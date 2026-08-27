import { useState } from 'react'
import { PatientInput, RxData } from '@/lib/mrx/types'

type GenerateResult = {
  prescription_id: string
  patient_id: string
  rx_data: RxData
}

export function usePrescription() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rxData, setRxData] = useState<RxData | null>(null)
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null)

  const generate = async (
    patient: PatientInput,
    speciesList: string[],
    doctorId: string
  ): Promise<GenerateResult> => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/mrx/generate-rx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient,
          species_list: speciesList,
          doctor_id: doctorId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Generation failed')
      }

      setRxData(data.rx_data)
      setPrescriptionId(data.prescription_id)
      return data
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
      throw e
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setRxData(null)
    setPrescriptionId(null)
    setError(null)
  }

  return { generate, loading, error, rxData, prescriptionId, reset }
}
