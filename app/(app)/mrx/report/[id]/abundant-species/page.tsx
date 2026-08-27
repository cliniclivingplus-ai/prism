/**
 * app/report/[id]/abundant-species/page.tsx
 */
'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { SectionHeader } from '@/components/mrx/SectionHeader'
import SectionAiPanel from '@/components/mrx/SectionAiPanel'
import SectionPageShell, { SectionLoading } from '@/components/mrx/SectionPageShell'
import { buildAiContextFields, useSectionAnalysis, useSectionReport } from '@/lib/mrx/sectionPage'
import type { AbundantSpecies, Kingdom } from '@/lib/mrx/extractAbundantSpecies'

// ─── Constants ───────────────────────────────────────────────────────────────

const KINGDOM_ORDER: Kingdom[] = ['Bacteria', 'Archaea', 'Fungi', 'Eukaryota', 'Viruses']

const KINGDOM_ICON: Record<Kingdom, string> = {
  Bacteria:  '🦠',
  Archaea:   '🧫',
  Fungi:     '🍄',
  Eukaryota: '🔬',
  Viruses:   '🧬',
}

const BIN_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Low Potential',
  2: 'Optimal Potential',
  3: 'Above Optimal',
}

// Dot / badge colours per bin
const BIN_DOT_COLOR: Record<1 | 2 | 3, string> = {
  1: '#f59e0b',  // amber
  2: '#6EA832',  // pista green
  3: '#9ca3af',  // grey
}

const BIN_BADGE: Record<1 | 2 | 3, string> = {
  1: 'bg-amber-50 border-amber-200 text-amber-700',
  2: 'bg-[#F2F9EC] border-[#C8E9A8] text-[#538A22]',
  3: 'bg-gray-100 border-gray-300 text-gray-500',
}

const BIN_CARD_LEFT: Record<1 | 2 | 3, string> = {
  1: 'border-l-amber-400',
  2: 'border-l-[#6EA832]',
  3: 'border-l-gray-300',
}

// ─── Range bar (foundation-style) ────────────────────────────────────────────
// Coloured zone track  +  dot marker at patient value  +  axis labels

function RangeBar({ s }: { s: AbundantSpecies }) {
  // Scale so there's always right-hand headroom past bin2_max
  const scaleMax = Math.max(
    s.bin2_max * 1.5,
    s.patient_value * 1.1,
    s.bin1_max * 4,
    0.0001,
  )
  const pct = (v: number) =>
    Math.max(0, Math.min(98, (v / scaleMax) * 100))

  const bin1Pct  = pct(s.bin1_max)
  const bin2Pct  = pct(s.bin2_max)
  const valuePct = pct(s.patient_value)
  const dotColor = BIN_DOT_COLOR[s.bin]

  // Format value label: trim trailing zeros but keep at least 3 sig figs
  const fmt = (n: number) => {
    if (n >= 1)    return n.toFixed(3)
    if (n >= 0.01) return n.toFixed(3)
    return n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '.0')
  }

  return (
    <div className="mt-4">

      {/* Patient value label floats above the dot */}
      <div className="relative h-5 mb-0.5">
        <span
          className="absolute bottom-0 text-[11px] font-mono font-semibold leading-none"
          style={{
            left:      `${valuePct}%`,
            transform: 'translateX(-50%)',
            color:     dotColor,
          }}
        >
          {fmt(s.patient_value)}
        </span>
      </div>

      {/* Track + dot - outer div has overflow:visible so dot can poke out */}
      <div className="relative" style={{ height: '10px', overflow: 'visible' }}>

        {/* Coloured zone track (overflow:hidden for rounded corners) */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          {/* Low Potential zone - amber */}
          <div
            className="absolute top-0 h-full bg-amber-100"
            style={{ left: 0, width: `${bin1Pct}%` }}
          />
          {/* Optimal Potential zone - pista green */}
          <div
            className="absolute top-0 h-full bg-[#E2F3D0]"
            style={{ left: `${bin1Pct}%`, width: `${Math.max(0, bin2Pct - bin1Pct)}%` }}
          />
          {/* Above Optimal zone - grey */}
          <div
            className="absolute top-0 h-full bg-gray-100"
            style={{ left: `${bin2Pct}%`, right: 0 }}
          />
        </div>

        {/* Boundary tick marks */}
        <div
          className="absolute top-0 h-full w-px bg-amber-300 opacity-60"
          style={{ left: `${bin1Pct}%` }}
        />
        <div
          className="absolute top-0 h-full w-px bg-[#C8E9A8]"
          style={{ left: `${bin2Pct}%` }}
        />

        {/* Dot marker - positioned on the outer div (not clipped) */}
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-sm"
          style={{
            left:            `${valuePct}%`,
            top:             '50%',
            transform:       'translate(-50%, -50%)',
            backgroundColor: dotColor,
            zIndex:          10,
          }}
        />
      </div>

      {/* Axis labels */}
      <div className="relative h-5 mt-2">
        <span className="absolute left-0 text-[9px] font-mono text-gray-400">0</span>

        <span
          className="absolute text-[9px] font-mono text-amber-500"
          style={{ left: `${bin1Pct}%`, transform: 'translateX(-50%)' }}
        >
          {fmt(s.bin1_max)}
        </span>

        <span
          className="absolute text-[9px] font-mono text-[#538A22]"
          style={{ left: `${bin2Pct}%`, transform: 'translateX(-50%)' }}
        >
          {fmt(s.bin2_max)}
        </span>
      </div>
    </div>
  )
}

// ─── Species card ─────────────────────────────────────────────────────────────

function SpeciesCard({ s }: { s: AbundantSpecies }) {
  return (
    <div
      className={`bg-white border border-[#E2F3D0] border-l-4 ${BIN_CARD_LEFT[s.bin]} rounded-xl px-5 py-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium italic text-gray-900 leading-snug">
          {s.name}
        </span>
        <span
          className={`flex-shrink-0 text-[10px] font-mono px-2 py-0.5 rounded border ${BIN_BADGE[s.bin]}`}
        >
          {BIN_LABEL[s.bin]}
        </span>
      </div>

      <RangeBar s={s} />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AbundantSpeciesPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)

  const [kingdomFilter, setKingdomFilter] = useState<'all' | Kingdom>('all')
  const [binFilter,     setBinFilter]     = useState<'all' | 1 | 2 | 3>('all')

  const species: AbundantSpecies[] = useMemo(() => {
    const raw = (report?.report_data as any)?.abundant_species
    return Array.isArray(raw) ? raw : []
  }, [report])

  const byKingdom = useMemo(() => {
    const m = new Map<Kingdom, AbundantSpecies[]>()
    for (const k of KINGDOM_ORDER) m.set(k, [])
    for (const s of species) m.get(s.kingdom)?.push(s)
    return m
  }, [species])

  const binCounts = useMemo(() => ({
    1: species.filter(s => s.bin === 1).length,
    2: species.filter(s => s.bin === 2).length,
    3: species.filter(s => s.bin === 3).length,
  }), [species])

  const getSectionData = useMemo(
    () => (rep: { report_data: Record<string, unknown> | null }) => ({
      abundant_species: (rep.report_data as any)?.abundant_species,
      total:            species.length,
      low_potential:    species.filter(s => s.bin === 1).map(s => s.name),
      optimal:          species.filter(s => s.bin === 2).map(s => s.name),
      above_optimal:    species.filter(s => s.bin === 3).map(s => s.name),
    }),
    [species],
  )

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'Top Abundant Species',
    getSectionData,
    species.length > 0,
  )

  if (loading) return <SectionLoading />
  if (!report)  return null

  // Visible list after filters
  const filtered = species
    .filter(s => kingdomFilter === 'all' || s.kingdom === kingdomFilter)
    .filter(s => binFilter     === 'all' || s.bin     === binFilter)

  return (
    <SectionPageShell
      reportId={id}
      section="abundant-species"
      label="Top Abundant Species"
      patientName={report.patient_name}
      pageData={{
        total:         species.length,
        low_potential: binCounts[1],
        optimal:       binCounts[2],
        above_optimal: binCounts[3],
        ...buildAiContextFields(analysis, analysing, error),
      }}
    >
      <SectionHeader reportId={id} title="Top Abundant Species" />

      {/* ── No data ────────────────────────────────────────────────────── */}
      {species.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center mb-6">
          <p className="text-sm font-medium text-amber-800 mb-1">
            No abundant species data found
          </p>
          <p className="text-xs text-amber-600">
            Re-upload this report to extract Abundant Species data.
          </p>
        </div>
      )}

      {species.length > 0 && (
        <>
          {/* ── Stats grid ───────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total tracked',  value: species.length,  style: 'bg-white border-[#E2F3D0] text-gray-700' },
              { label: 'Low potential',  value: binCounts[1],    style: 'bg-amber-50 border-amber-200 text-amber-600' },
              { label: 'Optimal',        value: binCounts[2],    style: 'bg-[#F2F9EC] border-[#C8E9A8] text-[#538A22]' },
              { label: 'Above optimal',  value: binCounts[3],    style: 'bg-gray-50 border-gray-200 text-gray-500' },
            ].map(c => (
              <div key={c.label} className={`border rounded-xl p-4 text-center ${c.style}`}>
                <div className="text-2xl font-bold mb-1">{c.value}</div>
                <div className="text-[10px] font-mono uppercase tracking-wide opacity-70">
                  {c.label}
                </div>
              </div>
            ))}
          </div>

          {/* ── Info box ─────────────────────────────────────────────── */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
            <p className="text-[10px] font-mono text-blue-500 uppercase tracking-widest mb-2">
              What is this section
            </p>
            <p className="text-sm text-blue-900 leading-relaxed">
              The 5 most abundant species in each kingdom (Bacteria, Archaea, Fungi,
              Eukaryota, Viruses). BugSpeaks classifies each into{' '}
              <strong>Low Potential</strong>, <strong>Optimal Potential</strong>, or{' '}
              <strong>Above Optimal</strong> - high abundance isn&apos;t automatically
              beneficial; current research hasn&apos;t confirmed whether extra potential
              beyond the optimal range helps or creates imbalance.
            </p>
          </div>

          {/* ── Bar legend ───────────────────────────────────────────── */}
          <div className="flex items-center gap-6 mb-5 px-1">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2.5 rounded-sm bg-amber-100 border border-amber-200" />
              <span className="text-[10px] font-mono text-gray-500">Low Potential</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2.5 rounded-sm bg-[#E2F3D0] border border-[#C8E9A8]" />
              <span className="text-[10px] font-mono text-gray-500">Optimal Potential</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2.5 rounded-sm bg-gray-100 border border-gray-200" />
              <span className="text-[10px] font-mono text-gray-500">Above Optimal</span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <div className="w-3.5 h-3.5 rounded-full bg-[#538A22] border-2 border-white shadow-sm" />
              <span className="text-[10px] font-mono text-gray-500">Patient value</span>
            </div>
          </div>

          {/* ── Filters ──────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {/* Kingdom filters */}
            <button
              onClick={() => setKingdomFilter('all')}
              className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition
                ${kingdomFilter === 'all'
                  ? 'bg-[#1A3207] text-white border-[#1A3207]'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
            >
              All kingdoms
            </button>

            {KINGDOM_ORDER.filter(k => (byKingdom.get(k)?.length ?? 0) > 0).map(k => (
              <button
                key={k}
                onClick={() => setKingdomFilter(k)}
                className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition
                  ${kingdomFilter === k
                    ? 'bg-[#1A3207] text-white border-[#1A3207]'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
              >
                {KINGDOM_ICON[k]} {k} ({byKingdom.get(k)?.length})
              </button>
            ))}

            <span className="text-gray-200 select-none">|</span>

            {/* Bin filters */}
            {([1, 2, 3] as const).map(b => (
              <button
                key={b}
                onClick={() => setBinFilter(binFilter === b ? 'all' : b)}
                className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition
                  ${binFilter === b
                    ? 'bg-[#1A3207] text-white border-[#1A3207]'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
              >
                {BIN_LABEL[b]} ({binCounts[b]})
              </button>
            ))}
          </div>

          {/* ── Species list ─────────────────────────────────────────── */}
          {kingdomFilter === 'all' ? (
            KINGDOM_ORDER
              .filter(k => (byKingdom.get(k)?.length ?? 0) > 0)
              .map(k => {
                const list = (byKingdom.get(k) ?? []).filter(
                  s => binFilter === 'all' || s.bin === binFilter,
                )
                if (list.length === 0) return null
                return (
                  <div key={k} className="mb-7">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">{KINGDOM_ICON[k]}</span>
                      <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">
                        {k}
                      </p>
                    </div>
                    <div className="space-y-3">
                      {list.map(s => (
                        <SpeciesCard key={`${s.kingdom}-${s.name}`} s={s} />
                      ))}
                    </div>
                  </div>
                )
              })
          ) : (
            <div className="space-y-3 mb-6">
              {filtered.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-10 font-mono">
                  No species match the selected filters.
                </p>
              )}
              {filtered.map(s => (
                <SpeciesCard key={`${s.kingdom}-${s.name}`} s={s} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── AI panel ─────────────────────────────────────────────────── */}
      <SectionAiPanel
        analysis={analysis}
        analysing={analysing}
        error={error}
        onRegenerate={() => report && analyse(report)}
        loadingMessage="Analysing abundant species profile…"
      />
    </SectionPageShell>
  )
}