import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveConfirmedSupplements } from '@/lib/pdf/resolveConfirmedSupplements'
import { parseNutritionistGuidelines } from '@/lib/pdf/parseNutritionistGuidelines'
import { generateDailyContent } from '@/lib/pdf/generateDailyContent'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Coach-triggered "Regenerate" on the Daily Lifestyle Guidelines /
// Breakfast-Lunch-Dinner / Daily Schedule sections, for any template —
// available in the DashboardClient editor (the single editing surface for
// every template) regardless of which one the roadmap is showing.
//
// Exists because these three fields only started being generated at Step
// 3/3B/3C of interpret/route.ts once that pipeline existed; a roadmap
// created before then (overwhelmingly Classic/Almanac/Pulse/Onyx/Vitals in
// practice, since Week-family templates are newer) has them genuinely
// empty in the database, so those sections stay hidden — not a rendering
// bug, a real content gap. This backfills that gap using the exact same
// prompts a fresh generation uses (lib/pdf/generateDailyContent.ts), so an
// existing roadmap ends up indistinguishable in quality from one generated
// today, on any template.
//
// Grounded in this roadmap's OWN already-generated real content (overview +
// nutritionist guidelines' diet protocol + this patient's confirmed
// supplements) rather than re-deriving the original session Q&A/reports —
// same "regenerate from current state" principle regenerate-checklist
// already uses, not the original session inputs.
export async function POST(req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  const { roadmapId } = await params
  let bodyLifestyle = ''
  let bodyMeals = ''
  try {
    const body = await req.json()
    if (typeof body?.lifestyle_guidelines === 'string') bodyLifestyle = body.lifestyle_guidelines.trim()
    if (typeof body?.meal_guidelines === 'string') bodyMeals = body.meal_guidelines.trim()
  } catch {
    // optional JSON body
  }

  const { data: roadmap, error } = await supabaseAdmin
    .from('roadmaps')
    .select('patient_id, session_id, overview, nutritionist_guidelines, guide_overrides, lifestyle_guidelines, meal_guidelines, daily_schedule')
    .eq('id', roadmapId)
    .single()
  if (error || !roadmap) return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 })

  // Fetch session consultation notes & Q&A if linked
  const { data: session } = roadmap.session_id
    ? await supabaseAdmin
        .from('sessions')
        .select('gemini_doc_raw, qa_pairs, roadmap_instructions')
        .eq('id', roadmap.session_id)
        .maybeSingle()
    : { data: null }

  const qaPairs: { question: string; answer: string }[] = session?.qa_pairs ?? []
  const fullQA = qaPairs.map((qa, i) => `Q${i + 1}: ${qa.question}\nAnswer: ${qa.answer}`).join('\n\n')
  const geminiSnippet = session?.gemini_doc_raw?.slice(0, 1500) ?? ''

  const parsed = parseNutritionistGuidelines(roadmap.nutritionist_guidelines ?? '')
  const confirmedSupplements = await resolveConfirmedSupplements(roadmap.patient_id)

  const overrides = (roadmap.guide_overrides ?? {}) as Record<string, unknown>
  const existingLifestyle = bodyLifestyle || (overrides.daily_lifestyle_guidelines as string) || (roadmap.lifestyle_guidelines as string) || ''
  const existingMeals = bodyMeals || (overrides.meal_guidelines as string) || (roadmap.meal_guidelines as string) || ''

  const patientFacts = [
    geminiSnippet ? `CONSULTATION TRANSCRIPT / MEETING NOTES:\n${geminiSnippet}` : '',
    fullQA ? `CONSULTATION Q&A NOTES:\n${fullQA}` : '',
    roadmap.overview ? `PATIENT CASE OVERVIEW:\n${roadmap.overview}` : '',
    parsed.dietProtocol.length > 0 ? `Diet protocol:\n${parsed.dietProtocol.join('\n')}` : '',
    confirmedSupplements.length > 0
      ? `Confirmed supplements:\n${confirmedSupplements.map((s) => `${s.name}${s.dose ? ` — ${s.dose}` : ''}${s.timing ? `, ${s.timing}` : ''}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n\n')

  if (!patientFacts.trim()) {
    return NextResponse.json({ error: 'Not enough real content on this roadmap yet to ground a regeneration — this needs at least an overview or nutritionist guidelines.' }, { status: 422 })
  }

  const { lifestyle_guidelines, meal_guidelines, daily_schedule } = await generateDailyContent(
    patientFacts,
    '',
    existingLifestyle,
    existingMeals
  )

  const { error: updateError } = await supabaseAdmin
    .from('roadmaps')
    .update({
      guide_overrides: {
        ...(roadmap.guide_overrides ?? {}),
        daily_lifestyle_guidelines: lifestyle_guidelines,
        meal_guidelines,
        daily_schedule,
      },
    })
    .eq('id', roadmapId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ lifestyle_guidelines, meal_guidelines, daily_schedule })
}
