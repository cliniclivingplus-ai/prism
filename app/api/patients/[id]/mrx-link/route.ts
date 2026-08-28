import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { supabaseMrx } from '@/lib/supabase'
import { parsePrescriptionRow } from '@/lib/mrxPrescription'

// Two ways to find this patient's reports, tried in order:
//
// 1. The unambiguous path: mrx.reports.clp_patient_id, the same direct hub
//    foreign key lib/clinical/patient.ts already trusts as authoritative
//    (set on every report uploaded via ?patient=<hub id> since v35). This
//    tab used to skip this entirely and only ever do #2 below, so a report
//    correctly linked by id still showed "0 reports" here — the hub
//    workspace and this tab disagreed about the same patient.
// 2. Legacy fallback: match by the linked mrx.patients row's own name.
//    Pre-v35 reports have no patient_id and identify their patient by
//    patient_name text only, so this is still needed for older data.
async function fetchLinkedPatient(hubPatientId: string, mrxPatientId: string) {
  const { data: patient } = await supabaseMrx.from('patients').select('id, name, age_sex, complaint, diet_type').eq('id', mrxPatientId).maybeSingle()
  if (!patient) return { patient: null, reportCount: 0, prescription: null }

  const { data: hubReports } = await supabaseMrx.from('reports').select('id').eq('clp_patient_id', hubPatientId)
  let reportIds = (hubReports ?? []).map((r) => r.id)

  if (reportIds.length === 0) {
    const { data: reports } = await supabaseMrx.from('reports').select('id').ilike('patient_name', patient.name)
    reportIds = (reports ?? []).map((r) => r.id)
  }

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
    // No explicit link yet — if this LP patient has a Clinicea ID and a
    // MicrobiomeRX patient with that same Clinicea ID exists (only possible
    // for reports uploaded after MicrobiomeRX started collecting Clinicea ID
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
          const { patient, reportCount, prescription } = await fetchLinkedPatient(id, newLink.mrx_patient_id)
          return NextResponse.json({ linked: { linkId: newLink.id, linkedAt: newLink.linked_at, patient, reportCount, prescription, autoLinked: true } })
        }
      }
    }
    return NextResponse.json({ linked: null })
  }

  const { patient, reportCount, prescription } = await fetchLinkedPatient(id, link.mrx_patient_id)
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

  const { patient, reportCount, prescription } = await fetchLinkedPatient(id, mrxPatientId)
  return NextResponse.json({ linked: { linkId: data.id, linkedAt: data.linked_at, patient, reportCount, prescription } })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseAdmin.from('mrx_patient_links').delete().eq('clp_patient_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ unlinked: true })
}
