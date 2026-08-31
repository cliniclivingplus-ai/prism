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

type SummaryRow = {
  name: string; unit: string; refRange: string; history: string
  latestDate: string; change: 'up' | 'down' | 'same'; inRange: boolean
}
type StructuredSummary = { rows: SummaryRow[]; closing: string }

// progress_summary is stored as a JSON string ({rows, closing}) so the
// table renders real per-marker data rather than free text. A value saved
// before this change is a plain sentence and won't parse as that shape —
// treated as a closing-only summary with no rows, so it still shows
// something sensible until the coach hits Regenerate.
function parseSummaryPayload(raw: string): StructuredSummary {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.rows)) return { rows: parsed.rows, closing: parsed.closing || '' }
  } catch { /* legacy plain-text value */ }
  return { rows: [], closing: raw }
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
  const [summary, setSummary] = useState<StructuredSummary | null>(null)
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
        if (j.patient.progress_summary) setSummary(parseSummaryPayload(j.patient.progress_summary))
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
        form.append('ocr_used', String(extracted.ocrUsed))

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
      .then((j) => {
        if (j.error) { setSummary({ rows: [], closing: j.error }); return }
        setSummary({ rows: j.rows ?? [], closing: j.closing ?? '' })
      })
      .catch(() => setSummary({ rows: [], closing: 'Could not load a summary — try again.' }))
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
          Clinicea ID {patient.clinic_id} · {reports.length} report{reports.length === 1 ? '' : 's'}
          {reports.length > 0 && <> · {fmtDate(reports[reports.length - 1].created_at)} to {fmtDate(reports[0].created_at)}</>}
        </p>

        <section className="mb-10">
          <h2 className="text-sm font-mono uppercase tracking-widest text-foreground-muted mb-3">Upload reports</h2>
          <div className="bg-card border border-border rounded-2xl p-6">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-primary-blood px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium rounded-lg text-sm transition-all"
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
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {loadingSummary && !summary ? (
              <p className="text-sm text-foreground-secondary px-5 py-4">Writing summary…</p>
            ) : summary ? (
              <>
                {summary.rows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-border text-left text-xs font-mono uppercase tracking-wide text-foreground-muted">
                          <th className="px-5 py-2.5 font-medium">Marker</th>
                          <th className="px-3 py-2.5 font-medium">History</th>
                          <th className="px-3 py-2.5 font-medium">Latest</th>
                          <th className="px-3 py-2.5 font-medium">Trend</th>
                          <th className="px-3 py-2.5 font-medium">Range</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.rows.map((r, i) => (
                          <tr key={i} className={i === summary.rows.length - 1 ? '' : 'border-b border-border'}>
                            <td className="px-5 py-2.5 font-medium text-foreground">{r.name}</td>
                            <td className="px-3 py-2.5 text-foreground-secondary whitespace-nowrap">
                              {r.history}{r.unit ? ` ${r.unit}` : ''}
                            </td>
                            <td className="px-3 py-2.5 text-foreground-muted whitespace-nowrap">{r.latestDate}</td>
                            <td className="px-3 py-2.5">
                              <span className={
                                r.change === 'up' ? 'text-danger' : r.change === 'down' ? 'text-success' : 'text-foreground-muted'
                              }>
                                {r.change === 'up' ? '↑ Increased' : r.change === 'down' ? '↓ Decreased' : '→ Same'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.inRange ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                                {r.inRange ? 'In range' : 'Out of range'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {summary.closing && (
                  <p className={`text-sm text-foreground-secondary px-5 py-4 ${summary.rows.length > 0 ? 'border-t border-border' : ''}`}>
                    {summary.closing}
                  </p>
                )}
              </>
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
                  className="roster-row bg-card border border-border rounded-xl px-5 py-4 flex items-center justify-between hover:border-primary transition">
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
