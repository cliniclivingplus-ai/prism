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
// Also handles ![alt](url) — standard markdown image syntax, written by
// ImageInsertButton after a coach uploads a picture into a lifestyle/meal/
// goal textarea (same "plain text in, real element out on the read view"
// pattern as the link case). The leading "!" is what tells this apart from
// a plain link at the same position, so it must be checked before the bare
// link alternative — but since only IMAGE_TOKEN's pattern can start with
// "!", there's no real ambiguity in the combined regex either way.
//
// Exported so the react-pdf renderer (lib/pdf/ClientGuideDocument.tsx, which
// can't use raw DOM <a>/<img> tags and needs its own composition) can split
// on the exact same grammar rather than maintaining a second regex that
// could silently drift from this one.
export const MARKDOWN_TOKEN = /(\*\*[^*]+\*\*|!\[[^\]]*\]\(https?:\/\/[^\s)]+\)|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g
export const LINK_TOKEN = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/
export const IMAGE_TOKEN = /^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/

export function renderMarkdownBold(text: string): React.ReactNode {
  if (!text || (!text.includes('**') && !text.includes('![') && !text.includes(']('))) return text
  const parts = text.split(MARKDOWN_TOKEN)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    const image = part.match(IMAGE_TOKEN)
    if (image) {
      // eslint-disable-next-line @next/next/no-img-element -- coach-uploaded, arbitrary external URL; next/image's domain allowlist doesn't fit a per-upload host
      return <img key={i} src={image[2]} alt={image[1]} style={{ maxWidth: '100%', display: 'block', borderRadius: 10, margin: '10px 0' }} />
    }
    const link = part.match(LINK_TOKEN)
    if (link) {
      // Explicit color rather than relying on default/inherited link
      // styling — this needs to read as a link at a glance wherever it
      // shows up (coach editor, patient dashboard, PDF), not blend into
      // the surrounding paragraph text.
      return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB', textDecoration: 'underline', fontWeight: 600 }}>{link[1]}</a>
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}
