import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patient_id')
  let query = supabaseAdmin.from('sessions').select('*').order('session_date', { ascending: false })
  if (patientId) query = query.eq('patient_id', patientId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .insert({ ...body, status: 'pending' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update status if notes were added
  if (body.pre_meeting_notes || body.gemini_doc_raw || body.post_meeting_notes) {
    await supabaseAdmin.from('sessions').update({ status: 'notes-added' }).eq('id', data.id)
  }

  return NextResponse.json(data, { status: 201 })
}
