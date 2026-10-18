import sourceRepairs from './recipeBankSourceRepairs.json'

type Field = 'ingredients' | 'steps'
type SourceRepair = { original: Record<Field, string>; cleaned: Record<Field, string> }
const repairs: Record<string, SourceRepair> = sourceRepairs

// Bank preview only: stored recipes and patient pages retain their data.
// Source corrections stop applying after a coach changes the original field.
export function cleanRecipeBankDisplayText(text: string, kind: Field, id?: string): string {
  const repair = id ? repairs[id] : undefined
  if (repair?.original[kind] === text) return repair.cleaned[kind]
  return text.split('\n').map((rawLine) => {
    let line = rawLine.replace(/^(\s*)[\uF0B7\uF0A7]\s*/, '$1')
    // A glyph before a unit may be a missing fraction. Never invent one.
    line = line.replace(/\uFFFD(?=\s*(?:cups?|tsp|tbsp|teaspoons?|tablespoons?|grams?|g|kg|ml|litres?|liters?)\b)/gi, '[quantity unclear]')
    line = line.replace(/^(\s*)\uFFFD\s+/, '$1')
    // Inline glyphs may be punctuation, fractions or letters. Retain the
    // uncertainty explicitly instead of silently changing recipe meaning.
    return line.replace(/[\uFFFD\uF0B7\uF0A7]/g, '[source text unclear]')
  }).join('\n')
}

export function recipeBankTextNeedsReview(text: string): boolean {
  return /\[(?:quantity|source text) unclear\]/.test(text)
}
