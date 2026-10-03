import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { supabaseAdmin } from '@/lib/supabase'
import { extractReportText, ScannedPdfError } from '@/lib/reports/extractText'
import { summarizeReportForPatient } from '@/lib/reports/summarizeReport'
import { extractSupplementsFromReport } from '@/lib/reports/extractSupplements'
import { stripUnsafeChars, sanitizeForDb } from '@/lib/sanitizeDbText'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('patient_reports')
    .select('*')
    .eq('patient_id', id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params

  // Two ways in:
  //  - JSON { storage_path, ... } — the file is already in Storage, put there
  //    by the browser with a signed URL (see ./upload-url). This is the path
  //    the UI uses, and the only one that works above ~4.5MB, since that's
  //    where a serverless request body is cut off on Vercel.
  //  - multipart form — kept for small files and any older caller.
  const isJson = (req.headers.get('content-type') || '').includes('application/json')

  let fileName = ''
  let fileType = ''
  let reportType = ''
  let storagePath = ''
  let buffer: ArrayBuffer

  if (isJson) {
    const body = await req.json().catch(() => null)
    fileName = typeof body?.file_name === 'string' ? body.file_name : ''
    fileType = typeof body?.file_type === 'string' ? body.file_type : ''
    reportType = typeof body?.report_type === 'string' ? body.report_type : ''
    storagePath = typeof body?.storage_path === 'string' ? body.storage_path : ''
    if (!storagePath || !fileName) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!reportType.trim()) return NextResponse.json({ error: 'Report type is required' }, { status: 400 })
    // The browser only ever gets a signed URL for a path inside this
    // patient's folder; re-check here so a handcrafted request can't read
    // another patient's file back out through this route.
    if (!storagePath.startsWith(`${patientId}/`)) return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })

    // Read back what the browser uploaded, so extraction runs on the same
    // bytes that were stored.
    const { data: blob, error: downloadError } = await supabaseAdmin.storage.from('patient-reports').download(storagePath)
    if (downloadError || !blob) return NextResponse.json({ error: downloadError?.message || 'Uploaded file not found' }, { status: 400 })
    buffer = await blob.arrayBuffer()
    if (!fileType) fileType = blob.type
  } else {
    const form = await req.formData()
    const file = form.get('file')
    const formType = form.get('report_type')
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (typeof formType !== 'string' || !formType.trim()) return NextResponse.json({ error: 'Report type is required' }, { status: 400 })
    fileName = file.name
    fileType = file.type
    reportType = formType
    buffer = await file.arrayBuffer()

    // Upload the original file first so it's preserved even if extraction fails.
    const ext = fileName.split('.').pop() || 'bin'
    storagePath = `${patientId}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('patient-reports')
      .upload(storagePath, buffer, { contentType: fileType, upsert: false })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: patient } = await supabaseAdmin.from('patients').select('full_name').eq('id', patientId).single()
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const { data: signedUrl } = await supabaseAdmin.storage.from('patient-reports').createSignedUrl(storagePath, 60 * 60 * 24 * 365)

  const { data: report, error: insertError } = await supabaseAdmin
    .from('patient_reports')
    .insert({
      patient_id: patientId,
      report_type: reportType.trim(),
      file_name: fileName,
      file_url: signedUrl?.signedUrl ?? null,
      status: 'processing',
    })
    .select()
    .single()
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  try {
    const rawText = stripUnsafeChars(await extractReportText(buffer, fileType))
    const [summary, supplements] = await Promise.all([
      summarizeReportForPatient(reportType.trim(), patient.full_name, rawText),
      extractSupplementsFromReport(rawText),
    ])
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('patient_reports')
      // supplements is a draft only — supplements_confirmed stays false
      // (its default) until a coach reviews and confirms it.
      .update({ raw_text: rawText, patient_summary: stripUnsafeChars(summary), supplements: sanitizeForDb(supplements), status: 'ready' })
      .eq('id', report.id)
      .select()
      .single()
    if (updateError) throw new Error(updateError.message)
    return NextResponse.json(updated)
  } catch (err) {
    const message = err instanceof ScannedPdfError ? err.message : err instanceof Error ? err.message : 'Extraction failed'
    await supabaseAdmin.from('patient_reports').update({ status: 'failed', error_message: message }).eq('id', report.id)
    return NextResponse.json({ error: message, report: { ...report, status: 'failed', error_message: message } }, { status: 422 })
  }
}
