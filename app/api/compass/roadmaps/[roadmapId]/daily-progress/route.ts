import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// The coach-facing view of a patient's Daily Health Check-in history — the
// thing that didn't exist anywhere before this feature. Reads the
// item_id-keyed check-ins (week_number sentinel 0) plus the same
// guide_overrides.daily_metrics.mood used as the daily reflection note,
// grouped by real calendar date, most recent first.
//
// item_text_snapshot (captured at the moment the patient checked it) is what
// gets shown here, not the checklist's current wording — so this stays
// historically accurate even after a coach edits the checklist later.
export async function GET(_req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  const { roadmapId } = await params

  const [{ data: checkins, error }, { data: roadmap }] = await Promise.all([
    supabaseAdmin
      .from('roadmap_checkins')
      .select('checkin_date, item_id, item_text_snapshot')
      .eq('roadmap_id', roadmapId)
      .eq('week_number', 0)
      .not('item_id', 'is', null)
      .order('checkin_date', { ascending: false }),
    supabaseAdmin.from('roadmaps').select('guide_overrides').eq('id', roadmapId).single(),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const dailyMetrics: Record<string, { mood?: string }> = roadmap?.guide_overrides?.daily_metrics ?? {}

  const byDate = new Map<string, { item_id: string; text: string }[]>()
  for (const c of checkins ?? []) {
    if (!c.item_id) continue
    const list = byDate.get(c.checkin_date) ?? []
    list.push({ item_id: c.item_id, text: c.item_text_snapshot || '(item text not recorded)' })
    byDate.set(c.checkin_date, list)
  }
  // Union with mood-only dates too — a patient may log a reflection on a day
  // they didn't check off any task, and that day still belongs in the history.
  for (const date of Object.keys(dailyMetrics)) {
    if (dailyMetrics[date]?.mood && !byDate.has(date)) byDate.set(date, [])
  }

  const days = [...byDate.entries()]
    .map(([date, items]) => ({ date, items, mood: dailyMetrics[date]?.mood || null }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 30)

  return NextResponse.json({ days })
}
