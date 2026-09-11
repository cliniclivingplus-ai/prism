import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'

// Keyword -> hyperlink bank behind the lifestyle/meal editor's auto-link
// feature (see components/ProtocolPickerButton.tsx's sibling, the
// auto-link scan in lib/autoLinkKeywords.ts). Seeded once from the
// clinic's historical PDF exports (migration_v40 + a one-off import), and
// grown from here on: every link a coach creates with LinkInsertButton
// POSTs the phrase+URL pair back to this route.
//
// GET with no query returns the full bank (client caches it once per
// session for local matching — see lib/hooks/useKeywordLinkBank.ts).
// GET ?q= does a server-side search for the "Pick a link" popover so that
// popover doesn't need the whole bank in memory.
const PAGE_SIZE = 1000 // PostgREST's own row cap — .limit() alone can't exceed it, only .range() paging can (see the Knowledge Base fix for the same bug)

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()

  if (q) {
    const { data, error } = await supabaseAdmin
      .from('keyword_links')
      .select('keyword, keyword_norm, url, source, created_at')
      .ilike('keyword_norm', `%${q.toLowerCase()}%`)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // The full-bank fetch is for client-side auto-link matching, not
  // display, so it pages past the 1000-row cap to get everything, then
  // collapses to the newest URL per phrase (one entry per keyword instead
  // of every historical duplicate).
  const all: { keyword: string; keyword_norm: string; url: string; source: string | null; created_at: string }[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('keyword_links')
      .select('keyword, keyword_norm, url, source, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    all.push(...data)
    if (data.length < PAGE_SIZE) break
  }

  const seen = new Set<string>()
  const deduped = all.filter((row) => {
    if (seen.has(row.keyword_norm)) return false
    seen.add(row.keyword_norm)
    return true
  })
  return NextResponse.json(deduped)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const keyword = typeof body?.keyword === 'string' ? body.keyword.trim() : ''
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  const source = typeof body?.source === 'string' ? body.source.trim() : null

  if (!keyword || keyword.length < 2) return NextResponse.json({ error: 'Keyword too short' }, { status: 400 })
  // One URL per row — a "url1; url2" value is what produced unrenderable
  // [phrase](url1; url2) links (see normalizeLinks in lib/renderMarkdownBold).
  if (!/^https?:\/\/[^\s)]+$/i.test(url) || /;\s*https?:\/\//i.test(url)) return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('keyword_links')
    .upsert(
      { keyword, keyword_norm: keyword.toLowerCase(), url, source },
      { onConflict: 'keyword_norm,url', ignoreDuplicates: true }
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
