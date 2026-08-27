// nutritionist_guidelines is a single AI-generated string with four labeled
// sections (Biomarkers / Diet protocol / Supplements / Red flags), each a
// bullet list. This splits it into those sections for reuse across pages
// (Supplements page, "When to reach us" red flags) without re-generating
// anything — same real content, different presentation.
export type ParsedGuidelines = {
  biomarkers: string[]
  dietProtocol: string[]
  supplements: string[]
  redFlags: string[]
}

// The model doesn't always format section headers the same way run to run
// (seen both "• Supplements:" and "• **Supplements**" with no colon, e.g.
// after a model swap changed its default markdown habits) — matching only
// a literal "supplements:" silently found nothing on the latter, so a real
// AI-written supplement list rendered as "no supplements on file yet."
// Stripping markdown bold and making the trailing colon optional makes the
// header match survive that kind of formatting drift without needing the
// prompt to be pixel-perfect.
const SECTION_HEADERS: { key: keyof ParsedGuidelines; pattern: RegExp }[] = [
  { key: 'biomarkers', pattern: /^biomarkers?\b:?/i },
  { key: 'dietProtocol', pattern: /^diet protocol\b:?/i },
  { key: 'supplements', pattern: /^supplements?\b:?/i },
  { key: 'redFlags', pattern: /^red flags?\b:?/i },
]

export function parseNutritionistGuidelines(text: string): ParsedGuidelines {
  const result: ParsedGuidelines = { biomarkers: [], dietProtocol: [], supplements: [], redFlags: [] }
  if (!text) return result

  const lines = text.split('\n')
  let current: keyof ParsedGuidelines | null = null

  for (const rawLine of lines) {
    // Strip leading bullet markers, markdown bold/italic markers, and
    // numbered-list prefixes ("1. ") before matching or storing — content
    // (a supplement name, a biomarker) keeps its own inline formatting,
    // only structural markup at the start of the line is stripped.
    const line = rawLine.trim().replace(/^[•\-*]+\s*/, '').replace(/^\*\*(.*)\*\*$/, '$1').replace(/^\d+\.\s*/, '')
    if (!line) continue
    const header = SECTION_HEADERS.find((h) => h.pattern.test(line) && line.length < 40)
    if (header) { current = header.key; continue }
    if (!current) continue
    const bullet = line.replace(/^\*\*(.*?)\*\*/, '$1').trim()
    if (bullet) result[current].push(bullet)
  }
  return result
}
