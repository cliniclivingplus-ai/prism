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
      const list = process.env.GROQ_API_KEYS.split(/[\n,]+/).map((k) => k.trim()).filter(Boolean)
      keys.push(...list)
    }
  }

  // 3. Read GROQ_API_KEY single env var
  const singleKey = process.env.GROQ_API_KEY?.trim()
  if (singleKey) keys.push(singleKey)

  // 4. Read numbered GROQ_API_KEY_2 .. 20
  for (let i = 2; i <= 20; i++) {
    const k = process.env[`GROQ_API_KEY_${i}`]?.trim()
    if (k) keys.push(k)
  }

  return Array.from(new Set(keys))
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
 */
export async function groqChatCompletion(
  params: ChatCompletionCreateParamsNonStreaming
): Promise<ChatCompletion> {
  const clients = getPool()
  let lastError: unknown = null
  const poolSize = clients.length

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
      throw err
    }
  }

  throw lastError
}
