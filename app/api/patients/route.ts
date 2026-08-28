import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('patients')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/**
 * Columns a client is allowed to set when creating a patient.
 *
 * This route previously did `.insert(body)` — whatever JSON arrived went
 * straight into the row, so any caller could set any column on the hub
 * patient record (including ids and columns added by later migrations).
 * Everything not on this list is now dropped.
 */
const WRITABLE = [
  'full_name',
  'clinic_patient_id',
  'gender',
  'date_of_birth',
  'age_years',
  'program',
  'primary_concern',
  'allergies',
  'medical_history',
  'phone',
  'email',
  'nutritionist_id',
] as const

type Writable = (typeof WRITABLE)[number]

function clean(body: Record<string, unknown>) {
  const row: Record<string, unknown> = {}
  for (const key of WRITABLE) {
    const v = body[key as Writable]
    if (v === undefined || v === null) continue
    if (typeof v === 'string') {
      const t = v.trim()
      // An empty field means "not recorded" — store NULL, not ''. It keeps
      // "unknown" and "recorded as blank" from looking identical later.
      if (t) row[key] = t
      continue
    }
    row[key] = v
  }
  return row
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const row = clean(body)
  // Not client-settable — this is the one insert path into public.patients,
  // so every row created here is by definition a deliberate hub patient,
  // not something a request body should be able to override.
  row.source = 'hub'

  if (!row.full_name) {
    return NextResponse.json({ error: 'Patient name is required.' }, { status: 400 })
  }

  if (row.age_years !== undefined) {
    const age = Number(row.age_years)
    if (!Number.isInteger(age) || age < 0 || age > 129) {
      return NextResponse.json(
        { error: 'Age must be a whole number between 0 and 129.' },
        { status: 400 }
      )
    }
    row.age_years = age
  }

  const { data, error } = await supabaseAdmin.from('patients').insert(row).select().single()

  if (error) {
    if (error.code === '23505' && error.message.includes('clinic_patient_id')) {
      return NextResponse.json(
        { error: `A patient with ID "${String(row.clinic_patient_id)}" already exists.` },
        { status: 409 }
      )
    }
    // Surfaced explicitly because it is the expected failure until the
    // relevant migration runs.
    if (error.code === 'PGRST204' || /column .* does not exist/i.test(error.message)) {
      return NextResponse.json(
        {
          error:
            'This form needs a pending migration to be run first — ' +
            'migration_v35_add_patient_and_hub_fk.sql (program, allergies, age_years) ' +
            'and/or migration_v42_patients_source.sql (source).',
        },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
