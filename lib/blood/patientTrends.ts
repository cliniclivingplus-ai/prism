import { normalizeMarkerName } from './markerGuidance'
import { parseNumericResult } from './rangeViz'
import type { ExtractedMarker } from './types'

export type TrendPoint = { date: string; value: number; abnormal: boolean }
export type MarkerTrend = {
  key: string
  displayName: string
  unit: string
  refRange: string
  points: TrendPoint[]
}

type ReportForTrend = { created_at: string; markers: ExtractedMarker[] | null }

// Groups the same test across a patient's reports into one timeline, even
// when it prints under slightly different names report to report (e.g.
// "Hemoglobin" vs "Hemoglobin (Hb)") — reuses normalizeMarkerName, the
// same normalization already used to match a marker against the guidance
// table, just for a different purpose here (grouping, not lookup).
//
// displayName/unit/refRange come from the most recent report that has
// this marker: labs phrase ranges slightly differently report to report,
// and showing whatever was printed most recently is the simplest honest
// choice rather than trying to reconcile possibly-conflicting historical
// ranges into one.
export function buildMarkerTrends(reports: ReportForTrend[]): MarkerTrend[] {
  const sorted = [...reports].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const trends = new Map<string, MarkerTrend>()
  for (const report of sorted) {
    for (const marker of report.markers ?? []) {
      const value = parseNumericResult(marker.result)
      if (value === null) continue
      const key = normalizeMarkerName(marker.test_name)
      if (!key) continue

      const existing = trends.get(key)
      const point: TrendPoint = { date: report.created_at, value, abnormal: marker.abnormal }
      if (existing) {
        existing.points.push(point)
        existing.displayName = marker.test_name
        existing.unit = marker.unit
        existing.refRange = marker.ref_range
      } else {
        trends.set(key, {
          key,
          displayName: marker.test_name,
          unit: marker.unit,
          refRange: marker.ref_range,
          points: [point],
        })
      }
    }
  }

  return [...trends.values()]
}
