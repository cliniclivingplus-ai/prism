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


// Free Gemini fallback (OpenAI-compatible endpoint). Used when a request is
// too big for Groq's per-request cap or every Groq key/model has failed —
// keeps the FULL prompt, unlike trimming. Only GEMINI_API_KEY is needed; no
// paid provider is ever called.
function hasGemini(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim())
}

function estimateTokens(params: ChatCompletionCreateParamsNonStreaming): number {
  const chars = params.messages.reduce((n, m) => n + (typeof m.content === 'string' ? m.content.length : 0), 0)
  return Math.ceil(chars / 4) + (params.max_tokens ?? 1000)
}

async function callGemini(params: ChatCompletionCreateParamsNonStreaming): Promise<ChatCompletion | null> {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) return null
  // If one model is overloaded (503) fall through to the next — all are on the same free key.
  const models = [process.env.GEMINI_MODEL?.trim(), 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'].filter((m, i, a): m is string => !!m && a.indexOf(m) === i)
  try {
    const body: Record<string, unknown> = {
      model: models[0],
      messages: params.messages,
      temperature: params.temperature ?? 0.3,
      // Gemini 2.5 counts its own thinking against the output budget, so a
      // budget sized for Groq's models can cut the answer off mid-JSON.
      max_tokens: Math.min((params.max_tokens ?? 1000) * 3 + 2000, 16000),
      reasoning_effort: 'low',
    }
    if (params.response_format) body.response_format = params.response_format
    // 503 ("high demand") and 429 are transient on Gemini — retry a few
    // times with a growing pause before giving up, so an oversized prompt
    // isn't dropped to the trimmed-Groq path just because of a short spike.
    let res: Response | null = null
    for (const model of models) {
      body.model = model
      for (let attempt = 0; attempt < 2; attempt++) {
        res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify(body),
        })
        if (res.ok || (res.status !== 503 && res.status !== 429)) break
        console.warn(`[Gemini fallback] ${model} ${res.status}, ${attempt === 0 ? 'retrying' : 'trying next model'}...`)
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1500))
      }
      if (res && (res.ok || (res.status !== 503 && res.status !== 429))) break
    }
    if (!res || !res.ok) {
      console.warn(`[Gemini fallback] ${res?.status}: ${(await res?.text() ?? '').slice(0, 200)}`)
      return null
    }
    return (await res.json()) as ChatCompletion
  } catch (e) {
    console.warn('[Gemini fallback] failed:', e instanceof Error ? e.message : e)
    return null
  }
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

  // 0. Requests already known to exceed Groq's ~8000-token per-request cap
  // go straight to Gemini with the full, untrimmed prompt.
  if (hasGemini() && estimateTokens(params) > 7000) {
    const viaGemini = await callGemini(params)
    if (viaGemini) return viaGemini
  }

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
  if (tooLarge && hasGemini()) {
    const viaGemini = await callGemini(params)
    if (viaGemini) return viaGemini
  }
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

  // 3. Last resort: free Gemini, whatever the error was.
  if (hasGemini() && isRateOrQuotaError(lastError)) {
    const viaGemini = await callGemini(params)
    if (viaGemini) return viaGemini
  }

  throw lastError
}

