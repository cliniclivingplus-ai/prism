'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/blood/supabase'
import { signOut, getUser } from '@/lib/blood/auth'

type ReportRow = {
  id: string
  patient_id: string | null
  pdf_filename: string | null
  created_at: string
  markers: { test_name: string; abnormal: boolean }[] | null
}
type PatientRow = { id: string; name: string; clinic_id: string }

export default function DashboardPage() {
  const router = useRouter()

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [reports, setReports] = useState<ReportRow[]>([])
  const [patients, setPatients] = useState<Record<string, PatientRow>>({})
  const [allPatients, setAllPatients] = useState<PatientRow[]>([])

  const [query, setQuery] = useState('')
  const [newName, setNewName] = useState('')
  const [newClinicId, setNewClinicId] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    getUser().then((u) => {
      if (!u) { router.replace('/login'); return }
      setCheckingAuth(false)
      load()
    })
  }, [router])

  async function load() {
    const { data: reportRows } = await supabase
      .from('reports')
      .select('id, patient_id, pdf_filename, created_at, markers')
      .order('created_at', { ascending: false })
    setReports((reportRows as ReportRow[]) ?? [])

    const { data: patientRows } = await supabase.from('patients').select('id, name, clinic_id').order('name')
    const rows = (patientRows as PatientRow[]) ?? []
    setAllPatients(rows)
    const map: Record<string, PatientRow> = {}
    for (const p of rows) map[p.id] = p
    setPatients(map)
  }

  async function createPatient(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newClinicId.trim()) { setCreateError('Both name and Clinicea ID are required.'); return }
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/blood/patients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), clinic_id: newClinicId.trim() }),
      })
      const j = await res.json()
      if (!res.ok) { setCreateError(j.error || 'Could not create patient.'); return }
      router.push(`/blood/patient/${j.patient.id}`)
    } catch {
      setCreateError('Network error, try again.')
    } finally {
      setCreating(false)
    }
  }

  const searchResults = query.trim()
    ? allPatients.filter((p) =>
        p.name.toLowerCase().includes(query.trim().toLowerCase()) ||
        p.clinic_id.toLowerCase().includes(query.trim().toLowerCase())
      )
    : []

  if (checkingAuth) return null

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="font-light text-lg">Blood Panel Analyzer</span>
          </div>
          <button onClick={signOut} className="text-sm text-foreground-secondary hover:text-foreground">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-sm font-mono uppercase tracking-widest text-foreground-muted mb-4">Find a patient</h2>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or Clinicea ID"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition"
            />
            {query.trim() && (
              <div className="mt-3 flex flex-col gap-1.5 max-h-60 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <p className="text-xs text-foreground-muted py-2">No matching patient.</p>
                ) : (
                  searchResults.map((p) => (
                    <Link key={p.id} href={`/blood/patient/${p.id}`}
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-border-light hover:border-primary transition">
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="text-xs text-foreground-muted">{p.clinic_id}</span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-sm font-mono uppercase tracking-widest text-foreground-muted mb-4">New patient</h2>
            <form onSubmit={createPatient} className="flex flex-col gap-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Patient name"
                disabled={creating}
                className="bg-background border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition"
              />
              <input
                value={newClinicId}
                onChange={(e) => setNewClinicId(e.target.value)}
                placeholder="Clinicea ID"
                disabled={creating}
                className="bg-background border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition"
              />
              {createError && <p className="text-xs text-danger">{createError}</p>}
              <button type="submit" disabled={creating}
                className="px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium rounded-lg text-sm transition-all">
                {creating ? 'Creating…' : 'Create patient account'}
              </button>
            </form>
          </div>
        </div>

        <h2 className="text-sm font-mono uppercase tracking-widest text-foreground-muted mb-3">Recent reports</h2>
        {reports.length === 0 ? (
          <p className="text-sm text-foreground-secondary py-8 text-center">No reports analyzed yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {reports.map((r) => {
              const abnormalCount = (r.markers ?? []).filter((m) => m.abnormal).length
              return (
                <div
                  key={r.id}
                  onClick={() => router.push(`/blood/report/${r.id}`)}
                  className="bg-card border border-border rounded-xl px-5 py-4 flex items-center justify-between hover:border-primary transition cursor-pointer"
                >
                  <div>
                    {r.patient_id ? (
                      <Link
                        href={`/blood/patient/${r.patient_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-medium hover:underline hover:text-primary"
                      >
                        {patients[r.patient_id]?.name ?? 'Unknown patient'}
                      </Link>
                    ) : (
                      <div className="text-sm font-medium">Unknown patient</div>
                    )}
                    <div className="text-xs text-foreground-muted mt-0.5">
                      {r.pdf_filename} · {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  {abnormalCount > 0 ? (
                    <span className="text-xs font-semibold text-danger bg-primary-light px-2.5 py-1 rounded-full">
                      {abnormalCount} out of range
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-success bg-secondary-light px-2.5 py-1 rounded-full">
                      All normal
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
