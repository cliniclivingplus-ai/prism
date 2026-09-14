// Columns a client is allowed to set on a hub `patients` row — shared by the
// create route (POST /api/patients) and the edit route (PATCH
// /api/patients/[id]) so the allowlist can't drift between the two. Before
// this existed, PATCH did `.update(body)` with no allowlist at all — any
// caller could set any column, including columns added by a later
// migration — the exact vulnerability POST was already fixed for.
export const WRITABLE_PATIENT_FIELDS = [
  'full_name',
  'clinic_patient_id',
  'gender',
  'date_of_birth',
  'age_years',
  'program',
  'primary_concern',
  'allergies',
  'medical_history',
  'phone',
  'email',
  'nutritionist_id',
] as const

export type WritablePatientField = (typeof WRITABLE_PATIENT_FIELDS)[number]

// An empty string means "not recorded", stored as NULL rather than '' — see
// the allergies note on the Add/Edit patient forms — so "unknown" and
// "recorded as blank" stay distinguishable.
export function cleanPatientFields(body: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const key of WRITABLE_PATIENT_FIELDS) {
    if (!(key in body)) continue
    const v = body[key]
    if (v === undefined) continue
    if (v === null) { row[key] = null; continue }
    if (typeof v === 'string') {
      const t = v.trim()
      row[key] = t ? t : null
      continue
    }
    row[key] = v
  }
  return row
}
