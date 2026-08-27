'use client'

import { ReactNode } from 'react'
import PageContextRegistrar from '@/components/mrx/PageContextRegistrar'

type StatTone = 'green' | 'amber' | 'red' | 'blue'

export function SectionLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-[#538A22] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export function SectionOverviewCard({
  stats,
}: {
  stats: { label: string; value: string; tone: StatTone }[]
}) {
  const toneClass: Record<StatTone, string> = {
    green: 'text-[#538A22]',
    amber: 'text-amber-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {stats.map(s => (
        <div
          key={s.label}
          className="bg-[#F2F9EC] border border-[#E2F3D0] rounded-xl p-4 text-center"
        >
          <p className={`text-2xl font-semibold ${toneClass[s.tone]}`}>
            {s.value}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {s.label}
          </p>
        </div>
      ))}
    </div>
  )
}

export default function SectionPageShell({
  reportId,
  section,
  label,
  patientName,
  pageData,
  children,
}: {
  reportId: string
  section: string
  label: string
  patientName?: string
  pageData: Record<string, unknown>
  children: ReactNode
}) {
  return (
    <>
      <PageContextRegistrar
        section={section}
        label={label}
        data={pageData}
        reportId={reportId}
        patientName={patientName}
      />

      <div className="w-full max-w-[1600px] mx-auto px-6 lg:px-8 py-6">
        {children}
      </div>
    </>
  )
}
