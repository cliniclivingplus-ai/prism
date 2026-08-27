import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveRoadmapId } from '@/lib/share/publicData'

export const dynamic = 'force-dynamic'

// Public, token-addressed. Water / energy / mood the patient logs against a
// calendar date, stored on roadmaps.guide_overrides.daily_metrics via a
// read-merge-write (same column the coach's "Save changes" patches).
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const roadmapId = await resolveRoadmapId(token)
  if (!roadmapId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const date = String(body.date || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Missing or invalid date' }, { status: 400 })
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('roadmaps')
    .select('guide_overrides')
    .eq('id', roadmapId)
    .single()
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  const overrides = existing?.guide_overrides ?? {}
  const dailyMetrics: Record<string, { water?: number; energy?: number; mood?: string }> = {
    ...(overrides.daily_metrics ?? {}),
  }
  const entry = { ...(dailyMetrics[date] ?? {}) }
  if (body.water !== undefined) entry.water = Number(body.water)
  if (body.energy !== undefined) entry.energy = Number(body.energy)
  if (body.mood !== undefined) entry.mood = String(body.mood)
  dailyMetrics[date] = entry

  const { error } = await supabaseAdmin
    .from('roadmaps')
    .update({ guide_overrides: { ...overrides, daily_metrics: dailyMetrics } })
    .eq('id', roadmapId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, date, entry })
}
