import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/mrx/supabase'

export type SectionReport = {
  id: string
  patient_name: string
  patient_age_sex: string
  patient_diet: string
  patient_history: string
  patient_allergies: string
  report_data: Record<string, unknown> | null
  species_list?: string[]
}

export type SectionAnalysis = {
  interpretation?: string
  what_it_means?: string
  contributing_factors?: { factor: string; impact: string; explanation: string }[]
  clinical_significance?: string
  what_drives_it?: string
  considerations?: string[]
  knowledge_insight?: string | null
  knowledge_source?: string | null
}

export function reportPatient(report: SectionReport) {
  return {
    name: report.patient_name,
    age_sex: report.patient_age_sex,
    diet_type: report.patient_diet,
    medical_history: report.patient_history,
    allergies: report.patient_allergies,
  }
}

export function buildAiContextFields(
  analysis: SectionAnalysis | string | null,
  analysing: boolean,
  error: string | null,
) {
  if (typeof analysis === 'string') {
    return {
      ai_analysis_status: analysing ? 'loading' : analysis ? 'complete' : error ? 'error' : 'not_started',
      ai_summary: analysis ?? null,
      ai_error: error,
    }
  }

  return {
    ai_analysis_status: analysing ? 'loading' : analysis ? 'complete' : error ? 'error' : 'not_started',
    ai_summary: analysis?.interpretation ?? null,
    ai_what_it_means: analysis?.what_it_means ?? null,
    ai_clinical_significance: analysis?.clinical_significance ?? null,
    ai_what_drives_it: analysis?.what_drives_it ?? null,
    ai_contributing_factors: analysis?.contributing_factors ?? null,
    ai_considerations: analysis?.considerations ?? null,
    ai_knowledge_insight: analysis?.knowledge_insight ?? null,
    ai_error: error,
  }
}

export function useSectionReport(id: string) {
  const router = useRouter()
  const [report, setReport] = useState<SectionReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        router.push('/mrx/dashboard')
        return
      }

      setReport(data as SectionReport)
      setLoading(false)
    }

    load()
  }, [id, router])

  return { report, loading }
}

export function useSectionAnalysis(
  report: SectionReport | null,
  section: string,
  getSectionData: (report: SectionReport) => unknown,
  enabled = true,
) {
  const [analysing, setAnalysing] = useState(false)
  const [analysis, setAnalysis] = useState<SectionAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  const analyse = useCallback(
    async (rep: SectionReport) => {
      setAnalysing(true)
      setError(null)
      try {
        const res = await fetch('/api/mrx/analyze-section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section,
            report_data: rep.report_data,
            patient: reportPatient(rep),
            section_data: getSectionData(rep),
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Analysis failed')
        setAnalysis(data.analysis)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Analysis failed')
      } finally {
        setAnalysing(false)
      }
    },
    [section, getSectionData],
  )

  useEffect(() => {
    if (!report || !enabled) return
    analyse(report)
    // Run once per report load; analyse is stable enough for the initial fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.id, enabled])

  return { analysing, analysis, error, analyse }
}
