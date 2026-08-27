'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { SectionHeader } from '@/components/mrx/SectionHeader'
import SectionAiPanel from '@/components/mrx/SectionAiPanel'
import SectionPageShell, { SectionLoading } from '@/components/mrx/SectionPageShell'
import { buildAiContextFields, useSectionAnalysis, useSectionReport } from '@/lib/mrx/sectionPage'

interface IntoleranceMetric {
  label: string
  key: string
  refThreshold: number
  icon: string
  description: string
  foods: string[]
}

interface IntoleranceScore extends IntoleranceMetric {
  score: number | null
}

const INTOLERANCE_METRICS: IntoleranceMetric[] = [
  {
    label: 'Lactose Intolerance Management',
    key: 'lactose',
    refThreshold: 49.64,
    icon: '',
    description: "Microbiome's ability to manage lactose via microbial beta-galactosidase activity.",
    foods: ['Milk', 'Yoghurt', 'Cheese', 'Ice cream', 'Butter'],
  },
  {
    label: 'Fructose Intolerance Management',
    key: 'fructose',
    refThreshold: 56.78,
    icon: '',
    description: 'Microbial capacity to ferment and manage excess fructose in the colon.',
    foods: ['Apples', 'Honey', 'Agave', 'High-fructose foods', 'Dried fruits'],
  },
  {
    label: 'Gluten Intolerance Management',
    key: 'gluten',
    refThreshold: 59.44,
    icon: '',
    description: "Microbiome's gluten-degrading enzyme potential and mucosal barrier support.",
    foods: ['Wheat', 'Barley', 'Rye', 'Oats (cross-contaminated)', 'Pasta'],
  },
  {
    label: 'Histamine Sensitivity Management',
    key: 'histamine_sensitivity',
    refThreshold: 45.64,
    icon: '',
    description: 'Microbial DAO enzyme activity potential for histamine degradation.',
    foods: ['Fermented foods', 'Aged cheese', 'Red wine', 'Canned fish', 'Vinegar'],
  },
]

type ToleranceStatus = 'managed' | 'risk'

function getStatus(score: number, threshold: number): ToleranceStatus {
  return score >= threshold ? 'managed' : 'risk'
}

export default function IntolerancePage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const getSectionData = useMemo(
    () => (rep: { report_data: Record<string, unknown> | null }) => {
      const intolerance = (rep.report_data?.intolerance ?? {}) as Record<string, number>
      return {
        metrics: INTOLERANCE_METRICS.map(m => ({
          label: m.label,
          score: intolerance[m.key] ?? null,
          threshold: m.refThreshold,
          status: intolerance[m.key] != null ? getStatus(intolerance[m.key], m.refThreshold) : 'unknown',
          atRiskFoods: m.foods,
        })),
      }
    },
    [],
  )

  const intolerance = (report?.report_data?.intolerance ?? {}) as Record<string, number>
  const hasData = INTOLERANCE_METRICS.some(m => intolerance[m.key] != null)

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'intolerance_management',
    getSectionData,
    hasData,
  )

  if (loading) return <SectionLoading />
  if (!report) return null

  const scores: IntoleranceScore[] = INTOLERANCE_METRICS.map(m => ({
    ...m,
    score: intolerance[m.key] ?? null,
  }))

  const atRisk = scores.filter(s => s.score != null && getStatus(s.score, s.refThreshold) === 'risk')
  const managed = scores.filter(s => s.score != null && getStatus(s.score, s.refThreshold) === 'managed')

  const pageData = {
    metrics: scores.map(s => ({
      key: s.key,
      label: s.label,
      score: s.score,
      threshold: s.refThreshold,
      status: s.score != null ? getStatus(s.score, s.refThreshold) : null,
    })),
    at_risk_count: atRisk.length,
    managed_count: managed.length,
    ...buildAiContextFields(analysis, analysing, error),
  }

  return (
    <SectionPageShell
      reportId={id}
      section="intolerance"
      label="Intolerance Management"
      patientName={report.patient_name}
      pageData={pageData}
    >
      <SectionHeader reportId={id} title="Intolerance Management" />

      {!hasData ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          No intolerance management data found. Re-upload the PDF to extract scores.
        </p>
      ) : (
        <div className="space-y-4">
          {atRisk.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-3">
              <span className="text-amber-500 text-xl mt-0.5">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {atRisk.length} intolerance{atRisk.length > 1 ? 's' : ''} flagged at risk
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {atRisk.map(s => s.label.replace(' Management', '')).join(', ')} - microbiome scores below clinical threshold.
                </p>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-5">
            {scores.map(m => {
              const status = m.score != null ? getStatus(m.score, m.refThreshold) : null
              const isOpen = expandedKey === m.key
              const max = Math.max(m.refThreshold * 1.5, (m.score ?? 0) * 1.2)
              const scorePct = m.score != null ? Math.min((m.score / max) * 100, 100) : 0
              const threshPct = (m.refThreshold / max) * 100
              const barColor = status === 'managed' ? '#8BC44F' : '#FBBF24'
              const gap = m.score != null ? m.score - m.refThreshold : null

              return (
                <div
                  key={m.key}
                  className={`bg-white rounded-2xl border transition-shadow hover:shadow-md overflow-hidden ${status === 'risk' ? 'border-amber-200' : 'border-[#E2F3D0]'}`}
                >
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{m.icon}</span>
                      <p className="font-semibold text-gray-800 text-sm">{m.label}</p>
                    </div>
                    <p className="text-xs text-gray-400 leading-snug mb-3">{m.description}</p>

                    {m.score != null ? (
                      <>
                        <div className="flex items-end justify-between mb-3">
                          <span className="text-3xl font-bold text-[#2A4D0D]">{m.score.toFixed(3)}</span>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${status === 'managed' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-amber-50 text-amber-700 border-amber-300'}`}>
                              {status === 'managed' ? '✓ Managed' : '⚠ At Risk'}
                            </span>
                            {gap != null && (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${gap >= 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                                {gap >= 0 ? '+' : ''}{gap.toFixed(2)} from threshold
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="absolute top-0 bottom-0 w-0.5 bg-[#538A22] z-10" style={{ left: `${threshPct}%` }} />
                          <div className="absolute top-0 bottom-0 rounded-full transition-all duration-700" style={{ width: `${scorePct}%`, backgroundColor: barColor }} />
                          <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-bold text-white">{m.score.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>0</span>
                          <span className="text-green-700 font-medium">Threshold: {m.refThreshold}</span>
                          <span>{max.toFixed(0)}</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Score not found in report data.</p>
                    )}
                  </div>

                  <button
                    onClick={() => setExpandedKey(isOpen ? null : m.key)}
                    className={`w-full px-5 py-2.5 text-left text-xs font-medium flex items-center justify-between transition-colors ${status === 'risk' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                  >
                    <span>{status === 'risk' ? '⚠ Foods to limit' : '✓ Generally tolerated foods'} ({m.foods.length})</span>
                    <span>{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-2">
                      {m.foods.map(f => (
                        <span key={f} className={`text-xs px-2.5 py-1 rounded-full font-medium ${status === 'risk' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{f}</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
              <p className="text-3xl font-bold text-green-700">{managed.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Intolerances Managed</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-3xl font-bold text-amber-700">{atRisk.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Intolerances at Risk</p>
            </div>
          </div>

          <SectionAiPanel
            analysis={analysis}
            analysing={analysing}
            error={error}
            onRegenerate={() => report && analyse(report)}
            subtitle="Dietary recommendations based on intolerance management scores"
          />
        </div>
      )}
    </SectionPageShell>
  )
}
