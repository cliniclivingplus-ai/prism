import { supabaseAdmin } from '@/lib/supabase'
import { resolveConfirmedSupplements } from '@/lib/pdf/resolveConfirmedSupplements'
import { parseNutritionistGuidelines } from '@/lib/pdf/parseNutritionistGuidelines'
import { generateDailyContent } from '@/lib/pdf/generateDailyContent'
import { generateAIChecklist, buildDeterministicChecklist } from '@/lib/dailyChecklist'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

type RoadmapRow = {
  id: string
  patient_id: string
  overview: string | null
  nutritionist_guidelines: string | null
  guide_overrides: Record<string, unknown> | null
}

// Self-heal for a roadmap that predates meal_guidelines/daily_schedule/AI
// checklist generation (or one whose generation call failed at the time) —
// called once, server-side, the first time such a roadmap is actually
// viewed (share page or coach editor). Those roadmaps fall back to
// long-form legacy text (the full "Diet protocol" clinical bullets, the
// raw pre-Step-3B lifestyle_guidelines) in place of the short, Week-style
// "under 8 words" content — the deterministic checklist fallback in
// particular truncates at 80 characters, multiple lines long next to the
// AI checklist's one-liners. Regenerating with the exact same prompts a
// fresh roadmap uses (lib/pdf/generateDailyContent.ts,
// lib/dailyChecklist.ts's AI pass) and persisting the result means an
// older roadmap ends up looking exactly like a freshly generated one,
// permanently, after this one-time call — every later view reads the
// persisted columns directly, no repeated AI cost.
//
// Only triggers when ALL THREE of daily_lifestyle_guidelines/meal_guidelines/
// daily_schedule are absent from guide_overrides — a roadmap the coach has
// already edited (even one field) is left alone, since that's real,
// intentional coach content this must never overwrite.
export async function ensureDailyContent(roadmap: RoadmapRow): Promise<void> {
  const overrides = roadmap.guide_overrides ?? {}
  const hasAnyOverride =
    'daily_lifestyle_guidelines' in overrides || 'meal_guidelines' in overrides || 'daily_schedule' in overrides
  if (hasAnyOverride) return

  const patientFacts = [
    roadmap.overview ?? '',
    (() => {
      const parsed = parseNutritionistGuidelines(roadmap.nutritionist_guidelines ?? '')
      return parsed.dietProtocol.length > 0 ? `Diet protocol:\n${parsed.dietProtocol.join('\n')}` : ''
    })(),
  ].filter(Boolean).join('\n\n')
  if (!patientFacts.trim()) return

  try {
    const confirmedSupplements = await resolveConfirmedSupplements(roadmap.patient_id)
    const supplementsForPrompt = [
      ...confirmedSupplements.map((s) => `${s.name}${s.dose ? ` — ${s.dose}` : ''}${s.timing ? `, ${s.timing}` : ''}`),
    ]
    const fullFacts = supplementsForPrompt.length > 0
      ? `${patientFacts}\n\nConfirmed supplements:\n${supplementsForPrompt.join('\n')}`
      : patientFacts

    const { lifestyle_guidelines, meal_guidelines, daily_schedule } = await generateDailyContent(groq, fullFacts, '')

    // Backfill the AI checklist too, same trigger — same long-vs-short
    // mismatch as above, and it reads lifestyle_guidelines as one of its
    // two real sources, so regenerate it from the freshly generated short
    // version rather than leaving it built from the old long one.
    let daily_checklist_items = (overrides as { daily_checklist_items?: unknown }).daily_checklist_items
    if (!Array.isArray(daily_checklist_items) || daily_checklist_items.length === 0) {
      const aiItems = await generateAIChecklist(confirmedSupplements, lifestyle_guidelines)
      daily_checklist_items = aiItems.length > 0 ? aiItems : buildDeterministicChecklist(confirmedSupplements, lifestyle_guidelines)
    }

    await supabaseAdmin
      .from('roadmaps')
      .update({
        guide_overrides: {
          ...overrides,
          daily_lifestyle_guidelines: lifestyle_guidelines,
          meal_guidelines,
          daily_schedule,
          daily_checklist_items,
        },
      })
      .eq('id', roadmap.id)

    // Mutate the in-memory row too, so the caller's buildGuideData() call
    // right after this one sees the fresh content without a second fetch.
    roadmap.guide_overrides = {
      ...overrides,
      daily_lifestyle_guidelines: lifestyle_guidelines,
      meal_guidelines,
      daily_schedule,
      daily_checklist_items,
    }
  } catch {
    // Best-effort — a failed backfill just leaves the existing (long-form
    // fallback) content in place for this view; the next view tries again.
  }
}
