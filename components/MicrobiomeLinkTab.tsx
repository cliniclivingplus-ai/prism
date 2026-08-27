'use client'
import { useState, useEffect, useRef } from 'react'
import { Dna, Search, Link2, Unlink, Loader2, FileText } from 'lucide-react'

const C = {
  green: '#538A22', greenDeep: '#2F5214', greenSoft: '#F2F9EC', greenBorder: '#C8E9A8',
  ink: '#1A2417', muted: '#6b7280', faint: '#8A9284', line: '#ECEBE3', card: '#FFFFFF',
  danger: '#B3261E', dangerSoft: '#FBEBE6',
}

type LinkedPatient = { id: string; name: string; age_sex: string | null; complaint: string | null; diet_type: string | null }
type PrescriptionItem = { section: 'supplements' | 'therapies' | 'dietary'; name: string; detail: string; doctorNote: string; contraindications: string }
type Prescription = { approvedAt: string; clinicalImpression: string; doctorNotes: string; items: PrescriptionItem[] }
type Linked = { linkId: string; linkedAt: string; patient: LinkedPatient; reportCount: number; prescription: Prescription | null; autoLinked?: boolean }
type Candidate = { id: string; name: string; age_sex: string | null; complaint: string | null; diet_type: string | null; reportCount: number }

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const SECTION_LABEL: Record<PrescriptionItem['section'], string> = { supplements: 'Supplement', therapies: 'Therapy', dietary: 'Dietary' }

function PrescriptionTable({ prescription }: { prescription: Prescription | null }) {
  if (!prescription) return null
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: C.muted }}>Approved prescription</span>
        <span style={{ fontSize: 11, color: C.muted }}>Approved {fmtDate(prescription.approvedAt)}</span>
      </div>
      {prescription.clinicalImpression && (
        <p style={{ fontSize: 12.5, color: C.ink, margin: '0 0 10px', lineHeight: 1.5 }}>{prescription.clinicalImpression}</p>
      )}
      {prescription.items.length > 0 && (
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: C.muted, borderBottom: `1px solid ${C.line}` }}>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>Item</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>Detail</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>Doctor&apos;s note</th>
                </tr>
              </thead>
              <tbody>
                {prescription.items.map((it, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.line}` }}>
                    <td style={{ padding: '8px 12px', color: C.muted, whiteSpace: 'nowrap' }}>{SECTION_LABEL[it.section]}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: C.ink }}>{it.name}</td>
                    <td style={{ padding: '8px 12px', color: C.ink }}>{it.detail}</td>
                    <td style={{ padding: '8px 12px', color: C.muted }}>{it.doctorNote || 'None noted'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {prescription.doctorNotes && (
        <p style={{ fontSize: 12, color: C.muted, margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>{prescription.doctorNotes}</p>
      )}
    </div>
  )
}

// MicrobiomeRX's own patient records live in this same Supabase project now
// (mrx_ prefixed tables, migrated from its separate database) but have no
// email/phone/clinic id shared with LP Compass's patients — so linking is
// a manual, coach-driven step: search MicrobiomeRX by name, pick the right
// match, confirm. Never auto-matched.
export default function MicrobiomeLinkTab({ patientId }: { patientId: string }) {
  const [loading, setLoading] = useState(true)
  const [linked, setLinked] = useState<Linked | null>(null)
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [searching, setSearching] = useState(false)
  const [linking, setLinking] = useState<string | null>(null)
  const [unlinking, setUnlinking] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/patients/${patientId}/mrx-link`)
      .then((r) => r.json())
      .then((j) => { if (alive) setLinked(j.linked) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [patientId])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setCandidates([]); return }
    setSearching(true)
    debounceRef.current = setTimeout(() => {
      fetch(`/api/mrx-patients/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((j) => setCandidates(Array.isArray(j) ? j : []))
        .finally(() => setSearching(false))
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  async function linkTo(mrxPatientId: string) {
    setLinking(mrxPatientId)
    setError('')
    try {
      const res = await fetch(`/api/patients/${patientId}/mrx-link`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mrx_patient_id: mrxPatientId }),
      })
      const j = await res.json()
      if (!res.ok) { setError(j.error || 'Could not link this patient.'); return }
      setLinked(j.linked)
      setQuery('')
      setCandidates([])
    } catch { setError('Network error — try again.') }
    finally { setLinking(null) }
  }

  async function unlink() {
    setUnlinking(true)
    setError('')
    try {
      const res = await fetch(`/api/patients/${patientId}/mrx-link`, { method: 'DELETE' })
      if (!res.ok) { setError('Could not unlink — try again.'); return }
      setLinked(null)
    } catch { setError('Network error — try again.') }
    finally { setUnlinking(false) }
  }

  if (loading) {
    return <div style={{ height: 100, background: C.card, borderRadius: 14, border: `1px solid ${C.line}`, opacity: 0.6 }} />
  }

  if (linked) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.greenBorder}`, borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: C.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Dna size={19} color={C.green} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>{linked.patient.name}</span>
                {linked.autoLinked && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: C.green, background: C.greenSoft, padding: '2px 7px', borderRadius: 999 }}>Auto-linked via Clinic ID</span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>
                {[linked.patient.age_sex, linked.patient.complaint].filter(Boolean).join(' · ') || 'No further details on file'}
              </div>
            </div>
          </div>
          <button onClick={unlink} disabled={unlinking}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: `1px solid ${C.line}`, background: '#fff', color: C.danger, fontSize: 12.5, fontWeight: 700, cursor: unlinking ? 'not-allowed' : 'pointer' }}>
            {unlinking ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Unlink size={13} />} Unlink
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.line}`, fontSize: 12.5, color: C.muted }}>
          <FileText size={13} />
          {linked.reportCount} MicrobiomeRX report{linked.reportCount === 1 ? '' : 's'} on file
        </div>
        <PrescriptionTable prescription={linked.prescription} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div>
      <div style={{ background: C.card, border: `1px dashed ${C.greenBorder}`, borderRadius: 14, padding: '20px 22px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: C.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Dna size={18} color={C.green} />
          </div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>Not linked to a MicrobiomeRX patient</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>
              MicrobiomeRX has no email or phone on file, so search by name and confirm the right match yourself.
            </div>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} color={C.faint} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search MicrobiomeRX patients by name…"
            style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 13.5, color: C.ink, boxSizing: 'border-box' }}
          />
        </div>

        {error && <p style={{ fontSize: 12.5, color: C.danger, margin: '10px 0 0' }}>{error}</p>}

        {query.trim() && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {searching ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.muted, padding: '10px 0' }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Searching…
              </div>
            ) : candidates.length === 0 ? (
              <p style={{ fontSize: 12.5, color: C.muted, margin: '6px 0' }}>No matching MicrobiomeRX patient found.</p>
            ) : (
              candidates.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 10, background: '#fff' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{c.name}</div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[c.age_sex, c.complaint].filter(Boolean).join(' · ') || 'No further details on file'}
                      {c.reportCount > 0 && <> · {c.reportCount} report{c.reportCount === 1 ? '' : 's'}</>}
                    </div>
                  </div>
                  <button onClick={() => linkTo(c.id)} disabled={linking === c.id}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, border: 'none', background: C.green, color: '#fff', fontSize: 12, fontWeight: 700, cursor: linking === c.id ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
                    {linking === c.id ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Link2 size={12} />} Link
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
