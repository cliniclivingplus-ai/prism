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
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()

  let query = supabaseAdmin
    .from('keyword_links')
    .select('keyword, keyword_norm, url, source, created_at')
    .order('created_at', { ascending: false })

  if (q) {
    query = query.ilike('keyword_norm', `%${q.toLowerCase()}%`).limit(20)
  } else {
    // The full-bank fetch is for client-side auto-link matching, not
    // display — collapsing to the newest URL per phrase keeps the payload
    // to one entry per keyword instead of every historical duplicate.
    query = query.limit(5000)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!q) {
    const seen = new Set<string>()
    const deduped = data.filter((row) => {
      if (seen.has(row.keyword_norm)) return false
      seen.add(row.keyword_norm)
      return true
    })
    return NextResponse.json(deduped)
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const keyword = typeof body?.keyword === 'string' ? body.keyword.trim() : ''
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  const source = typeof body?.source === 'string' ? body.source.trim() : null

  if (!keyword || keyword.length < 2) return NextResponse.json({ error: 'Keyword too short' }, { status: 400 })
  if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('keyword_links')
    .upsert(
      { keyword, keyword_norm: keyword.toLowerCase(), url, source },
      { onConflict: 'keyword_norm,url', ignoreDuplicates: true }
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
