'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

/**
 * Entry point from a patient's workspace into Blood Panel.
 *
 * The workspace knows the hub patient id; Blood Panel's pages are keyed by
 * blood.patients.id. This resolves one to the other (creating the row and the
 * link on first use) and forwards, so the coach never picks a patient from a
 * list — which is what keeps every report linked by id instead of by name.
 */
export default function BloodStartPage() {
  const router = useRouter()
  const hubPatientId = useSearchParams().get('patient')
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    if (!hubPatientId) {
      setError('No patient specified. Open this from a patient’s workspace.')
      return
    }

    fetch('/api/blood/patients/ensure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hubPatientId }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error || 'Could not open Blood Panel for this patient.')
        router.replace(`/blood/patient/${j.bloodPatientId}?upload=1`)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Something went wrong.'))
  }, [hubPatientId, router])

  return (
    <main className="flex-1 px-[30px] pt-7" style={{ maxWidth: 760 }}>
      <div
        className="rounded-[14px] px-6 py-[22px]"
        style={{ background: 'var(--paper-raised)', border: '1px solid var(--line-soft)' }}
      >
        {error ? (
          <>
            <h1 className="font-display m-0 mb-2 text-[19px] font-medium" style={{ color: 'var(--ink)' }}>
              Couldn’t open Blood Panel
            </h1>
            <p className="m-0 mb-4 text-[13px]" style={{ color: 'var(--ink-faint)' }}>{error}</p>
            {hubPatientId ? (
              <Link
                href={`/patients/${hubPatientId}?view=blood`}
                className="text-[13px] font-semibold"
                style={{ color: 'var(--rust-600)' }}
              >
                Back to the patient
              </Link>
            ) : (
              <Link href="/dashboard" className="text-[13px] font-semibold" style={{ color: 'var(--rust-600)' }}>
                Back to patients
              </Link>
            )}
          </>
        ) : (
          <p className="m-0 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
            Opening Blood Panel for this patient…
          </p>
        )}
      </div>
    </main>
  )
}
