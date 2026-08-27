import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveRoadmapId } from '@/lib/share/publicData'

export const dynamic = 'force-dynamic'

// Public, token-addressed. The patient ticks off a weekly action from their
// shared dashboard. Equivalent to the gated
// /api/compass/roadmaps/[roadmapId]/checkins, except the roadmap is named by
// its share_token, so a revoked link stops working immediately.
async function requireRoadmap(params: Promise<{ token: string }>) {
  const { token } = await params
  return resolveRoadmapId(token)
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const roadmapId = await requireRoadmap(params)
  if (!roadmapId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('roadmap_checkins')
    .select('week_number, action_index, checkin_date, item_id, item_text_snapshot')
    .eq('roadmap_id', roadmapId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const roadmapId = await requireRoadmap(params)
  if (!roadmapId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const weekNumber = Number(body.week_number)
  const checkinDate = String(body.date || '')
  // Daily Health Check-in items are identified by a stable item_id (see
  // lib/dailyChecklist.ts) instead of array position, so a coach editing or
  // reordering the checklist later never silently reattaches a patient's
  // historical tick to a different item. Weekly-goal check-ins (week_number
  // >= 1) are untouched and keep using action_index exactly as before.
  const itemId = typeof body.item_id === 'string' && body.item_id ? body.item_id : null
  const actionIndex = itemId ? null : Number(body.action_index)
  if (!Number.isFinite(weekNumber) || (!itemId && !Number.isFinite(actionIndex)) || !/^\d{4}-\d{2}-\d{2}$/.test(checkinDate)) {
    return NextResponse.json({ error: 'Missing or invalid week_number/item_id/action_index, or date' }, { status: 400 })
  }

  // Selects every matching row, not `.maybeSingle()`. maybeSingle() errors
  // when more than one row comes back, and that error used to be discarded —
  // so a duplicated check-in read as "not checked", took the insert branch,
  // and added yet another copy. The item could then never be un-ticked.
  // Reading the full set instead makes the toggle self-healing: duplicates
  // left over from before migration_v40 are all removed on the next tap.
  let existingQuery = supabaseAdmin
    .from('roadmap_checkins')
    .select('id')
    .eq('roadmap_id', roadmapId)
    .eq('week_number', weekNumber)
    .eq('checkin_date', checkinDate)
  existingQuery = itemId ? existingQuery.eq('item_id', itemId) : existingQuery.eq('action_index', actionIndex)
  const { data: existing, error: lookupError } = await existingQuery
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })

  if (existing && existing.length > 0) {
    const { error } = await supabaseAdmin.from('roadmap_checkins').delete().in('id', existing.map((r) => r.id))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ checked: false })
  }

  const itemTextSnapshot = itemId && typeof body.item_text === 'string' ? body.item_text.slice(0, 200) : null
  const { error } = await supabaseAdmin.from('roadmap_checkins').insert({
    roadmap_id: roadmapId, week_number: weekNumber, action_index: actionIndex, checkin_date: checkinDate,
    item_id: itemId, item_text_snapshot: itemTextSnapshot,
  })
  // 23505 = unique violation: the racing request won and the row now exists,
  // which is exactly the state this one wanted. Report it as checked rather
  // than failing the tap.
  if (error && error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ checked: true })
}
