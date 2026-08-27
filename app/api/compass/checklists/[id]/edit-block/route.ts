import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

import Groq from 'groq-sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { BLOCK_TYPES, BLOCK_ICON_KEYS, validateBlock, type ChecklistPageBlock } from '@/lib/blocks/types'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// The floating AI command box's backend — edits exactly ONE block in place
// from a natural-language instruction, never touches any other block on
// the page. Same block-palette constraint and anti-fabrication rules as
// generation (src/app/api/compass/checklists/route.ts).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { block_id, instruction } = body
    if (typeof block_id !== 'string' || !block_id) return NextResponse.json({ error: 'block_id is required' }, { status: 400 })
    if (typeof instruction !== 'string' || !instruction.trim()) return NextResponse.json({ error: 'instruction is required' }, { status: 400 })

    const { data: row, error: fetchError } = await supabaseAdmin.from('consultation_checklists').select('blocks, recipe_ids, image_ids, condition_goal').eq('id', id).single()
    if (fetchError || !row) return NextResponse.json({ error: fetchError?.message || 'Not found' }, { status: 404 })

    const blocks = (row.blocks || []) as ChecklistPageBlock[]
    const targetIndex = blocks.findIndex((b) => b.id === block_id)
    if (targetIndex === -1) return NextResponse.json({ error: 'Block not found' }, { status: 404 })
    const target = blocks[targetIndex]

    const allowedRecipeIds = new Set<string>(row.recipe_ids || [])
    const allowedImageIds = new Set<string>(row.image_ids || [])

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      temperature: 0.3,
      max_tokens: 900,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' as const },
      messages: [
        {
          role: 'system',
          content: `You edit exactly ONE block of a patient consultation-checklist page per a coach's instruction. Return the FULL updated block as strict JSON, same shape rules as below — you may change its "type" too if the instruction asks for a different visualization (e.g. "make this a chart"), but it must still be one of these types:
${BLOCK_TYPES.map((t) => `- ${t}`).join('\n')}

Block shapes (same as generation):
- hero: {id, type, title, subtitle?}
- stat_row: {id, type, title?, items:[{label, value, icon?}]} — icon from: ${BLOCK_ICON_KEYS.join(', ')}
- pull_quote: {id, type, text, attribution?}
- checklist: {id, type, title?, items:[{text}]}
- icon_grid: {id, type, title?, items:[{icon?, topic, text}]}
- goal_icons: {id, type, title?, items:[{icon, label}]} — pictorial, near-wordless: icon required, label is 2-4 words only, no sentence
- recipe_gallery: {id, type, title?, recipe_ids:[...]} — MUST only use ids from: ${[...allowedRecipeIds].join(', ') || 'none available'}
- image_gallery: {id, type, title?, image_ids:[...]} — MUST only use ids from: ${[...allowedImageIds].join(', ') || 'none available'}
- chart: {id, type, title?, chartType: "bar"|"donut", data:[{label, value}]} — only use numbers that are already present in this block, the patient's condition/goal text, or the coach's instruction itself. Never invent a number.
- text_block: {id, type, title?, text}
- table: {id, type, title?, headers:[...], rows:[[...cells matching headers length]]}
- image: {id, type, image_id, caption?} — image_id MUST be one of: ${[...allowedImageIds].join(', ') || 'none available'}

HARD RULES: never fabricate a clinical claim or number not already grounded in the block, the condition/goal text, or the instruction. Keep the same "id" field: "${target.id}". Never use an em dash (—); use a comma, period, or "and" instead. Return STRICT JSON only: {"block": {...}}.`,
        },
        {
          role: 'user',
          content: `Patient's condition/goal for this consultation (context only, do not restate unless relevant):
${row.condition_goal}

Current block:
${JSON.stringify(target)}

Coach's instruction:
${instruction.trim()}`,
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'
    let parsed: { block?: unknown } = {}
    try {
      const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
      const match = clean.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(match ? match[0] : clean)
    } catch { parsed = {} }

    const updated = validateBlock(parsed.block, allowedRecipeIds, allowedImageIds)
    if (!updated) return NextResponse.json({ error: "Could not apply that edit, try rephrasing the instruction." }, { status: 422 })
    // Preserve the original block's id regardless of what the model returned.
    const finalBlock = { ...updated, id: target.id } as ChecklistPageBlock

    const nextBlocks = [...blocks]
    nextBlocks[targetIndex] = finalBlock
    const { error: updateError } = await supabaseAdmin.from('consultation_checklists').update({ blocks: nextBlocks, updated_at: new Date().toISOString() }).eq('id', id)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ block: finalBlock })
  } catch (err) {
    console.error('checklist edit-block error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Edit failed' }, { status: 500 })
  }
}
