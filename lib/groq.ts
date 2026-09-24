import fs from 'fs'
import path from 'path'
import Groq from 'groq-sdk'
import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming } from 'groq-sdk/resources/chat/completions'

/**
 * Collect all unique Groq API keys from:
 * 1. groq_api_keys.txt in project root (extracting all gsk_... strings)
 * 2. GROQ_API_KEYS (comma/newline separated string)
 * 3. GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3, ..., GROQ_API_KEY_20
 */
export function getGroqKeys(): string[] {
  const keys: string[] = []

  // 1. Read groq_api_keys.txt if present in process.cwd()
  try {
    const filePath = path.join(process.cwd(), 'groq_api_keys.txt')
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const matches = content.match(/gsk_[A-Za-z0-9_]+/g)
      if (matches) keys.push(...matches)
    }
  } catch (err) {
    console.warn('[Groq Key Pool] Warning reading groq_api_keys.txt:', err)
  }

  // 2. Read GROQ_API_KEYS environment variable
  if (process.env.GROQ_API_KEYS) {
    const matches = process.env.GROQ_API_KEYS.match(/gsk_[A-Za-z0-9_]+/g)
    if (matches) {
      keys.push(...matches)
    } else {
      const list = process.env.GROQ_API_KEYS.split(/[\n,;]+/).map((k) => k.trim()).filter(Boolean)
      keys.push(...list)
    }
  }

  // 3. Read single and numbered GROQ_API_KEY, GROQ_API_KEY_1..50
  const singleKey = process.env.GROQ_API_KEY?.trim()
  if (singleKey) keys.push(singleKey)

  for (let i = 1; i <= 50; i++) {
    const k = process.env[`GROQ_API_KEY_${i}`]?.trim()
    if (k) keys.push(k)
  }

  // 4. Any env var value that looks like a Groq key (gsk_...)
  Object.values(process.env).forEach((val) => {
    if (typeof val === 'string' && val.startsWith('gsk_')) {
      keys.push(val.trim())
    }
  })

  return Array.from(new Set(keys))
}


function parseTooLarge(err: unknown): { limit: number; requested: number } | null {
  const message = err instanceof Error ? err.message : String(err)
  const m = message.match(/Limit\s+(\d+),\s*Requested\s+(\d+)/i)
  if (!m || !/413|too large/i.test(message)) return null
  return { limit: Number(m[1]), requested: Number(m[2]) }
}

// Roughly 4 characters per token. Trims the completion budget first (never
// below 600), then cuts the tail off the longest message for what's left.
function shrinkToFit(params: ChatCompletionCreateParamsNonStreaming, limit: number, requested: number): ChatCompletionCreateParamsNonStreaming | null {
  let over = requested - Math.floor(limit * 0.92)
  const next: ChatCompletionCreateParamsNonStreaming = { ...params, messages: params.messages.map((m) => ({ ...m })) }
  const maxTokens = next.max_tokens ?? 0
  if (maxTokens > 600) {
    const cut = Math.min(over, maxTokens - 600)
    next.max_tokens = maxTokens - cut
    over -= cut
  }
  if (over > 0) {
    let idx = -1
    let len = 0
    next.messages.forEach((m, i) => {
      const l = typeof m.content === 'string' ? m.content.length : 0
      if (l > len) { len = l; idx = i }
    })
    if (idx < 0) return null
    const content = next.messages[idx].content as string
    const keep = content.length - over * 4
    if (keep < 800) return null
    ;(next.messages[idx] as { content: string }).content = content.slice(0, keep) + ' [...trimmed to fit the model request limit]'
  }
  return next
}

export function hasGroqKey(): boolean {
  return getGroqKeys().length > 0
}

interface GroqClientEntry {
  key: string
  client: Groq
}

let cachedKeysJoined = ''
let pool: GroqClientEntry[] = []
let currentKeyIndex = 0

function getPool(): GroqClientEntry[] {
  const keys = getGroqKeys()
  const keysJoined = keys.join(',')

  // Re-initialize pool if keys changed or pool is empty
  if (pool.length === 0 || keysJoined !== cachedKeysJoined) {
    cachedKeysJoined = keysJoined
    if (keys.length === 0) {
      const fallbackKey = process.env.GROQ_API_KEY || ''
      pool = [{ key: fallbackKey, client: new Groq({ apiKey: fallbackKey }) }]
    } else {
      pool = keys.map((key) => ({ key, client: new Groq({ apiKey: key }) }))
    }
    currentKeyIndex = 0
  }
  return pool
}

function isRateOrQuotaError(err: unknown): boolean {
  const status = (err as { status?: number })?.status
  if (status === 429 || status === 413 || status === 503 || status === 502) return true
  const message = err instanceof Error ? err.message : String(err)
  return /rate_limit_exceeded|429|413|503|502|token_limit_exceeded|tpm|tokens|quota|exceeded/i.test(message)
}

/**
 * Execute Groq Chat Completion with automatic multi-key pool round-robin rotation and failover.
 * Dynamically rotates across all keys found in groq_api_keys.txt or environment variables.
 * Falls back to high-TPM models (llama-3.3-70b-versatile, llama-3.1-8b-instant) and secondary providers if rate limited.
 */
export async function groqChatCompletion(
  params: ChatCompletionCreateParamsNonStreaming
): Promise<ChatCompletion> {
  const clients = getPool()
  let lastError: unknown = null
  const poolSize = clients.length

  // 1. Primary Attempt Loop across all available Groq API keys
  for (let attempt = 0; attempt < poolSize; attempt++) {
    const index = (currentKeyIndex + attempt) % poolSize
    const { key, client } = clients[index]
    const keyAbbr = key ? `${key.slice(0, 8)}...` : 'empty'

    try {
      const result = await client.chat.completions.create(params)
      // Advance starting key index for next request (round-robin rotation)
      currentKeyIndex = (index + 1) % poolSize
      return result
    } catch (err) {
      lastError = err
      const isFailoverCandidate = isRateOrQuotaError(err) || poolSize > 1
      if (attempt < poolSize - 1 && isFailoverCandidate) {
        const nextIndex = (index + 1) % poolSize
        const nextKeyAbbr = clients[nextIndex].key ? `${clients[nextIndex].key.slice(0, 8)}...` : 'empty'
        console.warn(
          `[Groq Key Pool] Key #${index + 1} (${keyAbbr}) hit error (${err instanceof Error ? err.message.slice(0, 100) : err}). Automatically failing over to Key #${nextIndex + 1} (${nextKeyAbbr})...`
        )
        continue
      }
    }
  }

  // 1b. A 413 "Request too large" is about this ONE request's size against a
  // hard per-request cap (e.g. 8000 tokens on the on-demand tier), not about
  // how busy a key is — rotating keys can never fix it, since every key has
  // the same cap. Shrink the request itself (completion budget first, then
  // trim the longest message) and retry once before falling to other models.
  const tooLarge = parseTooLarge(lastError)
  if (tooLarge) {
    const shrunk = shrinkToFit(params, tooLarge.limit, tooLarge.requested)
    if (shrunk) {
      console.warn(`[Groq] Request too large (${tooLarge.requested} > ${tooLarge.limit} tokens). Retrying with a trimmed request...`)
      for (let attempt = 0; attempt < poolSize; attempt++) {
        const index = (currentKeyIndex + attempt) % poolSize
        try {
          const result = await clients[index].client.chat.completions.create(shrunk)
          currentKeyIndex = (index + 1) % poolSize
          return result
        } catch (e) {
          lastError = e
        }
      }
    }
  }

  // 2. Fallback Models Loop across all API keys (if request hit 413/TPM rate limits on gpt-oss or primary model)
  if (isRateOrQuotaError(lastError)) {
    const fallbackModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen-2.5-32b', 'mixtral-8x7b-32768']
    for (const fbModel of fallbackModels) {
      if (fbModel === params.model) continue
      console.warn(`[Groq Key Pool] Request rate-limited on ${params.model}. Retrying with fallback model '${fbModel}' across key pool...`)
      
      const fallbackParams: ChatCompletionCreateParamsNonStreaming = {
        ...params,
        model: fbModel,
        max_tokens: Math.min(params.max_tokens ?? 2500, 2500),
      }
      delete (fallbackParams as unknown as Record<string, unknown>).reasoning_effort

      for (let attempt = 0; attempt < poolSize; attempt++) {
        const index = (currentKeyIndex + attempt) % poolSize
        const { client } = clients[index]
        try {
          const result = await client.chat.completions.create(fallbackParams)
          currentKeyIndex = (index + 1) % poolSize
          return result
        } catch (fbErr) {
          console.warn(`[Groq Key Pool] Fallback '${fbModel}' failed on key #${index + 1}:`, fbErr instanceof Error ? fbErr.message.slice(0, 100) : fbErr)
        }
      }
    }
  }

  // 3. Secondary Provider Fallback (OpenRouter / OpenAI) if all Groq keys and models hit rate limits
  const secondaryKey = process.env.OPENROUTER_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  if (secondaryKey && isRateOrQuotaError(lastError)) {
    const isOpenRouter = Boolean(process.env.OPENROUTER_API_KEY?.trim())
    const baseUrl = isOpenRouter ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1'
    const fallbackModel = isOpenRouter ? 'meta-llama/llama-3.3-70b-instruct' : 'gpt-4o-mini'
    console.warn(`[Groq Key Pool] All Groq keys/models rate limited. Failing over to ${baseUrl} (${fallbackModel})...`)
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secondaryKey}`,
        },
        body: JSON.stringify({
          model: fallbackModel,
          messages: params.messages,
          max_tokens: Math.min(params.max_tokens ?? 2500, 2500),
          temperature: params.temperature ?? 0.7,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        return json as ChatCompletion
      }
    } catch (e) {
      console.error('[Groq Key Pool] Secondary provider fallback failed:', e)
    }
  }

  throw lastError
}

