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
    const ocrUsed = form.get('ocr_used') === 'true'

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
    // account (Clinicea ID is what makes that account unique) — never a
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

    let markers
    try {
      markers = await extractMarkers(rawText)
    } catch (err) {
      // Distinguish a real Groq/API failure from genuinely finding nothing —
      // these used to look identical to the coach as "No test results could
      // be extracted", even when the cause was a rate limit and retrying
      // in a minute would have worked fine.
      const message = err instanceof Error ? err.message : String(err)
      const rateLimited = /rate_limit_exceeded|429/i.test(message)
      return NextResponse.json(
        {
          error: rateLimited
            ? 'The AI extraction service is temporarily rate-limited — wait a minute and try uploading again.'
            : `Extraction failed: ${message}`,
        },
        { status: rateLimited ? 429 : 502 }
      )
    }
    if (markers.length === 0) {
      // A real multi-row lab report's OCR text runs well past this even
      // when messy — a report this short after OCR almost always means the
      // scan/photo itself was too low-quality for OCR to read the table,
      // not that the model failed to recognise valid rows. Worth telling
      // the coach that distinction rather than leaving it as a flat "no
      // results found", which reads like the AI's fault either way.
      const looksLikeBadScan = ocrUsed && rawText.trim().length < 150
      return NextResponse.json(
        {
          error: looksLikeBadScan
            ? 'This looks like a scan or photo the OCR could barely read (very little text recognised). Try a clearer photo/scan, better lighting, or the original digital PDF if you have one.'
            : 'No test results could be extracted from this report.',
        },
        { status: 422 }
      )
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
