import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabase'

// Hands the browser a one-shot signed URL so the file goes straight to
// Supabase Storage instead of through this app.
//
// Why: a serverless request body is capped at 4.5MB on Vercel, so posting the
// file to /api/patients/[id]/reports 413'd before any of our code ran — the
// coach saw "File size exceeds maximum upload limit" (or a network error) on a
// 6.3MB report even though the UI promised 15MB. Storage has no such cap.
//
// Gated like every other /api route (see lib/auth/middleware.ts); the signed
// URL it returns is single-use, expires on its own, and is scoped to one path
// inside the patient's own folder.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params
  const body = await req.json().catch(() => null)
  const fileName = typeof body?.file_name === 'string' ? body.file_name : ''
  if (!fileName.trim()) return NextResponse.json({ error: 'File name is required' }, { status: 400 })

  const { data: patient } = await supabaseAdmin.from('patients').select('id').eq('id', patientId).single()
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  // Extension only — never the coach's own file name, which can carry path
  // separators and would let an upload escape the patient's folder.
  const ext = (fileName.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin'
  const path = `${patientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { data, error } = await supabaseAdmin.storage.from('patient-reports').createSignedUploadUrl(path)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ path, signed_url: data.signedUrl, token: data.token })
}
