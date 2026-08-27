'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { SectionHeader } from '@/components/mrx/SectionHeader'
import SectionAiPanel from '@/components/mrx/SectionAiPanel'
import SectionPageShell, { SectionLoading } from '@/components/mrx/SectionPageShell'
import { buildAiContextFields, useSectionAnalysis, useSectionReport } from '@/lib/mrx/sectionPage'

const INDICATORS = [
  { key: 'leaky_gut', label: 'Leaky Gut Potential', desc: 'Intestinal permeability indicator', low: 42.75, high: 73.66 },
  { key: 'gut_inflammation', label: 'Gut Inflammation', desc: 'Inflammatory activity in the gut', low: 41.45, high: 70.29 },
  { key: 'fatigue', label: 'Prone to Fatigue', desc: 'Fatigue propensity based on microbiome', low: 45.55, high: 69.84 },
  { key: 'tmao', label: 'TMAO Production', desc: 'Cardiovascular risk metabolite', low: 26.90, high: 50.64 },
  { key: 'microplastic', label: 'Microplastic Exposure', desc: 'Microplastic accumulation indicator', low: 46.07, high: 69.08 },
]

const CLINICAL_NOTES: Record<string, string> = {
  leaky_gut: 'Elevated intestinal permeability - consider gut barrier support interventions',
  gut_inflammation: 'Elevated inflammatory markers - consider anti-inflammatory dietary protocol',
  fatigue: 'High fatigue propensity - consider energy metabolism and mitochondrial support',
  tmao: 'Elevated TMAO - consider reducing red meat and egg yolks, review cardiovascular risk',
  microplastic: 'Elevated microplastic exposure indicator - consider reducing plastic food packaging',
}

function getStatus(value: number, low: number, high: number): 'low' | 'normal' | 'high' {
  if (value < low) return 'low'
  if (value > high) return 'high'
  return 'normal'
}

function StatusBadge({ status }: { status: 'low' | 'normal' | 'high' }) {
  const styles = {
    high: 'bg-red-50 text-red-500 border border-red-200',
    normal: 'bg-[#F2F9EC] text-[#538A22] border border-[#C8E9A8]',
    low: 'bg-[#F2F9EC] text-[#538A22] border border-[#C8E9A8]',
  }
  const labels = { high: 'Elevated', normal: 'Normal', low: 'Low' }
  return (
    <span className={`text-xs font-medium px-3 py-1 rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function IndicatorRow({ indicator, value }: { indicator: typeof INDICATORS[0]; value: number }) {
  const { low, high } = indicator
  const status = getStatus(value, low, high)
  const pct = Math.min(100, Math.max(0, value))
  const thresholdPct = high // threshold line at the high reference mark

  const barColor = status === 'high' ? '#ef4444' : status === 'normal' ? '#538A22' : '#A8D878'

  return (
    <div className="py-4 border-b border-[#F2F9EC] last:border-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-800">{indicator.label}</span>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">{value}</span>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-2 bg-gray-100 rounded-full overflow-visible">
        {/* Filled bar */}
        <div
          className="absolute h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: barColor }}
        />
        {/* Threshold marker (vertical tick at high ref) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gray-300 rounded-full"
          style={{ left: `${thresholdPct}%` }}
        />
      </div>

      {/* X-axis labels */}
      <div className="relative mt-1">
        {[0, 25, 50, 75, 100].map(tick => (
          <span
            key={tick}
            className="absolute text-[10px] font-mono text-gray-300 -translate-x-1/2"
            style={{ left: `${tick}%` }}
          >
            {tick}
          </span>
        ))}
      </div>
      <div className="h-3" /> {/* spacer for the labels */}
    </div>
  )
}

export default function HealthIndicatorsPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)

  const getSectionData = useMemo(
    () => (rep: { report_data: Record<string, unknown> | null }) => rep.report_data?.health_indicators,
    []
  )

  const hiPreview = (report?.report_data?.health_indicators ?? {}) as Record<string, number>
  const hasData = INDICATORS.some(ind => hiPreview[ind.key] != null)

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'Health Indicators',
    getSectionData,
    hasData
  )

  if (loading) return <SectionLoading />
  if (!report) return null

  const hi = hiPreview
  const presentIndicators = INDICATORS.filter(ind => hi[ind.key] !== null && hi[ind.key] !== undefined)

  const elevated = presentIndicators.filter(ind => getStatus(hi[ind.key], ind.low, ind.high) === 'high')
  const normal = presentIndicators.filter(ind => getStatus(hi[ind.key], ind.low, ind.high) === 'normal')
  const low = presentIndicators.filter(ind => getStatus(hi[ind.key], ind.low, ind.high) === 'low')

  const pageData = {
    indicators: presentIndicators.map(ind => ({
      key: ind.key,
      label: ind.label,
      value: hi[ind.key],
      status: getStatus(hi[ind.key], ind.low, ind.high),
    })),
    elevated_count: elevated.length,
    normal_count: normal.length,
    low_count: low.length,
    ...buildAiContextFields(analysis, analysing, error),
  }

  return (
    <SectionPageShell
      reportId={id}
      section="health-indicators"
      label="Health Indicators"
      patientName={report.patient_name}
      pageData={pageData}
    >
      <SectionHeader reportId={id} title="Health Indicators" />

      {presentIndicators.length === 0 ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          No health indicator scores found. Re-upload the PDF to extract scores.
        </p>
      ) : (
        <>

      {/* Indicator rows */}
      <div className="bg-white border border-[#E2F3D0] rounded-2xl px-6 pt-2 pb-4 mb-3">
        {presentIndicators.map(ind => (
          <IndicatorRow key={ind.key} indicator={ind} value={hi[ind.key]} />
        ))}
        <p className="text-xs font-mono text-gray-300 mt-3">
          Vertical markers show reference threshold for each indicator
        </p>
      </div>

      {/* Summary count row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-5 text-center">
          <p className="text-3xl font-bold text-red-500 mb-1">{elevated.length}</p>
          <p className="text-[10px] font-mono uppercase tracking-widest text-red-400">Elevated</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-5 text-center">
          <p className="text-3xl font-bold text-amber-500 mb-1">{normal.length}</p>
          <p className="text-[10px] font-mono uppercase tracking-widest text-amber-400">Normal</p>
        </div>
        <div className="bg-[#F2F9EC] border border-[#E2F3D0] rounded-2xl px-4 py-5 text-center">
          <p className="text-3xl font-bold text-[#538A22] mb-1">{low.length}</p>
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#8BC44F]">Low</p>
        </div>
      </div>

      <SectionAiPanel
        analysis={analysis}
        analysing={analysing}
        error={error}
        onRegenerate={() => report && analyse(report)}
        loadingMessage="Analysing health indicators…"
      />
        </>
      )}
    </SectionPageShell>
  )
}