import { NextRequest, NextResponse } from 'next/server'
import { groqChatCompletion } from '@/lib/groq'
import { createClient } from '@supabase/supabase-js'
import { PatientInput, RxData } from '@/lib/mrx/types'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'mrx' } }
)

const SYSTEM_PROMPT = `You are an expert clinical gut microbiome dietitian with deep knowledge of Indian foods, prebiotics, and species-specific dietary interventions. Given a patient's gut microbiome species list and clinical context, generate a comprehensive, highly specific dietary prescription.

Return ONLY a valid JSON object - no markdown fences, no preamble, nothing else.

{
  "rx_title": "<8-12 word personalised prescription headline>",
  "rx_summary": "<2-3 sentences: overall dietary strategy, key goals, expected outcomes>",
  "stats": [
    {"num": "<e.g. 8>", "label": "<e.g. target species>"},
    {"num": "<e.g. 12>", "label": "<e.g. foods prescribed>"},
    {"num": "<e.g. 6>", "label": "<e.g. avoid foods>"},
    {"num": "<e.g. 4-6>", "label": "<e.g. weeks to results>"}
  ],
  "strategy_pillars": [
    {"icon": "<single emoji>", "title": "<short title>", "detail": "<1 line explanation>"}
  ],
  "add_foods": [
    {
      "name": "<SPECIFIC food name>",
      "emoji": "<relevant emoji>",
      "category": "<prebiotic|probiotic|fermented|fibre|anti-inflammatory|spice|protein|fat>",
      "frequency": "<Daily|Every other day|3x/week>",
      "amount": "<specific amount>",
      "why": "<2-3 sentences: exactly which species, what substrate, what metabolic outcome>",
      "target_species": "<exact species name this food directly feeds>",
      "how_to_use": "<specific Indian preparation or meal idea>",
      "indian_context": "<Indian food name if applicable, else null>",
      "priority": "high|medium|low"
    }
  ],
  "species_food_map": [
    {
      "species": "<species name>",
      "status": "depleted|overgrown|balanced|keystone",
      "intervention": "feed|suppress|maintain",
      "foods": ["food1", "food2", "food3"],
      "avoid": ["food that negatively affects this species"]
    }
  ],
  "daily_schedule": [
    {
      "time": "<Waking|Breakfast|Mid-morning|Lunch|Evening|Dinner|Before bed>",
      "time_sub": "<e.g. 6:30-7:00 AM>",
      "main_foods": "<specific foods with amounts>",
      "microbiome_reason": "<1 sentence: which species this targets and why>",
      "target_species_tag": "<short species name tag>"
    }
  ],
  "supplements": [
    {
      "name": "<supplement or prebiotic name>",
      "dose": "<specific dosage and timing>",
      "why": "<1-2 sentences: which species, what gap it fills>"
    }
  ],
  "avoid_foods": [
    {
      "name": "<food to avoid>",
      "reason": "<2 sentences: which pathobiont it feeds, what clinical consequence>",
      "pathobiont": "<species it negatively affects>"
    }
  ]
}

CRITICAL RULES:
1. Every add_food MUST name a target_species from the patient species list
2. Be SPECIFIC - not high-fiber vegetables but cooked-and-cooled basmati rice for Ruminococcus bromii
3. Prioritise Indian foods: idli, kanji, banana stem, ridge gourd, drumstick leaves, horse gram, ragi, jowar, bajra, kokum etc
4. If patient diet is vegetarian ALL food recommendations must be vegetarian
5. Factor in all stated allergies
6. species_food_map: 6-10 most clinically important species only
7. daily_schedule: 6-7 time slots practical for Indian patient
8. supplements: 3-5 targeted with specific doses
9. avoid_foods: 5-7 with exact pathobiont reasoning`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { patient, species_list, doctor_id }: {
      patient: PatientInput
      species_list: string[]
      doctor_id: string
    } = body

    if (!species_list || species_list.length < 3) {
      return NextResponse.json(
        { error: 'Need at least 3 species' },
        { status: 400 }
      )
    }

    if (!doctor_id) {
      return NextResponse.json(
        { error: 'doctor_id is required' },
        { status: 400 }
      )
    }

    const userMsg = `Patient: ${patient.name}${patient.age_sex ? ', ' + patient.age_sex : ''}
${patient.complaint ? 'Chief complaint: ' + patient.complaint : ''}
${patient.diet_type ? 'Current diet: ' + patient.diet_type : ''}
${patient.medical_history ? 'Medical history: ' + patient.medical_history : ''}
${patient.allergies ? 'Allergies: ' + patient.allergies : ''}

Gut microbiome species list (${species_list.length} species):
${species_list.join('\n')}`

    const completion = await groqChatCompletion({
      model: 'openai/gpt-oss-20b',
      max_tokens: 4000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMsg },
      ],
      response_format: { type: 'json_object' },
    })

    const rawText = completion.choices[0]?.message?.content || ''

    let rxData: RxData
    try {
      rxData = JSON.parse(rawText.replace(/```json|```/g, '').trim())
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse AI response. Please try again.' },
        { status: 500 }
      )
    }

    const { data: patientRow, error: patientError } = await supabaseAdmin
      .from('patients')
      .insert({
        doctor_id,
        name: patient.name,
        age_sex: patient.age_sex || null,
        complaint: patient.complaint || null,
        diet_type: patient.diet_type || null,
        medical_history: patient.medical_history || null,
        allergies: patient.allergies || null,
      })
      .select()
      .single()

    if (patientError) {
      console.error('Patient insert error:', patientError)
      return NextResponse.json(
        { error: 'Failed to save patient: ' + patientError.message },
        { status: 500 }
      )
    }

    const { data: rxRow, error: rxError } = await supabaseAdmin
      .from('prescriptions')
      .insert({
        patient_id: patientRow.id,
        doctor_id,
        species_list,
        species_count: species_list.length,
        rx_data: rxData,
      })
      .select()
      .single()

    if (rxError) {
      console.error('Prescription insert error:', rxError)
      return NextResponse.json(
        { error: 'Failed to save prescription: ' + rxError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      prescription_id: rxRow.id,
      patient_id: patientRow.id,
      rx_data: rxData,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('generate-rx error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
