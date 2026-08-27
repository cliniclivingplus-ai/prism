'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function EditPatientPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: '', gender: '', primary_concern: '',
    assigned_nutritionist: '', medical_history: ''
  })

  useEffect(() => {
    fetch(`/api/patients/${id}`).then(r => r.json()).then(data => {
      setForm({
        full_name: data.full_name ?? '',
        gender: data.gender ?? '',
        primary_concern: data.primary_concern ?? '',
        assigned_nutritionist: data.assigned_nutritionist ?? '',
        medical_history: data.medical_history ?? '',
      })
      setFetching(false)
    })
  }, [id])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch(`/api/patients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) { const j = await res.json(); setError(j.error); setLoading(false); return }
    router.push(`/compass/patients/${id}`)
  }

  if (fetching) return <div style={{ padding: 40, color: '#6b7280' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 600 }}>
      <Link href={`/compass/patients/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', textDecoration: 'none', marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Patient
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 24 }}>Edit Patient</h1>

      <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 12, padding: 28, border: '1px solid #e5e7eb' }}>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
          <input value={form.full_name} onChange={e => set('full_name', e.target.value)} required
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Gender</label>
          <select value={form.gender} onChange={e => set('gender', e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, background: '#fff' }}>
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div style={{ marginBottom: 16, padding: 16, background: '#F2F9EC', borderRadius: 10, border: '1px solid #C8E9A8' }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#538A22', marginBottom: 6 }}>
            Primary Health Concern <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Be specific — this drives the KB search. e.g. "Hashimoto's thyroiditis with fatigue and weight gain"</p>
          <input value={form.primary_concern} onChange={e => set('primary_concern', e.target.value)} required
            placeholder="e.g. PCOS with insulin resistance, weight gain and irregular periods"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #C8E9A8', fontSize: 14 }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Assigned Nutritionist</label>
          <input value={form.assigned_nutritionist} onChange={e => set('assigned_nutritionist', e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }} />
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Medical History</label>
          <textarea value={form.medical_history} onChange={e => set('medical_history', e.target.value)} rows={4}
            placeholder="Past diagnoses, medications, surgeries, family history..."
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical' }} />
        </div>

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={() => router.back()} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={loading} style={{ padding: '10px 24px', borderRadius: 8, background: '#538A22', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}