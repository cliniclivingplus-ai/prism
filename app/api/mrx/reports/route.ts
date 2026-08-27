import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Creates a MicrobiomeRx report row.
 *
 * Both upload paths (the /mrx/upload page and the UploadModal) used to insert
 * into mrx.reports straight from the browser. Two problems with that:
 *
 *   1. UploadModal set only `patient_name` — no patient_id at all. That is
 *      precisely how the 207 historical orphan rows came about, and it was
 *      still live in a second code path.
 *   2. Neither path wrote a foreign key to the *hub* patient record, so a
 *      report could still only be tied back to a person by matching a name.
 *
 * Linking now happens here, server-side, where both schemas are reachable:
 *   - `clp_patient_id` -> public.patients(id), the unambiguous hub FK
 *   - `patient_id`     -> mrx.patients(id), the tool's own row
 *   - a row in public.mrx_patient_links so the patient workspace resolves it
 *
 * Historical rows are untouched. Nothing here backfills or name-matches.
 */

type Body = {
  /** Hub patient id (public.patients.id). Optional but strongly preferred. */
  hubPatientId?: string | null
  clinicId?: string | null
  patientName: string
  patientAgeSex?: string | null
  pdfFilename?: string | null
  speciesList?: unknown
  speciesCount?: number | null
  reportData?: unknown
}

export async function POST(req: NextRequest) {
  const user = await requireUser()

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const patientName = (body.patientName ?? '').trim()
  if (!patientName) {
    return NextResponse.json({ error: 'Patient name is required.' }, { status: 400 })
  }

  const mrx = createAdminClient('mrx')
  const hub = createAdminClient('compass')

  let clpPatientId: string | null = null
  let mrxPatientId: string | null = null
  let clinicId = body.clinicId?.trim() || null

  if (body.hubPatientId) {
    // Resolve the hub record by id — never by name.
    const { data: hubPatient, error: hubErr } = await hub
      .from('patients')
      .select('id, full_name, clinic_patient_id')
      .eq('id', body.hubPatientId)
      .maybeSingle()

    if (hubErr) return NextResponse.json({ error: hubErr.message }, { status: 500 })
    if (!hubPatient) {
      return NextResponse.json({ error: 'Unknown patient.' }, { status: 404 })
    }

    clpPatientId = hubPatient.id as string
    clinicId = clinicId ?? ((hubPatient.clinic_patient_id as string | null) ?? null)

    // Reuse the mrx.patients row this hub patient is already linked to, so a
    // second upload for the same person doesn't create a duplicate.
    const { data: existingLink } = await hub
      .from('mrx_patient_links')
      .select('mrx_patient_id')
      .eq('clp_patient_id', clpPatientId)
      .maybeSingle()

    if (existingLink?.mrx_patient_id) {
      mrxPatientId = existingLink.mrx_patient_id as string
    } else {
      const { data: created, error: createErr } = await mrx
        .from('patients')
        .insert({
          doctor_id: user.id,
          name: (hubPatient.full_name as string | null) ?? patientName,
          age_sex: body.patientAgeSex?.trim() || null,
          clinic_id: clinicId,
        })
        .select('id')
        .single()

      if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })
      mrxPatientId = created.id as string

      const { error: linkErr } = await hub.from('mrx_patient_links').insert({
        clp_patient_id: clpPatientId,
        mrx_patient_id: mrxPatientId,
        linked_by: user.id,
      })
      // A unique-violation here means another upload linked it concurrently —
      // harmless, the link exists either way.
      if (linkErr && linkErr.code !== '23505') {
        return NextResponse.json({ error: linkErr.message }, { status: 500 })
      }
    }
  } else if (clinicId) {
    // No hub patient supplied (e.g. an upload started from inside the tool).
    // Fall back to the tool's own Clinic ID identity, which is still an id
    // rather than a name — but leaves clp_patient_id null.
    const { data: existing } = await mrx
      .from('patients')
      .select('id')
      .eq('clinic_id', clinicId)
      .maybeSingle()

    if (existing) {
      mrxPatientId = existing.id as string
    } else {
      const { data: created, error: createErr } = await mrx
        .from('patients')
        .insert({
          doctor_id: user.id,
          name: patientName,
          age_sex: body.patientAgeSex?.trim() || null,
          clinic_id: clinicId,
        })
        .select('id')
        .single()
      if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })
      mrxPatientId = created.id as string
    }
  }

  const { data, error } = await mrx
    .from('reports')
    .insert({
      doctor_id: user.id,
      patient_id: mrxPatientId,
      clp_patient_id: clpPatientId,
      clinic_id: clinicId,
      patient_name: patientName,
      patient_age_sex: body.patientAgeSex?.trim() || null,
      pdf_filename: body.pdfFilename ?? null,
      species_list: body.speciesList ?? null,
      species_count: body.speciesCount ?? null,
      report_data: body.reportData ?? null,
      nutrition_plan: null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === 'PGRST204' || /column .* does not exist/i.test(error.message)) {
      return NextResponse.json(
        {
          error:
            'Uploads need migration_v35_add_patient_and_hub_fk.sql to be run first ' +
            '(it adds mrx.reports.clp_patient_id).',
        },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    { id: data.id, clp_patient_id: clpPatientId, patient_id: mrxPatientId },
    { status: 201 }
  )
}
