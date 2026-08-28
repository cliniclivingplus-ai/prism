import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

import { createSupabaseAdmin } from '@/lib/blood/supabaseServer'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // Hub-name mismatch check: this report is filed under `patient` (the
  // tool's own row) above, but if it's also linked to a hub account by
  // clp_patient_id, that hub patient's own name might read differently —
  // the earliest visible sign a coach picked the wrong patient at upload.
  let hubPatientName: string | null = null
  if (report.clp_patient_id) {
    const hub = createAdminClient('compass')
    const { data: hubPatient } = await hub.from('patients').select('full_name').eq('id', report.clp_patient_id).maybeSingle()
    hubPatientName = hubPatient?.full_name ?? null
  }

  return NextResponse.json({ report, patient, fileUrl, hubPatientName })
}
