import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { cleanPatientFields } from '@/lib/patients/patientFields'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin.from('patients').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  // Previously `.update(body)` — whatever JSON arrived went straight into
  // the row, so any caller could overwrite any column (id, created_at,
  // anything a later migration added). Same allowlist as POST /api/patients
  // (lib/patients/patientFields.ts) — everything else is dropped. Unlike
  // POST, an explicit empty value here is kept as NULL rather than skipped,
  // so a coach can actually clear a field (e.g. unassigning a coach sends
  // nutritionist_id: null).
  const row = cleanPatientFields(body)

  if ('age_years' in row && row.age_years !== null) {
    const age = Number(row.age_years)
    if (!Number.isInteger(age) || age < 0 || age > 129) {
      return NextResponse.json({ error: 'Age must be a whole number between 0 and 129.' }, { status: 400 })
    }
    row.age_years = age
  }
  if ('full_name' in row && row.full_name === null) {
    return NextResponse.json({ error: 'Patient name is required.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.from('patients').update(row).eq('id', id).select().single()
  if (error) {
    if (error.code === '23505' && error.message.includes('clinic_patient_id')) {
      return NextResponse.json({ error: `A patient with ID "${String(row.clinic_patient_id)}" already exists.` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// Permanent — sessions, roadmaps, roadmap_checkins, and patient_reports all
// cascade-delete via their own patients_id/roadmap_id foreign keys (see
// supabase/schema.sql + migration_v13/v15), so this one delete is enough to
// clean up everything for this patient, nothing orphaned left behind.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseAdmin.from('patients').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
