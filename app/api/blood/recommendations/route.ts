import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import Groq from 'groq-sdk'
import { createSupabaseAdmin } from '@/lib/blood/supabaseServer'
import { findGuidanceMatch, type MarkerGuidanceRow } from '@/lib/blood/markerGuidance'
import type { ExtractedMarker, MarkerRecommendation } from '@/lib/blood/types'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

// Deterministic trigger -> constrained-LLM-rationale, same pattern as
// MicrobiomeRX's app/api/aic-supplements/route.ts: the recommendation
// itself always comes from the curated blood.marker_guidance row, never
// from the model. Groq's only job is writing 1-2 sentences that connect
// the row's own explanation to this specific patient's actual value.
async function writeRationale(marker: ExtractedMarker, row: MarkerGuidanceRow): Promise<string> {
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      max_tokens: 160,
      temperature: 0.25,
      reasoning_effort: 'low',
      messages: [
        {
          role: 'system',
          content: [
            'You write a short clinical rationale for a coach reviewing a patient\'s blood report finding.',
            'RULES:',
            '- Never use: "may", "might", "could", "perhaps", "possibly", "consider"',
            '- State the finding and its management plainly and confidently, grounded ONLY in the explanation and recommended actions given to you',
            '- Never invent a recommendation, mechanism, or claim not present in the given explanation/recommended actions',
            '- Reference the patient\'s actual result value',
            '- Maximum 3 sentences',
            '- Never use an em dash (—); use a comma, period, or "and" instead',
          ].join('\n'),
        },
        {
          role: 'user',
          content: `Finding: ${marker.test_name} = ${marker.result} ${marker.unit} (reference range: ${marker.ref_range || 'not printed'})
Condition: ${row.condition_label}
Explanation: ${row.explanation}
Recommended actions: ${row.recommended_actions}

Write the rationale.`,
        },
      ],
    })
    return completion.choices[0]?.message?.content?.trim() ?? row.recommended_actions
  } catch {
    return row.recommended_actions
  }
}

export async function POST(req: NextRequest) {
  try {
    const { report_id, regenerate = false } = await req.json()
    if (typeof report_id !== 'string' || !report_id) {
      return NextResponse.json({ error: 'report_id is required' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()

    const { data: report, error: reportError } = await admin
      .from('reports')
      .select('id, markers, recommendations')
      .eq('id', report_id)
      .single()
    if (reportError || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    if (!regenerate && report.recommendations) {
      return NextResponse.json({ source: 'cache', recommendations: report.recommendations as MarkerRecommendation[] })
    }

    const markers = (report.markers as ExtractedMarker[]) ?? []
    const abnormal = markers.filter((m) => m.abnormal)

    if (abnormal.length === 0) {
      await admin.from('reports').update({ recommendations: [] }).eq('id', report_id)
      return NextResponse.json({ source: 'generated', recommendations: [] })
    }

    const { data: guidanceRows } = await admin.from('marker_guidance').select('*')
    const guidance = (guidanceRows as MarkerGuidanceRow[]) ?? []

    const recommendations: MarkerRecommendation[] = await Promise.all(
      abnormal.map(async (marker) => {
        const match = findGuidanceMatch(marker.test_name, guidance)
        if (!match) {
          return {
            test_name: marker.test_name,
            result: marker.result,
            matched: false,
            condition_label: null,
            rationale: 'Outside the reference range. No curated guidance on file for this marker yet, flag it for clinical review.',
          }
        }
        const rationale = await writeRationale(marker, match)
        return {
          test_name: marker.test_name,
          result: marker.result,
          matched: true,
          condition_label: match.condition_label,
          rationale,
        }
      })
    )

    await admin.from('reports').update({ recommendations }).eq('id', report_id)
    return NextResponse.json({ source: 'generated', recommendations })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to generate recommendations' }, { status: 500 })
  }
}
