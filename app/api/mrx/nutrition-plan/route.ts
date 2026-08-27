import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { createClient } from '@supabase/supabase-js'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'mrx' } }
)

const SYSTEM_PROMPT = `You are a clinical gut microbiome nutritionist specialising in Indian dietary medicine.
You create 3-phase monthly nutrition plans based on gut microbiome report data.

PHASE STRUCTURE:
- Phase 1 (Weeks 1-4): REMOVE & REPAIR - eliminate triggers, heal gut barrier, reduce inflammation
- Phase 2 (Weeks 5-8): REINOCULATE - introduce fermented foods, prebiotics, rebuild microbial diversity  
- Phase 3 (Weeks 9-12): REBALANCE - diversify diet, maintain gains, long-term sustainability

Return ONLY valid JSON - no markdown, no preamble.

{
  "plan_title": "<personalised title based on patient findings>",
  "plan_summary": "<3-4 sentences: overall strategy, key findings driving this plan, expected outcomes>",
  "recommended_phase": <1, 2, or 3 - based on severity of findings>,
  "phase_rationale": "<why this starting phase was chosen based on the data>",
  "phases": [
    {
      "phase": 1,
      "name": "Remove & Repair",
      "duration": "Weeks 1–4",
      "goal": "<specific goal based on THIS patient's findings>",
      "focus_areas": ["<area1>", "<area2>", "<area3>"],
      "foods_to_eat": [
        {
          "food": "<specific food>",
          "indian_name": "<Indian name or null>",
          "amount": "<specific portion>",
          "timing": "<breakfast/lunch/dinner/snack>",
          "reason": "<1 sentence: which score or finding this addresses>"
        }
      ],
      "foods_to_avoid": [
        {
          "food": "<food to avoid>",
          "indian_name": "<Indian name or null>",
          "reason": "<1 sentence: why - which score or pathobiont it worsens>"
        }
      ],
      "daily_schedule": [
        {
          "time": "<e.g. 6:30 AM>",
          "meal": "<meal name>",
          "items": "<specific foods and amounts>",
          "notes": "<optional tip>"
        }
      ],
      "weekly_goals": [
        {
          "week": 1,
          "goal": "<specific actionable goal>",
          "focus": "<what to prioritise this week>"
        },
        {
          "week": 2,
          "goal": "<specific actionable goal>",
          "focus": "<what to prioritise this week>"
        },
        {
          "week": 3,
          "goal": "<specific actionable goal>",
          "focus": "<what to prioritise this week>"
        },
        {
          "week": 4,
          "goal": "<specific actionable goal>",
          "focus": "<what to prioritise this week>"
        }
      ],
      "doctor_notes": "<clinical rationale for doctor - what this phase addresses and why, based on scores>"
    },
    {
      "phase": 2,
      "name": "Reinoculate",
      "duration": "Weeks 5–8",
      "goal": "<specific goal>",
      "focus_areas": ["<area1>", "<area2>"],
      "foods_to_eat": [],
      "foods_to_avoid": [],
      "daily_schedule": [],
      "weekly_goals": [],
      "doctor_notes": "<clinical rationale>"
    },
    {
      "phase": 3,
      "name": "Rebalance",
      "duration": "Weeks 9–12",
      "goal": "<specific goal>",
      "focus_areas": ["<area1>", "<area2>"],
      "foods_to_eat": [],
      "foods_to_avoid": [],
      "daily_schedule": [],
      "weekly_goals": [],
      "doctor_notes": "<clinical rationale>"
    }
  ]
}

CRITICAL RULES:
1. All food must be appropriate for the patient's stated diet type
2. Prioritise Indian foods - idli, kanji, ragi, bajra, jowar, sabzi varieties, dal, curd, lassi etc
3. Every food recommendation must reference a specific score or finding from the report
4. Daily schedule must be practical for an Indian patient
5. Doctor notes are clinical and reference actual scores
6. Do NOT suggest supplements here - that is handled by the recommendation engine
7. Phase 1 is always most restrictive, Phase 3 most liberal
8. weekly_goals must be specific and measurable`

function buildPatientContext(reportData: any, patient: any): string {
  const lines: string[] = []

  lines.push(`PATIENT: ${patient.name}, ${patient.age_sex}`)
  if (patient.complaint) lines.push(`COMPLAINT: ${patient.complaint}`)
  if (patient.diet_type) lines.push(`DIET TYPE: ${patient.diet_type}`)
  if (patient.medical_history) lines.push(`MEDICAL HISTORY: ${patient.medical_history}`)
  if (patient.allergies) lines.push(`ALLERGIES: ${patient.allergies}`)

  lines.push('\n--- REPORT FINDINGS ---')

  const rd = reportData

  if (rd.rych_index != null) lines.push(`Rych Index (gut health score): ${rd.rych_index}/100`)
  if (rd.diversity?.shannon != null) lines.push(`Shannon Diversity: ${rd.diversity.shannon}`)
  if (rd.antibiotic_recovery != null) lines.push(`Antibiotic Recovery: ${rd.antibiotic_recovery}`)

  if (rd.scfa) {
    lines.push('\nSCFA Production:')
    Object.entries(rd.scfa).forEach(([k, v]) => {
      if (v != null) lines.push(`  ${k}: ${v}`)
    })
  }

  if (rd.vitamins) {
    lines.push('\nVitamin Production Potential:')
    Object.entries(rd.vitamins).forEach(([k, v]) => {
      if (v != null) lines.push(`  ${k}: ${v}`)
    })
  }

  if (rd.neurotransmitters) {
    lines.push('\nNeurotransmitter Production:')
    Object.entries(rd.neurotransmitters).forEach(([k, v]) => {
      if (v != null) lines.push(`  ${k}: ${v}`)
    })
  }

  if (rd.health_indicators) {
    lines.push('\nHealth Indicators:')
    Object.entries(rd.health_indicators).forEach(([k, v]) => {
      if (v != null) lines.push(`  ${k}: ${v}`)
    })
  }

  if (rd.disease_risk) {
    lines.push('\nDisease Risk Patterns:')
    Object.entries(rd.disease_risk).forEach(([k, v]) => {
      if (v != null) lines.push(`  ${k}: ${v}%`)
    })
  }

  if (rd.gut_function) {
    lines.push('\nGut Function:')
    Object.entries(rd.gut_function).forEach(([k, v]) => {
      if (v != null) lines.push(`  ${k}: ${v}`)
    })
  }

  if (rd.macronutrients) {
    lines.push('\nMacronutrient Metabolism:')
    Object.entries(rd.macronutrients).forEach(([k, v]) => {
      if (v != null) lines.push(`  ${k}: ${v}`)
    })
  }

  if (rd.intolerance) {
    lines.push('\nIntolerance Management:')
    Object.entries(rd.intolerance).forEach(([k, v]) => {
      if (v != null) lines.push(`  ${k}: ${v}`)
    })
  }

  if (rd.kingdom) {
    lines.push('\nMicrobial Kingdom Distribution:')
    Object.entries(rd.kingdom).forEach(([k, v]) => {
      if (v != null) lines.push(`  ${k}: ${v}%`)
    })
  }

  if (rd.species_list?.length > 0) {
    lines.push(`\nSpecies detected: ${rd.species_list.length} total`)
    lines.push(`Key species: ${rd.species_list.slice(0, 20).join(', ')}`)
  }

  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const { report_id, report_data, patient } = await req.json()

    if (!report_data) {
      return NextResponse.json({ error: 'Report data required' }, { status: 400 })
    }

    const patientContext = buildPatientContext(report_data, patient)

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      max_tokens: 4000,
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: patientContext },
      ],
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content || '{}'
    let plan: any
    try {
      plan = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Failed to parse plan' }, { status: 500 })
    }

    // Save to Supabase
    if (report_id) {
      await supabaseAdmin
        .from('reports')
        .update({ nutrition_plan: plan })
        .eq('id', report_id)
    }

    return NextResponse.json({ plan })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('nutrition-plan error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
