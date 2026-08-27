'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { SectionHeader } from '@/components/mrx/SectionHeader'
import SectionAiPanel from '@/components/mrx/SectionAiPanel'
import SectionPageShell, { SectionLoading } from '@/components/mrx/SectionPageShell'
import { buildAiContextFields, useSectionAnalysis, useSectionReport } from '@/lib/mrx/sectionPage'

const KINGDOM_COLORS: Record<string, string> = {
  bacteria:  '#538A22',
  archaea:   '#3b82f6',
  fungi:     '#a855f7',
  eukaryota: '#f59e0b',
  viruses:   '#ef4444',
}

export default function DiversityPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)

  const getSectionData = useMemo(
    () => (rep: { report_data: Record<string, unknown> | null }) => ({
      diversity: rep.report_data?.diversity,
      kingdom: rep.report_data?.kingdom,
      species_count: Array.isArray(rep.report_data?.species_list)
        ? rep.report_data!.species_list!.length
        : 0,
    }),
    []
  )

  const shannonPreview = (report?.report_data?.diversity as { shannon?: number } | undefined)?.shannon
  const hasData = shannonPreview != null

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'Microbial Diversity',
    getSectionData,
    hasData
  )

  if (loading) return <SectionLoading />
  if (!report) return null

  const rd = report.report_data
  const shannon = shannonPreview
  const kingdom = (rd?.kingdom ?? {}) as Record<string, number>
  const speciesCount = Array.isArray(rd?.species_list) ? rd.species_list.length : 0
  const kingdomEntries = Object.entries(kingdom)
    .filter(([, v]) => v != null)
    .sort(([, a], [, b]) => b - a)

  const pageData = {
    shannon_index: shannon ?? null,
    species_count: speciesCount,
    kingdom_breakdown: kingdomEntries.map(([k, v]) => ({ kingdom: k, percent: v })),
    ...buildAiContextFields(analysis, analysing, error),
  }

  const diversityStatus =
    shannon == null ? 'low' : shannon >= 3.5 ? 'high' : shannon >= 2.5 ? 'moderate' : 'low'
  const statusLabel = { high: 'High diversity', moderate: 'Moderate diversity', low: 'Low diversity' }[diversityStatus]
  const statusColor = { high: 'text-[#538A22]', moderate: 'text-amber-500', low: 'text-red-500' }[diversityStatus]
  const badgeBg = {
    high: 'bg-[#F2F9EC] text-[#538A22] border-[#C8E9A8]',
    moderate: 'bg-amber-50 text-amber-600 border-amber-200',
    low: 'bg-red-50 text-red-500 border-red-200',
  }[diversityStatus]
  const shannonBarColor = { high: '#538A22', moderate: '#f59e0b', low: '#ef4444' }[diversityStatus]
  const shannonPct = shannon != null ? Math.min(100, (shannon / 5) * 100) : 0

  return (
    <SectionPageShell
      reportId={id}
      section="diversity"
      label="Microbial Diversity"
      patientName={report.patient_name}
      pageData={pageData}
    >
      <SectionHeader reportId={id} title="Diversity" />

      {!shannon ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          No diversity scores found. Re-upload the PDF to extract scores.
        </p>
      ) : (
        <>

      {/* ── Section 1: Shannon Diversity Index ── */}
      <div className="bg-white border border-[#E2F3D0] rounded-2xl px-6 pt-2 pb-4 mb-3">
        <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest pt-4 mb-4">
          Shannon Diversity Index
        </p>

        <div className="py-4 border-t border-[#F2F9EC]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-800">Overall microbial diversity</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-900">{shannon}</span>
              <span className={`text-xs font-medium px-3 py-1 rounded-full border ${badgeBg}`}>
                {statusLabel}
              </span>
            </div>
          </div>

          <div className="relative h-2 bg-gray-100 rounded-full overflow-visible">
            <div
              className="absolute h-full rounded-full"
              style={{ width: `${shannonPct}%`, background: shannonBarColor }}
            />
            {/* Reference range markers at 2.17 and 4.58 */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gray-300 rounded-full"
              style={{ left: `${(2.17 / 5) * 100}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gray-300 rounded-full"
              style={{ left: `${(4.58 / 5) * 100}%` }}
            />
          </div>

          <div className="relative mt-1">
            {[0, 1, 2, 3, 4, 5].map(tick => (
              <span
                key={tick}
                className="absolute text-[10px] font-mono text-gray-300 -translate-x-1/2"
                style={{ left: `${(tick / 5) * 100}%` }}
              >
                {tick}
              </span>
            ))}
          </div>
          <div className="h-3" />
        </div>

        <p className="text-xs font-mono text-gray-300">
          Vertical markers show reference range (2.17 – 4.58)
        </p>
      </div>

      {/* Shannon summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className={`rounded-2xl px-4 py-5 text-center border ${
          diversityStatus === 'high' ? 'bg-[#F2F9EC] border-[#E2F3D0]'
          : diversityStatus === 'moderate' ? 'bg-amber-50 border-amber-100'
          : 'bg-red-50 border-red-100'
        }`}>
          <p className={`text-3xl font-bold mb-1 ${statusColor}`}>{shannon}</p>
          <p className={`text-[10px] font-mono uppercase tracking-widest ${
            diversityStatus === 'high' ? 'text-[#8BC44F]'
            : diversityStatus === 'moderate' ? 'text-amber-400'
            : 'text-red-400'
          }`}>Shannon Score</p>
        </div>
        <div className="bg-white border border-[#E2F3D0] rounded-2xl px-4 py-5 text-center">
          <p className="text-3xl font-bold text-gray-700 mb-1">{speciesCount}</p>
          <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Species detected</p>
        </div>
        <div className="bg-white border border-[#E2F3D0] rounded-2xl px-4 py-5 text-center">
          <p className={`text-3xl font-bold mb-1 ${statusColor}`}>
            {diversityStatus === 'high' ? 'Resilient' : diversityStatus === 'moderate' ? 'Moderate' : 'Vulnerable'}
          </p>
          <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Resilience</p>
        </div>
      </div>

      {/* ── Section 2: Kingdom Distribution ── */}
      {kingdomEntries.length > 0 && (
        <>
          <div className="bg-white border border-[#E2F3D0] rounded-2xl px-6 pt-2 pb-4 mb-3">
            <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest pt-4 mb-4">
              Kingdom Distribution
            </p>

            {kingdomEntries.map(([key, value]) => {
              const v = value as number
              const barColor = KINGDOM_COLORS[key] || '#538A22'
              // Kingdom values are percentages - bacteria ~97%, others ~0.001–2%
              // Use log scale feel: cap display bar at bacteria's actual value for relative comparison
              const maxVal = (kingdomEntries[0][1] as number) // largest = bacteria
              const pct = Math.min(100, (v / maxVal) * 100)

              return (
                <div key={key} className="py-4 border-t border-[#F2F9EC]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-800 capitalize">{key}</span>
                    <span className="text-sm font-semibold text-gray-900">{v.toFixed(3)}%</span>
                  </div>
                  <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="absolute h-full rounded-full"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                  </div>
                </div>
              )
            })}

            <p className="text-xs font-mono text-gray-300 mt-4">
              Bars show relative proportion within detected kingdoms. A healthy gut is predominantly bacteria (95–99%).
            </p>
          </div>

          {/* Kingdom count card */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white border border-[#E2F3D0] rounded-2xl px-4 py-5 text-center">
              <p className="text-3xl font-bold text-[#538A22] mb-1">{kingdomEntries.length}</p>
              <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Kingdoms detected</p>
            </div>
            {kingdomEntries.slice(0, 2).map(([key, value]) => (
              <div key={key} className="bg-white border border-[#E2F3D0] rounded-2xl px-4 py-5 text-center">
                <p className="text-3xl font-bold text-gray-700 mb-1">{(value as number).toFixed(2)}%</p>
                <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400 capitalize">{key}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionAiPanel
        analysis={analysis}
        analysing={analysing}
        error={error}
        onRegenerate={() => report && analyse(report)}
        loadingMessage="Analysing diversity data…"
      />
        </>
      )}
    </SectionPageShell>
  )
}