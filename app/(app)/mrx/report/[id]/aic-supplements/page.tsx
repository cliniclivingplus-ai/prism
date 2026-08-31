'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/mrx/supabase'
import type { AICRulesOutput, AICRecommendation } from '@/lib/mrx/aicSupplementRules'
import SectionPageShell, { SectionLoading } from '@/components/mrx/SectionPageShell'
import { useSectionReport } from '@/lib/mrx/sectionPage'
import { AlertTriangle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Report {
  id: string
  patient_name: string
  report_data: Record<string, unknown>
  aic_supplement_recommendations?: AICRulesOutput
}

// ─── Priority badge ───────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: AICRecommendation['priority'] }) {
  const styles: Record<string, string> = {
    critical:   'bg-red-100 text-red-700 border-red-200',
    high:       'bg-orange-100 text-orange-700 border-orange-200',
    moderate:   'bg-amber-100 text-amber-700 border-amber-200',
    supportive: 'bg-gray-100 text-gray-500 border-gray-200',
  }
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${styles[priority] ?? styles.supportive}`}>
      {priority}
    </span>
  )
}

// ─── Phase badge ──────────────────────────────────────────────────────────────

function PhaseBadge({ phase }: { phase: 1 | 2 | 3 }) {
  const labels: Record<number, string> = {
    1: 'Phase 1 - Restoration',
    2: 'Phase 2 - Rebuilding',
    3: 'Phase 3 - Maintenance',
  }
  const colors: Record<number, string> = {
    1: 'bg-blue-50 text-blue-600 border-blue-200',
    2: 'bg-[#F2F9EC] text-[#3D6B16] border-[#C8E9A8]',
    3: 'bg-purple-50 text-purple-600 border-purple-200',
  }
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${colors[phase]}`}>
      {labels[phase]}
    </span>
  )
}

// ─── Single recommendation card ───────────────────────────────────────────────

function RecommendationCard({ rec }: { rec: AICRecommendation }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <PriorityBadge priority={rec.priority} />
            <PhaseBadge phase={rec.phase} />
            <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            {rec.product.category.split('_').join(' ')}

            </span>
          </div>
          <h3 className="text-base font-semibold text-gray-900 mt-1">{rec.product.name}</h3>
          {rec.product.subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{rec.product.subtitle}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-xs font-mono text-[#3D6B16] bg-[#F2F9EC] border border-[#C8E9A8] rounded-lg px-3 py-1.5 whitespace-nowrap">
            {rec.product.timing}
          </p>
          <p className="text-xs text-gray-400 mt-1">{rec.product.dose}</p>
        </div>
      </div>

      {/* Triggered by */}
      <div className="px-5 pb-3 border-t border-gray-50">
        <p className="text-xs font-mono text-gray-400 uppercase tracking-wider mt-3 mb-2">
          Triggered by
        </p>
        <div className="space-y-1.5">
          {rec.triggered_by.map((f, i) => (
            <div key={i} className="flex items-start gap-3 text-xs">
              <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${
                f.severity === 'critical' ? 'bg-red-500' :
                f.severity === 'high'     ? 'bg-orange-500' :
                f.severity === 'moderate' ? 'bg-amber-500' : 'bg-gray-400'
              }`} />
              <div className="min-w-0">
                <span className="font-medium text-gray-700">{f.biomarker}</span>
                <span className="text-gray-400 mx-1">-</span>
                <span className="text-gray-500">{String(f.observed_value)}</span>
                <span className="text-gray-300 mx-1">vs</span>
                <span className="text-gray-400">{f.reference_range}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Rationale */}
      {rec.ai_rationale && (
        <div className="mx-5 mb-4 bg-[#F2F9EC] border border-[#C8E9A8] rounded-xl px-4 py-3">
          <p className="text-xs font-mono text-[#538A22] uppercase tracking-wider mb-1.5">
            Clinical Rationale
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{rec.ai_rationale}</p>
        </div>
      )}

      {/* Ingredients toggle */}
      {rec.product.ingredients && rec.product.ingredients.length > 0 && (
        <div className="border-t border-gray-50">
          <button
            onClick={() => setOpen(o => !o)}
            className="w-full px-5 py-2.5 text-left flex items-center justify-between text-xs font-mono text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition"
          >
            <span>Key ingredients ({rec.product.ingredients.length})</span>
            <span>{open ? '▲' : '▼'}</span>
          </button>
          {open && (
            <div className="px-5 pb-4 flex flex-wrap gap-1.5">
              {rec.product.ingredients.map((ing: string, i: number) => (
                <span key={i} className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                  {ing}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Note */}
      {rec.product.note && (
        <div className="mx-5 mb-4 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <span className="flex-shrink-0"><AlertTriangle size={13} /></span>
          <span>{rec.product.note}</span>
        </div>
      )}
    </div>
  )
}

// ─── Phase section ────────────────────────────────────────────────────────────

function PhaseSection({
  title, subtitle, color, recs, extra,
}: {
  title: string
  subtitle: string
  color: string
  recs: AICRecommendation[]
  extra?: React.ReactNode
}) {
  if (recs.length === 0 && !extra) return null
  return (
    <div className="mb-10">
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider mb-1 ${color}`}>
        {title}
      </div>
      <p className="text-xs text-gray-400 mb-4">{subtitle}</p>
      {extra}
      <div className="space-y-4">
        {recs.map((rec, i) => (
          <RecommendationCard key={`${rec.product_key}-${i}`} rec={rec} />
        ))}
      </div>
    </div>
  )
}

// ─── Rotation banner ──────────────────────────────────────────────────────────

function RotationBanner({ rotation }: { rotation: string }) {
  const months = rotation.split('|').map(s => s.trim())
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 mb-4">
      <p className="text-xs font-mono text-blue-600 uppercase tracking-wider mb-3">
        Infection Control Rotation Protocol
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        {months.map((m, i) => (
          <div key={i} className="flex-1 bg-white border border-blue-200 rounded-xl px-3 py-2.5 text-xs text-blue-900">
            {m}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Probiotic schedule banner ────────────────────────────────────────────────

function ProbioticSchedule({ schedule }: { schedule: string }) {
  return (
    <div className="bg-[#F2F9EC] border border-[#C8E9A8] rounded-2xl px-5 py-4 mb-4">
      <p className="text-xs font-mono text-[#538A22] uppercase tracking-wider mb-2">
        Probiotic Alternation Schedule
      </p>
      <p className="text-sm text-[#1A3207]">{schedule}</p>
    </div>
  )
}

// ─── Warnings ─────────────────────────────────────────────────────────────────

function Warnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null
  return (
    <div className="space-y-2 mb-8">
      {warnings.map((w, i) => (
        <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 leading-relaxed">
          {w}
        </div>
      ))}
    </div>
  )
}

// ─── Summary stats ────────────────────────────────────────────────────────────

function SummaryStats({ output }: { output: AICRulesOutput }) {
  const totalRecs =
    output.phase1.length +
    output.phase2_infection_control.length +
    output.phase2_probiotics.length +
    output.phase2_nutrition.length +
    output.phase3.length

  const critical = [
    ...output.phase1,
    ...output.phase2_infection_control,
    ...output.phase2_probiotics,
    ...output.phase2_nutrition,
    ...output.phase3,
  ].filter(r => r.priority === 'critical').length

  return (
    <div className="grid grid-cols-3 gap-3 mb-8">
      {[
        {
          label: 'Rych Index',
          value: `${output.rych_index}/100`,
          color: output.rych_index < 40 ? 'text-red-600' : output.rych_index < 60 ? 'text-amber-600' : 'text-[#538A22]',
        },
        { label: 'Supplements', value: String(totalRecs), color: 'text-gray-900' },
        { label: 'Critical',    value: String(critical),  color: critical > 0 ? 'text-red-600' : 'text-[#538A22]' },
      ].map(s => (
        <div key={s.label} className="bg-white border border-gray-100 rounded-2xl px-4 py-4 text-center">
          <p className={`text-2xl font-light ${s.color}`}>{s.value}</p>
          <p className="text-xs font-mono text-gray-400 uppercase tracking-wider mt-1">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AICSupplementsPage() {
  const params = useParams()
  const id     = params.id as string
  const router = useRouter()

  // Parallel lightweight load for SectionPageShell (clinical assistant context)
  const { report: shellReport, loading: shellLoading } = useSectionReport(id)

  const [report,     setReport]     = useState<Report | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [generating, setGenerating] = useState(false)
  const [output,     setOutput]     = useState<AICRulesOutput | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [source,     setSource]     = useState<'cache' | 'generated' | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data, error: dbErr } = await supabase
        .from('reports').select('*').eq('id', id).single()

      if (dbErr || !data) { router.push('/mrx/dashboard'); return }

      setReport(data)
      if (data.aic_supplement_recommendations) {
        setOutput(data.aic_supplement_recommendations)
        setSource('cache')
      }
      setLoading(false)
    }
    load()
  }, [id, router])

  const generate = async (regenerate = false) => {
    if (!report) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/mrx/aic-supplements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: report.id, report_data: report.report_data, regenerate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate recommendations')
      setOutput(data)
      setSource(data.source)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  // ── Page data for Clinical Assistant sidebar ───────────────────────────────
  const pageData = useMemo(() => {
    if (!output) return { status: 'no_plan_generated' }

    const allRecs = [
      ...output.phase1,
      ...output.phase2_infection_control,
      ...output.phase2_probiotics,
      ...output.phase2_nutrition,
      ...output.phase3,
    ]

    return {
      rych_index: output.rych_index,
      total_supplements: allRecs.length,
      critical_count: allRecs.filter(r => r.priority === 'critical').length,
      high_count: allRecs.filter(r => r.priority === 'high').length,
      moderate_count: allRecs.filter(r => r.priority === 'moderate').length,
      phase1_supplements: output.phase1.map(r => ({
        name: r.product.name,
        dose: r.product.dose,
        timing: r.product.timing,
        priority: r.priority,
        rationale: r.ai_rationale,
        triggered_by: r.triggered_by.map(f => f.biomarker),
      })),
      phase2_infection_control: output.phase2_infection_control.map(r => ({
        name: r.product.name,
        dose: r.product.dose,
        timing: r.product.timing,
        priority: r.priority,
        triggered_by: r.triggered_by.map(f => f.biomarker),
      })),
      phase2_probiotics: output.phase2_probiotics.map(r => ({
        name: r.product.name,
        dose: r.product.dose,
        timing: r.product.timing,
      })),
      phase2_nutrition: output.phase2_nutrition.map(r => ({
        name: r.product.name,
        dose: r.product.dose,
        timing: r.product.timing,
        priority: r.priority,
        triggered_by: r.triggered_by.map(f => f.biomarker),
      })),
      phase3_supplements: output.phase3.map(r => ({
        name: r.product.name,
        dose: r.product.dose,
        timing: r.product.timing,
      })),
      probiotic_alternation_schedule: output.probiotic_alternation_schedule,
      infection_control_rotation: output.infection_control_rotation,
      clinical_warnings: output.clinical_warnings,
      source,
      generated_at: output.generated_at,
      version: output.version,
    }
  }, [output, source])

  if (loading || shellLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-[#538A22] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!report || !shellReport) return null

  return (
    <SectionPageShell
      reportId={id}
      section="aic-supplements"
      label="AIC Supplement Plan"
      patientName={report.patient_name}
      pageData={pageData}
    >
      <div className="max-w-4xl mx-auto py-10 px-6">

        <Link href={`/mrx/report/${id}`} className="text-xs text-gray-400 hover:text-[#538A22] transition mb-2 block">
          &larr; {report.patient_name}
        </Link>

        <div className="flex items-start justify-between gap-4 mb-1">
          <div className="flex items-center gap-3">
            <span className="text-2xl"></span>
            <h1 className="text-3xl font-light text-gray-900">AIC Supplement Plan</h1>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-8">
          Deterministic rules engine &rarr; AIC product mapping &rarr; AI clinical rationale
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        {generating && (
          <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center mb-6">
            <div className="w-8 h-8 border-2 border-[#538A22] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500 font-mono">Running rules engine...</p>
            <p className="text-xs text-gray-400 mt-1">Mapping findings to AIC products and generating clinical rationales</p>
          </div>
        )}

        {!output && !generating && (
          <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
            <h3 className="text-base font-medium text-gray-900 mb-2">No supplement plan generated yet</h3>
            <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto leading-relaxed">
              Click Generate Plan to map this patient's report findings to AIC supplements.
            </p>
            <button
              onClick={() => generate(false)}
              className="btn-primary-mrx inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[#538A22] hover:bg-[#3D6B16] transition"
            >
              Generate Plan
            </button>
          </div>
        )}

        {output && !generating && (
          <>
            {source === 'cache' && (
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-400 font-mono mb-6">
                <span>Showing cached results</span>
                <button onClick={() => generate(true)} className="text-[#538A22] hover:text-[#3D6B16]">
                  Regenerate
                </button>
              </div>
            )}

            <SummaryStats output={output} />
            <Warnings warnings={output.clinical_warnings} />

            <PhaseSection
              title="Phase 1 - Gut Restoration"
              subtitle="Weeks 1–2: Seal the gut lining before any infection control. Complete this phase fully before moving to Phase 2."
              color="bg-blue-100 text-blue-700 border border-blue-200"
              recs={output.phase1}
            />

            <PhaseSection
              title="Phase 2A - Infection Control"
              subtitle="Weeks 3–10: Rotate antimicrobials monthly. Never run two simultaneously."
              color="bg-red-50 text-red-700 border border-red-200"
              recs={output.phase2_infection_control}
              extra={output.infection_control_rotation
                ? <RotationBanner rotation={output.infection_control_rotation} />
                : undefined}
            />

            <PhaseSection
              title="Phase 2B - Probiotic Rebuilding"
              subtitle="Weeks 3–10: Alternate probiotic strains nightly. Never give the same product two nights in a row."
              color="bg-[#E2F3D0] text-[#3D6B16] border border-[#C8E9A8]"
              recs={output.phase2_probiotics}
              extra={<ProbioticSchedule schedule={output.probiotic_alternation_schedule} />}
            />

            <PhaseSection
              title="Phase 2C - Nutritional Support"
              subtitle="Weeks 3–10: Address vitamin, mineral, and neurotransmitter deficiencies concurrently."
              color="bg-purple-50 text-purple-700 border border-purple-200"
              recs={output.phase2_nutrition}
            />

            <PhaseSection
              title="Phase 3 - Maintenance"
              subtitle="Weeks 11–12: Enzyme support once gut lining is healed. Continue core probiotics and nutrients."
              color="bg-gray-100 text-gray-600 border border-gray-200"
              recs={output.phase3}
            />

            <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between text-xs font-mono text-gray-400">
              <span>AIC Rules Engine {output.version}</span>
              <span>Generated {new Date(output.generated_at).toLocaleString()}</span>
            </div>
          </>
        )}
      </div>
    </SectionPageShell>
  )
}