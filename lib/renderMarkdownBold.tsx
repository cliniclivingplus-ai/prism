import { Fragment } from 'react'

// AI-generated text (report summaries, chat answers, case summaries, etc.)
// comes back with **bold** markdown syntax, but most of this app renders
// free text as plain strings — so patients/coaches were seeing literal
// asterisks instead of emphasis. This turns just that one construct into
// real <strong> tags; everything else in the string passes through
// unchanged, so it's safe to run over text that has no markdown in it too.
//
// Also handles [label](url) — a coach manually wraps a phrase in a
// lifestyle/meal-guideline textarea to link out to a study, product page, or
// reference article (see DashboardClient's per-period "Link" button). Same
// "narrow fixed grammar, never raw HTML" discipline as the bold case: only
// http(s) URLs render as a real link, anything else (a typo, a javascript:
// URL) falls back to showing the literal bracket text untouched rather than
// producing a broken or unsafe anchor.
// Exported so the react-pdf renderer (lib/pdf/ClientGuideDocument.tsx, which
// can't use raw DOM <a> tags and needs its own <Link>-based composition) can
// split on the exact same grammar rather than maintaining a second regex
// that could silently drift from this one.
export const MARKDOWN_TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g
export const LINK_TOKEN = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/

export function renderMarkdownBold(text: string): React.ReactNode {
  if (!text || (!text.includes('**') && !text.includes(']('))) return text
  const parts = text.split(MARKDOWN_TOKEN)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    const link = part.match(LINK_TOKEN)
    if (link) {
      return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}
