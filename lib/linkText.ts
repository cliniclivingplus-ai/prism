import { normalizeLinks } from './renderMarkdownBold'

// Coach-facing editors never show a link's URL — only its phrase. The stored
// text keeps [phrase](https://…) (what every patient view renders as a real
// link); these helpers strip it for display and put it back on save.

// Same link grammar as renderMarkdownBold's LINK_TOKEN; the lookbehind keeps
// ![alt](url) picture lines out of it.
export const INLINE_LINK_RE = /(?<!!)\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g

export function linksIn(text: string): { label: string; url: string }[] {
  return [...normalizeLinks(text || '').matchAll(INLINE_LINK_RE)].map((m) => ({ label: m[1], url: m[2] }))
}

// What the coach sees while typing: every link reduced to its phrase.
export function stripLinks(text: string): string {
  return normalizeLinks(text || '').replace(INLINE_LINK_RE, '$1')
}

// Puts each link from the previously stored text back around its phrase, in
// order. Links already present in `newText` (just made by Link or
// auto-linking) are kept as-is and never re-wrapped. A phrase the coach
// deleted or retyped loses its link, same as deleting linked text in any
// editor.
export function reattachLinks(newText: string, previousText: string): string {
  const prev = linksIn(previousText)
  if (prev.length === 0) return newText
  const kept: string[] = []
  const hold = (s: string) => `\u0000${kept.push(s) - 1}\u0000`
  let work = newText.replace(INLINE_LINK_RE, (m) => hold(m))
  let cursor = 0
  for (const { label, url } of prev) {
    const at = work.indexOf(label, cursor)
    if (at === -1) continue
    const token = hold(`[${label}](${url})`)
    work = work.slice(0, at) + token + work.slice(at + label.length)
    cursor = at + token.length
  }
  return work.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)])
}
