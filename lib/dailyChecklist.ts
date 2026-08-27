import Groq from 'groq-sdk'

// Shared by buildGuideData.ts (deterministic fallback), interpret/route.ts
// (AI generation, Step 3E) + the coach's manual "Ask AI to regenerate"
// endpoint (app/api/compass/roadmaps/[roadmapId]/regenerate-checklist), and
// WeekTemplate.tsx (rendering/editing) — one definition of what a checklist
// item is and one generation prompt, so none of these drift apart.
//
// `id` is the whole point of this module existing: it's assigned once and
// never recomputed from position, so a coach editing/reordering/adding to
// the list never silently reattaches a patient's historical checkmark to a
// different item. `source` records which real data this item came from
// (never invented) — useful both for the "never fabricate" grounding
// discipline this app uses everywhere, and for a coach to see at a glance
// why a given item is on the list.
export type ChecklistItem = {
  id: string
  text: string
  source: 'supplement' | 'lifestyle' | 'coach'
}

// The deterministic floor — used when there's no AI-generated
// roadmaps.daily_checklist_items yet (an older roadmap, or a failed
// generation call) and no coach override. Same real-data grounding as the
// live-derived list this replaces (WeekTemplate's old inline `dailyChecklist`
// useMemo) — just given stable IDs instead of being recomputed by position
// on every render.
export function buildDeterministicChecklist(
  confirmedSupplements: { name: string; timing?: string | null }[],
  lifestyleGuidelines: string,
): ChecklistItem[] {
  const items: ChecklistItem[] = []
  confirmedSupplements.slice(0, 4).forEach((s, i) => {
    items.push({ id: `sup-${i}`, source: 'supplement', text: `Take ${s.name}${s.timing ? ` — ${s.timing}` : ''}` })
  })
  // Local, minimal bullet split — avoids importing periodBullets.ts's
  // Label-aware parseBullets here just for a plain line split, since this
  // fallback only needs "one bullet per line," not period grouping.
  const lifestyleLines = (lifestyleGuidelines || '')
    .split(/\n|(?=•)/)
    .map((s) => s.replace(/^[•\-\s]+/, '').trim())
    .filter(Boolean)
  lifestyleLines.slice(0, 4).forEach((line, i) => {
    // Strip a leading "Label: " prefix (Morning/Breakfast/etc.) if present —
    // the checklist reads as a plain to-do, not a time-of-day bucket.
    const text = line.replace(/^[A-Za-z]{2,12}:\s*/, '')
    items.push({ id: `life-${i}`, source: 'lifestyle', text: text.length > 80 ? text.slice(0, 77) + '…' : text })
  })
  return items.slice(0, 8)
}

// The AI pass — used at initial generation (Step 3E) and by the coach's
// manual "regenerate" action. Deliberately NOT asked to write anything new:
// its only job is to select and lightly rephrase from two already-real
// sources, the same "select from real data, never originate" discipline the
// grocery-list AI cleanup pass and Blood Panel's extraction both follow.
// Framed as everyday healthy-living habits, never a medical prescription —
// on any failure (network, bad JSON, empty response) this returns `[]`, and
// the caller is expected to fall back to buildDeterministicChecklist.
export async function generateAIChecklist(
  confirmedSupplements: { name: string; timing?: string | null }[],
  lifestyleGuidelines: string,
): Promise<ChecklistItem[]> {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const supplementLines = confirmedSupplements.slice(0, 6).map((s) => `${s.name}${s.timing ? ` (${s.timing})` : ''}`)
    const lifestyleLines = (lifestyleGuidelines || '').split('\n').map((l) => l.trim()).filter(Boolean)
    if (supplementLines.length === 0 && lifestyleLines.length === 0) return []

    const res = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      reasoning_effort: 'low',
      temperature: 0.2,
      max_tokens: 700,
      response_format: { type: 'json_object' as const },
      messages: [
        { role: 'system', content: 'You select and lightly rephrase items for a patient\'s daily healthy-living checklist. You may ONLY use items already given to you — never invent a new habit, supplement, or product. This is everyday lifestyle guidance, not a medical prescription: never state or imply a dose, mg amount, or medical instruction beyond what is already written in the given supplement line. Respond with strict JSON only: {"items": [{"text": "...", "source": "supplement"|"lifestyle"}]}' },
        { role: 'user', content: `CONFIRMED SUPPLEMENTS (source: "supplement" — name only, drop any dose/mg, keep timing if given):
${supplementLines.length > 0 ? supplementLines.join('\n') : 'None.'}

LIFESTYLE GUIDELINES (source: "lifestyle" — pick the clearest ones, drop the "Morning:"/"Breakfast:"-style label prefix):
${lifestyleLines.length > 0 ? lifestyleLines.join('\n') : 'None.'}

Produce up to 6 short checklist items total, phrased as a simple daily to-do ("Take magnesium in the evening", "10 minute walk after lunch"). Prefer covering both sources if both have content. Under 8 words each. No explanation, no numbering.` },
      ],
    })
    const raw = res.choices[0]?.message?.content?.trim()
    if (!raw) return []
    const parsed = JSON.parse(raw)
    const items = Array.isArray(parsed.items) ? parsed.items : []
    return items
      .filter((it: unknown): it is { text: string; source: string } =>
        !!it && typeof it === 'object' && typeof (it as Record<string, unknown>).text === 'string' && !!(it as Record<string, unknown>).text)
      .slice(0, 8)
      .map((it: { text: string; source: string }) => ({
        id: crypto.randomUUID(),
        text: it.text.trim(),
        source: (it.source === 'supplement' || it.source === 'lifestyle' ? it.source : 'lifestyle') as ChecklistItem['source'],
      }))
  } catch {
    return []
  }
}
