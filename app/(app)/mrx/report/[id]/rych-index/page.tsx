'use client'
// app/report/[id]/rych-index/page.tsx - redesigned

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { SectionHeader } from '@/components/mrx/SectionHeader'
import SectionAiPanel from '@/components/mrx/SectionAiPanel'
import SectionPageShell, { SectionLoading } from '@/components/mrx/SectionPageShell'
import { buildAiContextFields, useSectionAnalysis, useSectionReport } from '@/lib/mrx/sectionPage'

// ─── Design tokens ────────────────────────────────────────────────────────────
// Palette: clinical green primary, warm neutrals, clear risk reds
// green-50  #F2F9EC   green-100 #E2F3D0   green-600 #3D7A15   green-700 #2F6011
// amber-500 #F59E0B   red-500   #EF4444   red-700   #B91C1C
// neutral-50 #FAFAFA  neutral-100 #F4F4F5  neutral-800 #27272A

type ScoreConfig = {
  color: string
  track: string
  badge: string
  badgeText: string
  label: string
  gradient: string
  markerPct: number
}

function getScoreConfig(score: number): ScoreConfig {
  if (score >= 70) return {
    color: '#3D7A15', track: '#D1EAC0', badge: '#EEF7E5', badgeText: '#3D7A15',
    label: 'Good', gradient: 'linear-gradient(90deg,#EF4444 0%,#F59E0B 33%,#84CC16 66%,#22C55E 100%)',
    markerPct: 70 + (score - 70) / 30 * 30,
  }
  if (score >= 50) return {
    color: '#D97706', track: '#FDE68A', badge: '#FFFBEB', badgeText: '#92400E',
    label: 'Moderate', gradient: 'linear-gradient(90deg,#EF4444 0%,#F59E0B 33%,#84CC16 66%,#22C55E 100%)',
    markerPct: 33 + (score - 50) / 20 * 33,
  }
  if (score >= 30) return {
    color: '#EF4444', track: '#FECACA', badge: '#FEF2F2', badgeText: '#991B1B',
    label: 'Low', gradient: 'linear-gradient(90deg,#EF4444 0%,#F59E0B 33%,#84CC16 66%,#22C55E 100%)',
    markerPct: (score / 30) * 33,
  }
  return {
    color: '#B91C1C', track: '#FECACA', badge: '#FEF2F2', badgeText: '#7F1D1D',
    label: 'Critical', gradient: 'linear-gradient(90deg,#EF4444 0%,#F59E0B 33%,#84CC16 66%,#22C55E 100%)',
    markerPct: score / 30 * 10,
  }
}

// ─── Score Hero ───────────────────────────────────────────────────────────────
// Signature element: large ring + live spectrum needle below it
function ScoreHero({ score }: { score: number }) {
  const cfg = getScoreConfig(score)
  const size = 220, stroke = 14
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(100, Math.max(0, score)) / 100) * circ

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Ring */}
      <div style={{ filter: `drop-shadow(0 6px 32px ${cfg.color}28)` }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track */}
          <circle cx={size/2} cy={size/2} r={r}
            fill="none" stroke={cfg.track} strokeWidth={stroke} />
          {/* Progress */}
          <circle cx={size/2} cy={size/2} r={r}
            fill="none" stroke={cfg.color} strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
          {/* Score number */}
          <text x={size/2} y={size/2 - 10}
            textAnchor="middle" dominantBaseline="middle"
            fontSize="58" fontWeight="800" fill={cfg.color}
            style={{ fontVariantNumeric: 'tabular-nums' }}>
            {score}
          </text>
          {/* Subtitle */}
          <text x={size/2} y={size/2 + 24}
            textAnchor="middle" fontSize="11" fill="#9CA3AF"
            letterSpacing="2">OUT OF 100</text>
        </svg>
      </div>

      {/* Status badge */}
      <span className="text-xs font-semibold px-4 py-1.5 rounded-full tracking-widest uppercase"
        style={{ background: cfg.badge, color: cfg.badgeText }}>
        {cfg.label}
      </span>

      {/* Spectrum bar + needle - the signature element */}
      <div className="w-52 mt-1">
        <div className="relative h-2.5 rounded-full overflow-visible"
          style={{ background: cfg.gradient }}>
          {/* Needle */}
          <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full
            border-2 shadow-md transition-all duration-700"
            style={{
              left: `calc(${cfg.markerPct}% - 8px)`,
              borderColor: cfg.color,
            }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-gray-400 mt-2 font-medium tracking-wide">
          <span>Critical</span><span>Low</span><span>Moderate</span><span>Good</span>
        </div>
      </div>
    </div>
  )
}

// ─── Metric card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, accent = '#538A22' }: {
  label: string, value: string | number, sub?: string, accent?: string
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 flex flex-col gap-1 relative overflow-hidden
      shadow-[0_1px_4px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow">
      {/* Left accent stripe */}
      <div className="absolute left-0 top-5 bottom-5 w-[3px] rounded-r-full" style={{ background: accent }} />
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.1em] pl-4">{label}</span>
      <span className="text-3xl font-bold pl-4" style={{ color: accent }}>{value}</span>
      {sub && <span className="text-xs text-gray-400 pl-4">{sub}</span>}
    </div>
  )
}

// ─── Risk chip ────────────────────────────────────────────────────────────────
function RiskChip({ label, value }: { label: string, value: number }) {
  const high = value > 20
  const mid = value > 10
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium
      ${high ? 'bg-red-50 border-red-200 text-red-700'
      : mid  ? 'bg-amber-50 border-amber-200 text-amber-700'
             : 'bg-[#F2F9EC] border-[#D1EAC0] text-[#3D7A15]'}`}>
      <span className="capitalize">{label.replace(/_/g, ' ')}</span>
      <span className={`text-xs font-bold rounded-full px-2.5 py-0.5
        ${high ? 'bg-red-200 text-red-800'
        : mid  ? 'bg-amber-200 text-amber-800'
               : 'bg-[#D1EAC0] text-[#3D7A15]'}`}>
        {value.toFixed(1)}%
      </span>
    </div>
  )
}

// ─── Health indicator chip ────────────────────────────────────────────────────
function IndicatorChip({ label, value }: { label: string, value: number }) {
  const high = value > 50
  return (
    <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-medium
      ${high ? 'bg-orange-50 border-orange-200 text-orange-700'
             : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
      <span className="capitalize">{label.replace(/_/g, ' ')}</span>
      <span className="font-bold ml-3">{value}</span>
    </div>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────
function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-3">{children}</p>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
type ReportData = {
  rych_index?: number
  diversity?: { shannon?: number }
  species_list?: unknown[]
  antibiotic_recovery?: string | number
  health_indicators?: Record<string, number | null>
  disease_risk?: Record<string, number>
}

export default function RychIndexPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)

  const getSectionData = useMemo(
    () => (rep: { report_data: Record<string, unknown> | null }) => ({
      rych_index: rep.report_data?.rych_index,
      diversity: rep.report_data?.diversity,
      health_indicators: rep.report_data?.health_indicators,
      disease_risk: rep.report_data?.disease_risk,
    }),
    []
  )

  const rd = report?.report_data as ReportData | null
  const score = typeof rd?.rych_index === 'number' ? rd.rych_index : null
  const hasData = score !== null

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report, 'Rych Index', getSectionData, hasData
  )

  if (loading) return <SectionLoading />
  if (!report) return null

  const pageData = {
    rych_index: score ?? null,
    rych_index_interpretation: score != null
      ? score >= 70 ? 'Good' : score >= 50 ? 'Moderate' : score >= 30 ? 'Low' : 'Critical'
      : null,
    shannon_diversity: rd?.diversity?.shannon ?? null,
    species_count: Array.isArray(rd?.species_list) ? rd.species_list.length : null,
    antibiotic_recovery: rd?.antibiotic_recovery ?? null,
    top_disease_risks: rd?.disease_risk
      ? Object.entries(rd.disease_risk)
          .filter(([, v]) => v != null)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([k, v]) => ({ condition: k, risk_pct: v }))
      : [],
    ...buildAiContextFields(analysis, analysing, error),
  }

  // Sorted disease risks
  const sortedRisks = rd?.disease_risk
    ? Object.entries(rd.disease_risk)
        .filter(([, v]) => v != null)
        .sort(([, a], [, b]) => b - a)
    : []

  const healthIndicators = rd?.health_indicators
    ? Object.entries(rd.health_indicators).filter(([, v]) => v !== null) as [string, number][]
    : []

  return (
    <SectionPageShell
      reportId={id}
      section="rych-index"
      label="Rych Index"
      patientName={report.patient_name}
      pageData={pageData}
    >
      <SectionHeader reportId={id} title="Rych Index" />

      {!score && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 mb-6">
          No Rych Index score found in this report. Re-upload the PDF to extract scores.
        </div>
      )}

      {score && (
        <div className="space-y-5">

          {/* ── Hero card ─────────────────────────────────────────────────── */}
          <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-[0_2px_20px_rgba(0,0,0,0.05)]">
            <div className="flex flex-col md:flex-row items-center gap-10">

              {/* Score ring + spectrum */}
              <div className="flex-shrink-0">
                <ScoreHero score={score} />
              </div>

              {/* Vertical divider (desktop) */}
              <div className="hidden md:block w-px bg-gray-100 self-stretch" />

              {/* Key metrics */}
              <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MetricCard
                  label="Shannon Diversity"
                  value={rd?.diversity?.shannon ?? '-'}
                  sub="Microbial richness score"
                  accent="#3D7A15"
                />
                <MetricCard
                  label="Species Count"
                  value={rd?.species_list?.length ?? '-'}
                  sub="Identified species"
                  accent="#538A22"
                />
                <MetricCard
                  label="Antibiotic Recovery"
                  value={rd?.antibiotic_recovery ?? '-'}
                  sub="Recovery index"
                  accent={
                    typeof rd?.antibiotic_recovery === 'number' && rd.antibiotic_recovery > 60
                      ? '#EF4444' : '#538A22'
                  }
                />
              </div>
            </div>
          </div>

          {/* ── Risk + Indicators row ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Disease Risk */}
            <Link href={`/mrx/report/${id}/disease-risk`}
              className="tool-card group bg-white border border-gray-100 rounded-2xl p-6
                shadow-[0_1px_8px_rgba(0,0,0,0.04)]
                hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] hover:border-red-100 transition-all">
              <div className="flex items-center justify-between mb-4">
                <SLabel>Disease Risk</SLabel>
                <span className="text-[10px] font-semibold text-gray-400 group-hover:text-red-400 transition">
                  VIEW ALL →
                </span>
              </div>
              {sortedRisks.length > 0 ? (
                <div className="space-y-2">
                  {sortedRisks.slice(0, 4).map(([k, v]) => (
                    <RiskChip key={k} label={k} value={v} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No risk data - re-upload PDF</p>
              )}
            </Link>

            {/* Health Indicators */}
            <Link href={`/mrx/report/${id}/health-indicators`}
              className="tool-card group bg-white border border-gray-100 rounded-2xl p-6
                shadow-[0_1px_8px_rgba(0,0,0,0.04)]
                hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] hover:border-[#D1EAC0] transition-all">
              <div className="flex items-center justify-between mb-4">
                <SLabel>Health Indicators</SLabel>
                <span className="text-[10px] font-semibold text-gray-400 group-hover:text-[#3D7A15] transition">
                  VIEW ALL →
                </span>
              </div>
              {healthIndicators.length > 0 ? (
                <div className="space-y-2">
                  {healthIndicators
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 4)
                    .map(([k, v]) => (
                      <IndicatorChip key={k} label={k} value={v} />
                    ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No data - re-upload PDF</p>
              )}
            </Link>
          </div>

          {/* ── AI Analysis ───────────────────────────────────────────────── */}
          {/* 
            SectionAiPanel already renders the AI output.
            We wrap it in a styled card so it matches the new design language.
          */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]
            overflow-hidden">
            {/* Card header */}
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800"></p>
                <p className="text-xs text-gray-400"></p>
              </div>
              {/* The SectionAiPanel Regenerate button will render inside the panel itself */}
            </div>
            <div className="px-6 py-5">
              <SectionAiPanel
                analysis={analysis}
                analysing={analysing}
                error={error}
                onRegenerate={() => report && analyse(report)}
                loadingMessage="Analysing Rych Index scores…"
              />
            </div>
          </div>

        </div>
      )}
    </SectionPageShell>
  )
}