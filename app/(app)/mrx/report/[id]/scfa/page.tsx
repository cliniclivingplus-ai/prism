'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { SectionHeader } from '@/components/mrx/SectionHeader'
import SectionAiPanel from '@/components/mrx/SectionAiPanel'
import SectionPageShell, { SectionLoading } from '@/components/mrx/SectionPageShell'
import { buildAiContextFields, useSectionAnalysis, useSectionReport } from '@/lib/mrx/sectionPage'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SCFAItem {
  name: string
  score: number
  low_ref: number
  high_ref: number
}

interface SCFAData {
  acetate?: number
  propionate?: number
  butyrate?: number
  isobutyric_acid?: number
  valeric_acid?: number
  isovaleric_acid?: number
  methylbutyric_acid?: number
  formate?: number
  caproate?: number
}

// ─── Reference ranges ─────────────────────────────────────────────────────────

const SCFA_REFS: Record<string, { label: string; low_ref: number; high_ref: number; clinical_note: string }> = {
  acetate:           { label: 'Acetate',              low_ref: 71.72, high_ref: 88.54,  clinical_note: 'Primary energy source for peripheral tissues; produced by Bifidobacterium and Bacteroides. Low levels suggest reduced fibre fermentation.' },
  propionate:        { label: 'Propionate',            low_ref: 53.96, high_ref: 68.416, clinical_note: 'Signals satiety via gut-brain axis; supports hepatic gluconeogenesis. Elevated levels may suppress acetate and butyrate production.' },
  butyrate:          { label: 'Butyrate',              low_ref: 59.94, high_ref: 71.932, clinical_note: 'Primary fuel for colonocytes; anti-inflammatory, strengthens gut barrier (tight junctions), inhibits colorectal cancer cell proliferation.' },
  isobutyric_acid:   { label: 'Isobutyric Acid',       low_ref: 63.2,  high_ref: 78.218, clinical_note: 'Branched-chain SCFA from protein fermentation. Low levels indicate reduced proteolytic fermentation.' },
  valeric_acid:      { label: 'Valeric Acid',          low_ref: 71.05, high_ref: 98.24,  clinical_note: 'Emerging SCFA linked to anti-inflammatory activity. Significantly low - may reflect a depleted Lachnospiraceae population.' },
  isovaleric_acid:   { label: 'Isovaleric Acid',       low_ref: 48.48, high_ref: 63.065, clinical_note: 'Branched-chain SCFA produced from leucine/valine catabolism. Low levels suggest limited amino acid fermentation.' },
  methylbutyric_acid:{ label: '2-Methylbutyric Acid',  low_ref: 25.36, high_ref: 62.06,  clinical_note: 'Above-optimal branched-chain SCFA. High levels may indicate excess protein fermentation in the colon - a sign of proteolytic dysbiosis.' },
  formate:           { label: 'Formate',               low_ref: 61.58, high_ref: 74.429, clinical_note: 'One-carbon unit donor; involved in nucleotide synthesis. Elevated formate may reflect increased Prevotella activity.' },
  caproate:          { label: 'Caproate (Hexanoate)',  low_ref: 43.31, high_ref: 71.124, clinical_note: 'Medium-chain fatty acid with antimicrobial properties; can be cytotoxic to colonocytes at high levels.' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBin(score: number, low_ref: number, high_ref: number): 'low' | 'optimal' | 'high' {
  if (score < low_ref)  return 'low'
  if (score > high_ref) return 'high'
  return 'optimal'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BinBadge({ bin }: { bin: 'low' | 'optimal' | 'high' }) {
  const styles = {
    low:     'bg-orange-100 text-orange-700 border-orange-200',
    optimal: 'bg-[#E2F3D0] text-[#3D6B16] border-[#A8D878]',
    high:    'bg-red-100 text-red-700 border-red-200',
  }
  const labels = { low: 'Low', optimal: 'Optimal', high: 'High Atypical' }
  return (
    <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded border ${styles[bin]}`}>
      {labels[bin]}
    </span>
  )
}

function SCFABar({ item }: { item: SCFAItem }) {
  const bin      = getBin(item.score, item.low_ref, item.high_ref)
  const barColor = bin === 'high' ? '#DC2626' : bin === 'low' ? '#EA580C' : '#538A22'
  const scorePct = Math.min(100, Math.max(0, item.score))
  const lowPct   = Math.min(100, Math.max(0, item.low_ref))
  const highPct  = Math.min(100, Math.max(0, item.high_ref))

  return (
    <div className="relative h-3 bg-gray-100 rounded-full overflow-visible">
      <div
        className="absolute top-0 h-full bg-[#E2F3D0] rounded-full"
        style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
      />
      <div
        className="absolute top-0 h-full w-2 rounded-full"
        style={{ left: `${scorePct}%`, background: barColor, transform: 'translateX(-50%)', zIndex: 10 }}
      />
    </div>
  )
}

function SCFARow({ item, refData }: { item: SCFAItem; refData: { label: string; clinical_note: string } }) {
  const [expanded, setExpanded] = useState(false)
  const bin = getBin(item.score, item.low_ref, item.high_ref)

  return (
    <div className="border border-[#E2F3D0] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-medium text-gray-800">{refData.label}</span>
            <BinBadge bin={bin} />
          </div>
          <SCFABar item={item} />
          <div className="flex justify-between text-[10px] font-mono text-gray-400 mt-1.5">
            <span>0</span>
            <span className="text-[#538A22]">Optimal: {item.low_ref}–{item.high_ref}</span>
            <span>100</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-4">
          <span
            className="text-2xl font-light tabular-nums"
            style={{ color: bin === 'high' ? '#DC2626' : bin === 'low' ? '#EA580C' : '#538A22' }}
          >
            {item.score}
          </span>
          <p className="text-[10px] text-gray-400 mt-0.5">{expanded ? '▲ hide' : '▼ details'}</p>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-[#E2F3D0] pt-3 bg-gray-50">
          <p className="text-xs text-gray-600 leading-relaxed">{refData.clinical_note}</p>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, items, color, bg }: {
  label: string; items: string[]; color: string; bg: string
}) {
  if (items.length === 0) return null
  return (
    <div className={`rounded-xl border p-4 ${bg}`} style={{ borderColor: color + '40' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color }}>
        {label} - {items.length}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(name => (
          <span key={name} className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: color + '20', color }}>
            {name}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SCFAPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)

  // Build the data object sent to the AI + clinical assistant
  const getSectionData = useMemo(
    () => (rep: { report_data: Record<string, unknown> | null }) => {
      const raw = (rep.report_data?.scfa ?? {}) as SCFAData
      return {
        scfa: raw,
        scfa_summary: Object.entries(SCFA_REFS)
          .filter(([key]) => raw[key as keyof SCFAData] != null)
          .map(([key, ref]) => {
            const score = raw[key as keyof SCFAData] as number
            return { name: ref.label, score, bin: getBin(score, ref.low_ref, ref.high_ref) }
          }),
      }
    },
    []
  )

  const raw     = (report?.report_data?.scfa ?? {}) as SCFAData
  const hasData = Object.keys(SCFA_REFS).some(k => raw[k as keyof SCFAData] != null)

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'SCFA Production Potential',
    getSectionData,
    hasData   // ← auto-triggers analysis on load when data is present
  )

  if (loading) return <SectionLoading />
  if (!report) return null

  // ── Build items ──────────────────────────────────────────────────────────
  const items: SCFAItem[] = Object.entries(SCFA_REFS)
    .filter(([key]) => raw[key as keyof SCFAData] != null)
    .map(([key, ref]) => ({
      name:     key,
      score:    raw[key as keyof SCFAData] as number,
      low_ref:  ref.low_ref,
      high_ref: ref.high_ref,
    }))

  const lowItems     = items.filter(i => getBin(i.score, i.low_ref, i.high_ref) === 'low')
  const optimalItems = items.filter(i => getBin(i.score, i.low_ref, i.high_ref) === 'optimal')
  const highItems    = items.filter(i => getBin(i.score, i.low_ref, i.high_ref) === 'high')
  const labelFor     = (key: string) => SCFA_REFS[key]?.label ?? key

  // ── Page data registered with the clinical assistant ────────────────────
  const pageData = {
    total_scfa_tracked: items.length,
    low_count:          lowItems.length,
    optimal_count:      optimalItems.length,
    high_count:         highItems.length,
    low_scfa:           lowItems.map(i => labelFor(i.name)),
    optimal_scfa:       optimalItems.map(i => labelFor(i.name)),
    high_scfa:          highItems.map(i => labelFor(i.name)),
    scfa_scores:        items.map(i => ({ name: labelFor(i.name), score: i.score, bin: getBin(i.score, i.low_ref, i.high_ref) })),
    ...buildAiContextFields(analysis, analysing, error),
  }

  return (
    <SectionPageShell
      reportId={id}
      section="scfa"
      label="SCFA Production"
      patientName={report.patient_name}
      pageData={pageData}
    >
      <SectionHeader reportId={id} title="SCFA Production" />

      <p className="text-sm text-gray-400 mb-2">
        Current capacity of gut microbes to produce short chain fatty acids · 3-bin scoring
      </p>

      <div className="flex items-center gap-4 text-xs font-mono text-gray-400 mb-8">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />
          Low potential
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#538A22] inline-block" />
          Optimal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
          Above optimal
        </span>
      </div>

      {!hasData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 mb-6">
          ⚠️ No SCFA data found for this report. Re-upload the PDF to extract scores.
        </div>
      )}

      {hasData && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <SummaryCard label="Low"          items={lowItems.map(i => labelFor(i.name))}     color="#EA580C" bg="bg-orange-50" />
            <SummaryCard label="Optimal"      items={optimalItems.map(i => labelFor(i.name))} color="#538A22" bg="bg-[#F2F9EC]" />
            <SummaryCard label="High Atypical" items={highItems.map(i => labelFor(i.name))}   color="#DC2626" bg="bg-red-50" />
          </div>

          {/* Butyrate alert */}
          {(() => {
            const butyrate = items.find(i => i.name === 'butyrate')
            if (!butyrate) return null
            const bin = getBin(butyrate.score, butyrate.low_ref, butyrate.high_ref)
            return bin === 'optimal' ? (
              <div className="bg-[#F2F9EC] border border-[#A8D878] rounded-xl px-4 py-3 text-sm text-[#3D6B16] mb-6 flex items-start gap-2">
                <span>✓</span>
                <span><strong>Butyrate is in the optimal range ({butyrate.score})</strong> - primary colonocyte fuel is well supported.</span>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 mb-6 flex items-start gap-2">
                <span>⚠️</span>
                <span><strong>Butyrate is {bin} ({butyrate.score})</strong> - clinically significant. Butyrate is the primary fuel for colonocytes and a key anti-inflammatory signal. Prioritise in supplementation and dietary advice.</span>
              </div>
            )
          })()}

          {/* Formate alert */}
          {(() => {
            const formate = items.find(i => i.name === 'formate')
            if (!formate || getBin(formate.score, formate.low_ref, formate.high_ref) !== 'high') return null
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-6 flex items-start gap-2">
                <span>⚑</span>
                <span><strong>Elevated Formate ({formate.score})</strong> may reflect high Prevotella copri activity - consistent with Prevotella dominance in this patient's foundation microbiota.</span>
              </div>
            )
          })()}

          {/* SCFA bars */}
          <div className="space-y-3 mb-10">
            {items.map(item => (
              <SCFARow key={item.name} item={item} refData={SCFA_REFS[item.name]} />
            ))}
          </div>

          {/* AI panel - same component used by all other section pages */}
          <SectionAiPanel
            analysis={analysis}
            analysing={analysing}
            error={error}
            onRegenerate={() => report && analyse(report)}
            loadingMessage="Analysing SCFA production profile…"
          />
        </>
      )}
    </SectionPageShell>
  )
}