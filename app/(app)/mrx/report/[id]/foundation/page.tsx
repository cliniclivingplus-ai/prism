/**
 * app/report/[id]/foundation/page.tsx
 */
'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { SectionHeader } from '@/components/mrx/SectionHeader'
import SectionAiPanel from '@/components/mrx/SectionAiPanel'
import SectionPageShell, { SectionLoading } from '@/components/mrx/SectionPageShell'
import { buildAiContextFields, useSectionAnalysis, useSectionReport } from '@/lib/mrx/sectionPage'
import type { FoundationSpecies } from '@/lib/mrx/ExtractFoundationmicrobiota'
import { AlertTriangle } from 'lucide-react'

// ─── Range bar ────────────────────────────────────────────────────────────────

function RangeBar({ s }: { s: FoundationSpecies }) {
  const range  = s.max - s.min || 1
  const pct    = (v: number) => Math.max(0, Math.min(100, ((v - s.min) / range) * 100))
  const refL   = pct(s.ref_low)
  const refW   = pct(s.ref_high) - refL
  const dotL   = pct(s.patient_value)
  const dotClr = s.status === 'low' ? '#f87171' : s.status === 'high' ? '#f59e0b' : '#6EA832'

  return (
    <div className="mt-3">
      <div className="relative h-2 bg-gray-100 rounded-full">
        <div
          className="absolute top-0 h-full rounded-full bg-[#C8E9A8]"
          style={{ left: `${refL}%`, width: `${refW}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3
                     rounded-full border-2 border-white shadow z-10"
          style={{ left: `${dotL}%`, backgroundColor: dotClr }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px] font-mono text-gray-400">
        <span>{s.min.toFixed(3)}</span>
        <span className="text-[#538A22]">{s.ref_low.toFixed(3)} – {s.ref_high.toFixed(3)}</span>
        <span>{s.max.toFixed(3)}</span>
      </div>
    </div>
  )
}

// ─── Status styles ────────────────────────────────────────────────────────────

const CARD_BG: Record<string, string> = {
  normal: 'bg-[#F2F9EC] border-[#C8E9A8]',
  low:    'bg-red-50 border-red-200',
  high:   'bg-amber-50 border-amber-200',
}

const BADGE: Record<string, string> = {
  normal: 'bg-[#F2F9EC] border-[#C8E9A8] text-[#538A22]',
  low:    'bg-red-50 border-red-200 text-red-700',
  high:   'bg-amber-50 border-amber-200 text-amber-700',
}

const LABEL: Record<string, string> = {
  normal: 'In range',
  low:    'Below range',
  high:   'Above range',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FoundationMicrobiotaPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)
  const [filter, setFilter] = useState<'all' | 'low' | 'normal' | 'high'>('all')
  const [search, setSearch] = useState('')

  const species: FoundationSpecies[] = useMemo(() => {
    const raw = (report?.report_data as any)?.foundation_microbiota
    return Array.isArray(raw) ? raw : []
  }, [report])

  const getSectionData = useMemo(
    () => (rep: { report_data: Record<string, unknown> | null }) => ({
      foundation_microbiota: (rep.report_data as any)?.foundation_microbiota,
      total:  species.length,
      low:    species.filter(s => s.status === 'low').length,
      high:   species.filter(s => s.status === 'high').length,
      normal: species.filter(s => s.status === 'normal').length,
    }),
    [species]
  )

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'Foundation Microbiota',
    getSectionData,
    species.length > 0
  )

  if (loading) return <SectionLoading />
  if (!report)  return null

  const lowCount    = species.filter(s => s.status === 'low').length
  const highCount   = species.filter(s => s.status === 'high').length
  const normalCount = species.filter(s => s.status === 'normal').length

  const filtered = species
    .filter(s => filter === 'all' || s.status === filter)
    .filter(s => !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <SectionPageShell
      reportId={id}
      section="foundation"
      label="Foundation Microbiota"
      patientName={report.patient_name}
      pageData={{
        total: species.length, low: lowCount, high: highCount, normal: normalCount,
        low_species:  species.filter(s => s.status === 'low').map(s => s.name),
        high_species: species.filter(s => s.status === 'high').map(s => s.name),
        ...buildAiContextFields(analysis, analysing, error),
      }}
    >
      <SectionHeader reportId={id} title="Foundation Microbiota" />

      {/* ── No data ──────────────────────────────────────────────────────── */}
      {species.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center mb-6">
          <p className="text-sm font-medium text-amber-800 mb-1">No foundation microbiota data found</p>
          <p className="text-xs text-amber-600">Re-upload this report to extract Foundation Microbiota data.</p>
        </div>
      )}

      {species.length > 0 && (
        <>
          {/* ── Stats ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total detected', value: species.length, style: 'bg-white border-[#E2F3D0] text-gray-700' },
              { label: 'In range',       value: normalCount,    style: 'bg-[#F2F9EC] border-[#C8E9A8] text-[#538A22]' },
              { label: 'Below range',    value: lowCount,       style: 'bg-red-50 border-red-200 text-red-600' },
              { label: 'Above range',    value: highCount,      style: 'bg-amber-50 border-amber-200 text-amber-600' },
            ].map(c => (
              <div key={c.label} className={`border rounded-xl p-4 text-center ${c.style}`}>
                <div className="text-2xl font-bold mb-1">{c.value}</div>
                <div className="text-[10px] font-mono uppercase tracking-wide opacity-80">{c.label}</div>
              </div>
            ))}
          </div>

          {/* ── Below range alert ──────────────────────────────────────── */}
          {lowCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
              <p className="text-xs font-mono text-red-700 uppercase tracking-wide font-medium mb-3 flex items-center gap-1">
                <AlertTriangle size={12} /> Below-range species ({lowCount})
              </p>
              <div className="flex flex-wrap gap-2">
                {species.filter(s => s.status === 'low').map(s => (
                  <span key={s.name} className="text-xs italic text-red-800 bg-red-100 border border-red-200 px-2 py-1 rounded-lg">
                    {s.name}
                    <span className="not-italic font-mono ml-1 text-red-500">({s.patient_value.toFixed(3)})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── What is foundation microbiota ──────────────────────────── */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
            <p className="text-xs font-mono text-blue-600 uppercase tracking-wide mb-2">What is foundation microbiota</p>
            <p className="text-sm text-blue-900 leading-relaxed">
              Foundation microbiota are keystone species whose presence or abundance has outsized
              effects on the entire microbiome ecosystem. BugSpeaks detected{' '}
              <strong>{species.length} keystone species</strong> in this report - perturbations
              in these affect SCFA production, immune function, gut barrier integrity, and mental health.
            </p>
          </div>

          {/* ── Filters + search ───────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {[
              { id: 'all',    label: `All (${species.length})` },
              { id: 'low',    label: `Below range (${lowCount})` },
              { id: 'normal', label: `In range (${normalCount})` },
              { id: 'high',   label: `Above range (${highCount})` },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition
                  ${filter === f.id
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
              >
                {f.label}
              </button>
            ))}
            <input
              type="text"
              placeholder="Search species…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="ml-auto text-xs font-mono px-3 py-1.5 rounded-lg border border-gray-200
                         focus:outline-none focus:border-[#8BC44F] bg-white text-gray-700
                         placeholder-gray-300 w-44"
            />
          </div>

          {/* ── Species list ───────────────────────────────────────────── */}
          <div className="space-y-3 mb-6">
            {filtered.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8 font-mono">No species match.</p>
            )}
            {filtered.map(s => (
              <div key={s.name} className={`border rounded-xl p-4 ${CARD_BG[s.status]}`}>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <span className="text-sm font-medium italic text-gray-900">{s.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${BADGE[s.status]}`}>
                      {s.patient_value.toFixed(3)}
                    </span>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${BADGE[s.status]}`}>
                      {LABEL[s.status]}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] font-mono text-gray-400">
                  Ref: {s.ref_low.toFixed(3)} – {s.ref_high.toFixed(3)}
                  &nbsp;|&nbsp;IQR: {s.p25.toFixed(3)} – {s.p75.toFixed(3)}
                </p>
                <RangeBar s={s} />
              </div>
            ))}
          </div>

          {/* ── Legend ─────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E2F3D0] rounded-xl p-5 mb-6">
            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-4">How to read the bars</p>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="flex gap-2 items-start">
                <div className="mt-1 w-4 h-2 rounded-full bg-[#C8E9A8] flex-shrink-0" />
                <div><div className="font-medium text-gray-700 mb-0.5">Green zone</div><div className="text-gray-500">Reference range for healthy population</div></div>
              </div>
              <div className="flex gap-2 items-start">
                <div className="mt-0.5 w-3 h-3 rounded-full bg-[#6EA832] border-2 border-white shadow flex-shrink-0" />
                <div><div className="font-medium text-gray-700 mb-0.5">Green dot</div><div className="text-gray-500">Patient value within range</div></div>
              </div>
              <div className="flex gap-2 items-start">
                <div className="mt-0.5 w-3 h-3 rounded-full bg-red-400 border-2 border-white shadow flex-shrink-0" />
                <div><div className="font-medium text-gray-700 mb-0.5">Red / amber dot</div><div className="text-gray-500">Patient value outside range</div></div>
              </div>
            </div>
          </div>
        </>
      )}

      <SectionAiPanel
        analysis={analysis}
        analysing={analysing}
        error={error}
        onRegenerate={() => report && analyse(report)}
        loadingMessage="Analysing foundation microbiota profile…"
      />
    </SectionPageShell>
  )
}