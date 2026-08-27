import type { MarkerTrend } from './patientTrends'

// Turns a MarkerTrend into plain SVG coordinates for a small sparkline —
// no charting library, same "keep it simple" approach as rangeViz.ts's
// single-value range bar, just extended to a timeline. Points are spaced
// evenly by reading order (not literal date distance) since that reads
// clearly enough for the handful of readings a patient realistically has,
// without irregular-gap math complicating a "simple" visual.

const WIDTH = 260
const HEIGHT = 56
const PAD_X = 8
const PAD_Y = 8

export const TREND_VIEWBOX = `0 0 ${WIDTH} ${HEIGHT}`

function parseBounds(refRange: string): { min: number; max: number } | null {
  const range = refRange.trim()
  const bounds = range.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/)
  const upperOnly = range.match(/^<\s*(\d+(?:\.\d+)?)/)
  const lowerOnly = range.match(/^>\s*(\d+(?:\.\d+)?)/)
  if (bounds) return { min: parseFloat(bounds[1]), max: parseFloat(bounds[2]) }
  if (upperOnly) return { min: 0, max: parseFloat(upperOnly[1]) }
  if (lowerOnly) return { min: parseFloat(lowerOnly[1]), max: parseFloat(lowerOnly[1]) * 1.5 }
  return null
}

export type TrendVizPoint = { x: number; y: number; value: number; date: string; abnormal: boolean }
export type TrendViz = {
  points: TrendVizPoint[]
  pathD: string
  bandTop: number | null    // SVG y of the reference range's high bound
  bandBottom: number | null // SVG y of the reference range's low bound
}

export function computeTrendViz(trend: MarkerTrend): TrendViz | null {
  if (trend.points.length < 2) return null

  const values = trend.points.map((p) => p.value)
  const bounds = parseBounds(trend.refRange)

  let lo = Math.min(...values)
  let hi = Math.max(...values)
  if (bounds) { lo = Math.min(lo, bounds.min); hi = Math.max(hi, bounds.max) }
  if (lo === hi) { lo -= 1; hi += 1 }
  const span = hi - lo
  const padLo = lo - span * 0.15
  const padHi = hi + span * 0.15

  const innerW = WIDTH - PAD_X * 2
  const innerH = HEIGHT - PAD_Y * 2
  const n = trend.points.length
  const yFor = (v: number) => PAD_Y + innerH - ((v - padLo) / (padHi - padLo)) * innerH
  const xFor = (i: number) => PAD_X + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)

  const points = trend.points.map((p, i) => ({ x: xFor(i), y: yFor(p.value), value: p.value, date: p.date, abnormal: p.abnormal }))
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  return {
    points,
    pathD,
    bandTop: bounds ? yFor(bounds.max) : null,
    bandBottom: bounds ? yFor(bounds.min) : null,
  }
}
