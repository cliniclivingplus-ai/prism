import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Given a hub patient id, return the Blood Panel patient row that represents
 * them — reusing the linked row if there is one, otherwise creating it and the
 * blood_patient_links row together.
 *
 * This is what makes "linked by real id from the first upload" true for Blood
 * Panel. The workspace only knows the hub id; the tool's pages are keyed by
 * blood.patients.id. Resolving that here (id -> id, via the link table) means
 * no page ever has to match a patient by name, and blood.reports.clp_patient_id
 * is populated from the very first report rather than backfilled later.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser()

  let body: { hubPatientId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const hubPatientId = body.hubPatientId?.trim()
  if (!hubPatientId) {
    return NextResponse.json({ error: 'hubPatientId is required.' }, { status: 400 })
  }

  const hub = createAdminClient('compass')
  const blood = createAdminClient('blood')

  const { data: hubPatient, error: hubErr } = await hub
    .from('patients')
    .select('id, full_name, clinic_patient_id')
    .eq('id', hubPatientId)
    .maybeSingle()

  if (hubErr) return NextResponse.json({ error: hubErr.message }, { status: 500 })
  if (!hubPatient) return NextResponse.json({ error: 'Unknown patient.' }, { status: 404 })

  // Already linked? Reuse it — a second upload must not fork the record.
  const { data: existing } = await hub
    .from('blood_patient_links')
    .select('blood_patient_id')
    .eq('clp_patient_id', hubPatientId)
    .maybeSingle()

  if (existing?.blood_patient_id) {
    return NextResponse.json({ bloodPatientId: existing.blood_patient_id, created: false })
  }

  // blood.patients.clinic_id is NOT NULL, but most hub records have no Clinic
  // ID yet (8 of 68 at the time of writing), so it cannot simply be copied.
  //
  // Falling back to the hub patient's own uuid, prefixed so its provenance is
  // unmistakable. Deliberately NOT a generated MRN-shaped string: this value
  // surfaces in the tool's UI, and something that looks like a clinic-issued
  // MRN but isn't is exactly the kind of identifier that gets trusted later.
  // Identity itself never rests on this field — the hub FK does that.
  const clinicId = hubPatient.clinic_patient_id?.trim() || `hub-${hubPatientId}`

  const { data: created, error: createErr } = await blood
    .from('patients')
    .insert({
      doctor_id: user.id,
      name: hubPatient.full_name ?? 'Unnamed patient',
      clinic_id: clinicId,
    })
    .select('id')
    .single()

  if (createErr) {
    return NextResponse.json(
      { error: `Could not create the Blood Panel record: ${createErr.message}` },
      { status: 500 }
    )
  }

  const { error: linkErr } = await hub.from('blood_patient_links').insert({
    clp_patient_id: hubPatientId,
    blood_patient_id: created.id,
    linked_by: user.id,
  })
  // Unique violation = another request linked it first; harmless either way.
  if (linkErr && linkErr.code !== '23505') {
    return NextResponse.json({ error: linkErr.message }, { status: 500 })
  }

  return NextResponse.json({ bloodPatientId: created.id, created: true })
}
