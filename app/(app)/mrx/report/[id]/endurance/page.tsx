'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { SectionHeader } from '@/components/mrx/SectionHeader'
import SectionAiPanel from '@/components/mrx/SectionAiPanel'
import SectionPageShell, { SectionLoading } from '@/components/mrx/SectionPageShell'
import { buildAiContextFields, useSectionAnalysis, useSectionReport } from '@/lib/mrx/sectionPage'
import { Activity, Dumbbell, CheckCircle2, AlertTriangle, type LucideIcon } from 'lucide-react'

interface EnduranceMetric {
  label: string
  key: string
  refThreshold: number
  icon: LucideIcon
  description: string
  microbiomeRole: string
  trainingTip: string
}

interface EnduranceScore extends EnduranceMetric {
  score: number | null
}

const ENDURANCE_METRICS: EnduranceMetric[] = [
  {
    label: 'Aerobic Endurance Potential',
    key: 'aerobic',
    refThreshold: 59.8,
    icon: Activity,
    description: 'Microbial support for sustained aerobic activity via SCFA production, VO₂-related metabolite activity, and oxygen utilisation pathways.',
    microbiomeRole: 'Key genera include Lactobacillus, Bifidobacterium, and Veillonella - which converts lactate to propionate, enhancing aerobic capacity.',
    trainingTip: 'Cardio performance may be suboptimal. Incorporate butyrate-producing prebiotic foods (oats, banana, legumes) and ensure adequate B-vitamin status.',
  },
  {
    label: 'Physical Endurance Potential',
    key: 'physical',
    refThreshold: 46.22,
    icon: Dumbbell,
    description: 'Overall microbial contribution to muscular endurance, recovery rate, and sustained physical output.',
    microbiomeRole: 'Short-chain fatty acid producers support mitochondrial function and reduce exercise-induced inflammation, improving overall physical stamina.',
    trainingTip: 'Microbial support for physical endurance is adequate. Maintain gut diversity with varied dietary fibre sources and post-workout fermented foods.',
  },
]

type EnduranceStatus = 'supported' | 'suboptimal'

function getStatus(score: number, threshold: number): EnduranceStatus {
  return score >= threshold ? 'supported' : 'suboptimal'
}

function RadialGauge({ score, threshold, label, icon: Icon }: { score: number; threshold: number; label: string; icon: LucideIcon }) {
  const pct = Math.min((score / (threshold * 1.4)) * 100, 100)
  const status = getStatus(score, threshold)
  const color = status === 'supported' ? '#8BC44F' : '#F59E0B'
  const r = 40
  const circumference = 2 * Math.PI * r
  const dash = (pct / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-28 w-28">
        <svg viewBox="0 0 100 100" className="rotate-[-90deg]">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#F3F4F6" strokeWidth="10" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl"><Icon size={20} /></span>
          <span className="text-sm font-bold text-gray-800">{pct.toFixed(0)}%</span>
        </div>
      </div>
      <p className="text-xs text-center text-gray-600 font-medium leading-tight max-w-[100px]">
        {label.replace(' Potential', '')}
      </p>
    </div>
  )
}

export default function EndurancePage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)

  const getSectionData = useMemo(
    () => (rep: { report_data: Record<string, unknown> | null }) => {
      const endurance = (rep.report_data?.endurance ?? {}) as Record<string, number>
      return {
        metrics: ENDURANCE_METRICS.map(m => ({
          label: m.label,
          score: endurance[m.key] ?? null,
          threshold: m.refThreshold,
          status: endurance[m.key] != null ? getStatus(endurance[m.key], m.refThreshold) : 'unknown',
          microbiomeRole: m.microbiomeRole,
        })),
      }
    },
    [],
  )

  const endurance = (report?.report_data?.endurance ?? {}) as Record<string, number>
  const hasData = ENDURANCE_METRICS.some(m => endurance[m.key] != null)

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'endurance_potential',
    getSectionData,
    hasData,
  )

  if (loading) return <SectionLoading />
  if (!report) return null

  const scores: EnduranceScore[] = ENDURANCE_METRICS.map(m => ({
    ...m,
    score: endurance[m.key] ?? null,
  }))

  const pageData = {
    metrics: scores.map(s => ({
      key: s.key,
      label: s.label,
      score: s.score,
      threshold: s.refThreshold,
      status: s.score != null ? getStatus(s.score, s.refThreshold) : null,
    })),
    ...buildAiContextFields(analysis, analysing, error),
  }

  return (
    <SectionPageShell
      reportId={id}
      section="endurance"
      label="Endurance Potential"
      patientName={report.patient_name}
      pageData={pageData}
    >
      <SectionHeader reportId={id} title="Endurance Potential" />

      {!hasData ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          No endurance potential data found. Re-upload the PDF to extract scores.
        </p>
      ) : (
        <div className="space-y-4">
          {scores.some(s => s.score != null) && (
            <div className="bg-white rounded-2xl border border-[#E2F3D0] p-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Endurance Overview</h2>
              <div className="flex justify-around items-center flex-wrap gap-6">
                {scores.map(s => s.score != null
                  ? <RadialGauge key={s.key} score={s.score} threshold={s.refThreshold} label={s.label} icon={s.icon} />
                  : null
                )}
              </div>
            </div>
          )}

          <div className="space-y-5">
            {scores.map(m => {
              const status = m.score != null ? getStatus(m.score, m.refThreshold) : null
              const max = Math.max(m.refThreshold * 1.5, (m.score ?? 0) * 1.3)
              const scorePct = m.score != null ? Math.min((m.score / max) * 100, 100) : 0
              const threshPct = (m.refThreshold / max) * 100
              const barColor = status === 'supported' ? '#8BC44F' : '#FBBF24'

              return (
                <div
                  key={m.key}
                  className={`bg-white rounded-2xl border p-5 hover:shadow-md transition-shadow ${status === 'suboptimal' ? 'border-amber-200' : 'border-[#E2F3D0]'}`}
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl"><m.icon size={30} /></span>
                      <div>
                        <p className="font-semibold text-gray-800">{m.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5 leading-snug">{m.description}</p>
                      </div>
                    </div>
                    {m.score != null && (
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-2xl font-bold text-[#2A4D0D]">{m.score.toFixed(3)}</span>
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${status === 'supported' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-amber-50 text-amber-700 border-amber-300'}`}>
                          {status === 'supported' ? <><CheckCircle2 size={11} /> Supported</> : <>↓ Suboptimal</>}
                        </span>
                      </div>
                    )}
                  </div>

                  {m.score != null && status && (
                    <>
                      <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden mt-3">
                        <div className="absolute top-0 bottom-0 w-0.5 bg-[#538A22] z-10" style={{ left: `${threshPct}%` }} />
                        <div className="absolute top-0 bottom-0 rounded-full transition-all duration-700" style={{ width: `${scorePct}%`, backgroundColor: barColor }} />
                        <span className="absolute inset-0 flex items-center justify-end pr-3 text-xs font-bold text-white">{m.score.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                        <span>0</span>
                        <span className="text-green-700 font-medium">Threshold: {m.refThreshold}</span>
                        <span>{max.toFixed(0)}</span>
                      </div>

                      <div className="mt-4 bg-green-50 border border-green-100 rounded-xl p-3">
                        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Microbiome Role</p>
                        <p className="text-xs text-gray-600 leading-relaxed">{m.microbiomeRole}</p>
                      </div>

                      <div className={`mt-3 rounded-xl border p-3 ${status === 'suboptimal' ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'}`}>
                        <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${status === 'suboptimal' ? 'text-amber-700' : 'text-green-700'}`}>
                          {status === 'suboptimal' ? <span className="inline-flex items-center gap-1"><AlertTriangle size={11} /> Training & Nutrition Note</span> : <span className="inline-flex items-center gap-1"><CheckCircle2 size={11} /> Maintenance Tip</span>}
                        </p>
                        <p className="text-xs text-gray-600 leading-relaxed">{m.trainingTip}</p>
                      </div>
                    </>
                  )}
                  {m.score == null && (
                    <p className="mt-3 text-sm text-gray-400 italic">Score not found in report data.</p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(['supported', 'suboptimal'] as const).map(s => {
              const count = scores.filter(m => m.score != null && getStatus(m.score, m.refThreshold) === s).length
              const cfg = s === 'supported'
                ? { label: 'Supported', color: 'text-green-700', bg: 'bg-green-50 border-green-200' }
                : { label: 'Suboptimal', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' }
              return (
                <div key={s} className={`rounded-xl border p-4 text-center ${cfg.bg}`}>
                  <p className={`text-3xl font-bold ${cfg.color}`}>{count}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{cfg.label}</p>
                </div>
              )
            })}
          </div>

          <SectionAiPanel
            analysis={analysis}
            analysing={analysing}
            error={error}
            onRegenerate={() => report && analyse(report)}
            subtitle="Training and nutrition recommendations based on endurance scores"
          />
        </div>
      )}
    </SectionPageShell>
  )
}
