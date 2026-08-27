/**
 * app/report/[id]/pathogens/page.tsx
 * Visually identical to foundation/page.tsx
 */
'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { SectionHeader } from '@/components/mrx/SectionHeader'
import SectionAiPanel from '@/components/mrx/SectionAiPanel'
import SectionPageShell, { SectionLoading } from '@/components/mrx/SectionPageShell'
import {
  buildAiContextFields,
  type SectionReport,
  useSectionAnalysis,
  useSectionReport,
} from '@/lib/mrx/sectionPage'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PathogenSpecies {
  name: string
  patient_value: number
  min: number
  p25: number
  ref_low: number
  ref_high: number
  p75: number
  max: number
  status: 'low' | 'normal' | 'high'
}

type Category = 'bacterial' | 'fungi' | 'protozoa' | 'worms' | 'other'

// ─── Genus → category (taxonomic grouping only) ───────────────────────────────

const GENUS_CATEGORY: Record<string, Category> = {
  Campylobacter: 'bacterial', Clostridioides: 'bacterial', Escherichia: 'bacterial',
  Helicobacter:  'bacterial', Salmonella:     'bacterial', Shigella:    'bacterial',
  Vibrio:        'bacterial', Yersinia:       'bacterial', Klebsiella:  'bacterial',
  Mycobacterium: 'bacterial', Proteus:        'bacterial', Citrobacter: 'bacterial',
  Fusobacterium: 'bacterial', Bacillus:       'bacterial', Enterococcus:'bacterial',
  Listeria:      'bacterial', Pseudomonas:    'bacterial', Staphylococcus:'bacterial',
  Streptococcus: 'bacterial', Plesiomonas:    'bacterial',
  Candida: 'fungi', Aspergillus: 'fungi',
  Giardia: 'protozoa', Blastocystis: 'protozoa', Chilomastix:  'protozoa',
  Cryptosporidium: 'protozoa', Dientamoeba: 'protozoa', Endolimax: 'protozoa',
  Entamoeba: 'protozoa', Pentatrichomonas: 'protozoa', Cyclospora: 'protozoa',
  Toxoplasma: 'protozoa',
  Necator: 'worms', Trichuris: 'worms', Ancylostoma: 'worms', Ascaris: 'worms',
}

const CATEGORY_CONFIG: Record<Category, { label: string; color: string; bg: string; border: string; dot: string }> = {
  bacterial: { label: 'Bacterial',    color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-400'    },
  fungi:     { label: 'Fungi / Yeast',color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-400' },
  protozoa:  { label: 'Protozoa',     color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', dot: 'bg-purple-400' },
  worms:     { label: 'Worms',        color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  dot: 'bg-amber-400'  },
  other:     { label: 'Other',        color: 'text-gray-700',   bg: 'bg-gray-50',   border: 'border-gray-200',   dot: 'bg-gray-400'   },
}

const CATEGORY_ORDER: Category[] = ['bacterial', 'fungi', 'protozoa', 'worms', 'other']

const STATUS_STYLE: Record<string, string> = {
  normal: 'bg-[#F2F9EC] border-[#C8E9A8] text-[#538A22]',
  low:    'bg-red-50 border-red-200 text-red-700',
  high:   'bg-amber-50 border-amber-200 text-amber-700',
}

const STATUS_LABEL: Record<string, string> = {
  normal: 'In range',
  low:    'Below range',
  high:   'Above range',
}

const STATUS_DOT: Record<string, string> = {
  normal: 'bg-[#8BC44F]',
  low:    'bg-red-400',
  high:   'bg-amber-400',
}

// ─── Range bar - identical to foundation page ─────────────────────────────────

function RangeBar({ p }: { p: PathogenSpecies }) {
  const range  = p.max - p.min || 1
  const pct    = (v: number) => Math.max(0, Math.min(100, ((v - p.min) / range) * 100))
  const refL   = pct(p.ref_low)
  const refW   = pct(p.ref_high) - refL
  const dotL   = pct(p.patient_value)
  const dotClr = p.status === 'low' ? '#f87171' : p.status === 'high' ? '#f59e0b' : '#6EA832'

  return (
    <div className="mt-3">
      <div className="relative h-2 bg-gray-100 rounded-full overflow-visible">
        <div
          className="absolute top-0 h-full rounded-full bg-[#C8E9A8]"
          style={{ left: `${refL}%`, width: `${refW}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3
                     rounded-full border-2 border-white shadow-md z-10"
          style={{ left: `${dotL}%`, backgroundColor: dotClr }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px] font-mono text-gray-400">
        <span>{p.min.toFixed(3)}</span>
        <span className="text-[#538A22]">{p.ref_low.toFixed(3)} – {p.ref_high.toFixed(3)}</span>
        <span>{p.max.toFixed(3)}</span>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getArray<T>(rd: Record<string, unknown> | null, key: string): T[] {
  const val = rd?.[key]
  return Array.isArray(val) ? (val as T[]) : []
}

function getStringField(rd: Record<string, unknown> | null, key: string): string | null {
  const val = rd?.[key]
  return typeof val === 'string' ? val : null
}

function getCategory(name: string): Category {
  return GENUS_CATEGORY[name.split(' ')[0] ?? ''] ?? 'other'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PathogensPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)
  const [filter, setFilter] = useState<'all' | 'low' | 'normal' | 'high' | Category>('all')
  const [search, setSearch] = useState('')

  const getSectionData = useMemo(
    () => (rep: SectionReport) => ({
      pathogens_data:        getArray(rep.report_data, 'pathogens_data'),
      pathogen_category_tag: getStringField(rep.report_data, 'pathogen_category_tag'),
    }),
    [],
  )

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'pathogen_characterization',
    getSectionData,
  )

  if (loading) return <SectionLoading />
  if (!report)  return null

  const rd          = report.report_data
  const species     = getArray<PathogenSpecies>(rd, 'pathogens_data')
  const categoryTag = getStringField(rd, 'pathogen_category_tag') ?? '-'

  const enriched    = species.map(p => ({ ...p, category: getCategory(p.name) }))
  const highCount   = enriched.filter(p => p.status === 'high').length
  const lowCount    = enriched.filter(p => p.status === 'low').length
  const normalCount = enriched.filter(p => p.status === 'normal').length

  const countByCategory = CATEGORY_ORDER.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = enriched.filter(p => p.category === cat).length
    return acc
  }, {})

  const filtered = enriched
    .filter(p => {
      if (filter === 'all') return true
      if (filter === 'high' || filter === 'low' || filter === 'normal') return p.status === filter
      return p.category === filter
    })
    .filter(p => !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()))

  const grouped = CATEGORY_ORDER.reduce<Record<string, typeof enriched>>((acc, cat) => {
    const items = filtered.filter(p => p.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})

  return (
    <SectionPageShell
      reportId={id}
      section="pathogens"
      label="Pathogen Characterization"
      patientName={report.patient_name}
      pageData={{
        total: species.length, high: highCount, low: lowCount, normal: normalCount,
        category_tag: categoryTag,
        ...buildAiContextFields(analysis, analysing, error),
      }}
    >
      <SectionHeader reportId={id} title="Pathogen Characterization" />

      {/* ── No data ────────────────────────────────────────────────────── */}
      {species.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center mb-6">
          <p className="text-sm font-medium text-amber-800 mb-1">No pathogen data found</p>
          <p className="text-xs text-amber-600">Re-upload this report to extract pathogen data.</p>
        </div>
      )}

      {species.length > 0 && (
        <>
          {/* ── Summary stats ─────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-white border border-[#E2F3D0] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-700 mb-1">{species.length}</div>
              <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wide">Total tracked</div>
            </div>
            <div className="bg-[#F2F9EC] border border-[#C8E9A8] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-[#538A22] mb-1">{normalCount}</div>
              <div className="text-[10px] font-mono text-[#538A22] uppercase tracking-wide">In range</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-amber-600 mb-1">{highCount}</div>
              <div className="text-[10px] font-mono text-amber-600 uppercase tracking-wide">Above range</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-red-600 mb-1">{lowCount}</div>
              <div className="text-[10px] font-mono text-red-600 uppercase tracking-wide">Below range</div>
            </div>
          </div>

          {/* ── Above range alert ─────────────────────────────────────── */}
          {highCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
              <p className="text-xs font-mono text-amber-800 uppercase tracking-wide font-medium mb-3">
                ⚠ {highCount} pathogen{highCount > 1 ? 's' : ''} above reference range - correlate clinically
              </p>
              <div className="flex flex-wrap gap-2">
                {enriched.filter(p => p.status === 'high').map((p, idx) => (
                  <span key={`alert-${p.name}-${idx}`}
                    className="text-xs italic text-amber-800 bg-amber-100 border border-amber-200 px-2 py-1 rounded-lg">
                    {p.name}
                    <span className="not-italic font-mono ml-1 text-amber-600">({p.patient_value.toFixed(3)})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── What is pathogen characterization ─────────────────────── */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
            <p className="text-xs font-mono text-blue-600 uppercase tracking-wide mb-2">
              What is pathogen characterization
            </p>
            <p className="text-sm text-blue-900 leading-relaxed">
              BugSpeaks® identifies and characterizes{' '}
              <strong>{species.length} pathogens</strong> commonly known to cause gut
              infections and other health issues. Values represent relative abundance from
              sequencing - not a culture-based diagnostic. Please correlate clinically.
              {categoryTag !== '-' && (
                <> Category tag: <strong>{categoryTag}</strong>.</>
              )}
            </p>
          </div>

          {/* ── Filters + search ──────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {[
              { id: 'all',    label: `All (${species.length})` },
              { id: 'high',   label: `Above range (${highCount})` },
              { id: 'normal', label: `In range (${normalCount})` },
              { id: 'low',    label: `Below range (${lowCount})` },
              ...CATEGORY_ORDER
                .filter(cat => countByCategory[cat] > 0)
                .map(cat => ({ id: cat, label: `${CATEGORY_CONFIG[cat].label} (${countByCategory[cat]})` })),
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition
                  ${filter === f.id
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
              >
                {f.label}
              </button>
            ))}
            <input
              type="text"
              placeholder="Search species…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="ml-auto text-xs font-mono px-3 py-1.5 rounded-lg border border-gray-200
                         focus:outline-none focus:border-[#8BC44F] bg-white placeholder-gray-300 w-44"
            />
          </div>

          {/* ── Species grouped by category ───────────────────────────── */}
          <div className="space-y-4 mb-6">
            {filtered.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8 font-mono">No pathogens match.</p>
            )}

            {CATEGORY_ORDER.filter(cat => grouped[cat]).map(cat => {
              const cfg   = CATEGORY_CONFIG[cat]
              const items = grouped[cat]
              return (
                <div key={cat}>
                  {/* Category label */}
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border mb-2 ${cfg.bg} ${cfg.border}`}>
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className={`text-xs font-semibold font-mono uppercase tracking-wide ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className={`ml-auto text-xs font-mono ${cfg.color}`}>{items.length}</span>
                  </div>

                  {/* Species cards - same as foundation page */}
                  <div className="space-y-3">
                    {items.map((p, idx) => (
                      <div
                        key={`${p.name}-${idx}`}
                        className={`border rounded-xl p-4 transition ${STATUS_STYLE[p.status]}`}
                      >
                        {/* Header row */}
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[p.status]}`} />
                            <span className="text-sm font-medium italic text-gray-900">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${STATUS_STYLE[p.status]}`}>
                              {p.patient_value.toFixed(3)}
                            </span>
                            <span className={`text-xs font-mono px-2 py-0.5 rounded border ${STATUS_STYLE[p.status]}`}>
                              {STATUS_LABEL[p.status]}
                            </span>
                          </div>
                        </div>

                        {/* Ref info */}
                        <p className="text-[10px] font-mono text-gray-400 mb-1">
                          Reference: {p.ref_low.toFixed(3)} – {p.ref_high.toFixed(3)}
                          &nbsp;|&nbsp;IQR: {p.p25.toFixed(3)} – {p.p75.toFixed(3)}
                        </p>

                        {/* Range bar */}
                        <RangeBar p={p} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Legend ────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E2F3D0] rounded-xl p-5 mb-6">
            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-4">How to read the bars</p>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="flex gap-2 items-start">
                <div className="mt-1 w-4 h-2 rounded-full bg-[#C8E9A8] flex-shrink-0" />
                <div><div className="font-medium text-gray-700 mb-0.5">Green zone</div><div className="text-gray-500">Reference range for healthy population</div></div>
              </div>
              <div className="flex gap-2 items-start">
                <div className="mt-0.5 w-3 h-3 rounded-full bg-[#6EA832] border-2 border-white shadow flex-shrink-0" />
                <div><div className="font-medium text-gray-700 mb-0.5">Green dot</div><div className="text-gray-500">Patient value within range</div></div>
              </div>
              <div className="flex gap-2 items-start">
                <div className="mt-0.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-white shadow flex-shrink-0" />
                <div><div className="font-medium text-gray-700 mb-0.5">Amber / red dot</div><div className="text-gray-500">Patient value outside reference range</div></div>
              </div>
            </div>
          </div>
        </>
      )}

      <SectionAiPanel
        analysis={analysis}
        analysing={analysing}
        error={error}
        onRegenerate={() => report && analyse(report)}
        subtitle="Pathogen profile interpretation and clinical recommendations"
      />
    </SectionPageShell>
  )
}