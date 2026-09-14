'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const C = {
  green: '#538A22', greenDeep: '#2F5214', ink: '#1A2417', muted: '#6b7280',
  faint: '#8A9284', line: '#ECEBE3', card: '#FFFFFF', bg: '#FBFBF8',
  danger: '#B3261E', dangerSoft: '#FBEBE6',
}

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.line}`,
  fontSize: 14, color: C.ink, fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#fff',
}
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }

type Coach = { id: string; full_name: string | null }

// Real hub `patients` columns — matches the writable allowlist in
// lib/patients/patientFields.ts and the Add-patient form, so a patient
// created there and edited here shows/saves the same fields. The previous
// version of this page used a made-up "assigned_nutritionist" text field
// and had no way to set clinic ID, age, program, allergies, phone, or
// email at all — none of those actually round-tripped.
type Form = {
  full_name: string
  clinic_patient_id: string
  age_years: string
  gender: string
  program: string
  primary_concern: string
  allergies: string
  nutritionist_id: string
  phone: string
  email: string
  medical_history: string
}

const EMPTY_FORM: Form = {
  full_name: '', clinic_patient_id: '', age_years: '', gender: '', program: '',
  primary_concern: '', allergies: '', nutritionist_id: '', phone: '', email: '', medical_history: '',
}

export default function EditPatientPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  // Reached from both the hub patient workspace (/patients/[id]) and the
  // Compass patient page (/compass/patients/[id]) — return to whichever one
  // linked here, defaulting to the Compass page since that's this route's
  // own namespace.
  const backHref = searchParams.get('from') || `/compass/patients/${id}`

  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const primaryConcernRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grows as the coach types a longer concern, instead of a one-line
  // <input> that scrolled sideways and (worse) implicitly submitted the
  // whole form on Enter/Shift+Enter — a plain textarea neither submits on
  // Enter nor Shift+Enter, both just insert a newline, matching how any
  // multi-line note field is expected to behave.
  useEffect(() => {
    const el = primaryConcernRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [form.primary_concern])

  useEffect(() => {
    fetch('/api/compass/nutritionists')
      .then((r) => r.json())
      .then((j) => setCoaches(Array.isArray(j) ? j : []))
      .catch(() => setCoaches([]))
  }, [])

  useEffect(() => {
    let alive = true
    fetch(`/api/patients/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return
        setForm({
          full_name: data.full_name ?? '',
          clinic_patient_id: data.clinic_patient_id ?? '',
          age_years: data.age_years != null ? String(data.age_years) : '',
          gender: data.gender ?? '',
          program: data.program ?? '',
          primary_concern: data.primary_concern ?? '',
          allergies: data.allergies ?? '',
          nutritionist_id: data.nutritionist_id ?? '',
          phone: data.phone ?? '',
          email: data.email ?? '',
          medical_history: data.medical_history ?? '',
        })
        setFetching(false)
      })
      .catch(() => { if (alive) { setError('Could not load this patient.'); setFetching(false) } })
    return () => { alive = false }
  }, [id])

  function set(field: keyof Form) {
    return (e: { target: { value: string } }) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Patient name is required.'); return }
    setLoading(true)
    setError('')
    const res = await fetch(`/api/patients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, age_years: form.age_years ? Number(form.age_years) : null }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Could not save changes.')
      setLoading(false)
      return
    }
    router.push(backHref)
  }

  if (fetching) return <div style={{ padding: 40, color: C.muted }}>Loading…</div>

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Link href={backHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.muted, textDecoration: 'none', marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to patient
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 24 }}>Edit patient</h1>

      <form onSubmit={handleSubmit} style={{ background: C.card, borderRadius: 12, padding: 28, border: `1px solid ${C.line}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 16px', marginBottom: 18 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Full name <span style={{ color: C.danger }}>*</span></label>
            <input value={form.full_name} onChange={set('full_name')} required style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Clinicea ID (MRN)</label>
            <input value={form.clinic_patient_id} onChange={set('clinic_patient_id')} placeholder="e.g. LP-2026-0417"
              style={{ ...inputStyle, fontFamily: 'monospace' }} />
          </div>

          <div>
            <label style={labelStyle}>Age</label>
            <input value={form.age_years} onChange={set('age_years')} inputMode="numeric" placeholder="Years" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Sex</label>
            <select value={form.gender} onChange={set('gender')} style={inputStyle}>
              <option value="">Not recorded</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Assigned coach</label>
            <select value={form.nutritionist_id} onChange={set('nutritionist_id')} style={inputStyle}>
              <option value="">Unassigned</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name ?? 'Unnamed coach'}</option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Program</label>
            <input value={form.program} onChange={set('program')} placeholder="e.g. Gut Reset — Ph.2" style={inputStyle} />
          </div>

          <div style={{ gridColumn: '1 / -1', padding: 16, background: '#F2F9EC', borderRadius: 10, border: '1px solid #C8E9A8' }}>
            <label style={{ ...labelStyle, color: C.greenDeep, fontWeight: 700 }}>Primary concern</label>
            <textarea ref={primaryConcernRef} value={form.primary_concern} onChange={set('primary_concern')} rows={1}
              placeholder="e.g. PCOS with insulin resistance, weight gain and irregular periods"
              style={{ ...inputStyle, resize: 'none', overflow: 'hidden', lineHeight: 1.5 }} />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Allergies</label>
            <p style={{ fontSize: 12, color: C.faint, margin: '-2px 0 8px' }}>Left blank means &quot;not recorded&quot; — never stored as &quot;none known&quot;.</p>
            <input value={form.allergies} onChange={set('allergies')} placeholder="e.g. penicillin, shellfish" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Phone</label>
            <input value={form.phone} onChange={set('phone')} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Email</label>
            <input value={form.email} onChange={set('email')} type="email" style={inputStyle} />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Medical history</label>
            <textarea value={form.medical_history} onChange={set('medical_history')} rows={4}
              placeholder="Past diagnoses, medications, surgeries, family history…"
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        {error && (
          <div style={{ background: C.dangerSoft, border: '1px solid #F3D6D6', borderRadius: 8, padding: '10px 14px', color: C.danger, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={() => router.push(backHref)}
            style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${C.line}`, background: '#fff', fontSize: 14, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary"
            style={{ padding: '10px 24px', borderRadius: 8, background: C.green, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
