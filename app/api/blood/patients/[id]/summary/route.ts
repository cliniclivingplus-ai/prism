import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import Groq from 'groq-sdk'
import { createSupabaseAdmin } from '@/lib/blood/supabaseServer'
import { buildMarkerTrends } from '@/lib/blood/patientTrends'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const NO_TREND_MESSAGE = 'Not enough history yet. Upload another report for this patient to start seeing a trend summary.'

// Same cache-unless-regenerate pattern as /api/blood/recommendations. The prompt
// only ever gets the patient's own real historical values (date -> value
// per marker) and is explicitly barred from claiming a trend that isn't
// actually in that data — the same anti-fabrication rule the per-report
// recommendations already follow, just applied to a timeline instead of a
// single reading.
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

    if (!regenerate && patient.progress_summary) {
      return NextResponse.json({ source: 'cache', summary: patient.progress_summary })
    }

    const { data: reports } = await admin
      .from('reports')
      .select('created_at, markers')
      .eq('patient_id', id)
      .order('created_at', { ascending: true })

    const trends = buildMarkerTrends((reports ?? []).map((r) => ({ created_at: r.created_at, markers: r.markers })))
    const withHistory = trends.filter((t) => t.points.length >= 2)

    if (withHistory.length === 0) {
      return NextResponse.json({ source: 'generated', summary: NO_TREND_MESSAGE })
    }

    const trendText = withHistory
      .map((t) => {
        const points = t.points
          .map((p) => `${new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}: ${p.value}${t.unit ? ' ' + t.unit : ''}${p.abnormal ? ' (out of range)' : ''}`)
          .join(', ')
        return `${t.displayName} (reference range: ${t.refRange || 'not printed'}): ${points}`
      })
      .join('\n')

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      max_tokens: 700,
      temperature: 0.25,
      reasoning_effort: 'low',
      messages: [
        {
          role: 'system',
          content: [
            'You write a progress summary for a coach comparing a patient\'s blood test results across multiple reports over time.',
            'For EACH marker in the data given, write one bullet point in this exact structure:',
            '- Marker name, then every reading in date order as "value on date", then say whether it increased, decreased, or stayed the same from the previous reading, then state whether the latest value is within or outside the reference range',
            'Example: "Hemoglobin: 8.10 on 12 Jul, 9.60 on 20 Jul. Increased by 1.5, still below the 12-15 reference range."',
            'RULES:',
            '- Only describe a change that is actually present in the numbers given — never claim a marker improved, worsened, or stayed stable unless the numbers given show that',
            '- Use the real values, units, dates, and reference ranges given, never invented ones',
            '- One bullet per marker, in the order given',
            '- After the bullets, add one closing sentence giving the overall picture across all markers together',
            '- State things plainly and confidently where the data supports it; do not hedge with "may/might/could/possibly"',
            '- Never use an em dash (—); use a comma, period, or "and" instead',
          ].join('\n'),
        },
        {
          role: 'user',
          content: `Patient: ${patient.name}\n\nMarker history (only markers with 2+ readings are included):\n${trendText}\n\nWrite the progress summary.`,
        },
      ],
    })

    const summary = completion.choices[0]?.message?.content?.trim() || NO_TREND_MESSAGE
    await admin.from('patients').update({ progress_summary: summary }).eq('id', id)

    return NextResponse.json({ source: 'generated', summary })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to generate summary' }, { status: 500 })
  }
}
