import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import Groq from 'groq-sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { embedText } from '@/lib/embeddings'
import { BLOCK_TYPES, BLOCK_ICON_KEYS, validateBlock } from '@/lib/blocks/types'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get('patient_id')
  if (!patientId) return NextResponse.json({ error: 'patient_id is required' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('consultation_checklists')
    .select('id, title, condition_goal, status, created_at, updated_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// KB grounding — same vector-search-first, keyword-fallback pattern as
// /api/compass/interpret and /api/compass/qa-chat, kept self-contained here rather than
// pulled into a shared helper so this route doesn't risk regressing either
// of those (both are already carefully tuned for Groq's free-tier TPM cap).
async function searchKB(queryText: string): Promise<{ kbContext: string; kbSources: { title: string; source_type: string }[] }> {
  try {
    const embedding = await embedText(queryText.slice(0, 512))
    let chunks: { content: string; document_id: string }[] = []
    if (embedding && embedding.length === 384) {
      const { data } = await supabaseAdmin.rpc('match_kb_chunks', { query_embedding: embedding, match_threshold: 0.3, match_count: 8 })
      if (data?.length) chunks = data
    }
    if (!chunks.length) {
      const keywords = [...new Set(queryText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 4))].slice(0, 2)
      if (keywords.length >= 2) {
        const { data } = await supabaseAdmin.from('kb_chunks').select('content, document_id').textSearch('content', keywords.join(' '), { type: 'plain', config: 'english' }).limit(8)
        if (data?.length) chunks = data
      }
    }
    if (!chunks.length) return { kbContext: '', kbSources: [] }
    const docIds = [...new Set(chunks.map((c) => c.document_id))]
    const { data: docs } = await supabaseAdmin.from('kb_documents').select('id, title, source_type').in('id', docIds)
    const docMap = Object.fromEntries((docs ?? []).map((d: { id: string; title: string; source_type: string }) => [d.id, d]))
    return {
      kbContext: chunks.map((c, i) => `[KB ${i + 1}]: ${c.content.slice(0, 350)}`).join('\n\n'),
      kbSources: docIds.map((id) => ({ title: docMap[id]?.title ?? 'Unknown', source_type: docMap[id]?.source_type ?? 'unknown' })),
    }
  } catch (err) {
    console.error('checklist KB search error:', err)
    return { kbContext: '', kbSources: [] }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { patient_id, session_id, condition_goal, recipe_ids = [], image_ids = [], style = 'standard' } = body
    const pictorial = style === 'pictorial'
    if (!patient_id || typeof condition_goal !== 'string' || !condition_goal.trim()) {
      return NextResponse.json({ error: 'patient_id and condition_goal are required' }, { status: 400 })
    }

    const { data: patient } = await supabaseAdmin.from('patients').select('full_name').eq('id', patient_id).single()
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    const [{ data: recipes }, { data: images }] = await Promise.all([
      recipe_ids.length ? supabaseAdmin.from('recipe_bank').select('id, name, meal_type, tags').in('id', recipe_ids) : Promise.resolve({ data: [] as { id: string; name: string; meal_type: string; tags: string[] }[] }),
      image_ids.length ? supabaseAdmin.from('guide_images').select('id, label, tags').in('id', image_ids) : Promise.resolve({ data: [] as { id: string; label: string; tags: string[] }[] }),
    ])
    const allowedRecipeIds = new Set((recipes ?? []).map((r) => r.id))
    const allowedImageIds = new Set((images ?? []).map((im) => im.id))

    const { kbContext, kbSources } = await searchKB(condition_goal)

    const recipesBlock = (recipes ?? []).length
      ? (recipes ?? []).map((r) => `- id: ${r.id} | name: "${r.name}" | meal_type: ${r.meal_type} | tags: ${(r.tags || []).join(', ')}`).join('\n')
      : 'None picked.'
    const imagesBlock = (images ?? []).length
      ? (images ?? []).map((im) => `- id: ${im.id} | label: "${im.label}" | tags: ${(im.tags || []).join(', ')}`).join('\n')
      : 'None picked.'

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      temperature: 0.3,
      max_tokens: 2200,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' as const },
      messages: [
        {
          role: 'system',
          content: `You are a functional-medicine nutritionist at Living Plus, designing a SINGLE-CONSULTATION goal checklist page for "${patient.full_name}" — not a multi-month roadmap, just what matters for the next consultation.

You must decide the page's own sections, headings, and which visualization fits each piece of content — but you can ONLY use these block types, nothing else:
${BLOCK_TYPES.map((t) => `- ${t}`).join('\n')}

Block shapes (return exactly these fields per type, extra fields are ignored):
- hero: {type, title, subtitle?}
- stat_row: {type, title?, items:[{label, value, icon?}]} — icon is one of: ${BLOCK_ICON_KEYS.join(', ')}
- pull_quote: {type, text, attribution?} — a short, motivating goal statement
- checklist: {type, title?, items:[{text}]} — THE actual goal checklist for the patient, concrete and actionable
- icon_grid: {type, title?, items:[{icon?, topic, text}]} — icon from the same list above
- goal_icons: {type, title?, items:[{icon, label}]} — pictorial, near-wordless: icon is required (not optional), label is 2-4 words only, never a sentence
- recipe_gallery: {type, title?, recipe_ids:[...]} — recipe_ids MUST be a subset of the picked recipe ids listed below, never invented
- image_gallery: {type, title?, image_ids:[...]} — image_ids MUST be a subset of the picked image ids listed below, never invented
- chart: {type, title?, chartType: "bar"|"donut", data:[{label, value}]} — ONLY include a chart block if the condition/goal text below contains real, explicit numbers to plot. If there are no real numbers, do not include any chart block at all. Never invent a number.
- text_block: {type, title?, text}
- table: {type, title?, headers:[...], rows:[[...cells matching headers length]]} — only use for genuinely tabular data (e.g. a dosing schedule), never invented numbers/cells
- image: {type, image_id, caption?} — image_id MUST be one of the picked image ids listed below, never invented

HARD RULES:
- Never fabricate a clinical claim, lab value, or statistic that isn't in the condition/goal text or the knowledge base excerpts below.
- Never invent a recipe or image — only reference the exact ids given below.
- Keep it scoped to the next consultation, not a multi-month plan — no "month 1/2/3" or "week" language.
- Never use an em dash (—); use a comma, period, or "and" instead.
- Return STRICT JSON only: {"title": "...", "blocks": [...]}. 4 to 8 blocks, ordered sensibly (hero first).
${pictorial ? `
PICTORIAL MODE (requested by the coach): favor "goal_icons" over every other block wherever the content is a goal, habit, or focus area, one icon tile per goal, label only, no descriptive sentence. Use "checklist" only for the literal actionable to-do items, and keep each item a short phrase (3-6 words), not a sentence. Do NOT use "text_block" at all, and use "pull_quote" only if the condition/goal text itself contains a short quote-worthy line. Minimize every other block's wording; the page should read almost entirely through icons and short labels.` : ''}`,
        },
        {
          role: 'user',
          content: `Condition / what to treat / goal for this consultation (the coach's own words, ground truth):
${condition_goal.trim()}

Picked recipes (use only these ids in any recipe_gallery block):
${recipesBlock}

Picked images (use only these ids in any image_gallery block):
${imagesBlock}

Knowledge base excerpts (use for grounding, cite nothing not supported here or in the condition/goal text):
${kbContext || 'None found — do not state any clinical fact that needs a source.'}`,
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'
    let parsed: { title?: string; blocks?: unknown[] } = {}
    try {
      const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
      const match = clean.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(match ? match[0] : clean)
    } catch { parsed = {} }

    const blocks = (Array.isArray(parsed.blocks) ? parsed.blocks : [])
      .map((b) => validateBlock(b, allowedRecipeIds, allowedImageIds))
      .filter((b) => b !== null)

    if (blocks.length === 0) {
      return NextResponse.json({ error: 'Could not generate a valid page from this input. Try adding more detail to the condition/goal.' }, { status: 422 })
    }

    const { data: row, error: insertError } = await supabaseAdmin
      .from('consultation_checklists')
      .insert({
        patient_id, session_id: session_id || null,
        title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : null,
        condition_goal: condition_goal.trim(),
        recipe_ids: [...allowedRecipeIds], image_ids: [...allowedImageIds],
        blocks, kb_sources: kbSources, status: 'ready',
      })
      .select()
      .single()
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    return NextResponse.json(row)
  } catch (err) {
    console.error('checklist generation error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Generation failed' }, { status: 500 })
  }
}
