import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'mrx' } }
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const doctor_id = searchParams.get('doctor_id')

  if (!doctor_id) {
    return NextResponse.json(
      { error: 'doctor_id is required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('prescriptions')
    .select('*, patients(name, age_sex, complaint)')
    .eq('doctor_id', doctor_id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ prescriptions: data })
}
