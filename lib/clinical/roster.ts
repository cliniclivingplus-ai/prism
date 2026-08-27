import { createClient } from '@/lib/supabase/server'
import { toolState, type ToolState } from './derive'

export type RosterPatient = {
  id: string
  name: string | null
  mrn: string | null
  /** Current week's focus theme from the latest roadmap, or null. */
  program: string | null
  currentWeek: number | null
  totalWeeks: number | null
  status: 'active' | 'review' | 'paused' | 'draft'
  tools: { compass: ToolState; mrx: ToolState; blood: ToolState }
  lastActivity: string | null
}

export type RosterStats = {
  totalPatients: number
  activePrograms: number
  awaitingReview: number
  sessionsToday: number
}

const PAUSED_AFTER_DAYS = 60

/**
 * One pass over the roster. Rows are assembled in JS rather than via a view
 * so the derivation rules stay visible and reviewable in one place.
 *
 * `weekly_schedule` is intentionally not selected — it's a large JSONB blob
 * per roadmap and the roster only needs the week count, which
 * duration_months implies (the sampled data is 4 weeks per month).
 */
export async function loadRoster(): Promise<{ patients: RosterPatient[]; stats: RosterStats }> {
  const supabase = await createClient('compass')

  const [patientsRes, roadmapsRes, sessionsRes, mrxRes, bloodRes] = await Promise.all([
    supabase
      .from('patients')
      .select('id, full_name, clinic_patient_id, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('roadmaps')
      .select('patient_id, created_at, status, duration_months')
      .order('created_at', { ascending: false }),
    supabase
      .from('sessions')
      .select('patient_id, session_date, status, created_at')
      .order('session_date', { ascending: false }),
    supabase.from('mrx_patient_links').select('clp_patient_id, linked_at'),
    supabase.from('blood_patient_links').select('clp_patient_id, linked_at'),
  ])

  type R = { patient_id: string; created_at: string; status: string | null; duration_months: number | null }
  type S = { patient_id: string; session_date: string | null; status: string | null; created_at: string }
  type L = { clp_patient_id: string; linked_at: string | null }

  const roadmaps = (roadmapsRes.data ?? []) as R[]
  const sessions = (sessionsRes.data ?? []) as S[]
  const mrxLinks = (mrxRes.data ?? []) as L[]
  const bloodLinks = (bloodRes.data ?? []) as L[]

  const latestRoadmap = new Map<string, R>()
  for (const r of roadmaps) if (!latestRoadmap.has(r.patient_id)) latestRoadmap.set(r.patient_id, r)

  const latestSession = new Map<string, S>()
  const pendingSession = new Set<string>()
  for (const s of sessions) {
    if (!latestSession.has(s.patient_id)) latestSession.set(s.patient_id, s)
    if (s.status === 'pending') pendingSession.add(s.patient_id)
  }

  const mrxAt = new Map(mrxLinks.map((l) => [l.clp_patient_id, l.linked_at]))
  const bloodAt = new Map(bloodLinks.map((l) => [l.clp_patient_id, l.linked_at]))

  const today = new Date().toISOString().slice(0, 10)

  const patients: RosterPatient[] = (patientsRes.data ?? []).map((p) => {
    const rm = latestRoadmap.get(p.id)
    const ss = latestSession.get(p.id)

    const activityDates = [rm?.created_at, ss?.session_date, ss?.created_at].filter(Boolean) as string[]
    const lastActivity = activityDates.sort().at(-1) ?? null

    const totalWeeks = rm?.duration_months ? rm.duration_months * 4 : null
    let currentWeek: number | null = null
    if (rm?.created_at && totalWeeks) {
      const elapsed = Math.floor((Date.now() - new Date(rm.created_at).getTime()) / (7 * 86_400_000)) + 1
      currentWeek = Math.min(Math.max(elapsed, 1), totalWeeks)
    }

    const staleDays = lastActivity
      ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86_400_000)
      : Infinity

    let status: RosterPatient['status']
    if (pendingSession.has(p.id)) status = 'review'
    else if (staleDays > PAUSED_AFTER_DAYS) status = 'paused'
    else if (rm?.status === 'final') status = 'active'
    else status = 'draft'

    return {
      id: p.id,
      name: p.full_name,
      mrn: p.clinic_patient_id,
      program: null, // no program-name column in the schema; see notes
      currentWeek,
      totalWeeks,
      status,
      tools: {
        compass: toolState(rm?.created_at ?? ss?.created_at ?? null),
        mrx: toolState(mrxAt.get(p.id) ?? null),
        blood: toolState(bloodAt.get(p.id) ?? null),
      },
      lastActivity,
    }
  })

  const stats: RosterStats = {
    totalPatients: patients.length,
    activePrograms: new Set(
      roadmaps.filter((r) => r.status === 'final').map((r) => r.patient_id)
    ).size,
    awaitingReview: pendingSession.size,
    sessionsToday: sessions.filter((s) => s.session_date?.slice(0, 10) === today).length,
  }

  return { patients, stats }
}
