import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const MAX_HISTORY_MESSAGES = 10

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function searchKnowledge(query: string) {
  try {
    const keyword = query.split(' ').slice(0, 3).join('%')
    const url = `${SUPABASE_URL}/rest/v1/knowledge_chunks?content=ilike.*${keyword}*&select=source_file,content&limit=5`
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    })
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

async function getReportContext(reportId: string) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/reports?id=eq.${reportId}&select=patient_name,patient_age_sex,report_data&limit=1`
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    })
    const data = await res.json()
    return Array.isArray(data) && data.length > 0 ? data[0] : null
  } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, report_id, active_section } = await req.json()

    // Last user message is the query for RAG search
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user')?.content ?? ''

    const [chunks, report] = await Promise.all([
      searchKnowledge(lastUserMessage),
      report_id ? getReportContext(report_id) : Promise.resolve(null),
    ])

    const knowledgeContext = chunks.length > 0
      ? chunks.map((c: any, i: number) => `[Source ${i + 1}: ${c.source_file}]\n${c.content}`).join('\n\n---\n\n')
      : ''

    // Full report_data JSON was previously stringified into the system prompt on
    // every turn (multi-KB, unchanged for the whole session) - just send the
    // identifying fields here; anything section-specific comes via active_section.
    const reportContext = report
      ? `Patient: ${report.patient_name}, ${report.patient_age_sex ?? ''}`
      : ''

    const systemPrompt = `You are a clinical microbiome specialist assistant for MicrobiomeRx, helping doctors interpret gut microbiome reports.
Be concise, precise, and clinical. ${active_section ? `The doctor is currently viewing the ${active_section} section.` : ''}
${reportContext ? `\nPatient context:\n${reportContext}` : ''}
${knowledgeContext ? `\nKnowledge base:\n${knowledgeContext}` : ''}`

    // Cap history sent back to the model - unbounded ...messages makes cost grow
    // quadratically with conversation length since every prior turn gets resent.
    const recentMessages = messages.slice(-MAX_HISTORY_MESSAGES)

    const response = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      max_tokens: 1000,
      messages: [
        { role: 'system', content: systemPrompt },
        ...recentMessages,
      ],
    })

    return NextResponse.json({
      reply: response.choices[0].message.content
    })

  } catch (err: any) {
    console.error('[clinical-assistant]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
