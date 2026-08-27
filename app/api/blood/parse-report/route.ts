import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { createSupabaseAdmin } from '@/lib/blood/supabaseServer'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractMarkers } from '@/lib/blood/extractMarkers'

// Extraction (including OCR for scanned reports) happens entirely in the
// browser now — see lib/extractReport.ts. This route only ever receives
// the already-extracted text, never page images: a real multi-page scan
// rendered to OCR-quality images is tens of MB, well past Vercel's 4.5MB
// serverless request-body limit, which is exactly what broke on some of
// the coach's own real 28-43 page sample reports.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const patientId = form.get('patient_id')
    const text = form.get('text')
    const file = form.get('file')

    if (typeof patientId !== 'string' || !patientId.trim()) {
      return NextResponse.json({ error: 'patient_id is required' }, { status: 400 })
    }
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'No text extracted from this report' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    const rawText = text

    const admin = createSupabaseAdmin()

    // Every upload must target an explicit, already-created patient
    // account (Clinic ID is what makes that account unique) — never a
    // typed/matched name, which previously risked two same-named patients
    // getting their reports mixed together.
    const { data: patient } = await admin.from('patients').select('id').eq('id', patientId).maybeSingle()
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    // Store the original file (best-effort — a storage failure shouldn't
    // block the analysis itself).
    const ext = file.name.split('.').pop() || 'bin'
    const path = `${patientId}/${Date.now()}.${ext}`
    const fileBuffer = await file.arrayBuffer()
    const { error: storageError } = await admin.storage.from('blood-reports').upload(path, fileBuffer, { contentType: file.type, upsert: false })
    const pdfPath = storageError ? null : path

    // Hub foreign key. blood.reports.patient_id already points at the tool's
    // own row (uploads were never name-matched here), but the workspace needs
    // a key straight back to the hub record — the same rule v35 introduced for
    // mrx.reports. Resolved id -> id through the link table; never by name,
    // and left null rather than guessed when this patient isn't linked yet.
    const hub = createAdminClient('compass')
    const { data: link } = await hub
      .from('blood_patient_links')
      .select('clp_patient_id')
      .eq('blood_patient_id', patientId)
      .maybeSingle()
    const clpPatientId = (link?.clp_patient_id as string | undefined) ?? null

    const markers = await extractMarkers(rawText)
    if (markers.length === 0) {
      return NextResponse.json({ error: 'No test results could be extracted from this report.' }, { status: 422 })
    }

    const { data: report, error: insertError } = await admin
      .from('reports')
      .insert({
        patient_id: patientId,
        clp_patient_id: clpPatientId,
        pdf_filename: file.name,
        pdf_path: pdfPath,
        raw_text: rawText,
        markers,
      })
      .select()
      .single()
    if (insertError) {
      if (insertError.code === 'PGRST204' || /column .* does not exist/i.test(insertError.message)) {
        return NextResponse.json(
          { error: 'Blood uploads need migration_v36_blood_hub_fk.sql to be run first (it adds blood.reports.clp_patient_id).' },
          { status: 503 }
        )
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ report })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Extraction failed' }, { status: 500 })
  }
}
