'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Copy, Sparkles, Loader2, CheckCircle2, LayoutDashboard, User } from 'lucide-react'

const C = {
  green: '#538A22',
  greenDeep: '#2F5214',
  greenSoft: '#F2F9EC',
  greenBorder: '#C8E9A8',
  amber: '#D98A2B',
  amberSoft: '#FBF1E3',
  ink: '#1A2417',
  muted: '#6b7280',
  faint: '#8A9284',
  line: '#ECEBE3',
  card: '#FFFFFF',
}

type PatientOption = {
  id: string
  full_name: string
  primary_concern?: string
}

type RoadmapOption = {
  id: string
  patient_id: string
  duration_months?: number
  created_at?: string
  overview?: string
  patient_name?: string
}

export default function CloneRoadmapModal({
  presetSourceRoadmapId,
  presetTargetPatientId,
  onClose,
}: {
  presetSourceRoadmapId?: string
  presetTargetPatientId?: string
  onClose: () => void
}) {
  const router = useRouter()

  const [patients, setPatients] = useState<PatientOption[]>([])
  const [roadmaps, setRoadmaps] = useState<RoadmapOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)

  const [selectedSourceRoadmapId, setSelectedSourceRoadmapId] = useState(presetSourceRoadmapId || '')
  const [selectedTargetPatientId, setSelectedTargetPatientId] = useState(presetTargetPatientId || '')

  const [adaptMode, setAdaptMode] = useState<'ai_adapt' | 'exact_clone'>('ai_adapt')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function loadData() {
      setLoadingOptions(true)
      try {
        const [patientsRes] = await Promise.all([fetch('/api/patients')])
        const patientData = await patientsRes.json()

        if (!alive) return

        const validPatients = Array.isArray(patientData) ? patientData : []
        setPatients(validPatients)

        // Load roadmaps for each patient to allow picking a source roadmap
        const roadmapPromises = validPatients.map(async (p: PatientOption) => {
          try {
            const r = await fetch(`/api/compass/roadmaps?patient_id=${p.id}`)
            const list = await r.json()
            if (Array.isArray(list)) {
              return list.map((item: any) => ({
                ...item,
                patient_name: p.full_name,
              }))
            }
          } catch {
            return []
          }
          return []
        })

        const allRoadmapArrays = await Promise.all(roadmapPromises)
        const combinedRoadmaps = allRoadmapArrays.flat()

        if (!alive) return
        setRoadmaps(combinedRoadmaps)

        // Auto select defaults if not preset
        if (!presetSourceRoadmapId && combinedRoadmaps.length > 0) {
          setSelectedSourceRoadmapId(combinedRoadmaps[0].id)
        }
        if (!presetTargetPatientId && validPatients.length > 0) {
          const firstOther = validPatients.find(
            (p) => !combinedRoadmaps[0] || p.id !== combinedRoadmaps[0].patient_id
          )
          setSelectedTargetPatientId(firstOther ? firstOther.id : validPatients[0].id)
        }
      } catch {
        setError('Failed to load patients list — try again.')
      } finally {
        if (alive) setLoadingOptions(false)
      }
    }

    loadData()
    return () => {
      alive = false
    }
  }, [presetSourceRoadmapId, presetTargetPatientId])

  async function handleCreate() {
    if (!selectedSourceRoadmapId || !selectedTargetPatientId) {
      setError('Please select both a source roadmap and a target patient.')
      return
    }

    setCreating(true)
    setError('')

    try {
      const res = await fetch('/api/compass/roadmaps/clone-and-adapt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_roadmap_id: selectedSourceRoadmapId,
          target_patient_id: selectedTargetPatientId,
          adapt_mode: adaptMode,
        }),
      })

      if (!res.ok) {
        const j = await res.json().catch(() => null)
        setError(j?.error || 'Could not adapt roadmap. Try again.')
        setCreating(false)
        return
      }

      const j = await res.json()
      onClose()
      router.push(`/compass/patients/${selectedTargetPatientId}/roadmap/${j.roadmap_id}/live-edit`)
    } catch {
      setError('Network error — check your connection and try again.')
      setCreating(false)
    }
  }

  const selectedTargetPatient = patients.find((p) => p.id === selectedTargetPatientId)
  const selectedSourceRoadmap = roadmaps.find((r) => r.id === selectedSourceRoadmapId)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(26,36,23,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 100,
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.card,
          borderRadius: 16,
          padding: '24px 26px',
          maxWidth: 540,
          width: '100%',
          position: 'relative',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: C.muted,
          }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: C.greenSoft,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Copy size={18} color={C.green} />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
              Use Dashboard as Template
            </h2>
            <p style={{ fontSize: 12.5, color: C.muted, margin: 0 }}>
              Adapt an existing successful dashboard for another patient with similar symptoms.
            </p>
          </div>
        </div>

        {loadingOptions ? (
          <div
            style={{
              padding: '30px 0',
              textAlign: 'center',
              color: C.muted,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading patient dashboards…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Source Roadmap Selection */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.greenDeep,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  marginBottom: 6,
                }}
              >
                Source Dashboard (Reference Template)
              </label>
              <select
                value={selectedSourceRoadmapId}
                onChange={(e) => setSelectedSourceRoadmapId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 9,
                  border: `1px solid ${C.line}`,
                  fontSize: 13,
                  color: C.ink,
                  background: '#fff',
                  boxSizing: 'border-box',
                }}
              >
                {roadmaps.length === 0 && <option value="">No existing dashboards found</option>}
                {roadmaps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.patient_name}&apos;s Dashboard (
                    {r.duration_months
                      ? `${r.duration_months >= 1 ? r.duration_months : Math.round(r.duration_months * 4)}${r.duration_months >= 1 ? '-month' : '-week'} plan`
                      : 'Roadmap'}
                    )
                  </option>
                ))}
              </select>
            </div>

            {/* Target Patient Selection */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.greenDeep,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  marginBottom: 6,
                }}
              >
                Target Patient (Who gets the new dashboard)
              </label>
              <select
                value={selectedTargetPatientId}
                onChange={(e) => setSelectedTargetPatientId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 9,
                  border: `1px solid ${C.line}`,
                  fontSize: 13,
                  color: C.ink,
                  background: '#fff',
                  boxSizing: 'border-box',
                }}
              >
                {patients.length === 0 && <option value="">No patients found</option>}
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} {p.primary_concern ? `— ${p.primary_concern}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Adaptation Mode Options */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.greenDeep,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  marginBottom: 8,
                }}
              >
                Adaptation Method
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label
                  onClick={() => setAdaptMode('ai_adapt')}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1.5px solid ${adaptMode === 'ai_adapt' ? C.green : C.line}`,
                    background: adaptMode === 'ai_adapt' ? C.greenSoft : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="adapt_mode"
                    checked={adaptMode === 'ai_adapt'}
                    onChange={() => setAdaptMode('ai_adapt')}
                    style={{ accentColor: C.green, marginTop: 2 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Sparkles size={14} color={C.green} /> AI Personalization (Recommended)
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                      Preserves the reference roadmap&apos;s structure, theme &amp; visual layout, while using AI to tailor weekly details specifically to {selectedTargetPatient?.full_name || 'the new patient'}&apos;s symptoms.
                    </div>
                  </div>
                </label>

                <label
                  onClick={() => setAdaptMode('exact_clone')}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1.5px solid ${adaptMode === 'exact_clone' ? C.green : C.line}`,
                    background: adaptMode === 'exact_clone' ? C.greenSoft : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="adapt_mode"
                    checked={adaptMode === 'exact_clone'}
                    onChange={() => setAdaptMode('exact_clone')}
                    style={{ accentColor: C.green, marginTop: 2 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Copy size={14} color={C.green} /> Exact Structural Copy
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                      Directly duplicates {selectedSourceRoadmap?.patient_name || 'source'}&apos;s roadmap layout, theme, and schedule for {selectedTargetPatient?.full_name || 'the new patient'}.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {error && <div style={{ color: '#B3261E', fontSize: 12.5, fontWeight: 600 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={creating}
                style={{
                  padding: '9px 16px',
                  borderRadius: 9,
                  border: `1px solid ${C.line}`,
                  background: C.card,
                  color: C.muted,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: creating ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !selectedSourceRoadmapId || !selectedTargetPatientId}
                style={{
                  padding: '9px 18px',
                  borderRadius: 9,
                  border: 'none',
                  background: creating || !selectedSourceRoadmapId || !selectedTargetPatientId ? '#7BA84F' : C.green,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: creating ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 6px rgba(83,138,34,0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {creating ? (
                  <>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating dashboard…
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Create dashboard for {selectedTargetPatient?.full_name || 'Patient'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
