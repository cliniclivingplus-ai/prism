import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabase'
import {
  FOUNDER_NOTE_SETTING_KEY,
  DEFAULT_FOUNDER_NOTE_TEMPLATE,
  readFounderNoteTemplate,
} from '@/lib/clinicSettings'

// The clinic's standard founder's note, editable by any coach from
// Compass -> Founder's note. Gated like every other /api route.
export async function GET() {
  const text = await readFounderNoteTemplate()
  return NextResponse.json({ text, isDefault: text === DEFAULT_FOUNDER_NOTE_TEMPLATE })
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const text = typeof body?.text === 'string' ? body.text : null
  if (text === null) return NextResponse.json({ error: 'Note text is required' }, { status: 400 })

  // Saving an empty note would leave new plans with a blank welcome; the
  // clinic's own wording is restored instead, which is also how "Reset to
  // the standard note" works.
  const value = text.trim() ? text : DEFAULT_FOUNDER_NOTE_TEMPLATE

  const { error } = await supabaseAdmin
    .from('clinic_settings')
    .upsert({ key: FOUNDER_NOTE_SETTING_KEY, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (error) {
    // The table arrives with migration_v44_clinic_settings.sql. Say so
    // plainly rather than failing with a Postgres error a coach cannot act on.
    if (error.code === '42P01' || /relation .* does not exist/i.test(error.message)) {
      return NextResponse.json(
        { error: 'Saving needs migration_v44_clinic_settings.sql to be run on the database first.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ text: value, isDefault: value === DEFAULT_FOUNDER_NOTE_TEMPLATE })
}
