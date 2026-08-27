// Ported from Blood Panel Analyzer (D:\Blood-Panel-Analyzer\lib\patientTrends.ts,
// rangeViz.ts, markerGuidance.ts, types.ts) so LP Compass can compute the
// same marker snapshot from a linked patient's `blood.reports` rows without
// a network hop to that app's own deployment. Pure functions, no framework
// dependency — kept in sync by hand since it's a small, stable surface.

export type ExtractedMarker = {
  test_name: string
  result: string
  unit: string
  ref_range: string
  flag: string
  abnormal: boolean
}

export type TrendPoint = { date: string; value: number; abnormal: boolean }
export type MarkerTrend = {
  key: string
  displayName: string
  unit: string
  refRange: string
  points: TrendPoint[]
}

export type TrendSnapshotRow = {
  key: string
  displayName: string
  unit: string
  refRange: string
  latestValue: number
  latestDate: string
  abnormal: boolean
  direction: 'up' | 'down' | 'same' | null
  delta: number | null
}

export function normalizeMarkerName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function parseNumericResult(result: string): number | null {
  const match = result.match(/\d+(?:\.\d+)?/)
  return match ? parseFloat(match[0]) : null
}

type ReportForTrend = { created_at: string; markers: ExtractedMarker[] | null }

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
        trends.set(key, { key, displayName: marker.test_name, unit: marker.unit, refRange: marker.ref_range, points: [point] })
      }
    }
  }
  return [...trends.values()]
}

export function buildTrendSnapshot(trends: MarkerTrend[]): TrendSnapshotRow[] {
  const rows = trends.map((t) => {
    const latest = t.points[t.points.length - 1]
    const prev = t.points.length >= 2 ? t.points[t.points.length - 2] : null
    const delta = prev ? Math.round(Math.abs(latest.value - prev.value) * 100) / 100 : null
    const direction: TrendSnapshotRow['direction'] = prev
      ? latest.value > prev.value ? 'up' : latest.value < prev.value ? 'down' : 'same'
      : null
    return {
      key: t.key, displayName: t.displayName, unit: t.unit, refRange: t.refRange,
      latestValue: latest.value, latestDate: latest.date, abnormal: latest.abnormal,
      direction, delta,
    }
  })
  return rows.sort((a, b) => Number(b.abnormal) - Number(a.abnormal))
}

// Plain-text block for AI prompt injection — abnormal markers first, with
// their real value/unit/reference range so the model has something
// concrete to reason about rather than a vague "blood work was done."
export function buildBloodMarkersPromptBlock(snapshot: TrendSnapshotRow[]): string {
  if (snapshot.length === 0) return ''
  const lines = snapshot.map((s) => {
    const status = s.abnormal ? 'OUT OF RANGE' : 'in range'
    const trend = s.direction && s.direction !== 'same' && s.delta !== null
      ? `, ${s.direction === 'up' ? 'up' : 'down'} ${s.delta} from previous reading`
      : ''
    return `${s.displayName}: ${s.latestValue} ${s.unit} (reference range: ${s.refRange || 'not printed'}) — ${status}${trend}`
  })
  return lines.join('\n')
}
