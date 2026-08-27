export type ExtractedMarker = {
  test_name: string
  result: string
  unit: string
  ref_range: string
  flag: string        // whatever the report itself printed, e.g. "H", "L", "*", "" — never invented
  abnormal: boolean
}

export type MarkerRecommendation = {
  test_name: string
  result: string
  matched: boolean          // true if it hit a blood.marker_guidance row
  condition_label: string | null
  rationale: string
}
