import { NextRequest, NextResponse } from 'next/server'
import { groqChatCompletion } from '@/lib/groq'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  const { reportId, speciesData } = await req.json()

  const response = await groqChatCompletion({
    model: 'openai/gpt-oss-20b',
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: `You are a clinical microbiome analyst. Analyze this gut microbiome species data and return ONLY valid JSON with no extra text.

Species Data:
${JSON.stringify(speciesData, null, 2)}

Return exactly this JSON structure:
{
  "gut_score": <integer 0-100>,
  "summary_text": "<2-3 sentence clinical summary>",
  "key_findings": ["finding 1", "finding 2", "finding 3"],
  "red_flags": ["red flag 1", "red flag 2"]
}`
      }
    ]
  })

  const raw = response.choices[0].message.content || '{}'
  const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())

  // Save to Supabase
  await fetch(`${SUPABASE_URL}/rest/v1/report_summaries`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      report_id: reportId,
      summary_text: parsed.summary_text,
      gut_score: parsed.gut_score,
      key_findings: parsed.key_findings,
      red_flags: parsed.red_flags
    })
  })

  return NextResponse.json(parsed)
}
