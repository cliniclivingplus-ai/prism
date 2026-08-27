/**
 * app/api/mrx/recommendations/route.ts
 * Single engine - KB tables drive all recommendations
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { runRulesEngineV2, extractMetricsForTracking, RULES_VERSION_V2 } from '@/lib/mrx/rulesEngineV2'

export const dynamic = 'force-dynamic'

async function createSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: 'mrx' },
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  )
}

// ── GET - Load saved output ───────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const report_id = req.nextUrl.searchParams.get('report_id')
  if (!report_id) return NextResponse.json({ error: 'report_id required' }, { status: 400 })

  const { data: report, error } = await supabase
    .from('reports')
    .select('id, rules_output, aic_rules_version')
    .eq('id', report_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    rules_output: report?.rules_output,
    already_generated: !!report?.rules_output,
  })
}

// ── POST - Run KB engine, save output ────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { report_id, force_regenerate = false } = body

  if (!report_id) return NextResponse.json({ error: 'report_id required' }, { status: 400 })

  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('id, report_data, rules_output, aic_rules_version, patient_id, created_at, sample_date')
    .eq('id', report_id)
    .single()

  if (reportError) return NextResponse.json({ error: reportError.message }, { status: 500 })
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  if (report.rules_output && !force_regenerate) {
    return NextResponse.json({ rules_output: report.rules_output, cached: true })
  }

  const reportData = report.report_data as Record<string, unknown>
  if (!reportData) {
    return NextResponse.json({ error: 'report_data is empty - parse the report first' }, { status: 400 })
  }

  const rulesOutput = await runRulesEngineV2(supabase, reportData)

  const { error: saveError } = await supabase
    .from('reports')
    .update({ rules_output: rulesOutput, aic_rules_version: RULES_VERSION_V2 })
    .eq('id', report_id)

  if (saveError) console.error('[recommendations] save failed:', saveError.message)

  const reportDate = (report.sample_date || report.created_at || new Date().toISOString()).slice(0, 10)
  const metrics = extractMetricsForTracking(reportData, reportDate)
  if (metrics.length > 0 && report.patient_id) {
    try {
      await supabase
        .from('patient_metrics')
        .upsert(
          metrics.map(m => ({ patient_id: report.patient_id, report_id, ...m })),
          { onConflict: 'patient_id,report_id,metric' }
        )
    } catch {
      // non-critical - metrics save failure doesn't block recommendations
    }
  }

  return NextResponse.json({
    rules_output: rulesOutput,
    cached: false,
    marker_count: rulesOutput.marker_count,
    conditions_flagged: rulesOutput.conditions_flagged,
    save_error: saveError?.message ?? null,
  })
}
