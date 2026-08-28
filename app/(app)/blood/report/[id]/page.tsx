'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import type { ExtractedMarker, MarkerRecommendation } from '@/lib/blood/types'
import { computeRangeViz } from '@/lib/blood/rangeViz'

// A simple horizontal range bar — the whole track is color-zoned (red
// outside the reference range, green inside it) so normal-vs-abnormal
// reads at a glance without even looking at the dot, plus a bold,
// high-contrast dot for the patient's actual value. No charting library:
// just absolutely-positioned divs over a track. Renders nothing if the
// result or range can't be read as plain numbers (text results, missing
// range, a garbled OCR read), rather than guessing at a misleading bar.
function RangeBar({ marker }: { marker: ExtractedMarker }) {
  const viz = computeRangeViz(marker.result, marker.ref_range)
  if (!viz) return null
  return (
    <div className="w-36">
      <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: '#FCA5A5' }}>
        <div
          className="absolute inset-y-0"
          style={{ left: `${viz.lowPct}%`, width: `${Math.max(0, viz.highPct - viz.lowPct)}%`, background: '#86EFAC' }}
        />
        <div
          className="absolute top-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${viz.valuePct}%`, background: viz.inRange ? '#15803D' : '#B91C1C' }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-foreground-muted mt-1 leading-none">
        <span>{viz.min}</span>
        <span>{viz.max}</span>
      </div>
    </div>
  )
}

type ReportData = {
  id: string
  pdf_filename: string | null
  markers: ExtractedMarker[] | null
  recommendations: MarkerRecommendation[] | null
  created_at: string
}
type Patient = { id: string; name: string }

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [report, setReport] = useState<ReportData | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<MarkerRecommendation[] | null>(null)
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [error, setError] = useState('')
  // Set when this report's own patient ("patient" above) has a different
  // name than the hub account it's linked to via clp_patient_id — the
  // earliest visible sign a coach picked the wrong patient at upload time.
  const [hubNameMismatch, setHubNameMismatch] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/blood/reports/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return
        if (j.error) { setError(j.error); return }
        setReport(j.report)
        setPatient(j.patient)
        setFileUrl(j.fileUrl)
        if (j.report.recommendations) setRecommendations(j.report.recommendations)
        const hubName = (j.hubPatientName ?? '').trim()
        const toolName = (j.patient?.name ?? '').trim()
        if (hubName && toolName && hubName.toLowerCase() !== toolName.toLowerCase()) {
          setHubNameMismatch(hubName)
        }
      })
    return () => { alive = false }
  }, [id])

  useEffect(() => {
    if (!report || recommendations !== null) return
    const abnormalCount = (report.markers ?? []).filter((m) => m.abnormal).length
    if (abnormalCount === 0) { setRecommendations([]); return }
    setLoadingRecs(true)
    fetch('/api/blood/recommendations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_id: id }),
    })
      .then((r) => r.json())
      .then((j) => { if (j.recommendations) setRecommendations(j.recommendations) })
      .finally(() => setLoadingRecs(false))
  }, [report, recommendations, id])

  if (error) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-sm text-danger">{error}</div>
  }
  if (!report) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-sm text-foreground-secondary">Loading…</div>
  }

  const markers = report.markers ?? []
  const abnormalMarkers = markers.filter((m) => m.abnormal)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/blood/dashboard" className="flex items-center gap-2 text-sm text-foreground-secondary hover:text-foreground">
            ← Dashboard
          </Link>
          {fileUrl && (
            <a href={fileUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
              View original file →
            </a>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-light mb-1">{patient?.name ?? 'Unknown patient'}</h1>
        <p className="text-sm text-foreground-muted mb-8">
          {report.pdf_filename} · {new Date(report.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>

        {hubNameMismatch && (
          <div className="rounded-2xl p-4 mb-8 text-sm" style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#78350F' }}>
            ⚠ This report is linked to the patient account &quot;{hubNameMismatch}&quot;, but this report&apos;s own patient is &quot;{patient?.name}&quot; — double-check this is the right report before relying on it.
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-card border border-border rounded-2xl px-5 py-4">
            <div className="text-2xl font-semibold">{markers.length}</div>
            <div className="text-xs text-foreground-muted mt-1">Tests analyzed</div>
          </div>
          <div className="bg-card border border-border rounded-2xl px-5 py-4">
            <div className={`text-2xl font-semibold ${abnormalMarkers.length > 0 ? 'text-danger' : 'text-success'}`}>{abnormalMarkers.length}</div>
            <div className="text-xs text-foreground-muted mt-1">Out of range</div>
          </div>
        </div>

        <section className="mb-10">
          <h2 className="text-sm font-mono uppercase tracking-widest text-foreground-muted mb-3">Findings</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-mono uppercase tracking-wider text-foreground-muted border-b border-border">
                  <th className="px-4 py-3">Test</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Reference range</th>
                  <th className="px-4 py-3">Where it falls</th>
                </tr>
              </thead>
              <tbody>
                {markers.map((m, i) => (
                  <tr key={i} className={`border-b border-border-light last:border-0 ${m.abnormal ? 'bg-primary-light/40' : ''}`}>
                    <td className="px-4 py-3 font-medium">{m.test_name}</td>
                    <td className={`px-4 py-3 whitespace-nowrap ${m.abnormal ? 'text-danger font-semibold' : ''}`}>
                      {m.result} {m.unit} {m.flag && <span className="ml-1 text-xs">({m.flag})</span>}
                    </td>
                    <td className="px-4 py-3 text-foreground-secondary whitespace-nowrap">{m.ref_range || '—'}</td>
                    <td className="px-4 py-3"><RangeBar marker={m} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-mono uppercase tracking-widest text-foreground-muted mb-3">Recommendations</h2>
          {abnormalMarkers.length === 0 ? (
            <p className="text-sm text-foreground-secondary">Every extracted value is within range.</p>
          ) : loadingRecs ? (
            <p className="text-sm text-foreground-secondary">Writing recommendations…</p>
          ) : (
            <div className="flex flex-col gap-3">
              {(recommendations ?? []).map((rec, i) => (
                <div key={i} className="bg-card border border-border rounded-xl px-5 py-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-sm font-semibold">{rec.test_name} — {rec.result}</div>
                    {rec.condition_label && (
                      <span className="text-xs font-medium text-primary bg-primary-light px-2 py-0.5 rounded-full">
                        {rec.condition_label}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm ${rec.matched ? 'text-foreground-secondary' : 'text-warning'}`}>{rec.rationale}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
