'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { SectionHeader } from '@/components/mrx/SectionHeader'
import SectionPageShell, { SectionLoading } from '@/components/mrx/SectionPageShell'
import { useSectionReport } from '@/lib/mrx/sectionPage'

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportData = {
  rych_index?: number
  endurance?: { aerobic?: number; physical?: number }
  health_indicators?: { gut_inflammation?: number; fatigue?: number; [key: string]: unknown }
  neurotransmitters?: { serotonin?: number; gaba?: number; dopamine?: number }
  disease_risk?: Record<string, number>
  [key: string]: unknown
}

type FullReport = {
  patient_name: string
  patient_age_sex: string
  patient_complaint?: string
  species_list?: unknown[]
  report_data: ReportData | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrainingPage() {
  const { id } = useParams<{ id: string }>()
  const { report, loading: loadingReport } = useSectionReport(id)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  async function generate() {
    if (!report) return
    setLoading(true)

    const full = report as unknown as FullReport
    const rd = (full.report_data || {}) as ReportData

    const res = await fetch('/api/mrx/rag-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: `Based on this patient's gut microbiome profile, create a personalised exercise and training recommendation.

Patient: ${full.patient_name}, ${full.patient_age_sex}
Complaint: ${full.patient_complaint ?? 'Not specified'}
Rych Index: ${rd.rych_index ??' '}
Aerobic Endurance: ${rd.endurance?.aerobic ??' '}
Physical Endurance: ${rd.endurance?.physical ??' '}
Gut Inflammation Risk: ${rd.health_indicators?.gut_inflammation ??' '}
Fatigue Risk: ${rd.health_indicators?.fatigue ??' '}
Serotonin Level: ${rd.neurotransmitters?.serotonin ??' '}
GABA Level: ${rd.neurotransmitters?.gaba ??' '}
Dopamine Level: ${rd.neurotransmitters?.dopamine ??' '}
Disease Risks: ${JSON.stringify(rd.disease_risk ?? {})}

Recommend:
1. Suitable exercise types (cardio, strength, yoga, walking etc)
2. Weekly training schedule
3. Exercise intensity based on gut health score
4. Recovery protocols
5. Foods to eat before/after exercise based on microbiome
6. What to avoid during training phase

Be specific and practical for an Indian patient.`,
        speciesData: full.species_list,
      }),
    })

    const data = await res.json()
    setResult(data.answer || 'Could not generate recommendation.')
    setLoading(false)
    setGenerated(true)
  }

  if (loadingReport) return <SectionLoading />
  if (!report) return null

  return (
    <SectionPageShell
      reportId={id}
      section="training"
      label="Training Recommendation"
      patientName={report.patient_name}
      pageData={{ plan_generated: generated, plan_text: result || null }}
    >
      <SectionHeader reportId={id} title="Training Recommendation" />
      <p className="text-sm text-gray-500 mb-6">
        Personalised exercise protocol from endurance, fatigue, and neurotransmitter data.
      </p>

      {!generated && (
        <div className="bg-white border border-[#E2F3D0] rounded-2xl p-8 text-center">
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            AI will analyse endurance scores, fatigue indicators, neurotransmitter levels, and
            disease risks to create a personalised exercise protocol.
          </p>
          <button
            onClick={generate}
            disabled={loading}
            className="btn-primary-mrx bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl text-sm font-medium disabled:opacity-50 transition"
          >
            {loading ? 'Generating...' : 'Generate Training Plan →'}
          </button>
        </div>
      )}

      {result && (
        <div className="bg-white border border-[#E2F3D0] rounded-2xl p-6 shadow-sm">
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
          <button
            onClick={() => { setResult(''); setGenerated(false) }}
            className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Regenerate
          </button>
        </div>
      )}
    </SectionPageShell>
  )
}