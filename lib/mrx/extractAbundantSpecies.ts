/**
 * lib/extractAbundantSpecies.ts
 *
 * Extracts "Top 5 Abundant Species" per kingdom from BugSpeaks PDFs.
 *
 * ─── Two bugs fixed in this version ────────────────────────────────────────
 *
 * BUG 1 - Page detection failure
 *   Old code:  if (!/ABUNDANT SPECIES/.test(page.text)) continue
 *   Problem:   "ABUNDANT SPECIES" in the PDF header may have a non-breaking
 *              space, be a styled graphic, or be joined without spaces by pdfjs,
 *              causing the regex to never match → 0 pages processed →
 *              falls back to text-based → +1 value shift on every species.
 *   Fix:       Detect pages by checking for kingdom header WORDS in the
 *              word-position data (Bacteria, Archaea, etc. are always real text).
 *
 * BUG 2 - Y-bucket too narrow for bar value labels
 *   Old code:  Math.round(w.top / 6) * 6   (6pt bucket → ±3pt tolerance)
 *   Problem:   In BugSpeaks PDFs the patient-value text printed inside the
 *              bar is laid out 6–8pt above the species-name baseline.  With a
 *              3pt tolerance they land in different row buckets, so the value
 *              is never associated with its species.  The bar value is then
 *              orphaned and the NEXT species' bar value gets assigned instead
 *              (the +1 shift symptom).
 *   Fix:       Don't rely on Y-bucket alone.  After normal row grouping, do a
 *              separate proximity search: for each species name row find the
 *              number with the closest Y within ±Y_VALUE_SEARCH points that
 *              also sits in the bar area (X ≥ BAR_AREA_X).  This is tolerant
 *              of any sub-pixel layout variation the PDF renderer introduces.
 *
 * ─── Layout reminder ────────────────────────────────────────────────────────
 *
 *   Prevotella copri    [████████ 57.064 ████████]   ← patient value
 *               41.285  🍃  64.403                   ← bin boundaries
 *
 *   patient_value: single number inside the bar, high X, near name-row Y
 *   bin1_max/bin2_max: pair of numbers below the bar, same axis row
 */

export type Kingdom = 'Bacteria' | 'Archaea' | 'Fungi' | 'Eukaryota' | 'Viruses'

export interface AbundantSpecies {
  name:          string
  kingdom:       Kingdom
  patient_value: number
  bin1_max:      number
  bin2_max:      number
  bin:           1 | 2 | 3
}

interface PageWord { text: string; x0: number; top: number }
interface PageLike  { text: string; words: PageWord[] }

// ─── Constants ───────────────────────────────────────────────────────────────

const KINGDOM_HEADERS: { label: Kingdom; pattern: RegExp }[] = [
  { label: 'Bacteria',  pattern: /^Bacteria$/i  },
  { label: 'Archaea',   pattern: /^Archaea$/i   },
  { label: 'Fungi',     pattern: /^Fungi$/i      },
  { label: 'Eukaryota', pattern: /^Eukaryota/i  },
  { label: 'Viruses',   pattern: /^Viruses$/i   },
]

const PAGE_STOP = /^(?:Name:|Age:|ID:|Gender:|Sample|Report Generated|Page \d+ of|HOW TO READ)/i

/**
 * BAR_AREA_X - X coordinate (PDF points) beyond which numbers are
 * inside the bar chart area (patient values or axis labels).
 * Species names are always in the left text column (x < ~160pt).
 * The bar chart starts at approximately x=165pt.
 */
const BAR_AREA_X = 160

/**
 * Y_VALUE_SEARCH - half-window (PDF points) for the patient-value
 * proximity search.  The bar-value text is typically within ±8pt of
 * the species-name baseline.  Axis labels (bin boundaries) sit ~12pt
 * below, so 8pt tolerance keeps them separate.
 */
const Y_VALUE_SEARCH = 8

// ─── Helpers ─────────────────────────────────────────────────────────────────

function classifyBin(v: number, b1: number, b2: number): 1 | 2 | 3 {
  const EPS = 1e-9
  if (v < b1 - EPS) return 1
  if (v > b2 + EPS) return 3
  return 2
}

function isNameToken(t: string): boolean {
  if (/^\d+\.?\d*$/.test(t)) return false
  return /^[A-Za-z][A-Za-z0-9.\-_]*$/.test(t)
}

function isNumberToken(t: string): boolean {
  return /^\d+\.\d+$/.test(t) || /^\d+$/.test(t)
}

function groupRows(words: PageWord[], bucket = 6): PageWord[][] {
  const map = new Map<number, PageWord[]>()
  for (const w of words) {
    const key = Math.round(w.top / bucket) * bucket
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(w)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([, ws]) => ws.sort((a, b) => a.x0 - b.x0))
}

// ─── PRIMARY: word-position extractor ────────────────────────────────────────

export function extractAbundantSpeciesFromPages(pages: PageLike[]): AbundantSpecies[] {
  const results: AbundantSpecies[] = []

  for (const page of pages) {
    if (!page.words?.length) continue

    // ── Page detection via kingdom header WORDS (Bug 1 fix) ──────────────
    // Checking page.text for "ABUNDANT SPECIES" is fragile - the heading
    // may use non-breaking spaces, stylised rendering, or be joined without
    // spaces in the pdfjs text stream.  Kingdom words (Bacteria, Archaea …)
    // are always plain text and reliably present in the word data.
    const hasKingdom = KINGDOM_HEADERS.some(k =>
      page.words.some(w => k.pattern.test(w.text)),
    )
    if (!hasKingdom) continue

    // ── Pre-collect bar-value candidates (Bug 2 fix) ─────────────────────
    // These are numbers that appear in the bar-chart area (X ≥ BAR_AREA_X).
    // They include both patient values (inside bars) and axis labels (below bars).
    // We distinguish them by Y-proximity to the species name row.
    const barCandidates = page.words
      .filter(w => isNumberToken(w.text) && w.x0 >= BAR_AREA_X)
      .map(w => ({ value: parseFloat(w.text), top: w.top }))

    // Standard row grouping for navigation structure
    const rows = groupRows(page.words, 6)
    let kingdom: Kingdom | null = null
    let i = 0

    while (i < rows.length) {
      const row     = rows[i]
      const rowText = row.map(w => w.text).join(' ').trim()
      if (!rowText) { i++; continue }

      // Kingdom header
      const km = KINGDOM_HEADERS.find(k => k.pattern.test(rowText))
      if (km) { kingdom = km.label; i++; continue }
      if (!kingdom) { i++; continue }
      if (PAGE_STOP.test(rowText)) { i++; continue }

      // ── Species name row ───────────────────────────────────────────────
      const nameW = row.filter(w => isNameToken(w.text))
      if (nameW.length < 2) { i++; continue }

      const firstUpper = /^[A-Z]/.test(nameW[0].text)
      if (kingdom !== 'Viruses' && !firstUpper) { i++; continue }

      // Y-centroid of the name tokens (used for proximity search)
      const nameY  = nameW.reduce((s, w) => s + w.top, 0) / nameW.length
      let fullName = nameW.map(w => w.text).join(' ').trim()
      let nameEndRow = i

      // Multi-line name continuation (e.g. "Candidatus Nitrosocosmicus" + "hydrocola")
      const numOnRow = row.filter(w => isNumberToken(w.text))
      if (numOnRow.length === 0 && i + 1 < rows.length) {
        const nr = rows[i + 1]
        const nrNames = nr.filter(w => isNameToken(w.text))
        const nrNums  = nr.filter(w => isNumberToken(w.text))
        if (nrNames.length === 1 && nrNums.length === 0 && /^[a-z]/.test(nrNames[0].text)) {
          fullName  += ' ' + nrNames[0].text
          nameEndRow = i + 1
        }
      }

      // ── Patient value: proximity search (Bug 2 fix) ────────────────────
      //
      // First check: is there already a number in the bar area on the SAME
      // row bucket?  (Covers species where Y alignment is exact.)
      //
      // Second check: scan barCandidates for the number with the smallest
      // Y-distance from nameY, within ±Y_VALUE_SEARCH.
      // (Covers species where bar-value text is 3-8pt off the name baseline.)
      //
      // Axis labels sit ~12pt below the name row, outside the search window.

      let patientValue: number | null = null

      const barOnSameRow = numOnRow.filter(w => w.x0 >= BAR_AREA_X)
      if (barOnSameRow.length === 1) {
        patientValue = parseFloat(barOnSameRow[0].text)
      } else {
        // Proximity search across all bar-area numbers on this page
        const nearby = barCandidates
          .filter(c => Math.abs(c.top - nameY) <= Y_VALUE_SEARCH)
          .sort((a, b) => Math.abs(a.top - nameY) - Math.abs(b.top - nameY))
        if (nearby.length > 0) patientValue = nearby[0].value
      }

      // ── Bin boundaries: look-ahead ─────────────────────────────────────
      // The axis row with bin1_max and bin2_max is always below the name row
      // (different Y bucket) and contains exactly 2 numbers.

      let bin1Max: number | null = null
      let bin2Max: number | null = null

      for (let r = nameEndRow + 1; r < Math.min(nameEndRow + 7, rows.length); r++) {
        const ahead     = rows[r]
        const aheadText = ahead.map(w => w.text).join(' ').trim()
        if (!aheadText) continue
        if (KINGDOM_HEADERS.some(k => k.pattern.test(aheadText))) break
        if (PAGE_STOP.test(aheadText)) break

        // Stop at the next species name row
        const aNT = ahead.filter(w => isNameToken(w.text))
        const aNN = ahead.filter(w => isNumberToken(w.text))
        if (aNT.length >= 2 && aNN.length <= 1) {
          const aFirst = /^[A-Z]/.test(aNT[0].text)
          if (kingdom === 'Viruses' || aFirst) break
        }

        const nums = ahead
          .filter(w => isNumberToken(w.text))
          .map(w => parseFloat(w.text))
          .filter(n => !isNaN(n) && n >= 0)

        if (nums.length >= 2 && bin1Max === null) {
          bin1Max = nums[0]; bin2Max = nums[1]
        } else if (nums.length === 1 && patientValue === null) {
          // Some renders put value on a dedicated row below name
          patientValue = nums[0]
        }

        if (patientValue !== null && bin1Max !== null) break
      }

      // ── Emit ──────────────────────────────────────────────────────────
      if (
        patientValue !== null && bin1Max !== null && bin2Max !== null &&
        patientValue >= 0 && bin1Max >= 0 && bin2Max >= 0 &&
        bin1Max <= bin2Max && !isNaN(patientValue) && !isNaN(bin1Max) && !isNaN(bin2Max)
      ) {
        results.push({
          name: fullName, kingdom,
          patient_value: patientValue,
          bin1_max: bin1Max, bin2_max: bin2Max,
          bin: classifyBin(patientValue, bin1Max, bin2Max),
        })
        console.log('[AbundantSpecies]', fullName, '→', patientValue, '|', bin1Max, '/', bin2Max)
      } else {
        console.warn('[AbundantSpecies] Failed:', fullName, { patientValue, bin1Max, bin2Max })
      }

      i++
    }
  }

  console.log('[AbundantSpecies][Pages] Total extracted:', results.length)
  return results
}

// ─── FALLBACK: text-based ────────────────────────────────────────────────────
// Kept for when page-word data is unavailable. Unreliable for BugSpeaks
// PDFs due to unpredictable text-stream ordering (produces +1 value shift).

function parseLineNums(line: string): number[] {
  return line.split(/\s+/).map(t => parseFloat(t)).filter(n => !isNaN(n) && n >= 0 && isFinite(n))
}

const BAD_FIRST = new Set([
  'Handbook','The','Top','Page','BugSpeaks','CLP','Name','Age','ID',
  'Gender','Sample','Report','HOW','How','Please','Note','Each','For',
])

function isSpeciesLine(line: string, kingdom: Kingdom | null): boolean {
  const t = line.trim()
  if (!t || t.length < 5 || t.length > 90) return false
  if (/^[\d\s.]+$/.test(t)) return false
  if (KINGDOM_HEADERS.some(k => k.pattern.test(t))) return false
  const words = t.split(/\s+/)
  if (words.length < 2 || words.length > 6) return false
  if (words.filter(w => /[A-Za-z]/.test(w)).length < 2) return false
  if (BAD_FIRST.has(words[0])) return false
  if (kingdom === 'Viruses') return /^[A-Za-z]/.test(words[0]) && words[0].length >= 3
  return /^[A-Z][a-z]{2,}/.test(words[0])
}

export function extractAbundantSpeciesFromText(text: string): AbundantSpecies[] {
  const results: AbundantSpecies[] = []
  const start = text.search(/ABUNDANT SPECIES|Top 5 Abundant Species/i)
  if (start === -1) return results

  const lines = text.slice(start, start + 35000).split('\n').map(l => l.trim()).filter(Boolean)
  const SKIP  = /^(?:Name:|Age:|ID:|Gender:|Sample|Report Generated|Page \d+|BugSpeaks|CLP|Handbook|\(Handbook|The 5|Top 5|ABUNDANT)/i
  const STOP  = /^(?:KINGDOM DISTRIBUTION|DIVERSITY INDEX|PROBIOTIC|PATHOGEN|FOUNDATION|ANTIBIOTIC|HOW TO READ)/i
  let kingdom: Kingdom | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const km = KINGDOM_HEADERS.find(k => k.pattern.test(line))
    if (km) { kingdom = km.label; continue }
    if (STOP.test(line)) break
    if (SKIP.test(line) || !kingdom || !isSpeciesLine(line, kingdom)) continue

    const tokens  = line.split(/\s+/).filter(Boolean)
    const alphaW  = tokens.filter(t => /[A-Za-z]/.test(t))
    const numLine = tokens.filter(t => /^\d+\.?\d*$/.test(t)).map(Number).filter(n => !isNaN(n) && n >= 0)

    let name = alphaW.join(' ')
    let nEnd = i

    if (numLine.length === 0 && i + 1 < lines.length) {
      const nx = lines[i + 1].split(/\s+/).filter(Boolean)
      if (nx.length === 1 && /^[a-z]/.test(nx[0]) && !/^\d/.test(nx[0])) {
        name += ' ' + nx[0]; nEnd = i + 1
      }
    }

    let pv: number | null = null
    let b1: number | null = null
    let b2: number | null = null

    if (numLine.length >= 3)      { [pv, b1, b2] = numLine }
    else if (numLine.length === 1) { pv = numLine[0] }
    else if (numLine.length === 0 && i > 0) {
      const pr = parseLineNums(lines[i - 1]); if (pr.length === 1) pv = pr[0]
    }

    for (let j = nEnd + 1; j <= Math.min(nEnd + 8, lines.length - 1); j++) {
      const ah = lines[j]
      if (!ah || STOP.test(ah) || SKIP.test(ah)) continue
      if (KINGDOM_HEADERS.some(k => k.pattern.test(ah))) break
      if (isSpeciesLine(ah, kingdom)) break
      const nums = parseLineNums(ah)
      if (nums.length >= 2 && b1 === null) { b1 = nums[0]; b2 = nums[1] }
      else if (nums.length === 1 && pv === null) { pv = nums[0] }
      if (pv !== null && b1 !== null) break
    }

    if (pv !== null && b1 !== null && b2 !== null && pv >= 0 && b1 >= 0 && b2 >= 0 && b1 <= b2) {
      results.push({ name, kingdom, patient_value: pv, bin1_max: b1, bin2_max: b2, bin: classifyBin(pv, b1, b2) })
    }
  }
  console.log('[AbundantSpecies][Text] Extracted:', results.length)
  return results
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export function extractAbundantSpecies(text: string, pages?: PageLike[]): AbundantSpecies[] {
  if (pages?.length) {
    const r = extractAbundantSpeciesFromPages(pages)
    if (r.length > 0) return r
    console.warn('[AbundantSpecies] word-position returned 0 - falling back to text')
  }
  return extractAbundantSpeciesFromText(text)
}
