import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function searchKnowledge(query: string): Promise<any[]> {
  const keywords = query.split(' ').slice(0, 3).join('*')
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/knowledge_chunks?content=ilike.*${encodeURIComponent(keywords)}*&limit=6`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      }
    }
  )
  return response.json()
}

export async function POST(req: NextRequest) {
  const { reportId, doctorId, depletedSpecies, overgrownSpecies } = await req.json()

  const ragQuery = `supplements for ${depletedSpecies.join(' ')} ${overgrownSpecies.join(' ')}`
  const chunks = await searchKnowledge(ragQuery)
  const knowledgeContext = chunks.map((c: any) => c.content).join('\n\n---\n\n')

  const response = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    max_tokens: 2000,
    reasoning_effort: 'low',
    messages: [
      {
        role: 'user',
        content: `You are a clinical microbiome specialist. Create a supplement prescription based on the species data and knowledge base. Return ONLY valid JSON.

Depleted Species: ${depletedSpecies.join(', ')}
Overgrown Species: ${overgrownSpecies.join(', ')}

Knowledge Base:
${knowledgeContext}

Return exactly this JSON:
{
  "supplement_plan": [
    {
      "supplement": "name",
      "dose": "amount",
      "timing": "with meals / morning / etc",
      "duration": "X weeks",
      "targets": ["species it helps"],
      "rationale": "why this supplement"
    }
  ]
}`
      }
    ]
  })

  const raw = response.choices[0].message.content || '{}'
  const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())

  // Save to Supabase
  await fetch(`${SUPABASE_URL}/rest/v1/prescriptions`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      report_id: reportId,
      doctor_id: doctorId,
      supplement_plan: parsed.supplement_plan
    })
  })

  return NextResponse.json(parsed)
}
