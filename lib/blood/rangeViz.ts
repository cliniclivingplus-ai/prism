// Turns a printed result + reference range into simple numbers a range-bar
// can draw — deliberately basic (min/max/value/percent positions), no
// charting library. Returns null whenever the range or result can't be
// read as plain numbers (text results, missing range, garbled OCR), and
// the caller just skips the bar for that row rather than showing a
// misleading one.
export type RangeViz = {
  value: number
  min: number
  max: number
  valuePct: number   // 0-100 position of the value along the padded track
  lowPct: number      // 0-100 position of the reference range's low bound
  highPct: number     // 0-100 position of the reference range's high bound
  inRange: boolean
}

// Pulls the first plain number out of a printed result — shared by the
// single-report range bar here and the cross-report trend builder in
// lib/patientTrends.ts, so both read "8.10 L" the same way instead of two
// near-identical regexes slowly drifting apart.
export function parseNumericResult(result: string): number | null {
  const match = result.match(/\d+(?:\.\d+)?/)
  return match ? parseFloat(match[0]) : null
}

export function computeRangeViz(result: string, refRange: string): RangeViz | null {
  const value = parseNumericResult(result)
  if (value === null) return null

  const range = refRange.trim()
  let min: number
  let max: number

  const bounds = range.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/)
  const upperOnly = range.match(/^<\s*(\d+(?:\.\d+)?)/)
  const lowerOnly = range.match(/^>\s*(\d+(?:\.\d+)?)/)

  if (bounds) {
    min = parseFloat(bounds[1])
    max = parseFloat(bounds[2])
  } else if (upperOnly) {
    max = parseFloat(upperOnly[1])
    min = 0
  } else if (lowerOnly) {
    min = parseFloat(lowerOnly[1])
    max = Math.max(min * 1.5, min + 1, value)
  } else {
    return null
  }
  if (!isFinite(min) || !isFinite(max) || min >= max) return null

  // Pad the visual track beyond the reference range so a value right at
  // (or past) the edge doesn't get clipped against the bar's own ends.
  const span = max - min
  const padMin = min - span * 0.25
  const padMax = max + span * 0.25
  const pct = (n: number) => Math.max(0, Math.min(100, ((n - padMin) / (padMax - padMin)) * 100))

  return {
    value, min, max,
    valuePct: pct(value),
    lowPct: pct(min),
    highPct: pct(max),
    inRange: value >= min && value <= max,
  }
}
