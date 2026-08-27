'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/mrx/supabase'
import { usePrescription } from '@/lib/mrx/hooks/usePrescription'
import LoadingState from '@/components/mrx/LoadingState'
import PrescriptionResult from '@/components/mrx/PrescriptionResult'
import type { PatientInput } from '@/lib/mrx/types'

type Report = {
  id: string
  doctor_id: string
  patient_name: string
  patient_age_sex: string
  patient_complaint: string
  patient_diet: string
  patient_history: string
  patient_allergies: string
  species_list: string[]
  species_count: number
}

export default function DietaryRxPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { generate, loading, error, rxData, reset } = usePrescription()

  const [report, setReport] = useState<Report | null>(null)
  const [loadingReport, setLoadingReport] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    async function load() {
      const { data, error: dbErr } = await supabase
        .from('reports')
        .select('*')
        .eq('id', id)
        .single()

      if (dbErr || !data) {
        router.push('/mrx/dashboard')
        return
      }
      setReport(data)
      setLoadingReport(false)
    }
    load()
  }, [id, router])

  const handleGenerate = async () => {
    if (!report) return

    setCurrentStep(0)
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= 5) { clearInterval(stepInterval); return prev }
        return prev + 1
      })
    }, 2000)

    const patient: PatientInput = {
      name: report.patient_name,
      age_sex: report.patient_age_sex || '',
      complaint: report.patient_complaint || '',
      diet_type: report.patient_diet || '',
      medical_history: report.patient_history || '',
      allergies: report.patient_allergies || '',
    }

    try {
      await generate(patient, report.species_list, report.doctor_id)
    } finally {
      clearInterval(stepInterval)
    }
  }

  if (loadingReport) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent
          rounded-full animate-spin" />
      </div>
    )
  }

  if (!report) return null

  if (loading) return <LoadingState currentStep={currentStep} />

  if (rxData) {
    return (
      <PrescriptionResult
        rxData={rxData}
        patientName={report.patient_name}
        speciesCount={report.species_count}
        onReset={reset}
      />
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-16 px-6 text-center">
      <Link
        href={`/mrx/report/${id}`}
        className="text-xs font-mono text-gray-400 hover:text-green-600
          transition mb-8 block text-left"
      >
        ← Back to report
      </Link>

      <div className="bg-white border border-gray-100 rounded-2xl p-10">
        <div className="text-5xl mb-5">🥗</div>
        <h2 className="text-2xl font-light text-gray-900 mb-2">
          Dietary prescription
        </h2>
        <p className="text-sm text-gray-400 mb-2">
          {report.patient_name} · {report.species_count} species
        </p>
        <p className="text-sm text-gray-500 leading-relaxed mb-8 max-w-md mx-auto">
          Generates species-specific food recommendations, a daily meal schedule,
          supplements, and foods to avoid - all tied to the exact species in this report.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3
            text-sm text-red-700 mb-6 text-left">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          className="w-full py-3 bg-green-700 hover:bg-green-800 text-white
            font-medium rounded-xl text-sm transition-all"
        >
          Generate dietary prescription →
        </button>
      </div>
    </div>
  )
}
