import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { groqChatCompletion } from '@/lib/groq'
import { createSupabaseAdmin } from '@/lib/blood/supabaseServer'
import { buildMarkerTrends } from '@/lib/blood/patientTrends'


const NO_TREND_MESSAGE = 'Not enough history yet. Upload another report for this patient to start seeing a trend summary.'

export type SummaryRow = {
  name: string
  unit: string
  refRange: string
  history: string // "2.11 → 1.65 → 1.26", oldest to latest, exactly as recorded
  latestDate: string
  change: 'up' | 'down' | 'same'
  inRange: boolean
}
export type StructuredSummary = { rows: SummaryRow[]; closing: string }

function fmtShort(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// Values, dates and range-status are read straight from the patient's own
// report data — never re-typed by the model. Only the one-line closing
// overview is generated text; a table cell is not the place to let an LLM
// paraphrase a number.
function buildRows(trends: ReturnType<typeof buildMarkerTrends>): SummaryRow[] {
  return trends.map((t) => {
    const last = t.points[t.points.length - 1]
    const prev = t.points[t.points.length - 2]
    const change: SummaryRow['change'] = last.value > prev.value ? 'up' : last.value < prev.value ? 'down' : 'same'
    return {
      name: t.displayName,
      unit: t.unit || '',
      refRange: t.refRange || '',
      history: t.points.map((p) => p.value).join(' → '),
      latestDate: fmtShort(last.date),
      change,
      inRange: !last.abnormal,
    }
  })
}

// Same cache-unless-regenerate pattern as /api/blood/recommendations. The
// closing overview is the only part an LLM writes; it's given the same
// deterministic rows the table renders and is explicitly barred from
// claiming a trend that isn't actually in that data — the same
// anti-fabrication rule the per-report recommendations already follow.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const regenerate = body?.regenerate === true

    const admin = createSupabaseAdmin()

    const { data: patient, error: patientError } = await admin
      .from('patients')
      .select('id, name, progress_summary')
      .eq('id', id)
      .single()
    if (patientError || !patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    // progress_summary is a text column carrying JSON now; a value from
    // before this change is a plain sentence and won't parse — treat that
    // as "no usable cache" rather than serving stale, wrongly-shaped data.
    if (!regenerate && patient.progress_summary) {
      try {
        const cached = JSON.parse(patient.progress_summary) as StructuredSummary
        if (Array.isArray(cached.rows)) return NextResponse.json({ source: 'cache', ...cached })
      } catch { /* pre-table cached value — fall through and regenerate */ }
    }

    const { data: reports } = await admin
      .from('reports')
      .select('created_at, markers')
      .eq('patient_id', id)
      .order('created_at', { ascending: true })

    const trends = buildMarkerTrends((reports ?? []).map((r) => ({ created_at: r.created_at, markers: r.markers })))
    const withHistory = trends.filter((t) => t.points.length >= 2)

    if (withHistory.length === 0) {
      const empty: StructuredSummary = { rows: [], closing: NO_TREND_MESSAGE }
      return NextResponse.json({ source: 'generated', ...empty })
    }

    const rows = buildRows(withHistory)

    const rowText = rows
      .map((r) => `${r.name}: ${r.history}${r.unit ? ' ' + r.unit : ''} (reference range: ${r.refRange || 'not printed'}), ${r.change === 'up' ? 'increased' : r.change === 'down' ? 'decreased' : 'stayed the same'}, currently ${r.inRange ? 'within range' : 'out of range'}`)
      .join('\n')

    const completion = await groqChatCompletion({
      model: 'openai/gpt-oss-20b',
      max_tokens: 300,
      temperature: 0.25,
      reasoning_effort: 'low',
      messages: [
        {
          role: 'system',
          content: [
            'You write ONE short closing overview (2-4 sentences) summarising a patient\'s blood marker trends for a coach.',
            'You are given the change/range status already computed for every marker — do not restate every marker individually, that table is shown separately. Instead, group and highlight what matters: which markers remain out of range, any that improved, any that worsened.',
            'RULES:',
            '- Only describe what the data given actually shows — never claim a marker improved, worsened, or stayed stable unless it is stated',
            '- Never invent a value, date, or marker not in the data given',
            '- Plain text only, no markdown, no bullet points — prose sentences only',
            '- State things plainly and confidently where the data supports it; do not hedge with "may/might/could/possibly"',
            '- Never use an em dash (—); use a comma, period, or "and" instead',
          ].join('\n'),
        },
        {
          role: 'user',
          content: `Patient: ${patient.name}\n\nMarker trends:\n${rowText}\n\nWrite the closing overview.`,
        },
      ],
    })

    const closing = completion.choices[0]?.message?.content?.trim() || ''
    const result: StructuredSummary = { rows, closing }
    await admin.from('patients').update({ progress_summary: JSON.stringify(result) }).eq('id', id)

    return NextResponse.json({ source: 'generated', ...result })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to generate summary' }, { status: 500 })
  }
}
