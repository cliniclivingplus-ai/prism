import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

import { createSupabaseAdmin } from '@/lib/blood/supabaseServer'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildMarkerTrends } from '@/lib/blood/patientTrends'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createSupabaseAdmin()

  const { data: patient, error } = await admin.from('patients').select('*').eq('id', id).single()
  if (error || !patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const { data: reports } = await admin
    .from('reports')
    .select('id, pdf_filename, markers, created_at')
    .eq('patient_id', id)
    .order('created_at', { ascending: false })

  const trends = buildMarkerTrends((reports ?? []).map((r) => ({ created_at: r.created_at, markers: r.markers })))

  const hub = createAdminClient('compass')
  const { data: link } = await hub
    .from('blood_patient_links')
    .select('clp_patient_id')
    .eq('blood_patient_id', id)
    .maybeSingle()

  const clpPatientId = link?.clp_patient_id ?? null

  return NextResponse.json({ patient, reports: reports ?? [], trends, clpPatientId })
}

