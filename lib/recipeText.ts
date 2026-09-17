// Recipe data is stored one logical item per line (both the manual "add
// recipe" form and the bulk .txt/.docx importer already strip any bullet/
// number the coach typed before saving) — so each non-empty line is always
// its own ingredient/step, never merged with the next. This just strips a
// redundant leading marker if one somehow made it into storage anyway (so
// rendering never doubles up "· · ..."), and drops stray PDF page-footer
// artifacts a bulk import might have picked up (e.g. "16 | P a g e").
const PAGE_FOOTER = /^\d+\s*\|\s*p\s*a\s*g\s*e$/i

export type RecipeStructuredItem =
  | { type: 'header'; text: string }
  | { type: 'item'; text: string }

export function isRecipeHeader(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false

  // 1. Matches "-- Title --", "=== Title ===", "--- Title ---", "*** Title ***", "[Title]", "### Title"
  if (/^[-=~#*_]{2,}\s*(.*?)\s*[-=~#*_]{2,}$/.test(trimmed)) return true
  if (/^[-=~#*_]{2,}\s+[A-Za-z0-9]/.test(trimmed)) return true
  if (/[A-Za-z0-9]\s+[-=~#*_]{2,}$/.test(trimmed)) return true
  if (/^\[\s*(.*?)\s*\]$/.test(trimmed)) return true
  if (/^#{1,3}\s+(.*)$/.test(trimmed)) return true

  // 2. Matches "For Dish Name:" or "Dish Name:" (must be short, no numbers/amounts)
  if (/^(for\s+)?([A-Za-z0-9\s&',()/-]{2,45}):$/i.test(trimmed) && !/\d/.test(trimmed) && !/\b(to taste|as needed|optional)\b/i.test(trimmed)) {
    return true
  }

  return false
}

export function cleanRecipeHeader(line: string): string {
  let s = line.trim()
  s = s.replace(/^[-=~#*_\s]+/, '').replace(/[-=~#*_\s]+$/, '')
  s = s.replace(/^\[\s*/, '').replace(/\s*\]$/, '')
  s = s.replace(/:\s*$/, '')
  return s.trim()
}

export function parseRecipeStructuredLines(rawText: string): RecipeStructuredItem[] {
  if (!rawText) return []
  const rawLines = rawText.split('\n').map((l) => l.trim()).filter((l) => l && !PAGE_FOOTER.test(l))
  const items: RecipeStructuredItem[] = []

  for (const rawLine of rawLines) {
    if (isRecipeHeader(rawLine)) {
      items.push({ type: 'header', text: cleanRecipeHeader(rawLine) })
    } else {
      const cleaned = rawLine.replace(/^[•\-·]+\s*/, '').replace(/^\d+[.)]\s*/, '').trim()
      if (cleaned) {
        items.push({ type: 'item', text: cleaned })
      }
    }
  }

  return items
}

export function splitRecipeLines(text: string): string[] {
  return (text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !PAGE_FOOTER.test(l))
    .map((l) => l.replace(/^[•\-·]+\s*/, '').replace(/^\d+[.)]\s*/, ''))
}
