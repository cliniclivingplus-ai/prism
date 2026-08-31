import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { getEmbeddings, chunkText } from '@/lib/embeddings'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string
    const sourceType = formData.get('source_type') as string
    const tags = formData.get('tags') as string
    const manualText = formData.get('manual_text') as string | null

    if (!title || !sourceType) {
      return NextResponse.json({ error: 'Title and source type are required' }, { status: 400 })
    }

    // ── 1. Extract text ──────────────────────────────────────
    let fullText = ''

    if (file && file.size > 0) {
      // Only accept .txt files — simple and reliable
      if (!file.name.endsWith('.txt')) {
        return NextResponse.json({ error: 'Only .txt files are supported. Export your PDF as text first.' }, { status: 400 })
      }
      fullText = await file.text()
    } else if (manualText && manualText.trim()) {
      fullText = manualText.trim()
    } else {
      return NextResponse.json({ error: 'Provide either a .txt file or paste text manually' }, { status: 400 })
    }

    fullText = fullText.replace(/\s+/g, ' ').trim()

    if (fullText.length < 50) {
      return NextResponse.json({ error: 'Content too short to process' }, { status: 400 })
    }

    // ── 2. Save document record ──────────────────────────────
    const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []

    const { data: doc, error: docError } = await supabaseAdmin
      .from('kb_documents')
      .insert({ title, source_type: sourceType, content: fullText, tags: tagsArray })
      .select()
      .single()

    if (docError) throw new Error(docError.message)

    // ── 3. Chunk text ────────────────────────────────────────
    const chunks = chunkText(fullText, 400, 60)

    if (chunks.length === 0) {
      return NextResponse.json({ error: 'Could not extract usable chunks' }, { status: 400 })
    }

    // ── 4. Embed in batches ──────────────────────────────────
    const BATCH_SIZE = 10
    const allEmbeddings: number[][] = []

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)
      const embeddings = await getEmbeddings(batch)
      allEmbeddings.push(...embeddings)
    }

    // ── 5. Store chunks + embeddings ─────────────────────────
    const chunkRows = chunks.map((content, idx) => ({
      document_id: doc.id,
      chunk_index: idx,
      content,
      embedding: `[${allEmbeddings[idx].join(',')}]`,
    }))

    const { error: chunkError } = await supabaseAdmin
      .from('kb_chunks')
      .insert(chunkRows)

    if (chunkError) throw new Error(chunkError.message)

    return NextResponse.json({
      success: true,
      document_id: doc.id,
      title,
      chunks_created: chunks.length,
      characters: fullText.length,
    }, { status: 201 })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('KB ingest error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Paginated — the library has grown to 16,500+ documents, well past
// PostgREST's default 1000-row cap. The old unpaginated query silently
// truncated to the 1000 most-recently-created rows, which meant most
// source types (book, website, ...) simply never appeared: whichever
// type happened to dominate the most recent inserts (youtube, at the
// time this was found) crowded out everything older. `total` and
// `typeCounts` are computed with count-only queries against the WHOLE
// table, independent of pagination, so the header/stat tiles are always
// accurate regardless of how many pages have been loaded.
const PAGE_SIZE = 100
const KNOWN_TYPES = ['book', 'podcast', 'guideline', 'article', 'gemini-note', 'website', 'youtube']

export async function GET(req: NextRequest) {
  const offset = Number(req.nextUrl.searchParams.get('offset') ?? 0)

  const [{ data, error }, { count: total }, typeCountEntries] = await Promise.all([
    supabaseAdmin
      .from('kb_documents')
      .select('id, title, source_type, tags, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
    supabaseAdmin.from('kb_documents').select('id', { count: 'exact', head: true }),
    Promise.all(
      KNOWN_TYPES.map(async (type) => {
        const { count } = await supabaseAdmin.from('kb_documents').select('id', { count: 'exact', head: true }).eq('source_type', type)
        return [type, count ?? 0] as const
      })
    ),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const typeCounts = Object.fromEntries(typeCountEntries)
  const knownTotal = typeCountEntries.reduce((sum, [, n]) => sum + n, 0)
  // Anything not in KNOWN_TYPES (a source_type value added directly in the
  // DB, bypassing the upload form's fixed dropdown) still counts toward
  // the true total instead of silently vanishing from it.
  typeCounts.other = (total ?? 0) - knownTotal

  return NextResponse.json({ documents: data, total: total ?? 0, typeCounts, pageSize: PAGE_SIZE })
}
