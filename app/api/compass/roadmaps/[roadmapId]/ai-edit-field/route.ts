import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Generic "click a section, tell AI what to change" backend for the
// Classic roadmap editor (src/app/dashboard/[roadmapId]/DashboardClient.tsx)
// — sits alongside manual field editing, never replaces it. Each "kind"
// describes the exact shape of the one field being edited; the model must
// return that same shape back, nothing else, and a coach still has to
// click "Save changes" as usual before anything actually persists.
const KIND_SHAPES: Record<string, string> = {
  text: 'A plain string. If it looks like a bullet list (lines starting with "•"), preserve that format — one bullet per line.',
  week: '{"focus_theme": "string", "cause": "string, 2-3 sentences explaining the biochemical mechanism", "actions": ["string", "..."], "milestone": "string"}',
  care_team_member: '{"name": "string", "role": "string", "intro": "string", "date": "YYYY-MM-DD or empty string", "time": "HH:MM or empty string", "mode": "string"}',
  service: '{"name": "string", "icon": "string, one of: coaching, video, phone, chat, nutrition, labs, wellness, clinical, group, followup", "sessions": "string, e.g. \'4 sessions/month\'", "description": "string"}',
  power_point: '{"url": "string, a real URL", "note": "string, a short caption"}',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { kind, current_value, instruction, context } = body
    if (typeof kind !== 'string' || !KIND_SHAPES[kind]) return NextResponse.json({ error: 'Unknown field kind' }, { status: 400 })
    if (typeof instruction !== 'string' || !instruction.trim()) return NextResponse.json({ error: 'instruction is required' }, { status: 400 })

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      temperature: 0.3,
      max_tokens: 900,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' as const },
      messages: [
        {
          role: 'system',
          content: `You edit exactly one field of a patient's wellness plan per a coach's instruction. The field's shape is:
${KIND_SHAPES[kind]}

HARD RULES:
- Return the FULL updated value in that exact shape, nothing else added or removed.
- Never fabricate a clinical claim, fact, or number that isn't already present in the current value, the patient context below, or the instruction itself.
- Keep any real, specific detail from the current value that the instruction doesn't ask to change.
- Never use an em dash (—); use a comma, period, or "and" instead.
- Return STRICT JSON only: {"value": <the updated field, in the exact shape above>}.`,
        },
        {
          role: 'user',
          content: `${context ? `Patient context (for grounding only, do not restate unless relevant):\n${context}\n\n` : ''}Current value:
${JSON.stringify(current_value)}

Coach's instruction:
${instruction.trim()}`,
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'
    let parsed: { value?: unknown } = {}
    try {
      const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
      const match = clean.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(match ? match[0] : clean)
    } catch { parsed = {} }

    if (parsed.value === undefined || parsed.value === null) {
      return NextResponse.json({ error: 'Could not apply that edit, try rephrasing.' }, { status: 422 })
    }
    // Shape sanity-check per kind — reject rather than silently accept
    // something that doesn't match, so a bad model output never corrupts
    // the coach's draft.
    const v = parsed.value
    const ok = kind === 'text' ? typeof v === 'string'
      : kind === 'week' ? (typeof v === 'object' && v !== null && Array.isArray((v as Record<string, unknown>).actions))
      : (typeof v === 'object' && v !== null)
    if (!ok) return NextResponse.json({ error: 'AI returned an unexpected shape, try rephrasing.' }, { status: 422 })

    return NextResponse.json({ value: v })
  } catch (err) {
    console.error('ai-edit-field error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Edit failed' }, { status: 500 })
  }
}
