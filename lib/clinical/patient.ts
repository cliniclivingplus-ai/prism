import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeAdherence, formatDate, toolState, type Adherence, type ToolState, type Checkin } from './derive'

export type PatientRecord = {
  id: string
  full_name: string | null
  gender: string | null
  date_of_birth: string | null
  phone: string | null
  primary_concern: string | null
  medical_history: string | null
  clinic_patient_id: string | null
  created_at: string
  coachName: string | null
}

export type CompassSnapshot = {
  hasData: boolean
  adherence: Adherence | null
  roadmapId: string | null
  roadmapStatus: string | null
  /** Live share token for the patient-facing roadmap, null if revoked/absent. */
  shareToken: string | null
  lastSessionDate: string | null
  lastSessionSummary: string | null
  sessionCount: number
  updatedAt: string | null
}

export type MrxSnapshot = {
  hasData: boolean
  /** Id of the saved report, so the workspace can open it directly. */
  reportId: string | null
  reportDate: string | null
  rychIndex: number | null
  rychTier: string | null
  shannon: number | null
  /** SCFA percentages — the one multi-slice composition the report exposes. */
  scfa: { name: string; value: number }[]
  flagged: { name: string; severity: string | null; condition: string | null }[]
  speciesCount: number | null
}

export type BloodMarker = {
  name: string
  result: string
  unit: string | null
  refRange: string | null
  flag: string | null
  abnormal: boolean
}

export type BloodSnapshot = {
  hasData: boolean
  /** Blood Panel's own patient row, for linking into the tool. */
  bloodPatientId: string | null
  reportId: string | null
  reportDate: string | null
  markers: BloodMarker[]
  abnormal: BloodMarker[]
}

export type PatientWorkspace = {
  patient: PatientRecord
  compass: CompassSnapshot
  mrx: MrxSnapshot
  blood: BloodSnapshot
  toolStates: { compass: ToolState; mrx: ToolState; blood: ToolState }
  activity: { label: string; meta: string; tone: 'ok' | 'amber' }[]
}

/** Parse the numeric part of a marker result, for positioning a range marker. */
function numeric(v: unknown): number | null {
  const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

export function rangePosition(m: BloodMarker): number | null {
  const val = numeric(m.result)
  if (val === null || !m.refRange) return null
  const parts = m.refRange.split('-').map((p) => numeric(p))
  if (parts.length !== 2 || parts[0] === null || parts[1] === null) return null
  const [lo, hi] = parts
  if (hi <= lo) return null
  // Reference band occupies the middle 20–75% of the track, matching the
  // gradient in the mockup's .range-track.
  const span = hi - lo
  const pct = 20 + ((val - lo) / span) * 55
  return Math.max(2, Math.min(98, pct))
}

/**
 * sessions.case_summary is JSONB, not text — every non-null row is an object
 * shaped { goal, summary, checklist, coach_quote }. Rendering it straight into
 * JSX throws "Objects are not valid as a React child", so pull the prose field
 * out and fall back to the plain-text column.
 */
function sessionSummaryText(
  caseSummary: unknown,
  postMeetingNotes: unknown
): string | null {
  if (typeof caseSummary === 'string' && caseSummary.trim()) return caseSummary
  if (caseSummary && typeof caseSummary === 'object') {
    const o = caseSummary as Record<string, unknown>
    for (const key of ['summary', 'goal', 'coach_quote']) {
      const v = o[key]
      if (typeof v === 'string' && v.trim()) return v
    }
  }
  if (typeof postMeetingNotes === 'string' && postMeetingNotes.trim()) return postMeetingNotes
  return null
}

export async function loadPatientWorkspace(id: string): Promise<PatientWorkspace | null> {
  const supabase = await createClient('compass')

  const { data: p } = await supabase
    .from('patients')
    .select(
      'id, full_name, gender, date_of_birth, phone, primary_concern, medical_history, clinic_patient_id, created_at, nutritionist_id'
    )
    .eq('id', id)
    .maybeSingle()

  if (!p) return null

  const [coachRes, roadmapRes, sessionsRes, mrxLinkRes, bloodLinkRes] = await Promise.all([
    p.nutritionist_id
      ? supabase.from('nutritionists').select('full_name').eq('id', p.nutritionist_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('roadmaps')
      .select('id, created_at, status, weekly_schedule, duration_months, share_token, share_revoked_at')
      .eq('patient_id', id)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('sessions')
      .select('id, session_date, status, case_summary, post_meeting_notes, created_at')
      .eq('patient_id', id)
      .order('session_date', { ascending: false }),
    supabase.from('mrx_patient_links').select('mrx_patient_id, linked_at').eq('clp_patient_id', id).maybeSingle(),
    supabase.from('blood_patient_links').select('blood_patient_id, linked_at').eq('clp_patient_id', id).maybeSingle(),
  ])

  const roadmap = roadmapRes.data?.[0] ?? null
  const sessions = sessionsRes.data ?? []
  const latestSession = sessions[0] ?? null

  let adherence: Adherence | null = null
  if (roadmap) {
    const { data: checkins } = await supabase
      .from('roadmap_checkins')
      .select('week_number, action_index, checkin_date')
      .eq('roadmap_id', roadmap.id)
    adherence = computeAdherence(roadmap.weekly_schedule, (checkins ?? []) as Checkin[], roadmap.created_at)
  }

  const compass: CompassSnapshot = {
    hasData: Boolean(roadmap || sessions.length),
    adherence,
    roadmapId: roadmap?.id ?? null,
    roadmapStatus: roadmap?.status ?? null,
    // A revoked link must not be offered to the coach as "view as patient".
    shareToken: roadmap?.share_revoked_at ? null : (roadmap?.share_token ?? null),
    lastSessionDate: latestSession?.session_date ?? null,
    lastSessionSummary: sessionSummaryText(
      latestSession?.case_summary,
      latestSession?.post_meeting_notes
    ),
    sessionCount: sessions.length,
    updatedAt: roadmap?.created_at ?? latestSession?.created_at ?? null,
  }

  // ── MicrobiomeRx (mrx schema, reached only through the link table) ──
  const mrx: MrxSnapshot = {
    hasData: false, reportId: null, reportDate: null, rychIndex: null, rychTier: null,
    shannon: null, scfa: [], flagged: [], speciesCount: null,
  }
  {
    const mrxDb = createAdminClient('mrx')
    const mrxPatientId = mrxLinkRes.data?.mrx_patient_id ?? null

    // 1. The unambiguous path: a hub foreign key, set on every report
    //    uploaded after migration v35. No link row or name needed.
    const REPORT_COLS = 'id, created_at, sample_date, rules_output, report_data, species_count'
    let rep = (
      await mrxDb
        .from('reports')
        .select(REPORT_COLS)
        .eq('clp_patient_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data

    // 2. Historical path: the tool's own patient_id, via the link table.
    if (!rep && mrxPatientId) rep = (
      await mrxDb
        .from('reports')
        .select(REPORT_COLS)
        .eq('patient_id', mrxPatientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data

    // 3. Historical fallback, permanent and intended for the pre-v35 rows:
    //    all 207 of them have an empty patient_id and identify their patient
    //    by patient_name only, so nothing above can match them.
    //
    //    Guarded deliberately: if more than one mrx patient shares that name
    //    we refuse to match rather than risk attaching another patient's
    //    stool panel to this record. This is NOT a shim to delete — see
    //    "Known data-quality issues" in CLAUDE.md. New uploads never reach
    //    here, because step 1 resolves them by foreign key.
    if (!rep && mrxPatientId) {
      const { data: mrxPatient } = await mrxDb
        .from('patients')
        .select('name')
        .eq('id', mrxPatientId)
        .maybeSingle()

      const name = (mrxPatient as { name?: string } | null)?.name?.trim()
      if (name) {
        const { data: sameName } = await mrxDb.from('patients').select('id').eq('name', name)
        const unambiguous = (sameName ?? []).length === 1

        if (unambiguous) {
          rep = (
            await mrxDb
              .from('reports')
              .select(REPORT_COLS)
              .eq('patient_name', name)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
          ).data
        }
      }
    }

    if (rep) {
      const rules = (rep.rules_output ?? {}) as Record<string, unknown>
      const rdata = (rep.report_data ?? {}) as Record<string, unknown>
      const scfaRaw = (rdata.scfa ?? {}) as Record<string, number>

      const top = Object.entries(scfaRaw)
        .filter(([, v]) => typeof v === 'number')
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
      const rest = Object.entries(scfaRaw)
        .filter(([, v]) => typeof v === 'number')
        .slice(4)
        .reduce((s, [, v]) => s + v, 0)

      mrx.hasData = true
      mrx.reportId = (rep.id as string) ?? null
      mrx.reportDate = (rep.sample_date as string) ?? (rep.created_at as string) ?? null
      mrx.rychIndex = typeof rules.rych_index === 'number' ? rules.rych_index : null
      mrx.rychTier = typeof rules.rych_tier_label === 'string' ? rules.rych_tier_label : null
      mrx.shannon =
        typeof (rdata.diversity as Record<string, unknown>)?.shannon === 'number'
          ? ((rdata.diversity as Record<string, number>).shannon)
          : null
      mrx.speciesCount = typeof rep.species_count === 'number' ? rep.species_count : null
      mrx.scfa = [
        ...top.map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })),
        ...(rest > 0 ? [{ name: 'other', value: rest }] : []),
      ]
      mrx.flagged = (Array.isArray(rules.flagged_markers) ? rules.flagged_markers : [])
        .slice(0, 8)
        .map((f) => {
          const m = f as Record<string, unknown>
          return {
            name: String(m.markername ?? 'Unknown'),
            severity: typeof m.severity === 'string' ? m.severity : null,
            condition: typeof m.condition_flagged === 'string' ? m.condition_flagged : null,
          }
        })
    }
  }

  // ── Blood Panel (blood schema) ──
  const blood: BloodSnapshot = {
    hasData: false, bloodPatientId: null, reportId: null,
    reportDate: null, markers: [], abnormal: [],
  }
  {
    const bloodDb = createAdminClient('blood')
    const bloodPatientId = bloodLinkRes.data?.blood_patient_id ?? null
    blood.bloodPatientId = bloodPatientId

    // Hub FK first (v36), exactly as for MicrobiomeRx; the tool's own
    // patient_id is the fallback for panels uploaded before that column
    // existed. No name matching on either path.
    const BLOOD_COLS = 'id, created_at, markers'
    let rep = (
      await bloodDb
        .from('reports')
        .select(BLOOD_COLS)
        .eq('clp_patient_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data

    if (!rep && bloodPatientId) rep = (
      await bloodDb
        .from('reports')
        .select(BLOOD_COLS)
        .eq('patient_id', bloodPatientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data

    if (rep) {
      const markers: BloodMarker[] = (Array.isArray(rep.markers) ? rep.markers : []).map((raw) => {
        const m = raw as Record<string, unknown>
        return {
          name: String(m.test_name ?? 'Unknown'),
          result: String(m.result ?? '—'),
          unit: typeof m.unit === 'string' ? m.unit : null,
          refRange: typeof m.ref_range === 'string' ? m.ref_range : null,
          flag: typeof m.flag === 'string' ? m.flag : null,
          abnormal: Boolean(m.abnormal),
        }
      })
      blood.hasData = true
      blood.reportId = (rep.id as string) ?? null
      blood.reportDate = (rep.created_at as string) ?? null
      blood.markers = markers
      blood.abnormal = markers.filter((m) => m.abnormal)
    }
  }

  const activity: PatientWorkspace['activity'] = []
  if (latestSession?.session_date) {
    activity.push({
      label: sessionSummaryText(latestSession.case_summary, latestSession.post_meeting_notes)
        ? 'Session note logged'
        : 'Session recorded',
      meta: `LP Compass · ${formatDate(latestSession.session_date)}`,
      tone: latestSession.status === 'pending' ? 'amber' : 'ok',
    })
  }
  if (roadmap) {
    activity.push({
      label: roadmap.status === 'final' ? 'Roadmap finalised' : 'Roadmap drafted',
      meta: `LP Compass · ${formatDate(roadmap.created_at)}`,
      tone: roadmap.status === 'final' ? 'ok' : 'amber',
    })
  }
  if (mrx.hasData) {
    activity.push({
      label: 'Stool panel report processed',
      meta: `MicrobiomeRx · ${formatDate(mrx.reportDate)}`,
      tone: 'ok',
    })
  }
  if (blood.hasData) {
    activity.push({
      label: 'Blood panel processed',
      meta: `Blood Panel · ${formatDate(blood.reportDate)}`,
      tone: 'ok',
    })
  }

  return {
    patient: {
      id: p.id,
      full_name: p.full_name,
      gender: p.gender,
      date_of_birth: p.date_of_birth,
      phone: p.phone,
      primary_concern: p.primary_concern,
      medical_history: p.medical_history,
      clinic_patient_id: p.clinic_patient_id,
      created_at: p.created_at,
      coachName: (coachRes.data as { full_name?: string } | null)?.full_name ?? null,
    },
    compass,
    mrx,
    blood,
    toolStates: {
      compass: toolState(compass.updatedAt),
      mrx: toolState(mrx.hasData ? mrx.reportDate : null),
      blood: toolState(blood.hasData ? blood.reportDate : null),
    },
    activity,
  }
}
