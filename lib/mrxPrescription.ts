// Mirrors MicrobiomeRX's own review/approve flow (D:\GMB-Report-Analyzer\microbiomerx
// app/report/[id]/review/page.tsx) — a doctor edits AI-suggested supplement/
// therapy/dietary items there, then clicks "Approve RX", which upserts
// mrx.prescriptions with `approved_at` set. That's the only "final,
// doctor-signed-off" state this data ever reaches; an unapproved row (no
// generate-rx button click, or approval since removed via "Remove
// Approval") is a draft and deliberately excluded here — LP Compass
// should only ever show/use what a doctor actually approved.
export type PrescriptionSectionItem = {
  key: string
  label: string
  aicProduct?: string | null
  detail: string
  rationale?: string
  doctorNote?: string
  status: 'kb' | 'modified' | 'added' | 'removed'
  category?: string
  phase?: string
  contraindications?: string
}

export type PrescriptionItem = {
  section: 'supplements' | 'therapies' | 'dietary'
  name: string
  detail: string
  doctorNote: string
  contraindications: string
}

export type ApprovedPrescription = {
  approvedAt: string
  clinicalImpression: string
  doctorNotes: string
  items: PrescriptionItem[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parsePrescriptionRow(row: any): ApprovedPrescription | null {
  if (!row || !row.approved_at || !row.rx_data) return null
  const rxData = row.rx_data as {
    sections?: { supplements?: PrescriptionSectionItem[]; therapies?: PrescriptionSectionItem[]; dietary?: PrescriptionSectionItem[] }
    clinical_impression?: string
    doctor_notes?: string
  }
  const sections = rxData.sections ?? {}
  const items: PrescriptionItem[] = (['supplements', 'therapies', 'dietary'] as const).flatMap((section) =>
    (sections[section] ?? [])
      .filter((it) => it.status !== 'removed')
      .map((it) => ({
        section,
        name: it.aicProduct?.trim() || it.label,
        detail: it.detail || '',
        doctorNote: it.doctorNote || '',
        contraindications: it.contraindications || '',
      }))
  )
  return {
    approvedAt: row.approved_at,
    clinicalImpression: rxData.clinical_impression || '',
    doctorNotes: rxData.doctor_notes || '',
    items,
  }
}

export function buildPrescriptionPromptBlock(rx: ApprovedPrescription): string {
  if (rx.items.length === 0 && !rx.clinicalImpression) return ''
  const lines: string[] = []
  if (rx.clinicalImpression) lines.push(`Clinical impression: ${rx.clinicalImpression}`)
  for (const item of rx.items) {
    const bits = [item.name, item.detail].filter(Boolean).join(' — ')
    const note = item.doctorNote ? ` (doctor's note: ${item.doctorNote})` : ''
    lines.push(`[${item.section}] ${bits}${note}`)
  }
  if (rx.doctorNotes) lines.push(`Doctor's overall notes: ${rx.doctorNotes}`)
  return lines.join('\n')
}
