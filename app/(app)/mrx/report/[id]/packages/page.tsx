'use client'
import { useParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { SectionHeader } from '@/components/mrx/SectionHeader'
import SectionPageShell, { SectionLoading } from '@/components/mrx/SectionPageShell'
import { useSectionReport } from '@/lib/mrx/sectionPage'
import { useState, useEffect } from 'react'  // ← add useEffect here
import { supabase } from '@/lib/mrx/supabase'





export default function PackagesPage() {
  const params = useParams()
  const id = params.id as string
  const [report, setReport] = useState<any>(null)
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)


  useEffect(() => {
    supabase.from('reports').select('*').eq('id', id).single()
    .then(({ data }: { data: any }) => setReport(data))
  }, [id])

  async function generate() {
    if (!report) return
    setLoading(true)
    const rd = report.report_data || {}

    const res = await fetch('/api/mrx/rag-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: `Based on this patient's gut microbiome data, recommend specific probiotic and supplement packages. 
        
Patient: ${report.patient_name}, ${report.patient_age_sex}
Complaint: ${report.patient_complaint}
Rych Index: ${rd.rych_index}
Absent Probiotics: ${(rd.probiotic_absent || []).join(', ')}
Pathogens Detected: ${(rd.pathogens_detected || []).join(', ')}
Health Indicators: ${JSON.stringify(rd.health_indicators)}
Disease Risk: ${JSON.stringify(rd.disease_risk)}

Recommend:
1. Specific probiotic strains needed (with CFU dosage)
2. Prebiotic supplements
3. Key vitamins/minerals based on low production scores
4. Anti-inflammatory supplements if needed
5. Indian market availability for each recommendation

Format with clear sections, dosages, and timing.`,
        speciesData: report.species_list
      })
    })
    const data = await res.json()
    setResult(data.answer || 'Could not generate recommendation.')
    setLoading(false)
    setGenerated(true)
  }

  if (!report) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="max-w-3xl mx-auto py-10 px-6">
      {/* Back + title */}
      <SectionHeader reportId={id} title="Package Recommendation" />

      {!generated && (
        <div className="bg-white border border-[#E2F3D0] rounded-2xl p-8 text-center">
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            AI will analyse the patient's absent probiotics, health indicators, disease risk, and low production scores to recommend specific supplement packages with Indian market availability.
          </p>
          <button
            onClick={generate}
            disabled={loading}
            className="btn-primary-mrx bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl text-sm font-medium disabled:opacity-50 transition"
          >
            {loading ? 'Generating...' : 'Generate Package Recommendation →'}
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
    </div>
  )
}

