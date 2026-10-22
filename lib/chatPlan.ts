// Turns a coach's discussion with the clinical co-pilot into the plan the
// guide generator must follow.
//
// The chat is stored as sessions.qa_pairs with mode 'discussion'. Until now
// it reached the generator only as loose Q&A text mixed in with notes, so
// what a coach actually agreed in the chat might or might not survive into
// the dashboard. This distils the conversation into the decisions it
// contains, which the generator then treats as the coach's own instructions.
//
// Grounding rule, same discipline as the rest of this app: only what the
// discussion actually says. The model is extracting, not advising — it may
// not add a recommendation nobody made.
import { groqChatCompletion } from './groq'

export type AgreedPlan = {
  lifestyle: string[]
  meals: string[]
  weeklyFocus: string[]
  supplements: { name: string; why: string }[]
  avoid: string[]
  notes: string[]
}

export type QaPair = { question?: string; answer?: string; mode?: string }

const EMPTY: AgreedPlan = { lifestyle: [], meals: [], weeklyFocus: [], supplements: [], avoid: [], notes: [] }

export function isEmptyPlan(plan: AgreedPlan): boolean {
  return (
    plan.lifestyle.length === 0 &&
    plan.meals.length === 0 &&
    plan.weeklyFocus.length === 0 &&
    plan.supplements.length === 0 &&
    plan.avoid.length === 0 &&
    plan.notes.length === 0
  )
}

// The discussion turns only, oldest first, as a readable transcript.
export function discussionTranscript(pairs: QaPair[]): string {
  return (pairs || [])
    .filter((p) => p.mode === 'discussion')
    .map((p) => {
      const coach = (p.question || '').trim()
      const copilot = (p.answer || '').trim()
      return [coach && `Coach: ${coach}`, copilot && `Co-pilot: ${copilot}`].filter(Boolean).join('\n')
    })
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

const asList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').map(v => v.trim()).filter(Boolean) : []

export async function distilAgreedPlan(pairs: QaPair[], patientName: string): Promise<AgreedPlan> {
  const transcript = discussionTranscript(pairs)
  // Even a short coach instruction can settle a concrete decision.
  if (!transcript) return EMPTY
  if (transcript.length > 48000) throw new Error('This discussion is too long to extract safely. Start a new session with the final agreed plan so it can be reviewed without dropping earlier turns.')

  try {
    let accumulated: AgreedPlan = EMPTY
    for (let offset = 0; offset < transcript.length; offset += 10000) {
      const completion = await groqChatCompletion({
        model: 'openai/gpt-oss-120b',
        temperature: 0.1,
        max_tokens: 2400,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' as const },
        messages: [
          {
            role: 'system',
            content: `You are reading a discussion between a nutrition coach and a clinical co-pilot about ${patientName}'s plan. Extract ONLY the decisions the discussion actually contains, so they can be carried into the patient's guide.

  Rules:
  - Extract, never advise. If the discussion did not say it, it does not go in.
  - Newer coach corrections and rejections replace earlier decisions. The accumulated plan is provisional: remove superseded items. Coach confirmation of the preceding suggestion counts as agreement.
  - A suggestion the coach rejected, or left open ("maybe", "we could consider"), does not go in. Only what was settled.
  - Keep the coach's own wording and quantities. Do not round, rename or "improve" a number.
  - Each item is one short instruction a coach would recognise as theirs.
  - Supplements: only ones actually agreed, with the reason given in the discussion. Never invent a dose that was not stated.
  - If the discussion settled nothing, return empty arrays. An empty result is correct and expected.

  Respond with strict JSON only:
  {"lifestyle": ["..."], "meals": ["..."], "weeklyFocus": ["..."], "supplements": [{"name": "...", "why": "..."}], "avoid": ["..."], "notes": ["..."]}

  lifestyle: daily habits (movement, sleep, hydration, routine).
  meals: what to eat, meal timing, foods to include.
  weeklyFocus: anything agreed about how the weeks should progress.
  avoid: foods or habits to leave out.
  notes: decisions that belong in the clinical notes rather than the patient's daily guidance.`,
          },
          { role: 'user', content: `Accumulated decisions from earlier turns: ${JSON.stringify(accumulated)}\n\nNext chronological discussion segment:\n${transcript.slice(Math.max(0, offset - 1000), offset + 10000)}` },
        ],
      })

      const raw = completion.choices[0]?.message?.content?.trim()
      if (!raw || completion.choices[0]?.finish_reason === 'length') throw new Error('Incomplete plan extraction')
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (!['lifestyle', 'meals', 'weeklyFocus', 'supplements', 'avoid', 'notes'].every(key => Array.isArray(parsed[key]))) throw new Error('Invalid extracted plan')
      accumulated = {
        lifestyle: asList(parsed.lifestyle),
        meals: asList(parsed.meals),
        weeklyFocus: asList(parsed.weeklyFocus),
        supplements: Array.isArray(parsed.supplements)
          ? (parsed.supplements as Record<string, unknown>[])
              .filter((s) => s && typeof s === 'object' && String(s.name || '').trim())
              .map((s) => ({ name: String(s.name).trim(), why: String(s.why || '').trim() }))
              .slice(0, 60)
          : [],
        avoid: asList(parsed.avoid),
        notes: asList(parsed.notes),
      }
    }
    return accumulated
  } catch {
    throw new Error('Could not reliably extract the agreed chat plan. Your saved discussion is unchanged; retry dashboard generation.')
  }
}

// The block injected into the generator's prompts. Worded as what it is:
// decisions already made by the coach, which the model follows rather than
// reconsiders.
export function agreedPlanBlock(plan: AgreedPlan): string {
  if (isEmptyPlan(plan)) return ''
  const section = (title: string, items: string[]) =>
    items.length ? `${title}:\n${items.map((i) => `- ${i}`).join('\n')}` : ''
  const supplements = plan.supplements.length
    ? `Supplements agreed (for the coach's clinical notes, not the patient's daily guidance):\n${plan.supplements
        .map((s) => `- ${s.name}${s.why ? ` — ${s.why}` : ''}`)
        .join('\n')}`
    : ''
  return [
    section('Daily habits agreed', plan.lifestyle),
    section('Meals agreed', plan.meals),
    section('Week-by-week focus agreed', plan.weeklyFocus),
    section('To avoid', plan.avoid),
    supplements,
    section('Other decisions', plan.notes),
  ]
    .filter(Boolean)
    .join('\n\n')
}
