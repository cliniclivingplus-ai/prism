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

// Plain-text segments only, alternating with the link spans that sit
// between them (kept untouched, in order).
function splitOnLinks(text: string): { plain: string[]; links: string[] } {
  return { plain: text.split(LINK_SPAN), links: text.match(LINK_SPAN) ?? [] }
}

export function autoLinkText(text: string, bank: KeywordLinkEntry[]): { next: string; linkedCount: number } {
  if (!text || bank.length === 0) return { next: text, linkedCount: 0 }

  // Longest phrase first, so "1 tsp psyllium husk" wins over the shorter
  // "psyllium husk" when both are known and both would match.
  const sorted = [...bank].sort((a, b) => b.keyword.length - a.keyword.length)

  let linkedCount = 0
  const linkedNorms = new Set<string>() // one auto-link per keyword per box, avoid over-linking repeats

  // Each plain-text run is a list of {text} chunks that are still fair
  // game, threaded between {link} chunks created this pass — a keyword
  // match can only search inside a {text} chunk, and once a match creates
  // a {link} chunk, later (different) keywords can never search inside
  // it. That's the piece the old single-string version got wrong: "Tea"
  // matching for a second time *inside* the "[Fennel Tea](...)" link
  // "Fennel Tea" itself had just created.
  type Chunk = { kind: 'text'; value: string } | { kind: 'link'; value: string }

  function linkPlainRun(run: string): Chunk[] {
    let chunks: Chunk[] = [{ kind: 'text', value: run }]
    for (const entry of sorted) {
      if (linkedNorms.has(entry.keyword_norm)) continue
      let matched = false
      chunks = chunks.flatMap((chunk): Chunk[] => {
        if (chunk.kind === 'link' || matched) return [chunk]
        const idx = chunk.value.toLowerCase().indexOf(entry.keyword.toLowerCase())
        if (idx === -1) return [chunk]
        matched = true
        const before = chunk.value.slice(0, idx)
        const phrase = chunk.value.slice(idx, idx + entry.keyword.length)
        const after = chunk.value.slice(idx + entry.keyword.length)
        const out: Chunk[] = []
        if (before) out.push({ kind: 'text', value: before })
        out.push({ kind: 'link', value: `[${phrase}](${entry.url})` })
        if (after) out.push({ kind: 'text', value: after })
        return out
      })
      if (matched) { linkedNorms.add(entry.keyword_norm); linkedCount++ }
    }
    return chunks
  }

  const { plain, links } = splitOnLinks(text)
  const linkedRuns = plain.map((run) => linkPlainRun(run).map((c) => c.value).join(''))

  let next = linkedRuns[0]
  for (let i = 0; i < links.length; i++) {
    next += links[i] + linkedRuns[i + 1]
  }

  return { next, linkedCount }
}
