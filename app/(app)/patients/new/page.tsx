'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { IconPlus, IconChevron } from '@/components/ui/icons'

type Coach = { id: string; full_name: string | null }

const FIELD_BG = {
  background: 'var(--paper)',
  border: '1px solid var(--line-soft)',
  borderRadius: 9,
  padding: '9px 11px',
  fontSize: 13,
  color: 'var(--ink)',
  width: '100%',
  outline: 'none',
  fontFamily: 'inherit',
} as const

function Field({
  label, hint, children, wide = false,
}: {
  label: string; hint?: string; children: React.ReactNode; wide?: boolean
}) {
  return (
    <label style={{ display: 'block', gridColumn: wide ? '1 / -1' : undefined }}>
      <div
        className="mb-1.5 text-[10.5px] font-semibold uppercase"
        style={{ letterSpacing: '.07em', color: 'var(--ink-faint)' }}
      >
        {label}
      </div>
      {children}
      {hint && (
        <div className="mt-1 text-[11px]" style={{ color: 'var(--ink-faint)' }}>
          {hint}
        </div>
      )}
    </label>
  )
}

export default function AddPatientPage() {
  const router = useRouter()
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    full_name: '',
    clinic_patient_id: '',
    age_years: '',
    gender: '',
    program: '',
    primary_concern: '',
    allergies: '',
    nutritionist_id: '',
    phone: '',
    email: '',
  })

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    fetch('/api/compass/nutritionists')
      .then((r) => r.json())
      .then((j) => setCoaches(Array.isArray(j) ? j : []))
      .catch(() => setCoaches([]))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) {
      setError('Patient name is required.')
      return
    }
    setSaving(true)
    setError(null)

    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        age_years: form.age_years ? Number(form.age_years) : undefined,
      }),
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error || 'Could not create the patient.')
      setSaving(false)
      return
    }

    // Straight into the new patient's workspace — all three tools will show
    // their empty states until something is uploaded or linked.
    router.push(`/patients/${json.id}`)
  }

  return (
    <>
      <header
        className="sticky top-0 z-[5] flex h-[58px] flex-shrink-0 items-center px-7"
        style={{ background: 'var(--paper-raised)', borderBottom: '1px solid var(--line-soft)' }}
      >
        <div className="flex items-center gap-1.5 text-[12.5px]" style={{ color: 'var(--ink-faint)' }}>
          <Link href="/dashboard">Patients</Link>
          <span>/</span>
          <b style={{ color: 'var(--ink)', fontWeight: 600 }}>New patient</b>
        </div>
      </header>

      <main className="flex-1 px-[30px] pb-[70px] pt-7" style={{ maxWidth: 860 }}>
        <h1
          className="font-display m-0 mb-1 text-[27px] font-medium"
          style={{ color: 'var(--teal-900)' }}
        >
          Add a patient
        </h1>
        <p className="mb-6 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
          Creates the hub record. Compass, MicrobiomeRx and Blood Panel all hang off this
          one row, so anything uploaded later links to it by id.
        </p>

        <form onSubmit={submit}>
          <div
            className="mb-[18px] rounded-[14px] px-6 py-[22px]"
            style={{ background: 'var(--paper-raised)', border: '1px solid var(--line-soft)' }}
          >
            <div className="grid gap-x-5 gap-y-[18px] [grid-template-columns:1fr_1fr] max-[700px]:[grid-template-columns:1fr]">
              <Field label="Full name">
                <input
                  autoFocus
                  value={form.full_name}
                  onChange={set('full_name')}
                  placeholder="e.g. Kalika Rao"
                  style={FIELD_BG}
                />
              </Field>

              <Field label="Clinic ID (MRN)" hint="Optional, but it's the key other tools match on.">
                <input
                  value={form.clinic_patient_id}
                  onChange={set('clinic_patient_id')}
                  placeholder="e.g. LP-2026-0417"
                  style={{ ...FIELD_BG, fontFamily: 'var(--font-jetbrains), monospace' }}
                />
              </Field>

              <Field label="Age" hint="Years. Leave blank if unknown — nothing is guessed.">
                <input
                  value={form.age_years}
                  onChange={set('age_years')}
                  inputMode="numeric"
                  placeholder="e.g. 34"
                  style={FIELD_BG}
                />
              </Field>

              <Field label="Sex">
                <select value={form.gender} onChange={set('gender')} style={FIELD_BG}>
                  <option value="">Not recorded</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </Field>

              <Field label="Program">
                <input
                  value={form.program}
                  onChange={set('program')}
                  placeholder="e.g. Gut Reset — Ph.2"
                  style={FIELD_BG}
                />
              </Field>

              <Field label="Assigned coach">
                <select value={form.nutritionist_id} onChange={set('nutritionist_id')} style={FIELD_BG}>
                  <option value="">Unassigned</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name ?? 'Unnamed coach'}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Primary concern" wide>
                <input
                  value={form.primary_concern}
                  onChange={set('primary_concern')}
                  placeholder="e.g. IBS-D, fatigue"
                  style={FIELD_BG}
                />
              </Field>

              <Field
                label="Allergies"
                wide
                hint="Left blank means 'not recorded' — it is not stored as 'none known'."
              >
                <input
                  value={form.allergies}
                  onChange={set('allergies')}
                  placeholder="e.g. penicillin, shellfish"
                  style={FIELD_BG}
                />
              </Field>

              <Field label="Phone">
                <input
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="e.g. +91 98••• ••417"
                  style={FIELD_BG}
                />
              </Field>

              <Field label="Email">
                <input
                  value={form.email}
                  onChange={set('email')}
                  type="email"
                  placeholder="optional"
                  style={FIELD_BG}
                />
              </Field>
            </div>
          </div>

          {error && (
            <div
              className="mb-4 rounded-[10px] px-4 py-3 text-[12.5px]"
              style={{
                background: 'var(--rust-100)',
                border: '1px solid var(--rust-500)',
                color: 'var(--rust-600)',
              }}
            >
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-[7px] rounded-[9px] px-[17px] py-2.5 text-[13px] font-semibold text-white"
              style={{ background: 'var(--teal-700)', opacity: saving ? 0.6 : 1 }}
            >
              <IconPlus /> {saving ? 'Creating…' : 'Create patient'}
            </button>
            <Link
              href="/dashboard"
              className="text-[13px] font-semibold"
              style={{ color: 'var(--ink-faint)' }}
            >
              Cancel
            </Link>
            <span className="ml-auto flex items-center gap-1 text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
              Opens the patient workspace next <IconChevron size={13} />
            </span>
          </div>
        </form>
      </main>
    </>
  )
}
