import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Public — same trust model as /checkins (the shareable, no-login patient
// dashboard reads/writes this). Water/energy/mood are just a few small
// values per real calendar date, so they live in guide_overrides.daily_metrics
// on the roadmap row itself rather than a new table — a safe read-merge-write
// on the same JSONB column the coach's own "Save changes" already patches.
export async function POST(req: NextRequest, { params }: { params: Promise<{ roadmapId: string }> }) {
  const { roadmapId } = await params
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
  const dailyMetrics: Record<string, { water?: number; energy?: number; mood?: string }> = { ...(overrides.daily_metrics ?? {}) }
  const entry = { ...(dailyMetrics[date] ?? {}) }
  if (body.water !== undefined) entry.water = Number(body.water)
  if (body.energy !== undefined) entry.energy = Number(body.energy)
  if (body.mood !== undefined) entry.mood = String(body.mood).slice(0, 200)
  dailyMetrics[date] = entry

  const { error } = await supabaseAdmin
    .from('roadmaps')
    .update({ guide_overrides: { ...overrides, daily_metrics: dailyMetrics } })
    .eq('id', roadmapId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ date, entry })
}
