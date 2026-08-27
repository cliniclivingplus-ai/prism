import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  const { reportId, supplementPlan, duration } = await req.json()
  const weeks = duration === '3m' ? 12 : 4

  const response = await groq.chat.completions.create({
    model: 'openai/gpt-oss-20b',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `Create a ${weeks}-week supplement schedule. Return ONLY valid JSON.

Supplement Plan:
${JSON.stringify(supplementPlan, null, 2)}

Return exactly this JSON:
{
  "weeks": [
    {
      "week": 1,
      "morning": [{"supplement": "name", "dose": "amount"}],
      "afternoon": [{"supplement": "name", "dose": "amount"}],
      "evening": [{"supplement": "name", "dose": "amount"}],
      "notes": "phase notes"
    }
  ]
}`
      }
    ]
  })

  const raw = response.choices[0].message.content || '{}'
  const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())

  // Update prescription with schedule
  const field = duration === '3m' ? 'schedule_3m' : 'schedule_1m'
  await fetch(
    `${SUPABASE_URL}/rest/v1/prescriptions?report_id=eq.${reportId}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ [field]: parsed })
    }
  )

  return NextResponse.json(parsed)
}
