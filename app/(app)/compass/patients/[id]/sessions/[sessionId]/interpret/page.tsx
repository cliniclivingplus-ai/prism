'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Wand2, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import DashboardClient from '@/components/guide-templates/DashboardClient'
import type { GuideData } from '@/lib/pdf/ClientGuideDocument'

type WeeklyPlan = {
  week_number: number
  focus_theme: string
  cause: string
  actions: string[]
  days?: string[][]
  milestone?: string
}

type KbSource = { title: string; source_type: string; chunk_preview: string }

type Roadmap = {
  id: string
  share_token?: string | null
  share_revoked_at?: string | null
  overview: string
  lifestyle_guidelines: string
  nutritionist_guidelines: string
  weekly_schedule: WeeklyPlan[]
  kb_sources: KbSource[]
  duration_months: number
}

function durationLabel(months: number): string {
  const found = DURATION_GROUPS.flatMap((g) => g.options).find((o) => o.months === months)
  return found?.label ?? `${months} months`
}

// Two distinct program shapes, not one flat list: a single-week plan renders
// like a checklist (see the auto-suggested "week" template in
// DashboardClient, the only template built for a single week), while the
// monthly options are the full multi-month roadmap.
const DURATION_GROUPS: { category: string; options: { label: string; months: number }[] }[] = [
  { category: 'Single-Week Plan', options: [{ label: 'Week 1', months: 0.25 }] },
  {
    category: 'Monthly Program',
    options: [
      { label: '1 Month', months: 1 },
      { label: '2 Months', months: 2 },
      { label: '3 Months', months: 3 },
      { label: '6 Months', months: 6 },
      { label: '12 Months', months: 12 },
    ],
  },
]

export default function InterpretPage() {
  const params = useParams()
  const patientId = params.id as string
  const sessionId = params.sessionId as string

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  // window.confirm() gave zero visible reaction in some environments — a
  // native dialog that either didn't render or was easy to dismiss without
  // noticing, so a click on Refresh/Regenerate could look like it did
  // nothing at all. Replaced with an in-app modal that's unmistakably
  // there the instant either button is clicked.
  const [confirmAction, setConfirmAction] = useState<'refresh' | 'regenerate' | null>(null)
  const [guideData, setGuideData] = useState<GuideData | null>(null)
  const [guideDataError, setGuideDataError] = useState('')
  const [error, setError] = useState('')
  const [duration, setDuration] = useState(1)

  useEffect(() => {
    async function loadExisting() {
      try {
        const res = await fetch(`/api/compass/roadmaps?session_id=${sessionId}`)
        if (res.ok) {
          const json = await res.json()
          if (json?.id) setRoadmap(json)
        }
      } catch {}
      finally { setFetching(false) }
    }
    loadExisting()
  }, [sessionId])

  // Once an existing roadmap loads, default the duration picker to whatever
  // it's already set to — so refreshing without touching it keeps the same
  // length, but a coach can still bump it up/down before refreshing.
  useEffect(() => {
    if (roadmap?.duration_months) setDuration(roadmap.duration_months)
  }, [roadmap?.id])

  // Same GuideData the patient dashboard and PDF use — fetched fresh
  // whenever a roadmap is generated or regenerated, so the editable preview
  // below always reflects exactly what's in the database.
  useEffect(() => {
    if (!roadmap?.id) { setGuideData(null); return }
    setGuideData(null)
    setGuideDataError('')
    fetch(`/api/compass/roadmaps/${roadmap.id}/guide-data`)
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Could not load the dashboard preview.')
        return j.data as GuideData
      })
      .then(setGuideData)
      .catch((err) => setGuideDataError(err.message || 'Could not load the dashboard preview.'))
  }, [roadmap?.id])

  async function generateRoadmap() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/compass/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, patient_id: patientId, duration_months: duration }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Generation failed'); return }
      setRoadmap(json.roadmap)
    } catch { setError('Network error — try again') }
    finally { setLoading(false) }
  }

  // Writes fresh AI content into the SAME roadmap row instead of creating a
  // new one, so the patient's already-shared /dashboard/{roadmapId} link
  // never breaks — they just see the updated plan next time they open it.
  // Coach-side settings (template, theme, care team, etc.) aren't touched;
  // the patient's check-in history for the old content is cleared, since it
  // wouldn't correspond to anything on the refreshed page anymore.
  async function refreshPlan() {
    if (!roadmap) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/compass/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, patient_id: patientId, duration_months: duration, refresh_roadmap_id: roadmap.id }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Refresh failed'); return }
      setRoadmap(json.roadmap)
    } catch { setError('Network error — try again') }
    finally { setLoading(false) }
  }

  // Creates a genuinely NEW roadmap (new id, new dashboard link) with
  // whatever duration is currently selected — for when the plan itself
  // needs to change shape (e.g. going from a 3-month to a 6-month plan),
  // not just refreshed content at the same length. The current roadmap is
  // left completely untouched in the database; this just stops showing it
  // here in favor of the new one.
  async function regeneratePlan() {
    await generateRoadmap()
  }

  async function confirmAndRun() {
    const action = confirmAction
    setConfirmAction(null)
    if (action === 'refresh') await refreshPlan()
    else if (action === 'regenerate') await regeneratePlan()
  }

  if (fetching) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <Loader2 size={28} color="#538A22" style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

        {/* Back */}
        <Link href={`/compass/patients/${patientId}/sessions/${sessionId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', textDecoration: 'none', marginBottom: 20 }}>
          <ArrowLeft size={14} /> Back to Session
        </Link>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>Patient Dashboard</h1>
            <p style={{ color: '#6b7280', fontSize: 13, marginTop: 3 }}>
              {roadmap
                ? <>Live at <strong>{durationLabel(roadmap.duration_months)}</strong> · edit below → Save changes → Preview as patient</>
                : 'Pick a duration below → Generate Dashboard → edit the preview → Save changes → Preview as patient'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {roadmap ? (
              <>
                <button onClick={() => setConfirmAction('refresh')} disabled={loading}
                  title="Update this same roadmap's content in place — same link, patient sees it refresh next time they open it"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', color: '#6b7280', opacity: loading ? 0.7 : 1 }}>
                  {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : '↺'} {loading ? 'Refreshing...' : 'Refresh plan'}
                </button>
                <button onClick={() => setConfirmAction('regenerate')} disabled={loading}
                  title="Create a brand new roadmap with a new link — use this when the plan's length itself needs to change (e.g. 3 months → 6 months)"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', color: '#6b7280', opacity: loading ? 0.7 : 1 }}>
                  {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Wand2 size={14} />} Regenerate
                </button>
              </>
            ) : (
              <button onClick={generateRoadmap} disabled={loading}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: '#538A22', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1 }}>
                {loading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Wand2 size={15} />}
                {loading ? 'Generating...' : 'Generate Dashboard'}
              </button>
            )}
          </div>
        </div>

        {/* Always-visible, state-aware flow guidance — the old per-button
            hover tooltips explained Refresh vs Regenerate but were easy to
            never see; this puts the same explanation where it can't be
            missed, and changes with whether a roadmap exists yet. */}
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12.5, color: '#4B5563', lineHeight: 1.6 }}>
          {!roadmap ? (
            <>👋 <strong>First time building this session's dashboard:</strong> pick a duration below, then click <strong>Generate Dashboard</strong>. An editable preview appears underneath — exactly what the patient will see.</>
          ) : (
            <>
              🔄 <strong>Updating after a later session:</strong> pick the duration you want (same length is fine), then use{' '}
              <strong>Refresh plan</strong> to update this exact dashboard in place — same link the patient already has, and the content it replaces is automatically saved to History first.{' '}
              Only use <strong>Regenerate</strong> if the plan's length itself needs to change (e.g. 3 months → 12 months) and you want a brand new, separate link — it never touches this current roadmap.
            </>
          )}
        </div>

        {/* Plan length, grouped by program shape rather than one flat list —
            a single-week plan is checklist-style, monthly options are the
            full roadmap. */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: roadmap && duration !== roadmap.duration_months ? 10 : 24 }}>
          {DURATION_GROUPS.map((group) => (
            <div key={group.category}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{group.category}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {group.options.map(({ label, months }) => (
                  <button key={label} onClick={() => setDuration(months)}
                    style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: duration === months ? '#538A22' : '#d1d5db', background: duration === months ? '#F2F9EC' : '#fff', color: duration === months ? '#538A22' : '#6b7280' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* The duration picker alone changes nothing — it's silent otherwise,
            which read as "I clicked Week 1 and nothing happened." This makes
            the pending, not-yet-applied selection and its next step explicit. */}
        {roadmap && duration !== roadmap.duration_months && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', marginBottom: 24, fontSize: 12.5, color: '#92400E' }}>
            <span>
              You selected <strong>{durationLabel(duration)}</strong> — the live dashboard is still <strong>{durationLabel(roadmap.duration_months)}</strong> until you apply it.
            </span>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => setConfirmAction('refresh')} disabled={loading}
                style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#538A22', color: '#fff', fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
                Refresh plan (same link)
              </button>
              <button onClick={() => setConfirmAction('regenerate')} disabled={loading}
                style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #D1D5DB', background: '#fff', color: '#6b7280', fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
                Regenerate (new link)
              </button>
            </div>
          </div>
        )}

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{error}</div>}
        {loading && <div style={{ background: '#F2F9EC', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#538A22', marginBottom: 16 }}>🔍 Searching KB → 🧠 Interpreting → ✍️ Writing plan (~30s)...</div>}

        {!roadmap && !loading && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '48px 24px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>
            <Wand2 size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p style={{ fontSize: 15, fontWeight: 500, color: '#374151' }}>No dashboard yet</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Select a duration above and click Generate Dashboard</p>
          </div>
        )}

        {roadmap && !guideData && !guideDataError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: 13, padding: '24px 0' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading preview…
          </div>
        )}
        {guideDataError && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{guideDataError}</div>}
      </div>

      {/* The editable dashboard preview breaks out of the narrow column above
          — it's designed to be a full-width standalone page (same component
          the patient sees), not a form embedded in a form. */}
      {roadmap && guideData && (
        <div style={{ marginTop: 4 }}>
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 0 12px' }}>
            <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: 13, color: '#92400e' }}>
              💡 This is exactly what your patient will see. Edit anything below, click <strong>Save changes</strong>, then use <strong>Preview as patient</strong> to copy the dashboard link and send it over.
            </div>
          </div>
          <DashboardClient roadmapId={roadmap.id} shareToken={roadmap.share_revoked_at ? undefined : (roadmap.share_token ?? undefined)} patientId={patientId} data={guideData} initialCheckins={[]} editable duration={duration} />
        </div>
      )}

      {confirmAction && (
        <div
          onClick={() => setConfirmAction(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, padding: 22, maxWidth: 420, width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
          >
            <h2 style={{ fontSize: 15.5, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
              {confirmAction === 'refresh' ? 'Refresh this plan?' : 'Generate a brand new roadmap?'}
            </h2>
            <p style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.6, margin: '0 0 18px' }}>
              {confirmAction === 'refresh'
                ? 'This replaces the weekly schedule with new AI-generated content and clears the patient’s check-in history for it. The dashboard link they already have keeps working, unchanged.'
                : 'This creates a separate dashboard with its own new link — your current roadmap stays exactly as it is, untouched, just no longer shown here.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setConfirmAction(null)}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmAndRun}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#538A22', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {confirmAction === 'refresh' ? 'Refresh plan' : 'Generate new roadmap'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
