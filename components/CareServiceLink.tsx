'use client'
import type { CSSProperties } from 'react'
import { ExternalLink } from 'lucide-react'

// "What's included in your care" tiles can carry one link — a meeting room,
// a Google Form, a booking page, anything the coach wants the patient to
// open. Stored on the service itself (guide_overrides.care_services[i].link
// / .linkLabel) so it travels with the tile across every template.

// Coaches paste links in whatever shape their browser gave them, so a bare
// "meet.google.com/abc-defg-hij" is accepted and given https://. Anything
// that isn't http(s) after that (javascript:, mailto: typos, free text) is
// refused — this lands as a real <a href> on a public patient page.
export function careLinkHref(raw?: string | null): string | null {
  const trimmed = (raw || '').trim()
  if (!trimmed || /\s/.test(trimmed)) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname.includes('.')) return null
    return url.toString()
  } catch {
    return null
  }
}

// A service saved with no name and no link renders as a bare icon tile —
// patients never see those, and the section hides when nothing else is left.
export function isVisibleCareService(svc: { name?: string; link?: string }): boolean {
  return !!(svc.name?.trim() || careLinkHref(svc.link))
}

// A button label that says what the link actually is when the coach
// didn't write one.
export function careLinkDefaultLabel(href: string): string {
  const host = new URL(href).hostname.replace(/^www\./, '')
  const path = new URL(href).pathname
  if (/^(meet\.google\.com|zoom\.us|[\w-]+\.zoom\.us|teams\.microsoft\.com|teams\.live\.com|whereby\.com|meet\.jit\.si)$/.test(host)) return 'Join meeting'
  if (host === 'forms.gle' || (host === 'docs.google.com' && path.startsWith('/forms')) || host === 'forms.office.com' || host.endsWith('typeform.com')) return 'Open form'
  if (host === 'calendly.com' || host === 'cal.com') return 'Book a slot'
  return 'Open link'
}

// Patient-facing: a filled, accent-coloured pill so it reads as the one
// thing to tap on the tile. Rendered as a sibling of the tile's own toggle
// button (never inside it — an <a> inside a <button> is invalid and the
// click would also toggle the tile).
// Twelve templates, twelve accents — some light (Neon's cyan, Onyx's gold)
// — so the text colour follows the accent's luminance unless one is given.
function readableOn(accent: string): string {
  const m = accent.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return '#fff'
  const hex = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#14151A' : '#fff'
}

export function CareServiceLinkButton({ link, label, accent, color, style }: {
  link?: string
  label?: string
  accent: string
  color?: string
  style?: CSSProperties
}) {
  const href = careLinkHref(link)
  if (!href) return null
  return (
    <a data-care-link href={href} target="_blank" rel="noopener noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 999, background: accent, color: color ?? readableOn(accent), fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none', lineHeight: 1.2, boxShadow: '0 1px 2px rgba(0,0,0,0.12)', ...style }}>
      <ExternalLink size={13} /> {label?.trim() || careLinkDefaultLabel(href)}
    </a>
  )
}

// Coach-facing: the URL + optional button label pair, with a live check so
// a link that won't open for the patient is flagged before it's saved.
export function CareServiceLinkFields({ link, label, onLink, onLabel, onBlur, inputStyle, mutedColor = '#8A9284' }: {
  link?: string
  label?: string
  onLink: (v: string) => void
  onLabel: (v: string) => void
  onBlur?: () => void
  inputStyle: CSSProperties
  mutedColor?: string
}) {
  const href = careLinkHref(link)
  const invalid = !!(link || '').trim() && !href
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, width: '100%' }}>
      <div>
        <input value={link || ''} onChange={(e) => onLink(e.target.value)} onBlur={onBlur}
          placeholder="Link (meeting, Google Form, any URL)" inputMode="url"
          style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', borderColor: invalid ? '#B3261E' : (inputStyle.borderColor as string | undefined) }} />
        <div style={{ fontSize: 11, marginTop: 3, color: invalid ? '#B3261E' : mutedColor }}>
          {invalid ? 'Not a working web link — check it starts with a website address.' : href ? `Patient sees: “${label?.trim() || careLinkDefaultLabel(href)}”` : 'Optional — shows as a button on the tile.'}
        </div>
      </div>
      <input value={label || ''} onChange={(e) => onLabel(e.target.value)} onBlur={onBlur}
        placeholder={href ? `Button text (default: ${careLinkDefaultLabel(href)})` : 'Button text (optional)'}
        style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', alignSelf: 'start' }} />
    </div>
  )
}
