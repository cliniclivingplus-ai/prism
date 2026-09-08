'use client'
import { useEffect, useState } from 'react'
import type { KeywordLinkEntry } from '@/lib/autoLinkKeywords'

// Module-scoped so every editor box on a page shares one fetch of the
// keyword -> URL bank instead of each textarea re-requesting it.
let cache: KeywordLinkEntry[] | null = null
let inflight: Promise<KeywordLinkEntry[]> | null = null

function fetchBank(): Promise<KeywordLinkEntry[]> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetch('/api/compass/keyword-links')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: KeywordLinkEntry[]) => { cache = data; return data })
      .catch(() => [])
  }
  return inflight
}

export function useKeywordLinkBank() {
  const [bank, setBank] = useState<KeywordLinkEntry[]>(cache ?? [])

  useEffect(() => {
    let cancelled = false
    fetchBank().then((data) => { if (!cancelled) setBank(data) })
    return () => { cancelled = true }
  }, [])

  // Called after a coach manually creates a link (LinkInsertButton), so
  // the newly-added phrase is available for auto-linking elsewhere on the
  // same page without a full page reload.
  function addToBank(keyword: string, url: string) {
    const entry: KeywordLinkEntry = { keyword, keyword_norm: keyword.toLowerCase(), url }
    cache = [entry, ...(cache ?? []).filter((e) => e.keyword_norm !== entry.keyword_norm)]
    setBank(cache)
  }

  return { bank, addToBank }
}
