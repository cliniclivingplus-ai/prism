import Groq from 'groq-sdk'
import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming } from 'groq-sdk/resources/chat/completions'

// Collect all unique Groq API keys from environment variables:
// 1. GROQ_API_KEYS (comma-separated string, e.g. "gsk_1,gsk_2,gsk_3")
// 2. GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3, ..., GROQ_API_KEY_20
function getGroqKeys(): string[] {
  const keys: string[] = []

  if (process.env.GROQ_API_KEYS) {
    const list = process.env.GROQ_API_KEYS.split(',').map((k) => k.trim()).filter(Boolean)
    keys.push(...list)
  }

  const singleKey = process.env.GROQ_API_KEY?.trim()
  if (singleKey) keys.push(singleKey)

  for (let i = 2; i <= 20; i++) {
    const k = process.env[`GROQ_API_KEY_${i}`]?.trim()
    if (k) keys.push(k)
  }

  return Array.from(new Set(keys))
}

function createGroqPool(): Groq[] {
  const keys = getGroqKeys()
  if (keys.length === 0) {
    return [new Groq({ apiKey: process.env.GROQ_API_KEY || '' })]
  }
  return keys.map((key) => new Groq({ apiKey: key }))
}

let pool: Groq[] = []

function getPool(): Groq[] {
  if (pool.length === 0) {
    pool = createGroqPool()
  }
  return pool
}

function isRateLimitError(err: unknown): boolean {
  const status = (err as { status?: number })?.status
  if (status === 429 || status === 413) return true
  const message = err instanceof Error ? err.message : String(err)
  return /rate_limit_exceeded|429|413|token_limit_exceeded|tpm/i.test(message)
}

/**
 * Execute Groq Chat Completion with automatic multi-key pool rotation and rate-limit failover.
 * Rotates across all configured team keys (GROQ_API_KEY, GROQ_API_KEY_2..20, or GROQ_API_KEYS).
 */
export async function groqChatCompletion(
  params: ChatCompletionCreateParamsNonStreaming
): Promise<ChatCompletion> {
  const clients = getPool()
  let lastError: unknown = null

  for (let index = 0; index < clients.length; index++) {
    const client = clients[index]
    try {
      return await client.chat.completions.create(params)
    } catch (err) {
      lastError = err
      if (isRateLimitError(err) && index < clients.length - 1) {
        console.warn(
          `[Groq Key Pool] Key #${index + 1} hit rate limit (${err instanceof Error ? err.message.slice(0, 100) : err}). Automatically failing over to Key #${index + 2}...`
        )
        continue
      }
      throw err
    }
  }

  throw lastError
}
