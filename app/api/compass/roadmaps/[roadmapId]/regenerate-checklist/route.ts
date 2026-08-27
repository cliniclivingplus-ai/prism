import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveConfirmedSupplements } from '@/lib/pdf/resolveConfirmedSupplements'
import { generateAIChecklist } from '@/lib/dailyChecklist'

export const dynamic = 'force-dynamic'

// Coach-triggered "Ask AI to regenerate" on the Daily Health Check-in
// section (WeekTemplate.tsx) — available any time, not gated to right after
// a supplement confirmation, since the confirm dialog in the UI already
// covers the real risk (overwriting a coach's manual edits). Same
// select-from-real-data generation as Step 3E in interpret/route.ts, reread
// against this patient's CURRENT confirmed supplements and lifestyle
// guidelines rather than what existed at initial roadmap generation.
export async function POST(_req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  const { roadmapId } = await params
  const { data: roadmap, error } = await supabaseAdmin
    .from('roadmaps')
    .select('patient_id, lifestyle_guidelines, guide_overrides')
    .eq('id', roadmapId)
    .single()
  if (error || !roadmap) return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 })

  const lifestyleGuidelines = roadmap.guide_overrides?.daily_lifestyle_guidelines ?? roadmap.lifestyle_guidelines ?? ''
  const confirmedSupplements = await resolveConfirmedSupplements(roadmap.patient_id)
  const items = await generateAIChecklist(confirmedSupplements, lifestyleGuidelines)
  if (items.length === 0) {
    return NextResponse.json({ error: 'Could not generate a checklist — no confirmed supplements or lifestyle guidelines to draw from yet.' }, { status: 422 })
  }

  const { error: updateError } = await supabaseAdmin
    .from('roadmaps')
    .update({ guide_overrides: { ...(roadmap.guide_overrides ?? {}), daily_checklist_items: items } })
    .eq('id', roadmapId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ items })
}
