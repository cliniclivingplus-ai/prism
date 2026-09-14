import { supabaseAdmin } from '@/lib/supabase'
import { supabaseMrx } from '@/lib/supabase'
import { parsePrescriptionRow } from '@/lib/mrxPrescription'
import type { GuideData } from './ClientGuideDocument'

// The one place that decides what goes into "Your supplement plan" —
// previously duplicated across the live dashboard page, the coach-editing
// guide-data API, and (not at all, a separate gap) the PDF route, which is
// exactly how the MicrobiomeRX merge added to one of them silently never
// reached the others. Two sources, both gated on an explicit human
// confirmation step, merged and returned in that order:
// 1. EVERY patient_reports row a coach has explicitly reviewed & confirmed
//    (see ReportsTab.tsx's review step) — a patient can have more than one
//    active prescription (e.g. one from their GP, one from a specialist),
//    and confirming a second one used to silently drop the first's
//    supplements from the dashboard (this only ever read the single most
//    recent confirmed report). All confirmed reports are merged now, most
//    recent first.
// 2. A linked MicrobiomeRX patient's doctor-approved prescription
//    (approved via that app's own "Approve RX" step) — same confirmed-only
//    trust model, so it belongs here on equal footing, appended rather
//    than replacing the patient_reports list.
export async function resolveConfirmedSupplements(patientId: string): Promise<GuideData['confirmedSupplements']> {
  const { data: supplementReports } = await supabaseAdmin
    .from('patient_reports')
    .select('supplements')
    .eq('patient_id', patientId)
    .eq('supplements_confirmed', true)
    .not('supplements', 'is', null)
    .order('created_at', { ascending: false })

  const mrxSupplements: GuideData['confirmedSupplements'] = []
  try {
    // Two ways to find this patient's reports, tried in order — same
    // priority as app/api/patients/[id]/mrx-link/route.ts's
    // fetchLinkedPatient, which had this exact gap until it was fixed
    // there: this function still only ever did the name-match fallback,
    // so a report correctly linked by id never reached the roadmap's
    // supplement plan even after the mrx-link tab itself was fixed to see it.
    //
    // 1. The unambiguous path: mrx.reports.clp_patient_id, the direct hub
    //    foreign key set on every report uploaded via ?patient=<hub id>
    //    since v35.
    // 2. Legacy fallback: the linked mrx.patients row's own name, for
    //    pre-v35 reports with no patient_id.
    const { data: hubReports } = await supabaseMrx.from('reports').select('id').eq('clp_patient_id', patientId)
    let reportIds = (hubReports ?? []).map((r) => r.id)

    if (reportIds.length === 0) {
      const { data: mrxLink } = await supabaseAdmin
        .from('mrx_patient_links')
        .select('mrx_patient_id')
        .eq('clp_patient_id', patientId)
        .maybeSingle()
      if (mrxLink) {
        const { data: mrxPatient } = await supabaseMrx.from('patients').select('name').eq('id', mrxLink.mrx_patient_id).maybeSingle()
        if (mrxPatient) {
          const { data: mrxReports } = await supabaseMrx.from('reports').select('id').ilike('patient_name', mrxPatient.name)
          reportIds = (mrxReports ?? []).map((r) => r.id)
        }
      }
    }

    if (reportIds.length > 0) {
      const { data: rxRow } = await supabaseMrx
        .from('prescriptions')
        .select('approved_at, rx_data')
        .in('report_id', reportIds)
        .not('approved_at', 'is', null)
        .order('approved_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const prescription = parsePrescriptionRow(rxRow)
      if (prescription) {
        // "Your supplement plan" means supplements — therapies and dietary
        // items belong to their own sections of the prescription, not here.
        for (const item of prescription.items.filter((it) => it.section === 'supplements')) {
          // item.detail is free text from MicrobiomeRX's own review page,
          // usually "dose · timing · duration" but not guaranteed —
          // split what's there into the right columns, put everything
          // else in dose rather than dropping it.
          const parts = item.detail.split('·').map((p) => p.trim()).filter(Boolean)
          const [dose, timing, duration] = parts.length >= 3 ? parts : [item.detail, '', '']
          mrxSupplements.push({ name: item.name, dose, timing, duration, notes: item.doctorNote })
        }
      }
    }
  } catch { /* linking is optional — never block on it */ }

  const reportSupplements = (supplementReports ?? []).flatMap((r) => r.supplements ?? [])
  return [...reportSupplements, ...mrxSupplements]
}
