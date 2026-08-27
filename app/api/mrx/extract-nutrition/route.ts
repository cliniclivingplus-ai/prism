/**
 * app/api/mrx/extract-nutrition/route.ts
 *
 * POST { reportId, nutritionData }
 *  → merges nutritionData into reports.report_data.nutrition_data
 *  → returns { ok: true, foodCount }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'mrx' } }
)

export async function POST(req: NextRequest) {
  try {
    const { reportId, nutritionData } = await req.json()

    if (!reportId || !nutritionData) {
      return NextResponse.json({ error: 'Missing reportId or nutritionData' }, { status: 400 })
    }

    // Count total foods extracted
    const foodCount = Object.values(nutritionData as Record<string, Record<string, unknown>>)
      .reduce((sum, cat) => sum + Object.keys(cat).length, 0)

    // Fetch existing report_data so we can merge (not overwrite)
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('reports')
      .select('report_data')
      .eq('id', reportId)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const merged = {
      ...(existing.report_data ?? {}),
      nutrition_data: nutritionData,
    }

    const { error: updateErr } = await supabaseAdmin
      .from('reports')
      .update({ report_data: merged })
      .eq('id', reportId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, foodCount })
  } catch (err) {
    console.error('[extract-nutrition]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
