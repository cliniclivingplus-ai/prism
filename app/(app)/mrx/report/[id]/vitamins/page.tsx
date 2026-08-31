'use client'
import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { SectionHeader } from '@/components/mrx/SectionHeader'
import SectionAiPanel from '@/components/mrx/SectionAiPanel'
import SectionPageShell, { SectionLoading } from '@/components/mrx/SectionPageShell'
import { buildAiContextFields, useSectionAnalysis, useSectionReport } from '@/lib/mrx/sectionPage'
import { AlertTriangle } from 'lucide-react'

interface VitaminEntry {
  key: string
  label: string
  value: number
  low: number
  high: number
  role: string
  supplement_note?: string
}

const VITAMIN_META: Omit<VitaminEntry, 'value'>[] = [
  { key: 'b1',  label: 'Vitamin B1',  low: 42.12, high: 58.616, role: 'Energy metabolism, nerve & muscle function' },
  { key: 'b2',  label: 'Vitamin B2',  low: 41.02, high: 52.14,  role: 'Cellular energy, antioxidant defence', supplement_note: 'Low - consider dietary riboflavin sources' },
  { key: 'b3',  label: 'Vitamin B3',  low: 44.38, high: 58.94,  role: 'NAD⁺ synthesis, DNA repair, energy' },
  { key: 'b5',  label: 'Vitamin B5',  low: 47.76, high: 73.65,  role: 'CoA synthesis, fatty acid metabolism', supplement_note: 'Low - pantothenic acid may be needed' },
  { key: 'b6',  label: 'Vitamin B6',  low: 44.32, high: 57.356, role: 'Amino acid metabolism, neurotransmitter synthesis' },
  { key: 'b7',  label: 'Vitamin B7',  low: 48.32, high: 60.8,   role: 'Fatty acid synthesis, gluconeogenesis' },
  { key: 'b9',  label: 'Vitamin B9',  low: 46.97, high: 60.22,  role: 'DNA synthesis, methylation, cell division' },
  { key: 'b12', label: 'Vitamin B12', low: 47.98, high: 61.484, role: 'Nerve function, red blood cell formation, methylation', supplement_note: '⚠ Critically low - B12 supplementation indicated' },
  { key: 'c',   label: 'Vitamin C',   low: 29.26, high: 65.68,  role: 'Antioxidant, collagen synthesis, immune support' },
]

function getStatus(value: number, low: number, high: number): 'low' | 'normal' | 'high' {
  if (value < low) return 'low'
  if (value > high) return 'high'
  return 'normal'
}

function StatusBadge({ status }: { status: 'low' | 'normal' | 'high' }) {
  const styles = {
    high:   'bg-red-100 text-red-700 border-red-200',
    normal: 'bg-[var(--pista-100)] text-[var(--pista-700)] border-[var(--pista-200)]',
    low:    'bg-amber-100 text-amber-700 border-amber-200',
  }
  const labels = { high: 'Above Optimal', normal: 'Optimal', low: 'Low' }
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function VitaminBar({ value, low, high }: { value: number; low: number; high: number }) {
  const max = high * 1.6
  const valuePct  = Math.min(100, (value / max) * 100)
  const lowPct    = (low / max) * 100
  const highPct   = (high / max) * 100
  const status    = getStatus(value, low, high)
  const barColor  = status === 'high' ? '#dc2626' : status === 'low' ? '#f59e0b' : '#538A22'

  return (
    <div className="mt-2">
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden relative">
        {/* reference range band */}
        <div
          className="absolute h-full rounded-full"
          style={{
            left: `${lowPct}%`,
            width: `${highPct - lowPct}%`,
            background: 'rgba(83,138,34,0.15)',
          }}
        />
        {/* value marker */}
        <div
          className="absolute h-full w-1.5 rounded-full transition-all"
          style={{ left: `${valuePct}%`, background: barColor, transform: 'translateX(-50%)' }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-gray-400 mt-0.5">
        <span>0</span>
        <span className="text-[var(--pista-600)]">{low}–{high}</span>
        <span>{(high * 1.6).toFixed(0)}</span>
      </div>
    </div>
  )
}

export default function VitaminsPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)

  const getSectionData = useMemo(
    () => (rep: { report_data: Record<string, unknown> | null }) => rep.report_data?.vitamins,
    []
  )

  const vitaminsPreview = (report?.report_data?.vitamins ?? {}) as Record<string, number>
  const hasData = VITAMIN_META.some(m => vitaminsPreview[m.key] != null)

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'Vitamin Production Potential',
    getSectionData,
    hasData
  )

  if (loading) return <SectionLoading />
  if (!report) return null

  const vitamins = vitaminsPreview
  const vitaminRows: VitaminEntry[] = VITAMIN_META.map(meta => ({
    ...meta,
    value: vitamins?.[meta.key] ?? null,
  }))

  const lowCount    = vitaminRows.filter(v => v.value != null && getStatus(v.value, v.low, v.high) === 'low').length
  const normalCount = vitaminRows.filter(v => v.value != null && getStatus(v.value, v.low, v.high) === 'normal').length
  const highCount   = vitaminRows.filter(v => v.value != null && getStatus(v.value, v.low, v.high) === 'high').length

  const pageData = {
    low_count: lowCount,
    normal_count: normalCount,
    high_count: highCount,
    vitamins: vitaminRows.filter(v => v.value != null).map(v => ({
      key: v.key,
      label: v.label,
      value: v.value,
      status: getStatus(v.value!, v.low, v.high),
    })),
    ...buildAiContextFields(analysis, analysing, error),
  }

  return (
    <SectionPageShell
      reportId={id}
      section="vitamins"
      label="Vitamin Production"
      patientName={report.patient_name}
      pageData={pageData}
    >
      <SectionHeader reportId={id} title="Vitamins Production" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        
      </div>
      <p className="text-sm text-gray-400 mb-1">
        Microbiome's capacity to synthesise vitamins • Handbook Page No. 04
      </p>
      <p className="text-xs text-gray-400 mb-8 font-mono">
        Dr Shammi Kapoor · 63 Yrs · Male · BS041850
      </p>

      {/* No data state */}
      {!vitamins && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 mb-6 flex items-center gap-1.5">
          <AlertTriangle size={14} /> No vitamin data found in this report. Re-upload the PDF to extract scores.
        </div>
      )}

      {vitamins && (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-light text-amber-700">{lowCount}</p>
              <p className="text-xs text-amber-600 font-mono mt-0.5 uppercase tracking-wide">Low</p>
            </div>
            <div className="bg-[var(--pista-50)] border border-[var(--pista-200)] rounded-xl p-4 text-center">
              <p className="text-2xl font-light text-[var(--pista-700)]">{normalCount}</p>
              <p className="text-xs text-[var(--pista-600)] font-mono mt-0.5 uppercase tracking-wide">Optimal</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-light text-red-700">{highCount}</p>
              <p className="text-xs text-red-600 font-mono mt-0.5 uppercase tracking-wide">Above Optimal</p>
            </div>
          </div>

          {/* Vitamin cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {vitaminRows.map(vit => {
              if (vit.value == null) return null
              const status = getStatus(vit.value, vit.low, vit.high)
              const borderColor = status === 'low' ? 'border-amber-200' : status === 'high' ? 'border-red-200' : 'border-[#E2F3D0]'
              const bgColor     = status === 'low' ? 'bg-amber-50/40'   : status === 'high' ? 'bg-red-50/40'   : 'bg-white'

              return (
                <div key={vit.key}
                  className={`${bgColor} border ${borderColor} rounded-2xl p-4 transition hover:shadow-sm`}>
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{vit.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{vit.role}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xl font-light tabular-nums ${
                        status === 'low' ? 'text-amber-700' :
                        status === 'high' ? 'text-red-700' : 'text-[var(--pista-700)]'
                      }`}>
                        {vit.value.toFixed(3)}
                      </span>
                      <StatusBadge status={status} />
                    </div>
                  </div>

                  <VitaminBar value={vit.value} low={vit.low} high={vit.high} />

                  {vit.supplement_note && (
                    <div className={`mt-3 text-xs px-3 py-2 rounded-lg font-mono ${
                      vit.key === 'b12'
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : 'bg-amber-100 text-amber-700 border border-amber-200'
                    }`}>
                      {vit.supplement_note}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Low vitamins summary */}
          {lowCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8">
              <p className="text-xs font-mono text-amber-600 uppercase tracking-widest mb-3">
                Deficient vitamins - action needed
              </p>
              <div className="space-y-2">
                {vitaminRows
                  .filter(v => v.value != null && getStatus(v.value, v.low, v.high) === 'low')
                  .map(v => (
                    <div key={v.key} className="flex items-start gap-2">
                      <span className="text-amber-500 flex-shrink-0 mt-0.5">↓</span>
                      <div>
                        <span className="text-sm font-medium text-amber-800">{v.label}</span>
                        <span className="text-xs text-amber-600 ml-2 font-mono">{v.value?.toFixed(3)} (ref {v.low}–{v.high})</span>
                        <p className="text-xs text-amber-700 mt-0.5">{v.role}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <SectionAiPanel
            analysis={analysis}
            analysing={analysing}
            error={error}
            onRegenerate={() => report && analyse(report)}
            loadingMessage="Analysing vitamin profile…"
          />
        </>
      )}
    </SectionPageShell>
  )
}