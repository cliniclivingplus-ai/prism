'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { SectionHeader } from '@/components/mrx/SectionHeader'
import SectionAiPanel from '@/components/mrx/SectionAiPanel'
import SectionPageShell, { SectionLoading } from '@/components/mrx/SectionPageShell'
import { buildAiContextFields, useSectionAnalysis, useSectionReport } from '@/lib/mrx/sectionPage'

const DISEASES = [
  { key: 'constipation',         label: 'Constipation',                    threshold: 30 },
  { key: 'ibs',                  label: 'Irritable Bowel Syndrome',         threshold: 15 },
  { key: 'type2_diabetes',       label: 'Type 2 Diabetes',                  threshold: 10 },
  { key: 'hypertension',         label: 'Hypertension',                     threshold: 10 },
  { key: 'nafld',                label: 'Non-alcoholic Fatty Liver Disease', threshold: 5  },
  { key: 'rheumatoid_arthritis', label: 'Rheumatoid Arthritis',             threshold: 5  },
  { key: 'obesity',              label: 'Obesity',                          threshold: 5  },
  { key: 'ibd',                  label: 'Inflammatory Bowel Disease',       threshold: 3  },
]

function getRiskLevel(value: number, threshold: number): 'high' | 'moderate' | 'low' {
  if (value >= threshold * 2) return 'high'
  if (value >= threshold) return 'moderate'
  return 'low'
}

// ─── Risk bar row ─────────────────────────────────────────────────────────────
// Layout: [label 35%] [bar track 40%] [value + badge 25%]
// Bar track is explicitly constrained - never spans full card width.
function RiskBarRow({
  label,
  value,
  threshold,
  risk,
  maxValue,
}: {
  label: string
  value: number
  threshold: number
  risk: 'high' | 'moderate' | 'low'
  maxValue: number
}) {
  const barPct = Math.min(100, (value / maxValue) * 100)
  const thresholdPct = Math.min(100, (threshold / maxValue) * 100)

  const barColor =
    risk === 'high' ? '#EF4444' : risk === 'moderate' ? '#F59E0B' : '#538A22'

  const badgeStyle =
    risk === 'high'
      ? 'bg-red-50 text-red-700 border-red-200'
      : risk === 'moderate'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-[#F2F9EC] text-[#3D7A15] border-[#D1EAC0]'

  const badgeLabel =
    risk === 'high' ? 'High' : risk === 'moderate' ? 'Moderate' : 'Low'

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums" style={{ color: barColor }}>
            {value.toFixed(1)}%
          </span>
          <span
            className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border uppercase tracking-wide ${badgeStyle}`}
          >
            {badgeLabel}
          </span>
        </div>
      </div>
      {/* Full-width bar track */}
      <div className="relative h-2 bg-gray-100 rounded-full overflow-visible">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${barPct}%`, background: barColor }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gray-400 rounded-full opacity-40"
          style={{ left: `${thresholdPct}%` }}
          title={`Clinical threshold: ${threshold}%`}
        />
      </div>
    </div>
  )
}

// ─── Summary stat card ────────────────────────────────────────────────────────
function SummaryCard({
  count,
  label,
  bg,
  border,
  textColor,
}: {
  count: number
  label: string
  bg: string
  border: string
  textColor: string
}) {
  return (
    <div
      className="rounded-2xl p-5 text-center border"
      style={{ background: bg, borderColor: border }}
    >
      <div className="text-4xl font-bold mb-1" style={{ color: textColor }}>
        {count}
      </div>
      <div
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: textColor }}
      >
        {label}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DiseaseRiskPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)

  const getSectionData = useMemo(
    () => (rep: { report_data: Record<string, unknown> | null }) =>
      rep.report_data?.disease_risk,
    []
  )

  const drPreview = (report?.report_data?.disease_risk ?? {}) as Record<string, number>
  const hasDataPreview = Object.values(drPreview).some((v) => v != null)

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'Disease Risk',
    getSectionData,
    hasDataPreview
  )

  if (loading) return <SectionLoading />
  if (!report) return null

  const dr = (report.report_data?.disease_risk ?? {}) as Record<string, number>
  const hasData = Object.values(dr).some((v) => v !== null && v !== undefined)

  const sortedDiseases = DISEASES.map((d) => ({
    ...d,
    value: dr[d.key] ?? null,
  }))
    .filter((d) => d.value !== null && d.value !== undefined)
    .sort((a, b) => (b.value as number) - (a.value as number)) as Array<
    (typeof DISEASES)[0] & { value: number }
  >

  const highRisk     = sortedDiseases.filter((d) => getRiskLevel(d.value, d.threshold) === 'high')
  const moderateRisk = sortedDiseases.filter((d) => getRiskLevel(d.value, d.threshold) === 'moderate')
  const lowRisk      = sortedDiseases.filter((d) => getRiskLevel(d.value, d.threshold) === 'low')

  const maxValue = sortedDiseases.length > 0
    ? Math.max(...sortedDiseases.map((d) => d.value)) * 1.2
    : 100

  const pageData = {
    diseases: sortedDiseases.map((d) => ({
      key: d.key,
      label: d.label,
      value: d.value,
      threshold: d.threshold,
      risk_level: getRiskLevel(d.value, d.threshold),
    })),
    high_risk_count: highRisk.length,
    moderate_risk_count: moderateRisk.length,
    high_risk_conditions: highRisk.map((d) => d.label),
    ...buildAiContextFields(analysis, analysing, error),
  }

  return (
    <SectionPageShell
      reportId={id}
      section="disease-risk"
      label="Disease Risk"
      patientName={report.patient_name}
      pageData={pageData}
    >
      <SectionHeader reportId={id} title="Disease Risk" />

      {/* Disclaimer */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 mb-6 flex items-start gap-2">
        <span className="mt-0.5 text-blue-400">ℹ</span>
        <span>
          These percentages reflect microbiome-associated risk patterns, not clinical diagnoses.
          Clinical judgment is required before acting on these values.
        </span>
      </div>

      {!hasData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 mb-6">
          No disease risk scores found in this report. Re-upload the PDF to extract scores.
        </div>
      )}

      {hasData && (
        <div className="space-y-5">

          {/* ── Summary stat row ────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            <SummaryCard
              count={highRisk.length}
              label="High risk"
              bg="#FEF2F2"
              border="#FECACA"
              textColor="#B91C1C"
            />
            <SummaryCard
              count={moderateRisk.length}
              label="Moderate risk"
              bg="#FFFBEB"
              border="#FDE68A"
              textColor="#92400E"
            />
            <SummaryCard
              count={lowRisk.length}
              label="Low risk"
              bg="#F2F9EC"
              border="#D1EAC0"
              textColor="#3D7A15"
            />
          </div>

          {/* ── Risk bar chart ───────────────────────────────────────────────── */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4
            shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-8">
              Risk probability distribution
            </p>
            <div className="space-y-5">
              {sortedDiseases.map((d) => (
                <RiskBarRow
                  key={d.key}
                  label={d.label}
                  value={d.value}
                  threshold={d.threshold}
                  risk={getRiskLevel(d.value, d.threshold)}
                  maxValue={maxValue}
                />
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-5 flex items-center gap-1.5">
              <span className="inline-block w-0.5 h-3 bg-gray-400 rounded-full opacity-50" />
              Vertical markers indicate the clinical threshold for each condition
            </p>
          </div>

          {/* ── High-risk callout ────────────────────────────────────────────── */}
          {highRisk.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-[0.15em] mb-3">
                Conditions requiring attention
              </p>
              <div className="space-y-2">
                {highRisk.map((d) => (
                  <div
                    key={d.key}
                    className="flex items-center justify-between bg-white border border-red-100
                      rounded-xl px-4 py-3"
                  >
                    <span className="text-sm font-medium text-red-800">{d.label}</span>
                    <span className="text-sm font-bold text-red-600">{d.value.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AI Analysis ─────────────────────────────────────────────────── */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800"></p>
                <p className="text-xs text-gray-400"></p>
              </div>
            </div>
            <div className="px-6 py-5">
              <SectionAiPanel
                analysis={analysis}
                analysing={analysing}
                error={error}
                onRegenerate={() => report && analyse(report)}
                loadingMessage="Analysing disease risk patterns…"
              />
            </div>
          </div>

        </div>
      )}
    </SectionPageShell>
  )
}