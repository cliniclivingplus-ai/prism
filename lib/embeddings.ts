// Runtime embeddings using HF Inference Providers (the "hf-inference" provider).
// Same model as the bulk KB ingestion script: all-MiniLM-L6-v2 (384 dim)
//
// api-inference.huggingface.co (the old free "Inference API") is fully
// decommissioned — the hostname doesn't even resolve anymore. Confirmed via
// DNS lookup and by testing in both this dev environment and production;
// every single "HF embedding error: fetch failed" all session was this,
// not a network/firewall issue. router.huggingface.co is the current
// endpoint for Inference Providers.
const HF_MODEL = 'sentence-transformers/all-MiniLM-L6-v2'
const HF_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}/pipeline/feature-extraction`

export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.HUGGINGFACE_API_KEY
  if (!apiKey) {
    console.log('No HF API key — skipping vector search')
    return null
  }

  try {
    const res = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: text.slice(0, 512), // MiniLM max tokens
        options: { wait_for_model: true },
      }),
      signal: AbortSignal.timeout(8000), // 8s timeout
    })

    if (!res.ok) {
      console.log('HF API error:', res.status, await res.text())
      return null
    }

    const data = await res.json()

    // HF returns nested array for feature-extraction
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0] as number[]
    }
    if (Array.isArray(data)) {
      return data as number[]
    }

    console.log('Unexpected HF response shape:', JSON.stringify(data).slice(0, 100))
    return null
  } catch (err) {
    console.log('HF embedding error:', err instanceof Error ? err.message : err)
    return null
  }
}

// Aliases for backwards compatibility with kb/route.ts and kb/search/route.ts
export const getEmbedding = embedText

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = []
  for (const text of texts) {
    const embedding = await embedText(text)
    if (embedding) results.push(embedding)
  }
  return results
}

export function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/)
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    chunks.push(words.slice(i, i + chunkSize).join(' '))
    if (i + chunkSize >= words.length) break
  }
  return chunks
}
