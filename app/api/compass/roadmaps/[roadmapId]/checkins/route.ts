import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'

// Public — this is read/written from the shareable, no-login patient
// dashboard, same trust model as the PDF download link.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ roadmapId: string }> }) {
  const { roadmapId } = await params
  const { data, error } = await supabaseAdmin
    .from('roadmap_checkins')
    .select('week_number, action_index, checkin_date, item_id, item_text_snapshot')
    .eq('roadmap_id', roadmapId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// Toggles a single check-in — inserts it if missing, deletes it if already
// checked. Returns the new checked state so the client can reconcile if two
// taps race. Daily Health Check-in items pass item_id (stable, see
// lib/dailyChecklist.ts) instead of action_index — see the share-route twin
// for why. Weekly-goal check-ins (week_number >= 1) are unaffected.
export async function POST(req: NextRequest, { params }: { params: Promise<{ roadmapId: string }> }) {
  const { roadmapId } = await params
  const body = await req.json()
  const weekNumber = Number(body.week_number)
  const checkinDate = String(body.date || '')
  const itemId = typeof body.item_id === 'string' && body.item_id ? body.item_id : null
  const actionIndex = itemId ? null : Number(body.action_index)
  if (!Number.isFinite(weekNumber) || (!itemId && !Number.isFinite(actionIndex)) || !/^\d{4}-\d{2}-\d{2}$/.test(checkinDate)) {
    return NextResponse.json({ error: 'Missing or invalid week_number/item_id/action_index, or date' }, { status: 400 })
  }

  let existingQuery = supabaseAdmin
    .from('roadmap_checkins')
    .select('id')
    .eq('roadmap_id', roadmapId)
    .eq('week_number', weekNumber)
    .eq('checkin_date', checkinDate)
  existingQuery = itemId ? existingQuery.eq('item_id', itemId) : existingQuery.eq('action_index', actionIndex)
  const { data: existing } = await existingQuery.maybeSingle()

  if (existing) {
    const { error } = await supabaseAdmin.from('roadmap_checkins').delete().eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ checked: false })
  }

  const itemTextSnapshot = itemId && typeof body.item_text === 'string' ? body.item_text.slice(0, 200) : null
  const { error } = await supabaseAdmin.from('roadmap_checkins').insert({
    roadmap_id: roadmapId, week_number: weekNumber, action_index: actionIndex, checkin_date: checkinDate,
    item_id: itemId, item_text_snapshot: itemTextSnapshot,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ checked: true })
}
