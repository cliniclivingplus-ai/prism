import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { supabaseMrx } from '@/lib/supabase'
import { parsePrescriptionRow } from '@/lib/mrxPrescription'

// MicrobiomeRX's own `reports.patient_id` is null on every existing row —
// reports (and, through report_id, prescriptions) only carry the patient's
// name as free text, never a real link to `mrx.patients.id`. So a linked
// patient's actual reports/prescriptions have to be found by matching that
// name, not by the id the coach picked when searching/linking. (MicrobiomeRX
// is expected to add a real patient id at upload time later, at which point
// this can switch to an id join with a name-based fallback — not yet.)
async function fetchLinkedPatient(mrxPatientId: string) {
  const { data: patient } = await supabaseMrx.from('patients').select('id, name, age_sex, complaint, diet_type').eq('id', mrxPatientId).maybeSingle()
  if (!patient) return { patient: null, reportCount: 0, prescription: null }

  const { data: reports } = await supabaseMrx.from('reports').select('id').ilike('patient_name', patient.name)
  const reportIds = (reports ?? []).map((r) => r.id)

  let prescription = null
  if (reportIds.length > 0) {
    const { data: rxRow } = await supabaseMrx
      .from('prescriptions')
      .select('approved_at, rx_data')
      .in('report_id', reportIds)
      .not('approved_at', 'is', null)
      .order('approved_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    prescription = parsePrescriptionRow(rxRow)
  }

  return { patient, reportCount: reportIds.length, prescription }
}

// A LP Compass patient links to at most one MicrobiomeRX patient record —
// MicrobiomeRX already handles multiple gut reports per patient over time
// under the same patients row, so there's no need for more than one link
// here. mrx_patient_links lives in `public` (CDB's own bridge table); the
// MicrobiomeRX patient/report data it points to lives in the `mrx` schema,
// a separate client — so linked patient details are fetched as a second
// query rather than a PostgREST embed, since `patients` exists (as a
// different, unrelated table) in `public` too and an embed hint can't
// safely disambiguate across schemas.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: link, error } = await supabaseAdmin
    .from('mrx_patient_links')
    .select('id, mrx_patient_id, linked_at')
    .eq('clp_patient_id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!link) {
    // No explicit link yet — if this LP patient has a Clinic ID and a
    // MicrobiomeRX patient with that same Clinic ID exists (only possible
    // for reports uploaded after MicrobiomeRX started collecting Clinic ID
    // at upload time), link them automatically instead of making the coach
    // search by name. Falls through to "not linked" otherwise.
    const { data: clpPatient } = await supabaseAdmin.from('patients').select('clinic_patient_id').eq('id', id).maybeSingle()
    if (clpPatient?.clinic_patient_id) {
      const { data: match } = await supabaseMrx.from('patients').select('id').eq('clinic_id', clpPatient.clinic_patient_id).maybeSingle()
      if (match) {
        const { data: newLink, error: linkError } = await supabaseAdmin
          .from('mrx_patient_links')
          .insert({ clp_patient_id: id, mrx_patient_id: match.id })
          .select('id, mrx_patient_id, linked_at')
          .single()
        if (!linkError && newLink) {
          const { patient, reportCount, prescription } = await fetchLinkedPatient(newLink.mrx_patient_id)
          return NextResponse.json({ linked: { linkId: newLink.id, linkedAt: newLink.linked_at, patient, reportCount, prescription, autoLinked: true } })
        }
      }
    }
    return NextResponse.json({ linked: null })
  }

  const { patient, reportCount, prescription } = await fetchLinkedPatient(link.mrx_patient_id)
  return NextResponse.json({ linked: { linkId: link.id, linkedAt: link.linked_at, patient, reportCount, prescription } })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const mrxPatientId = body.mrx_patient_id
  if (typeof mrxPatientId !== 'string' || !mrxPatientId) return NextResponse.json({ error: 'mrx_patient_id is required' }, { status: 400 })

  // Replace-style: a patient links to one MicrobiomeRX record at a time,
  // so clear any existing link for this patient before setting the new one.
  await supabaseAdmin.from('mrx_patient_links').delete().eq('clp_patient_id', id)
  const { data, error } = await supabaseAdmin
    .from('mrx_patient_links')
    .insert({ clp_patient_id: id, mrx_patient_id: mrxPatientId })
    .select('id, mrx_patient_id, linked_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { patient, reportCount, prescription } = await fetchLinkedPatient(mrxPatientId)
  return NextResponse.json({ linked: { linkId: data.id, linkedAt: data.linked_at, patient, reportCount, prescription } })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseAdmin.from('mrx_patient_links').delete().eq('clp_patient_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ unlinked: true })
}
