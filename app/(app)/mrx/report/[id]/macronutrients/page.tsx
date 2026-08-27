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
    key:         'carbohydrate',
    label:       'Carbohydrate Metabolism',
    description: 'Fermentation of carbohydrates and dietary fibre by gut bacteria',
    refLow:      29.75,
    refHigh:     42.366,
    min:         0,
    max:         100,
  },
  {
    key:         'fat',
    label:       'Fat Metabolism',
    description: 'Lipid digestion and bile acid transformation potential',
    refLow:      40.9,
    refHigh:     57.068,
    min:         0,
    max:         100,
  },
  {
    key:         'protein',
    label:       'Protein Metabolism',
    description: 'Protein fermentation and amino acid synthesis capacity',
    refLow:      46.2,
    refHigh:     61.9,
    min:         0,
    max:         100,
  },
] as const

type MetricKey = typeof METRICS[number]['key']
type Status = 'low' | 'optimal' | 'high'

function getStatus(score: number, low: number, high: number): Status {
  if (score < low)  return 'low'
  if (score > high) return 'high'
  return 'optimal'
}

// ─── Colour config ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Status, string> = {
  low:     'Below range',
  optimal: 'In range',
  high:    'Above range',
}

const STATUS_BADGE: Record<Status, string> = {
  low:     'bg-red-50 border-red-200 text-red-700',
  optimal: 'bg-[#F2F9EC] border-[#C8E9A8] text-[#538A22]',
  high:    'bg-amber-50 border-amber-200 text-amber-700',
}

const STATUS_DOT: Record<Status, string> = {
  low:     '#f87171',
  optimal: '#6EA832',
  high:    '#f59e0b',
}

const STATUS_VALUE: Record<Status, string> = {
  low:     'text-red-600',
  optimal: 'text-[#538A22]',
  high:    'text-amber-600',
}

// ─── Range bar - same style as foundation / pathogen pages ────────────────────

interface RangeBarProps {
  score:   number
  min:     number
  max:     number
  refLow:  number
  refHigh: number
  status:  Status
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
        {/* Track zones */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          {/* Below range */}
          <div className="absolute top-0 h-full bg-gray-100" style={{ left: 0, width: `${refL}%` }} />
          {/* Reference range - green */}
          <div className="absolute top-0 h-full bg-[#C8E9A8]" style={{ left: `${refL}%`, width: `${refW}%` }} />
          {/* Above range */}
          <div className="absolute top-0 h-full bg-gray-100" style={{ left: `${refL + refW}%`, right: 0 }} />
        </div>

        {/* Boundary tick marks */}
        <div className="absolute top-0 h-full w-px bg-[#6EA832] opacity-60" style={{ left: `${refL}%` }} />
        <div className="absolute top-0 h-full w-px bg-[#6EA832] opacity-60" style={{ left: `${refL + refW}%` }} />

        {/* Dot */}
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-sm"
          style={{
            left:            `${dotPct}%`,
            top:             '50%',
            transform:       'translate(-50%, -50%)',
            backgroundColor: dotClr,
            zIndex:          10,
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

interface MetricCardProps {
  label:       string
  description: string
  score:       number
  refLow:      number
  refHigh:     number
  min:         number
  max:         number
}

function MetricCard({ label, description, score, refLow, refHigh, min, max }: MetricCardProps) {
  const status = getStatus(score, refLow, refHigh)
  return (
    <div className="bg-white border border-[#E2F3D0] rounded-xl px-5 py-4">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{description}</p>
        </div>
        <span className={`flex-shrink-0 text-[10px] font-mono px-2 py-0.5 rounded border ${STATUS_BADGE[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      <RangeBar
        score={score}
        min={min}
        max={max}
        refLow={refLow}
        refHigh={refHigh}
        status={status}
      />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MacronutrientPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)

  const mn      = (report?.report_data?.macronutrients ?? {}) as Record<MetricKey, number | null>
  const hasData = METRICS.some(m => mn[m.key] != null)

  const scores = METRICS.map(m => ({
    ...m,
    score:  mn[m.key] ?? null,
    status: mn[m.key] != null ? getStatus(mn[m.key]!, m.refLow, m.refHigh) : null,
  }))

  const getSectionData = useMemo(
    () => (rep: { report_data: Record<string, unknown> | null }) => {
      const d = (rep.report_data?.macronutrients ?? {}) as Record<string, number>
      return {
        metrics: METRICS.map(m => ({
          label:   m.label,
          score:   d[m.key] ?? null,
          refLow:  m.refLow,
          refHigh: m.refHigh,
          status:  d[m.key] != null ? getStatus(d[m.key], m.refLow, m.refHigh) : 'unknown',
        })),
      }
    },
    [],
  )

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'macronutrient_metabolism',
    getSectionData,
    hasData,
  )

  if (loading) return <SectionLoading />
  if (!report) return null

  // Summary counts
  const inRange = scores.filter(s => s.status === 'optimal').length
  const low     = scores.filter(s => s.status === 'low').length
  const high    = scores.filter(s => s.status === 'high').length

  return (
    <SectionPageShell
      reportId={id}
      section="macronutrients"
      label="Macronutrient Metabolism"
      patientName={report.patient_name}
      pageData={{
        metrics: scores.map(s => ({ key: s.key, label: s.label, score: s.score, status: s.status })),
        ...buildAiContextFields(analysis, analysing, error),
      }}
    >
      <SectionHeader reportId={id} title="Macronutrient Metabolism" />

      {!hasData ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center mb-6">
          <p className="text-sm font-medium text-amber-800 mb-1">No macronutrient data found</p>
          <p className="text-xs text-amber-600">Re-upload this report to extract macronutrient metabolism data.</p>
        </div>
      ) : (
        <>
          {/* ── Stats grid ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white border border-[#E2F3D0] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-700 mb-1">{scores.filter(s => s.score != null).length}</div>
              <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wide">Metrics tracked</div>
            </div>
            <div className="bg-[#F2F9EC] border border-[#C8E9A8] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-[#538A22] mb-1">{inRange}</div>
              <div className="text-[10px] font-mono text-[#538A22] uppercase tracking-wide">In range</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-amber-600 mb-1">{low + high}</div>
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
            {scores.map(m =>
              m.score != null ? (
                <MetricCard
                  key={m.key}
                  label={m.label}
                  description={m.description}
                  score={m.score}
                  refLow={m.refLow}
                  refHigh={m.refHigh}
                  min={m.min}
                  max={m.max}
                />
              ) : null,
            )}
          </div>

          {/* ── How to read ─────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E2F3D0] rounded-xl p-5 mb-6">
            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-3">How to read</p>
            <div className="grid grid-cols-3 gap-4 text-xs text-gray-500">
              <div className="flex gap-2 items-start">
                <div className="mt-1 w-3 h-3 rounded-full bg-[#6EA832] border-2 border-white shadow flex-shrink-0" />
                <div><strong className="text-gray-700">In range</strong> - microbiome has adequate potential for this metabolic function</div>
              </div>
              <div className="flex gap-2 items-start">
                <div className="mt-1 w-3 h-3 rounded-full bg-red-400 border-2 border-white shadow flex-shrink-0" />
                <div><strong className="text-gray-700">Below range</strong> - reduced metabolic potential; may affect digestion and energy</div>
              </div>
              <div className="flex gap-2 items-start">
                <div className="mt-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-white shadow flex-shrink-0" />
                <div><strong className="text-gray-700">Above range</strong> - elevated metabolic activity; correlate clinically</div>
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
        loadingMessage="Analysing macronutrient metabolism…"
      />
    </SectionPageShell>
  )
}