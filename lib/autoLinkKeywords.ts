// Turns plain typed text into the same `[phrase](url)` markdown-link
// syntax LinkInsertButton writes by hand — see renderMarkdownBold, which
// already renders that syntax as a real, distinctly-styled <a> everywhere
// lifestyle/meal guideline text is shown. This is the "automatic" half:
// given a bank of known keyword -> URL pairs, find any of those phrases
// still sitting as plain text and wrap them.
export interface KeywordLinkEntry {
  keyword: string
  keyword_norm: string
  url: string
}

// Matches `[already linked text](https://...)` spans so we never wrap
// text that's already a link, and never match keyword phrases that only
// appear inside a URL or an existing link label.
const LINK_SPAN = /\[[^\]]*\]\([^)]*\)/g

export function autoLinkText(text: string, bank: KeywordLinkEntry[]): { next: string; linkedCount: number } {
  if (!text || bank.length === 0) return { next: text, linkedCount: 0 }

  // Longest phrase first, so "1 tsp psyllium husk" wins over the shorter
  // "psyllium husk" when both are known and both would match.
  const sorted = [...bank].sort((a, b) => b.keyword.length - a.keyword.length)

  // Work segment-by-segment around existing links so we never touch text
  // that's already inside one, and never re-link a phrase already linked.
  const segments = text.split(LINK_SPAN)
  const existingLinks = text.match(LINK_SPAN) ?? []
  let linkedCount = 0

  const linkedNorms = new Set<string>()

  const nextSegments = segments.map((segment) => {
    let result = segment
    for (const entry of sorted) {
      if (linkedNorms.has(entry.keyword_norm)) continue // one auto-link per keyword per box, avoid over-linking repeats
      const idx = result.toLowerCase().indexOf(entry.keyword.toLowerCase())
      if (idx === -1) continue
      const matched = result.slice(idx, idx + entry.keyword.length)
      result = result.slice(0, idx) + `[${matched}](${entry.url})` + result.slice(idx + entry.keyword.length)
      linkedNorms.add(entry.keyword_norm)
      linkedCount++
    }
    return result
  })

  // Re-interleave the untouched existing links back between the segments.
  let next = nextSegments[0]
  for (let i = 0; i < existingLinks.length; i++) {
    next += existingLinks[i] + nextSegments[i + 1]
  }

  return { next, linkedCount }
}
