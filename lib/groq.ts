import Groq from 'groq-sdk'
import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming } from 'groq-sdk/resources/chat/completions'

// Two Groq accounts, tried in order — the org's on-demand tier has a real,
// regularly-hit daily/per-minute token cap (see interpret/route.ts's own
// TPM-413 history), and a roadmap generation failing outright because of it
// is a worse outcome than briefly drawing on a second account's quota.
// GROQ_API_KEY_2 is optional; when unset this behaves exactly like a plain
// `new Groq(...)` call always did.
const primary = new Groq({ apiKey: process.env.GROQ_API_KEY })
const fallback = process.env.GROQ_API_KEY_2 ? new Groq({ apiKey: process.env.GROQ_API_KEY_2 }) : null

function isRateLimitError(err: unknown): boolean {
  const status = (err as { status?: number })?.status
  if (status === 429) return true
  const message = err instanceof Error ? err.message : String(err)
  return /rate_limit_exceeded|429/i.test(message)
}

// Same call shape as groq.chat.completions.create(...) — pass the same
// params through unchanged. Only retries on a rate-limit error, and only
// once (on the fallback key); any other failure (bad JSON schema, network,
// etc.) surfaces immediately since a second key wouldn't fix it anyway.
// Every current caller wants the non-streaming response shape (none pass
// `stream: true`), so this is typed to that overload specifically —
// otherwise `create`'s streaming/non-streaming union type loses `.choices`
// on the result.
export async function groqChatCompletion(
  params: ChatCompletionCreateParamsNonStreaming
): Promise<ChatCompletion> {
  try {
    return await primary.chat.completions.create(params)
  } catch (err) {
    if (fallback && isRateLimitError(err)) {
      console.log('Groq primary key rate-limited, retrying on GROQ_API_KEY_2:', err instanceof Error ? err.message.slice(0, 150) : err)
      return await fallback.chat.completions.create(params)
    }
    throw err
  }
}
