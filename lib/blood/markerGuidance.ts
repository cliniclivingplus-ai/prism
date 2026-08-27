// Normalizes a marker/test name for matching across labs that print the
// same test under different names (e.g. "Hb" vs "Haemoglobin" vs
// "Hemoglobin (Hb)") — strip everything but letters/digits, lowercase.
export function normalizeMarkerName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export type MarkerGuidanceRow = {
  id: string
  marker_name: string
  synonyms: string[]
  direction: 'low' | 'high'
  condition_label: string
  explanation: string
  recommended_actions: string
}

// A guidance row matches a marker's own name OR any of its synonyms —
// direction isn't checked here (the caller already knows whether the
// marker came back abnormal; direction in the table is metadata for a
// human reading the seed data, not a second gate).
//
// Two-pass strategy:
// 1. Real printed test names routinely append the abbreviation in
//    parentheses to the full name — "Hemoglobin (Hb)", "Hemoglobin A2
//    (HbA2)", "Mean Corpuscular Volume (MCV)". Try an EXACT match against
//    just that parenthetical first. This matters because a plain
//    substring pass alone would wrongly match "Hemoglobin A2 (HbA2)"
//    against the generic "Hemoglobin" row (its own name IS a substring)
//    before ever reaching the more specific "HbA2" row — a clinically
//    wrong match, since low HbA2 and low Hemoglobin are different
//    findings with different guidance.
// 2. Only if there was NO parenthetical at all, fall back to substring
//    containment against the full test name (handles cases like OCR/text
//    extraction fusing a panel header onto the row name — "Zinc , SERUM
//    Zinc, Serum"). If a parenthetical WAS present but matched nothing
//    (e.g. "Hemoglobin A (HbA)" — "HbA" isn't a seeded marker), that's a
//    strong signal this is a genuinely different, unseeded test, not a
//    naming variant of a seeded one — falling back to a loose substring
//    match here previously attached the generic Hemoglobin/anemia
//    guidance to a hemoglobin *fraction* percentage, producing a
//    clinically misleading rationale for a marker the table doesn't
//    actually cover.
export function findGuidanceMatch(testName: string, rows: MarkerGuidanceRow[]): MarkerGuidanceRow | null {
  const target = normalizeMarkerName(testName)
  if (!target) return null

  const parenMatch = testName.match(/\(([^)]+)\)/)
  if (parenMatch) {
    const abbrev = normalizeMarkerName(parenMatch[1])
    if (abbrev) {
      for (const row of rows) {
        const candidates = [row.marker_name, ...row.synonyms]
        if (candidates.some((c) => normalizeMarkerName(c) === abbrev)) return row
      }
    }
    return null
  }

  // Minimum 4 chars for the loose fallback — short synonyms like "Hb" (2
  // chars) or "Zn" are exact-safe (used above) but not substring-safe:
  // "Hb" is a substring of "HbA1c/Total" too (it's the shared prefix of
  // every hemoglobin-fraction test name — HbA, HbA1c, HbF, HbS...), which
  // wrongly matched a fasting-glucose-adjacent glycated-hemoglobin test
  // against the generic Hemoglobin/anemia row.
  for (const row of rows) {
    const candidates = [row.marker_name, ...row.synonyms]
    if (candidates.some((c) => {
      const norm = normalizeMarkerName(c)
      return norm.length >= 4 && (target.includes(norm) || norm.includes(target))
    })) return row
  }
  return null
}
