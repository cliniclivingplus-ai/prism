'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { SectionHeader } from '@/components/mrx/SectionHeader'
import SectionAiPanel from '@/components/mrx/SectionAiPanel'
import SectionPageShell, { SectionLoading } from '@/components/mrx/SectionPageShell'
import { buildAiContextFields, useSectionAnalysis, useSectionReport } from '@/lib/mrx/sectionPage'

// ─── Metric definitions ───────────────────────────────────────────────────────

const METRICS = [
  {
    key:          'intestinal_motility',
    label:        'Intestinal Motility',
    description:  'Gut transit and bowel movement regulation',
    clinicalNote: 'High scores suggest over-active motility linked to loose stools, urgency or IBS-D. Below range suggests sluggish transit - bloating, constipation risk.',
    refLow:       62.84,
    refHigh:      82.702,
    min:          0,
    max:          100,
  },
  {
    key:          'mineral_bioavailability',
    label:        'Mineral Bioavailability',
    description:  'Microbial support for mineral absorption',
    clinicalNote: 'Below range indicates reduced mineral absorption capacity - risk for deficiency states. High scores may reflect increased oxalate-degrading activity.',
    refLow:       35.94,
    refHigh:      52.76,
    min:          0,
    max:          100,
  },
] as const

type MetricKey = typeof METRICS[number]['key']
type Status    = 'low' | 'optimal' | 'high'

function getStatus(score: number, low: number, high: number): Status {
  if (score < low)  return 'low'
  if (score > high) return 'high'
  return 'optimal'
}

// ─── Colour config ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Status, string> = {
  low:     'Below Range',
  optimal: 'Optimal',
  high:    'Above Range',
}

const STATUS_BADGE: Record<Status, string> = {
  low:     'bg-amber-50 border-amber-200 text-amber-700',
  optimal: 'bg-[#F2F9EC] border-[#C8E9A8] text-[#538A22]',
  high:    'bg-red-50 border-red-200 text-red-700',
}

const STATUS_DOT: Record<Status, string> = {
  low:     '#f59e0b',
  optimal: '#6EA832',
  high:    '#f87171',
}

// ─── Range bar ────────────────────────────────────────────────────────────────

interface RangeBarProps {
  score: number; min: number; max: number; refLow: number; refHigh: number; status: Status
}

function RangeBar({ score, min, max, refLow, refHigh, status }: RangeBarProps) {
  const range  = max - min || 1
  const pct    = (v: number) => Math.max(0, Math.min(100, ((v - min) / range) * 100))
  const refL   = pct(refLow)
  const refW   = pct(refHigh) - refL
  const dotPct = pct(score)
  const dotClr = STATUS_DOT[status]

  return (
    <div className="mt-4">
      {/* Value label above dot */}
      <div className="relative h-5 mb-0.5">
        <span
          className="absolute bottom-0 text-[11px] font-mono font-semibold leading-none"
          style={{ left: `${dotPct}%`, transform: 'translateX(-50%)', color: dotClr }}
        >
          {score.toFixed(2)}
        </span>
      </div>

      {/* Track + dot */}
      <div className="relative" style={{ height: '10px', overflow: 'visible' }}>
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div className="absolute top-0 h-full bg-gray-100" style={{ left: 0, width: `${refL}%` }} />
          <div className="absolute top-0 h-full bg-[#C8E9A8]" style={{ left: `${refL}%`, width: `${refW}%` }} />
          <div className="absolute top-0 h-full bg-gray-100" style={{ left: `${refL + refW}%`, right: 0 }} />
        </div>
        <div className="absolute top-0 h-full w-px bg-[#6EA832] opacity-60" style={{ left: `${refL}%` }} />
        <div className="absolute top-0 h-full w-px bg-[#6EA832] opacity-60" style={{ left: `${refL + refW}%` }} />
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-sm"
          style={{
            left: `${dotPct}%`, top: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: dotClr, zIndex: 10,
          }}
        />
      </div>

      {/* Axis labels */}
      <div className="relative h-5 mt-2 text-[9px] font-mono text-gray-400">
        <span className="absolute" style={{ left: 0 }}>{min}</span>
        <span className="absolute text-[#538A22]" style={{ left: `${refL}%`, transform: 'translateX(-50%)' }}>
          {refLow}
        </span>
        <span className="absolute text-[#538A22]" style={{ left: `${refL + refW}%`, transform: 'translateX(-50%)' }}>
          {refHigh}
        </span>
        <span className="absolute" style={{ right: 0 }}>{max}</span>
      </div>
    </div>
  )
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({ m }: { m: typeof METRICS[number] & { score: number; status: Status } }) {
  return (
    <div className="bg-white border border-[#E2F3D0] rounded-xl px-5 py-4">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <p className="text-sm font-medium text-gray-900">{m.label}</p>
          <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{m.description}</p>
        </div>
        <span className={`flex-shrink-0 text-[10px] font-mono px-2 py-0.5 rounded border ${STATUS_BADGE[m.status]}`}>
          {STATUS_LABEL[m.status]}
        </span>
      </div>

      <RangeBar score={m.score} min={m.min} max={m.max} refLow={m.refLow} refHigh={m.refHigh} status={m.status} />

      {/* Clinical note - only when out of range */}
      {m.status !== 'optimal' && (
        <p className="text-xs text-gray-600 mt-3 leading-relaxed border-t border-[#E2F3D0] pt-3">
          {m.clinicalNote}
        </p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GutFunctionPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)

  const gf      = (report?.report_data?.gut_function ?? {}) as Record<MetricKey, number | null>
  const hasData = METRICS.some(m => gf[m.key] != null)

  const scores = METRICS.map(m => ({
    ...m,
    score:  gf[m.key] ?? null,
    status: gf[m.key] != null ? getStatus(gf[m.key]!, m.refLow, m.refHigh) : null,
  }))

  const present = scores.filter((s): s is typeof s & { score: number; status: Status } => s.score != null)

  const getSectionData = useMemo(
    () => (rep: { report_data: Record<string, unknown> | null }) => {
      const d = (rep.report_data?.gut_function ?? {}) as Record<string, number>
      return {
        metrics: METRICS.map(m => ({
          label: m.label, score: d[m.key] ?? null,
          refLow: m.refLow, refHigh: m.refHigh,
          status: d[m.key] != null ? getStatus(d[m.key], m.refLow, m.refHigh) : 'unknown',
        })),
      }
    },
    [],
  )

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report, 'gut_function', getSectionData, hasData,
  )

  if (loading) return <SectionLoading />
  if (!report) return null

  const inRange = present.filter(s => s.status === 'optimal').length
  const outRange = present.filter(s => s.status !== 'optimal').length

  const motility = scores.find(s => s.key === 'intestinal_motility')
  const mineral  = scores.find(s => s.key === 'mineral_bioavailability')

  return (
    <SectionPageShell
      reportId={id}
      section="gut-function"
      label="Gut Function"
      patientName={report.patient_name}
      pageData={{
        metrics: scores.map(s => ({ key: s.key, label: s.label, score: s.score, status: s.status, refLow: s.refLow, refHigh: s.refHigh })),
        ...buildAiContextFields(analysis, analysing, error),
      }}
    >
      <SectionHeader reportId={id} title="Gut Function" />

      {!hasData ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center mb-6">
          <p className="text-sm font-medium text-amber-800 mb-1">No gut function data found</p>
          <p className="text-xs text-amber-600">Re-upload this report to extract gut function scores.</p>
        </div>
      ) : (
        <>
          {/* ── Stats ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white border border-[#E2F3D0] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-700 mb-1">{present.length}</div>
              <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wide">Metrics tracked</div>
            </div>
            <div className="bg-[#F2F9EC] border border-[#C8E9A8] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-[#538A22] mb-1">{inRange}</div>
              <div className="text-[10px] font-mono text-[#538A22] uppercase tracking-wide">Optimal</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-amber-600 mb-1">{outRange}</div>
              <div className="text-[10px] font-mono text-amber-600 uppercase tracking-wide">Out of range</div>
            </div>
          </div>

          {/* ── Legend ─────────────────────────────────────────────────── */}
          <div className="flex items-center gap-6 mb-5 px-1">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2.5 rounded-sm bg-[#C8E9A8] border border-[#6EA832]" />
              <span className="text-[10px] font-mono text-gray-500">Reference range</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2.5 rounded-sm bg-gray-100 border border-gray-200" />
              <span className="text-[10px] font-mono text-gray-500">Outside range</span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <div className="w-3.5 h-3.5 rounded-full bg-[#6EA832] border-2 border-white shadow-sm" />
              <span className="text-[10px] font-mono text-gray-500">Patient score</span>
            </div>
          </div>

          {/* ── Metric cards ────────────────────────────────────────────── */}
          <div className="space-y-4 mb-6">
            {present.map(m => <MetricCard key={m.key} m={m} />)}
          </div>

          {/* ── Correlation insight ─────────────────────────────────────── */}
          {motility?.score != null && mineral?.score != null && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 mb-6">
              <p className="text-[10px] font-mono text-blue-500 uppercase tracking-widest mb-2">Clinical correlation</p>
              <p className="text-sm text-blue-900 leading-relaxed">
                {motility.status === 'high' && mineral.status === 'low'
                  ? 'Elevated motility combined with reduced mineral bioavailability suggests rapid transit limiting adequate absorption. Consider motility-modulating probiotics and magnesium support.'
                  : motility.status === 'low'
                  ? 'Sluggish intestinal motility may contribute to bloating, constipation and fermentation of undigested substrates. Fibre diversity and physical activity support transit time.'
                  : 'Gut motility and mineral bioavailability scores are within or near reference ranges. Continue dietary support to maintain microbial balance.'}
              </p>
            </div>
          )}
        </>
      )}

      <SectionAiPanel
        analysis={analysis}
        analysing={analysing}
        error={error}
        onRegenerate={() => report && analyse(report)}
        loadingMessage="Analysing gut function scores…"
      />
    </SectionPageShell>
  )
}