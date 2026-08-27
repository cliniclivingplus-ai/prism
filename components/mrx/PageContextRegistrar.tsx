'use client'
// components/PageContextRegistrar.tsx
// Re-pushes context whenever ANY prop changes - critical so the assistant
// gets updated data after auto-analysis completes on the page.

import { useEffect } from 'react'
import { useContext } from 'react'
import { PageCtx } from '@/components/mrx/PageContext'

type PageContextData = {
  section: string
  label: string
  data: Record<string, unknown>
  reportId?: string
  patientName?: string
}

export default function PageContextRegistrar(props: PageContextData) {
  const { setPageCtx } = useContext(PageCtx)

  // Serialize data so useEffect detects deep changes (e.g. when analysis arrives).
  // Capped at 20k chars to avoid hashing huge objects on every render.
  const dataKey = JSON.stringify(props.data).slice(0, 20_000)

  useEffect(() => {
    setPageCtx(props)
    return () => setPageCtx(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.section, props.reportId, dataKey])

  return null
}
