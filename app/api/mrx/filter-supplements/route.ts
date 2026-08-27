import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const MAX_HISTORY_MESSAGES = 10

interface ChatMsg { role: 'ai' | 'doctor'; text: string }
interface SupplementInfo { label: string; aicProduct?: string; phase?: string; category?: string; detail?: string; rationale?: string }
interface FilterResult {
  name: string
  tier: 'must' | 'recommended' | 'optional' | 'remove'
  reason: string
  new?: boolean
  detail?: string
  phase?: string
}

// Matches the inline FilterPanel in review/page.tsx, which POSTs
// { supplements, messages, mode: 'start' | 'chat', hasExistingResults }
// and expects either { text } to continue the chat, or
// { type: 'results', text, results } once filtering is done.
export async function POST(req: NextRequest) {
  try {
    const { supplements, messages, mode } = (await req.json()) as {
      supplements: SupplementInfo[]
      messages: ChatMsg[]
      mode: 'start' | 'chat'
      hasExistingResults?: boolean
    }

    if (!Array.isArray(supplements) || supplements.length === 0) {
      return NextResponse.json({ error: 'Missing or empty supplements list' }, { status: 400 })
    }

    const suppListText = supplements
      .map((s, i) => {
        const nameParts = [s.label, s.aicProduct && s.aicProduct !== s.label ? `/ ${s.aicProduct}` : '']
          .filter(Boolean)
          .join(' ')
        const meta = [s.category, s.phase].filter(Boolean).join(', ') || 'uncategorised'
        return `${i + 1}. ${nameParts} (${meta})`
      })
      .join('\n')

    const doctorTurns = (messages || []).filter(m => m.role === 'doctor').length
    const lastDoctorText = [...(messages || [])].reverse().find(m => m.role === 'doctor')?.text || ''
    const forceFilter = /\b(filter now|go ahead|that'?s all|thats all|just filter|no more|proceed|enough|nothing else)\b/i.test(lastDoctorText)

    const systemPrompt = `You are an AI clinical pharmacist assistant helping a doctor filter a gut-microbiome supplement prescription for a specific patient.

Your job has two phases:
1. ASK PHASE: Gather the patient's concerns, known allergies, current medications, and any relevant conditions or constraints (pregnancy, kidney/liver disease, dietary restrictions, budget, age, how many supplements they can realistically take). Ask ONE short, focused question at a time — never ask everything at once. Keep questions conversational, warm, and brief (1-2 sentences).

   IMPORTANT: Every time the doctor gives you an answer, your next message must first briefly acknowledge or confirm what they told you — especially if it was an instruction (e.g. "remove overlapping supplements," "avoid Ox Bile") rather than just descriptive info — THEN ask your next question. Never jump straight to a new question without first showing you registered the previous answer. Keep the acknowledgment to one short clause, e.g. "Got it, I'll drop anything overlapping. " before the next question. Put both the acknowledgment and the question together in the single "question" field.

2. FILTER PHASE: Once you have enough information — typically after 2 to 4 doctor answers, or immediately if the doctor says something like "that's all", "go ahead", or "just filter it" — stop asking and produce the filtered list instead of another question.

The full supplement list you are filtering (${supplements.length} items). You may ONLY use these exact names, never invent new ones:
${suppListText}

Respond with ONLY a valid JSON object. No markdown fences, no commentary before or after. Use exactly one of these two shapes:

To ask another question:
{"action":"ask","question":"your next question here"}

To deliver the final filtered list:
{"action":"filter","summary":"one short sentence summarising the patient profile you used to filter","results":[{"name":"exact name from the list above","tier":"must|recommended|optional|remove","reason":"one concise clinical sentence"}]}

Rules for the filter action:
- Every single supplement from the ORIGINAL list above must appear exactly once in results, using its exact name as given
- "must" = essential, directly addresses the patient's stated concerns/conditions, no conflicts — cap at 6 items
- "recommended" = useful secondary support, no conflicts
- "optional" = low priority given this specific patient's profile right now
- "remove" = contraindicated (allergy, medication interaction, or condition conflict), wrong treatment phase for where the doctor said the patient is, or redundant with another item
- Treat every allergy, medication, and condition the doctor mentioned as a hard constraint — never place a conflicting item above "remove"
- Treat every explicit instruction the doctor gives (e.g. "remove overlapping supplements that do the same job," "keep it under 5 items," "Phase 1 only") as a hard constraint on the filter phase too, not just allergy/condition info
- Do NOT invent or add supplements on your own initiative

ADDING A NEW SUPPLEMENT — only when the doctor explicitly asks you to add a specific named item that is NOT already in the original list:
- Include it in results with the SAME object shape plus two extra fields: "new":true and "detail":"suggested dose & timing, e.g. 600mg 1x/day with meals · 4 weeks"
- Give it a "phase" field too (one of "Phase 1","Phase 1+2","Phase 2","Phase 3") based on clinical context
- Assign it a tier normally (usually "must" or "recommended" since the doctor asked for it directly, unless it conflicts with a stated allergy/condition — in which case tier it "remove" and explain why in "reason")
- Never add something the doctor didn't explicitly name`

    let turnInstruction: string
    if (mode === 'start' || (messages || []).length === 0) {
      turnInstruction = 'Begin the conversation. Ask your first question about this patient.'
    } else if (forceFilter) {
      turnInstruction = 'The doctor has indicated they are done answering questions. Produce the filter action now, using whatever information has been gathered in the conversation so far. Do not ask another question.'
    } else if (doctorTurns >= 4) {
      turnInstruction = 'You have already gathered several answers. Unless something clinically critical is still completely missing (e.g. no allergy info at all), produce the filter action now rather than asking another question.'
    } else {
      turnInstruction = 'Continue the conversation. Ask another question only if genuinely useful information is still missing; otherwise produce the filter action.'
    }

    // Cap history sent back to the model - unbounded map over the full running
    // ask/filter conversation makes cost grow quadratically with turn count.
    const groqMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...(messages || []).slice(-MAX_HISTORY_MESSAGES).map(m => ({
        role: (m.role === 'doctor' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.text,
      })),
      { role: 'user', content: turnInstruction },
    ]

    const raw = await callGroqWithRetry(groqMessages)

    let parsed = tryParseJsonObject(raw)

    if (!parsed) {
      console.error('[filter-supplements] JSON parse failed, retrying once. Raw text:', raw.slice(0, 500))
      const retryMessages = [
        ...groqMessages,
        { role: 'assistant' as const, content: raw },
        { role: 'user' as const, content: 'That was not a single valid JSON object. Respond again with ONLY one valid JSON object in the exact shape described — no other text.' },
      ]
      const retryRaw = await callGroqWithRetry(retryMessages)
      parsed = tryParseJsonObject(retryRaw)

      if (!parsed) {
        console.error('[filter-supplements] JSON parse failed again after retry. Raw text:', retryRaw.slice(0, 500))
        return NextResponse.json({
          text: "Sorry, I didn't quite catch that — could you rephrase or give me a bit more detail?",
        })
      }
    }

    if (parsed.action === 'filter' && Array.isArray(parsed.results)) {
      const results: FilterResult[] = parsed.results
        .filter((r: any) => r && typeof r.name === 'string' && ['must', 'recommended', 'optional', 'remove'].includes(r.tier))
        .map((r: any) => ({
          name: r.name,
          tier: r.tier,
          reason: typeof r.reason === 'string' ? r.reason : '',
          ...(r.new === true ? { new: true, detail: typeof r.detail === 'string' ? r.detail : '', phase: typeof r.phase === 'string' ? r.phase : 'Phase 2' } : {}),
        }))
      if (results.length === 0) {
        console.error('[filter-supplements] filter action returned no valid results:', JSON.stringify(parsed).slice(0, 500))
        return NextResponse.json({
          text: "I tried to build the filter but something went wrong — could you confirm the patient's main concern again?",
        })
      }
      console.log('[filter-supplements] filter produced', results.length, 'results after', doctorTurns, 'doctor turns')
      return NextResponse.json({
        type: 'results',
        text: parsed.summary || '',
        results,
      })
    }

    const question = typeof parsed.question === 'string' && parsed.question.trim()
      ? parsed.question
      : 'Could you tell me a bit more about the patient — any allergies, medications, or conditions?'

    return NextResponse.json({ text: question })
  } catch (error) {
    console.error('[filter-supplements] error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// Extracts and parses the FIRST complete top-level {...} object in the text,
// using proper brace-depth tracking instead of a greedy regex. A regex like
// /\{[\s\S]*\}/ grabs from the first '{' to the LAST '}' in the whole string —
// if the model ever echoes a stray brace from its own instructions or emits
// any trailing text with braces in it, that greedy match spans two objects
// and produces invalid JSON. This walks brace depth so it stops at the first
// object's true closing brace.
function tryParseJsonObject(text: string): any | null {
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escapeNext = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escapeNext) { escapeNext = false; continue }
    if (ch === '\\') { escapeNext = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        const candidate = text.slice(start, i + 1)
        try {
          return JSON.parse(candidate)
        } catch {
          return null
        }
      }
    }
  }
  return null
}

async function callGroqWithRetry(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  retries = 2
): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: 'openai/gpt-oss-20b',
        max_tokens: 3000,
        temperature: 0.2,
        reasoning_effort: 'low',
        messages,
      })

      const text = completion.choices[0]?.message?.content || ''
      if (!text.trim()) throw new Error('Empty completion from openai/gpt-oss-20b')
      return text
    } catch (err: any) {
      const status = err?.status || err?.response?.status
      const isRateLimit = status === 429
      const isLast = attempt === retries

      if ((isRateLimit || err?.message?.includes('Empty completion')) && !isLast) {
        const waitMs = 1000 * (attempt + 1)
        console.warn(`[filter-supplements] retrying (attempt ${attempt + 1}) — ${err?.message || status}`)
        await new Promise(res => setTimeout(res, waitMs))
        continue
      }
      throw err
    }
  }
  throw new Error('Groq call failed after retries')
}