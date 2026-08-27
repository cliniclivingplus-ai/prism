import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { getEmbedding } from '@/lib/embeddings'

export async function POST(req: NextRequest) {
  try {
    const { query, threshold = 0.3, limit = 10 } = await req.json()
    if (!query) return NextResponse.json({ error: 'No query' }, { status: 400 })

    const queryEmbedding = await getEmbedding(query)
    if (!queryEmbedding) return NextResponse.json({ error: 'Embedding failed' }, { status: 500 })

    const { data, error } = await supabaseAdmin.rpc('match_kb_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
    })

    if (error) throw new Error(error.message)

    const documentIds = [...new Set((data ?? []).map((d: { document_id: string }) => d.document_id))]
    const { data: docs } = await supabaseAdmin
      .from('kb_documents')
      .select('id, title, source_type')
      .in('id', documentIds)

    const docMap = Object.fromEntries((docs ?? []).map((d: { id: string; title: string; source_type: string }) => [d.id, d]))

    const results = (data ?? []).map((chunk: { id: string; content: string; document_id: string; similarity: number }) => ({
      id: chunk.id,
      content: chunk.content,
      similarity: chunk.similarity,
      document: docMap[chunk.document_id] ?? null,
    }))

    return NextResponse.json({ results, query })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
