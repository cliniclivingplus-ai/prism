import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseMrx } from '@/lib/supabase'

// MicrobiomeRX patients have no email/phone/clinic id — name is the only
// searchable field a coach has to go on, so results also carry age/sex,
// complaint, and a report count to help tell same-named patients apart.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() || ''
  if (!q) return NextResponse.json([])

  const { data: candidates, error } = await supabaseMrx
    .from('patients')
    .select('id, name, age_sex, complaint, diet_type')
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(20)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!candidates?.length) return NextResponse.json([])

  const ids = candidates.map((c) => c.id)
  const { data: reports } = await supabaseMrx.from('reports').select('patient_id').in('patient_id', ids)
  const counts = new Map<string, number>()
  for (const r of reports ?? []) counts.set(r.patient_id, (counts.get(r.patient_id) ?? 0) + 1)

  return NextResponse.json(candidates.map((c) => ({ ...c, reportCount: counts.get(c.id) ?? 0 })))
}
