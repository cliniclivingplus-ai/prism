import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

import { createSupabaseAdmin } from '@/lib/blood/supabaseServer'

// Creates a patient account keyed by a real, clinic-assigned Clinic ID —
// the actual uniqueness guarantee lives on the DB column
// (blood_patients_clinic_id_unique, migration_v31), this route just turns
// that constraint violation into a clean message instead of a raw
// Postgres error. Two patients can share a name; they can never share a
// Clinic ID, which is what report uploads now key off of instead of a
// typed/matched name.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const clinicId = typeof body.clinic_id === 'string' ? body.clinic_id.trim() : ''

    if (!name) return NextResponse.json({ error: 'Patient name is required' }, { status: 400 })
    if (!clinicId) return NextResponse.json({ error: 'Clinic ID is required' }, { status: 400 })

    const admin = createSupabaseAdmin()
    const { data: patient, error } = await admin
      .from('patients')
      .insert({ name, clinic_id: clinicId })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `Clinic ID "${clinicId}" is already in use by another patient.` }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ patient })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not create patient' }, { status: 500 })
  }
}
