'use client'
import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { SectionHeader } from '@/components/mrx/SectionHeader'
import SectionAiPanel from '@/components/mrx/SectionAiPanel'
import SectionPageShell, { SectionLoading } from '@/components/mrx/SectionPageShell'
import { buildAiContextFields, useSectionAnalysis, useSectionReport } from '@/lib/mrx/sectionPage'
import { Microscope, AlertTriangle } from 'lucide-react'

interface NTEntry {
  key: string
  label: string
  value: number | null
  low: number
  high: number
  group: string
  role: string
  clinical_note?: string
}

// Groups per sections.md
const NT_GROUPS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  inhibitory:  { label: 'Inhibitory',   color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200' },
  monoamines:  { label: 'Monoamines',   color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200'   },
  excitatory:  { label: 'Excitatory',   color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200' },
  precursors:  { label: 'Precursors',   color: 'text-teal-700',   bg: 'bg-teal-50',    border: 'border-teal-200'   },
  histamine:   { label: 'Histamine',    color: 'text-rose-700',   bg: 'bg-rose-50',    border: 'border-rose-200'   },
}

const NT_META: Omit<NTEntry, 'value'>[] = [
  // Inhibitory
  { key: 'gaba',          label: 'GABA',           low: 52.71, high: 65.62, group: 'inhibitory',
    role: 'Primary inhibitory neurotransmitter; calming, anti-anxiety',
    clinical_note: 'Low GABA linked to anxiety, poor sleep, heightened stress response' },
  // Monoamines
  { key: 'serotonin',     label: 'Serotonin',       low: 46.34, high: 66.26, group: 'monoamines',
    role: 'Mood, sleep, appetite - 90% produced in the gut',
    clinical_note: 'Low serotonin potential; correlates with mood dysregulation' },
  { key: 'dopamine',      label: 'Dopamine',         low: 48.54, high: 62.288, group: 'monoamines',
    role: 'Reward, motivation, motor control, cognition' },
  { key: 'norepinephrine',label: 'Norepinephrine',   low: 18.63, high: 28.878, group: 'monoamines',
    role: 'Stress response, alertness, cardiovascular regulation',
    clinical_note: 'Very low - may contribute to fatigue and poor stress adaptation' },
  { key: 'epinephrine',   label: 'Epinephrine',      low: 26.33, high: 38.85, group: 'monoamines',
    role: 'Fight-or-flight response, energy mobilisation',
    clinical_note: 'Below reference range; reduced adrenal signalling potential' },
  // Excitatory
  { key: 'glutamate',     label: 'Glutamate',        low: 58.31, high: 73.368, group: 'excitatory',
    role: 'Primary excitatory neurotransmitter; learning and memory',
    clinical_note: 'Below optimal - may impact cognitive sharpness' },
  { key: 'acetylcholine', label: 'Acetylcholine',    low: 26.2,  high: 37.98, group: 'excitatory',
    role: 'Memory, attention, neuromuscular junction',
    clinical_note: 'Low - relevant to cognitive function and muscle coordination' },
  // Precursors
  { key: 'tryptophan',    label: 'Tryptophan',       low: 40.71, high: 90.71, group: 'precursors',
    role: 'Serotonin & melatonin precursor; sleep and mood upstream',
    clinical_note: '⚠ Score 0.0 - critically absent; major upstream deficit for serotonin & melatonin' },
  { key: 'tryptamine',    label: 'Tryptamine',       low: 20.18, high: 33.34, group: 'precursors',
    role: 'Tryptophan metabolite; gut–brain signalling' },
  // Histamine
  { key: 'histamine',     label: 'Histamine',        low: 39.26, high: 49.528, group: 'histamine',
    role: 'Immune response, gastric acid secretion, wakefulness' },
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

function NTBar({ value, low, high }: { value: number; low: number; high: number }) {
  const max = Math.max(high * 1.4, value * 1.1, 100)
  const valuePct = Math.min(100, (value / max) * 100)
  const lowPct   = (low / max) * 100
  const highPct  = (high / max) * 100
  const status   = getStatus(value, low, high)
  const barColor = status === 'high' ? '#dc2626' : status === 'low' ? '#f59e0b' : '#538A22'

  return (
    <div className="mt-2">
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative">
        <div
          className="absolute h-full rounded-full"
          style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%`, background: 'rgba(83,138,34,0.15)' }}
        />
        <div
          className="absolute h-full w-1.5 rounded-full"
          style={{ left: `${valuePct}%`, background: barColor, transform: 'translateX(-50%)' }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-gray-400 mt-0.5">
        <span>0</span>
        <span className="text-[var(--pista-600)]">{low}–{high}</span>
        <span>{max.toFixed(0)}</span>
      </div>
    </div>
  )
}

export default function NeurotransmittersPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)

  const getSectionData = useMemo(
    () => (rep: { report_data: Record<string, unknown> | null }) => rep.report_data?.neurotransmitters,
    []
  )

  const ntPreview = (report?.report_data?.neurotransmitters ?? {}) as Record<string, number>
  const hasData = NT_META.some(m => ntPreview[m.key] != null)

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'Neurotransmitter Production Potential',
    getSectionData,
    hasData
  )

  if (loading) return <SectionLoading />
  if (!report) return null

  const nt = ntPreview
  const ntRows: NTEntry[] = NT_META.map(meta => ({
    ...meta,
    value: nt?.[meta.key] ?? null,
  }))

  const lowCount    = ntRows.filter(r => r.value != null && getStatus(r.value, r.low, r.high) === 'low').length
  const normalCount = ntRows.filter(r => r.value != null && getStatus(r.value, r.low, r.high) === 'normal').length
  const highCount   = ntRows.filter(r => r.value != null && getStatus(r.value, r.low, r.high) === 'high').length

  const groupOrder = ['inhibitory', 'monoamines', 'excitatory', 'precursors', 'histamine']

  const pageData = {
    low_count: lowCount,
    normal_count: normalCount,
    high_count: highCount,
    neurotransmitters: ntRows.filter(r => r.value != null).map(r => ({
      key: r.key,
      label: r.label,
      value: r.value,
      group: r.group,
      status: getStatus(r.value!, r.low, r.high),
    })),
    ...buildAiContextFields(analysis, analysing, error),
  }

  return (
    <SectionPageShell
      reportId={id}
      section="neurotransmitters"
      label="Neurotransmitters"
      patientName={report.patient_name}
      pageData={pageData}
    >
      <SectionHeader reportId={id} title="Neurotransmitter Production" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        
      </div>
      <p className="text-sm text-gray-400 mb-1">
        Microbiome's capacity to produce neurotransmitters • Handbook Page No. 06
      </p>
      <p className="text-xs text-gray-400 mb-2 font-mono">
        Dr Shammi Kapoor · 63 Yrs · Male · BS041850
      </p>
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-xs text-blue-700 mb-8">
        <Microscope size={13} style={{display:'inline', verticalAlign:-2}} /> <span className="font-medium">Gut-Brain Axis:</span> 90% of serotonin is produced in the gut.
        Low tryptophan → low serotonin. These scores reflect microbial production potential, not serum levels.
      </div>

      {/* No data state */}
      {!nt && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 mb-6 flex items-center gap-1.5">
          <AlertTriangle size={14} /> No neurotransmitter data found in this report. Re-upload the PDF to extract scores.
        </div>
      )}

      {nt && (
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

          {/* Grouped sections */}
          {groupOrder.map(groupKey => {
            const groupItems = ntRows.filter(r => r.group === groupKey && r.value != null)
            if (groupItems.length === 0) return null
            const g = NT_GROUPS[groupKey]

            return (
              <div key={groupKey} className="mb-8">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${g.bg} ${g.border} border mb-4`}>
                  <span className={`text-xs font-mono font-medium uppercase tracking-widest ${g.color}`}>
                    {g.label}
                  </span>
                </div>

                <div className="space-y-3">
                  {groupItems.map(item => {
                    const status = getStatus(item.value!, item.low, item.high)
                    const borderColor = status === 'low' ? 'border-amber-200' :
                                        status === 'high' ? 'border-red-200' : 'border-[#E2F3D0]'
                    const bgColor     = status === 'low' ? 'bg-amber-50/30' :
                                        status === 'high' ? 'bg-red-50/30' : 'bg-white'

                    return (
                      <div key={item.key}
                        className={`${bgColor} border ${borderColor} rounded-2xl p-4`}>
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1 pr-4">
                            <p className="text-sm font-medium text-gray-800">{item.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{item.role}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className={`text-xl font-light tabular-nums ${
                              status === 'low' ? 'text-amber-700' :
                              status === 'high' ? 'text-red-700' : 'text-[var(--pista-700)]'
                            }`}>
                              {item.value!.toFixed(3)}
                            </span>
                            <StatusBadge status={status} />
                          </div>
                        </div>

                        <NTBar value={item.value!} low={item.low} high={item.high} />

                        {item.clinical_note && (
                          <div className={`mt-3 text-xs px-3 py-2 rounded-lg font-mono ${
                            item.key === 'tryptophan'
                              ? 'bg-red-100 text-red-700 border border-red-200'
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}>
                            {item.clinical_note}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Critical alert - tryptophan */}
          {nt?.tryptophan === 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-8">
              <p className="text-xs font-mono text-red-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                <AlertTriangle size={11} /> Critical Finding
              </p>
              <p className="text-sm text-red-800 leading-relaxed">
                <span className="font-medium">Tryptophan score is 0.0</span> - the microbiome is producing
                essentially no tryptophan. As the upstream precursor for both serotonin and melatonin, this
                directly explains the low serotonin potential and may impact mood, sleep quality, and gut-brain
                signalling. Dietary tryptophan sources (turkey, eggs, pumpkin seeds, tofu) and targeted prebiotic
                support should be considered.
              </p>
            </div>
          )}

          {/* Low NT summary */}
          {lowCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8">
              <p className="text-xs font-mono text-amber-600 uppercase tracking-widest mb-3">
                Low neurotransmitters - {lowCount} deficient
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ntRows
                  .filter(r => r.value != null && getStatus(r.value, r.low, r.high) === 'low')
                  .map(r => (
                    <div key={r.key} className="flex items-center gap-2">
                      <span className="text-amber-500">↓</span>
                      <div>
                        <span className="text-xs font-medium text-amber-800">{r.label}</span>
                        <span className="text-xs text-amber-600 ml-1 font-mono">{r.value?.toFixed(3)}</span>
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
            loadingMessage="Analysing neurotransmitter profile…"
          />
        </>
      )}
    </SectionPageShell>
  )
}