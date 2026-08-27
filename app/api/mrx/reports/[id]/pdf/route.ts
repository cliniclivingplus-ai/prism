import { NextRequest, NextResponse } from 'next/server'
import {
  reportPdfDownloadPaths,
  reportPdfStoragePath,
} from '@/lib/mrx/reportPdf'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/mrx/supabaseServer'

const BUCKET = 'mrx-reports'

async function getAuthorizedReport(id: string) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('id, doctor_id, pdf_filename')
    .eq('id', id)
    .single()

  if (reportError || !report || report.doctor_id !== user.id) {
    return { error: NextResponse.json({ error: 'Report not found' }, { status: 404 }) }
  }

  return { report, user }
}

async function loadStoredPdf(id: string, pdfFilename?: string | null) {
  const admin = createSupabaseAdmin()
  const paths = reportPdfDownloadPaths(id, pdfFilename)

  for (const path of paths) {
    const { data: pdfBlob, error: storageError } = await admin.storage
      .from(BUCKET)
      .download(path)

    if (!storageError && pdfBlob) {
      return { pdfBlob, filename: pdfFilename || `${id}.pdf` }
    }
  }

  return null
}

/** Check whether the stored PDF exists (no response body). */
export async function HEAD(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthorizedReport(id)
  if ('error' in auth && auth.error) return auth.error

  const stored = await loadStoredPdf(id, auth.report.pdf_filename)
  if (!stored) {
    return new NextResponse(null, { status: 404 })
  }

  return new NextResponse(null, {
    status: 200,
    headers: { 'Content-Type': 'application/pdf' },
  })
}

/** Serve the stored PDF for in-browser viewing. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthorizedReport(id)
  if ('error' in auth && auth.error) return auth.error

  const stored = await loadStoredPdf(id, auth.report.pdf_filename)
  if (!stored) {
    return NextResponse.json(
      { error: 'PDF not found in storage. Please re-upload this report.' },
      { status: 404 }
    )
  }

  return new NextResponse(stored.pdfBlob, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${stored.filename}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

/** Save the uploaded PDF to Supabase Storage (server-side, service role). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthorizedReport(id)
  if ('error' in auth && auth.error) return auth.error

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is missing' },
      { status: 500 }
    )
  }

  const formData = await req.formData()
  const file = formData.get('file')

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'PDF file is required' }, { status: 400 })
  }

  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
  }

  const storagePath = reportPdfStoragePath(id)
  const admin = createSupabaseAdmin()

  const { error: storageError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (storageError) {
    console.error('[pdf upload]', storageError.message)
    return NextResponse.json(
      { error: `Storage upload failed: ${storageError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, path: storagePath })
}
