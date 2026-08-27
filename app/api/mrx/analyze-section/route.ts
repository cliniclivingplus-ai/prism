import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const { section, report_data, patient, section_data } = await req.json()

    if (!section || !report_data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      max_tokens: 2000,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `You are a clinical gut microbiome analyst. Analyse the ${section} data from a BugSpeaks report.
Be specific to the patient's actual scores. Never prescribe.
Use "consider", "may indicate", "worth exploring".
Return ONLY valid JSON.

{
  "interpretation": "<2-3 sentences about this patient's score>",
  "what_it_means": "<plain language explanation of what ${section} is>",
  "contributing_factors": [
    { "factor": "<name>", "impact": "positive|negative|neutral", "explanation": "<1 sentence>" }
  ],
  "clinical_significance": "<1-2 sentences>",
  "what_drives_it": "<what explains this score>",
  "considerations": ["<consideration 1>", "<consideration 2>", "<consideration 3>"],
  "knowledge_insight": null,
  "knowledge_source": null
}`,
        },
        {
          role: 'user',
          content: `PATIENT: ${patient?.name || 'Unknown'}, ${patient?.age_sex || ''}
COMPLAINT: ${patient?.complaint || 'not specified'}
DIET: ${patient?.diet_type || 'not specified'}
HISTORY: ${patient?.medical_history || 'none'}

SECTION: ${section}
SECTION DATA: ${JSON.stringify(section_data)}

REPORT CONTEXT:
Rych Index: ${report_data?.rych_index ?? 'not available'}
Shannon Diversity: ${report_data?.diversity?.shannon ?? 'not available'}
Health Indicators: ${JSON.stringify(report_data?.health_indicators ?? {})}
Disease Risk: ${JSON.stringify(report_data?.disease_risk ?? {})}
SCFA: ${JSON.stringify(report_data?.scfa ?? {})}
Vitamins: ${JSON.stringify(report_data?.vitamins ?? {})}`,
        },
      ],
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content || '{}'
    let analysis: any = {}
    try { analysis = JSON.parse(raw) } catch { analysis = {} }

    return NextResponse.json({ analysis })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('analyze-section error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
