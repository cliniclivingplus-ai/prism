'use client'

import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/blood/auth'
import { extractFromFile, type ExtractProgress } from '@/lib/blood/extractReport'
import type { ExtractedMarker } from '@/lib/blood/types'
import type { MarkerTrend } from '@/lib/blood/patientTrends'
import { computeTrendViz, TREND_VIEWBOX } from '@/lib/blood/trendViz'

const MAX_FILES = 5

type Patient = { id: string; name: string; clinic_id: string; age_sex: string | null; notes: string | null }
type ReportRow = { id: string; pdf_filename: string | null; markers: ExtractedMarker[] | null; created_at: string }

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Splits the AI progress summary into per-marker bullets + one closing line.
// The prompt now asks for "- " prefixed, newline-separated bullets, but
// summaries generated before that change (or a model that ignores it) can
// still come back as one paragraph — in that case this just returns the
// whole thing as a single closing line, same as the old plain-paragraph
// render, so nothing breaks for un-regenerated history.
function parseSummary(text: string): { bullets: string[]; closing: string | null } {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const bullets = lines.filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim())
  const closing = lines.find((l) => !l.startsWith('- ')) ?? null
  if (bullets.length === 0) return { bullets: [], closing: text }
  return { bullets, closing }
}

// Same "keep it simple" bold red/green zoning as the report page's range
// bar, just as a timeline: a shaded band for the reference range, a line
// through the actual readings, and a bold dot per reading colored by
// whether that specific reading was in range.
function Sparkline({ trend }: { trend: MarkerTrend }) {
  const viz = computeTrendViz(trend)
  if (!viz) return null
  return (
    <div>
      <svg viewBox={TREND_VIEWBOX} className="w-full h-14">
        {viz.bandTop !== null && viz.bandBottom !== null && (
          <rect x={0} y={viz.bandTop} width={260} height={Math.max(0, viz.bandBottom - viz.bandTop)} fill="#86EFAC" opacity={0.4} />
        )}
        <path d={viz.pathD} fill="none" stroke="#6b7280" strokeWidth={1.5} />
        {viz.points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill={p.abnormal ? '#B91C1C' : '#15803D'} stroke="white" strokeWidth={1.5} />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-foreground-muted mt-0.5">
        <span>{fmtDate(trend.points[0].date)}</span>
        <span>{fmtDate(trend.points[trend.points.length - 1].date)}</span>
      </div>
    </div>
  )
}

export default function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [reports, setReports] = useState<ReportRow[]>([])
  const [trends, setTrends] = useState<MarkerTrend[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [error, setError] = useState('')

  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    getUser().then((u) => {
      if (!u) { router.replace('/login'); return }
      setCheckingAuth(false)
    })
  }, [router])

  function loadPatient() {
    return fetch(`/api/blood/patients/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) { setError(j.error); return }
        setPatient(j.patient)
        setReports(j.reports)
        setTrends(j.trends)
        if (j.patient.progress_summary) setSummary(j.patient.progress_summary)
      })
  }

  useEffect(() => {
    if (checkingAuth) return
    loadPatient()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, checkingAuth])

  async function handleFiles(files: FileList) {
    const list = Array.from(files).slice(0, MAX_FILES)
    if (list.length === 0) return
    setUploading(true)
    setUploadError('')
    try {
      for (let i = 0; i < list.length; i++) {
        const file = list[i]
        const label = `File ${i + 1} of ${list.length}`
        setUploadProgress(`${label}: reading ${file.name}…`)
        const onProgress = (p: ExtractProgress) => {
          if (p.stage === 'ocr') setUploadProgress(`${label}: OCR page ${p.page} of ${p.totalPages}…`)
        }
        const extracted = await extractFromFile(file, onProgress)

        const form = new FormData()
        form.append('patient_id', id)
        form.append('text', extracted.text)
        form.append('file', file)

        setUploadProgress(`${label}: extracting markers…`)
        const res = await fetch('/api/blood/parse-report', { method: 'POST', body: form })
        const j = await res.json()
        if (!res.ok) { setUploadError(`${file.name}: ${j.error || 'Could not analyze this report.'}`); continue }
      }
      await loadPatient()
      // A fresh upload can change the trend picture entirely — force a
      // regenerated summary rather than showing one written before this
      // upload existed.
      loadSummary(true)
    } finally {
      setUploading(false)
      setUploadProgress('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function loadSummary(regenerate: boolean) {
    setLoadingSummary(true)
    fetch(`/api/blood/patients/${id}/summary`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regenerate }),
    })
      .then((r) => r.json())
      .then((j) => setSummary(j.summary || j.error || 'Could not load a summary — try again.'))
      .catch(() => setSummary('Could not load a summary — try again.'))
      .finally(() => setLoadingSummary(false))
  }

  useEffect(() => {
    if (!patient || summary !== null) return
    loadSummary(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient, summary])

  if (checkingAuth) return null
  if (error) return <div className="min-h-screen bg-background flex items-center justify-center text-sm text-danger">{error}</div>
  if (!patient) return <div className="min-h-screen bg-background flex items-center justify-center text-sm text-foreground-secondary">Loading…</div>

  const trendsWithHistory = trends.filter((t) => t.points.length >= 2)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link href="/blood/dashboard" className="text-sm text-foreground-secondary hover:text-foreground">← Dashboard</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-light mb-1">{patient.name}</h1>
        <p className="text-sm text-foreground-muted mb-8">
          Clinic ID {patient.clinic_id} · {reports.length} report{reports.length === 1 ? '' : 's'}
          {reports.length > 0 && <> · {fmtDate(reports[reports.length - 1].created_at)} to {fmtDate(reports[0].created_at)}</>}
        </p>

        <section className="mb-10">
          <h2 className="text-sm font-mono uppercase tracking-widest text-foreground-muted mb-3">Upload reports</h2>
          <div className="bg-card border border-border rounded-2xl p-6">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium rounded-lg text-sm transition-all"
            >
              {uploading ? 'Analyzing…' : 'Choose reports'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="application/pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => { if (e.target.files) handleFiles(e.target.files) }}
            />
            {uploading && uploadProgress && <p className="text-xs text-foreground-secondary mt-3">{uploadProgress}</p>}
            {uploadError && <p className="text-xs text-danger mt-3 whitespace-pre-wrap">{uploadError}</p>}
            <p className="text-xs text-foreground-muted mt-3">
              Up to {MAX_FILES} reports at once, any lab, any layout — PDF or a photo/screenshot, up to 15MB each. Scanned PDFs are OCR&apos;d automatically in your browser, so a batch of long reports can take a few minutes — keep this tab open while it runs.
            </p>
          </div>
        </section>

        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-mono uppercase tracking-widest text-foreground-muted">Progress summary</h2>
            <button onClick={() => loadSummary(true)} disabled={loadingSummary} className="text-xs text-primary hover:underline disabled:opacity-50">
              {loadingSummary ? 'Writing…' : 'Regenerate'}
            </button>
          </div>
          <div className="bg-card border border-border rounded-2xl px-5 py-4">
            {loadingSummary && !summary ? (
              <p className="text-sm text-foreground-secondary">Writing summary…</p>
            ) : summary ? (
              (() => {
                const { bullets, closing } = parseSummary(summary)
                return (
                  <>
                    {bullets.length > 0 && (
                      <ul className="list-disc pl-5 space-y-1.5 text-sm text-foreground-secondary">
                        {bullets.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    )}
                    {closing && (
                      <p className={`text-sm text-foreground-secondary whitespace-pre-wrap ${bullets.length > 0 ? 'mt-3 pt-3 border-t border-border' : ''}`}>
                        {closing}
                      </p>
                    )}
                  </>
                )
              })()
            ) : null}
          </div>
        </section>

        {trendsWithHistory.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-mono uppercase tracking-widest text-foreground-muted mb-3">Trends</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {trendsWithHistory.map((t) => (
                <div key={t.key} className="bg-card border border-border rounded-2xl px-5 py-4">
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-sm font-semibold">{t.displayName}</div>
                    <div className="text-xs text-foreground-muted">{t.points[t.points.length - 1].value} {t.unit}</div>
                  </div>
                  <Sparkline trend={t} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-mono uppercase tracking-widest text-foreground-muted mb-3">Report history</h2>
          <div className="flex flex-col gap-2">
            {reports.map((r) => {
              const abnormalCount = (r.markers ?? []).filter((m) => m.abnormal).length
              return (
                <Link key={r.id} href={`/blood/report/${r.id}`}
                  className="bg-card border border-border rounded-xl px-5 py-4 flex items-center justify-between hover:border-primary transition">
                  <div>
                    <div className="text-sm font-medium">{r.pdf_filename}</div>
                    <div className="text-xs text-foreground-muted mt-0.5">{fmtDate(r.created_at)}</div>
                  </div>
                  {abnormalCount > 0 ? (
                    <span className="text-xs font-semibold text-danger bg-primary-light px-2.5 py-1 rounded-full">{abnormalCount} out of range</span>
                  ) : (
                    <span className="text-xs font-semibold text-success bg-secondary-light px-2.5 py-1 rounded-full">All normal</span>
                  )}
                </Link>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
