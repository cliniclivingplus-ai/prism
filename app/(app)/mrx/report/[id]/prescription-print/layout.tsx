'use client'

import { useEffect } from 'react'

export default function PrescriptionPrintLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    document.body.classList.add('prescription-print-page')
    return () => {
      document.body.classList.remove('prescription-print-page')
    }
  }, [])

  return <>{children}</>
}