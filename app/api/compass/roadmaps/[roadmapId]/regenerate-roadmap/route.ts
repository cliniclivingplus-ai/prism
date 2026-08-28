import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 280

// Coach-triggered "Regenerate roadmap" on the roadmap-goals ("Your
// roadmap") section — available in the DashboardClient editor next to the
// other regenerate controls, for every template (the coach always edits
// there regardless of which one is picked). A thin wrapper around
// /api/compass/interpret's existing refresh_roadmap_id path (the same one
// the interpret page's own "Refresh this plan" button uses) so this only
// needs a roadmapId from the client instead of also threading session_id
// through every template's props. Deliberately NOT auto-triggered on page
// view like the daily-content self-heal: this resets the roadmap's
// check-in history and regenerates 1-48 weeks of real clinical content, so
// it stays an explicit, confirmed coach action.
export async function POST(req: NextRequest, { params }: { params: Promise<{ roadmapId: string }> }) {
  const { roadmapId } = await params
  const { data: roadmap, error } = await supabaseAdmin
    .from('roadmaps')
    .select('session_id, patient_id, duration_months')
    .eq('id', roadmapId)
    .single()
  if (error || !roadmap) return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 })

  const cookie = req.headers.get('cookie') ?? ''
  const res = await fetch(new URL('/api/compass/interpret', req.nextUrl.origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      session_id: roadmap.session_id,
      patient_id: roadmap.patient_id,
      duration_months: roadmap.duration_months ?? 1,
      refresh_roadmap_id: roadmapId,
    }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) return NextResponse.json({ error: json?.error || 'Regeneration failed' }, { status: res.status })
  return NextResponse.json(json)
}
