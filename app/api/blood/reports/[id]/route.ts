import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

import { createSupabaseAdmin } from '@/lib/blood/supabaseServer'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createSupabaseAdmin()

  const { data: report, error } = await admin.from('reports').select('*').eq('id', id).single()
  if (error || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  const { data: patient } = report.patient_id
    ? await admin.from('patients').select('id, name').eq('id', report.patient_id).maybeSingle()
    : { data: null }

  let fileUrl: string | null = null
  if (report.pdf_path) {
    const { data: signed } = await admin.storage.from('blood-reports').createSignedUrl(report.pdf_path, 60 * 60)
    fileUrl = signed?.signedUrl ?? null
  }

  return NextResponse.json({ report, patient, fileUrl })
}
