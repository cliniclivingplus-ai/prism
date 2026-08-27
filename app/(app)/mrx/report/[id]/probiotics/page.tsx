'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { SectionHeader } from '@/components/mrx/SectionHeader'
import SectionAiPanel from '@/components/mrx/SectionAiPanel'
import SectionPageShell, { SectionLoading } from '@/components/mrx/SectionPageShell'
import { buildAiContextFields, useSectionAnalysis, useSectionReport } from '@/lib/mrx/sectionPage'

const PROBIOTIC_BENEFITS: Record<string, string> = {
  'Lactobacillus acidophilus':      'Lactase production, gut barrier, immune modulation',
  'Lactobacillus amylovorus':       'Starch degradation, colonisation resistance',
  'Lactobacillus bulgaricus':       'Lactose digestion, yoghurt fermentation',
  'Lacticaseibacillus casei':       'IBS symptom relief, immune support',
  'Lactobacillus caucasicus':       'Dairy fermentation, anti-inflammatory',
  'Lactobacillus crispatus':        'Vaginal health, colonisation resistance',
  'Lactobacillus delbrueckii':      'Lactic acid production, gut pH balance',
  'Lactobacillus gallinarum':       'Bile salt metabolism, cholesterol reduction',
  'Lactobacillus gasseri':          'Weight management, metabolic health',
  'Lactobacillus helveticus':       'Blood pressure regulation, calcium absorption',
  'Lactobacillus jensenii':         'Mucosal immunity, H2O2 production',
  'Lactobacillus johnsonii':        'H. pylori inhibition, gut barrier support',
  'Lactobacillus lactis':           'Lactic acid, nisin production',
  'Lactobacillus pentosus':         'Fibre fermentation, immune activation',
  'Lacticaseibacillus paracasei':   'IBS relief, immune modulation',
  'Lactiplantibacillus plantarum':  'IBS, anxiety, gut barrier integrity',
  'Lacticaseibacillus rhamnosus':   'Diarrhoea prevention, gut barrier, allergy',
  'Levilactobacillus brevis':       'GABA production, anti-inflammatory',
  'Ligilactobacillus salivarius':   'Oral health, bacteriocin production',
  'Limosilactobacillus fermentum':  'Antioxidant, gut barrier, iron absorption',
  'Limosilactobacillus reuteri':    'Colic, H. pylori, serotonin, gut motility',
  'Bifidobacterium adolescentis':   'Acetate, B vitamins, immune maturation',
  'Bifidobacterium animalis':       'Transit time, IBS, immune support',
  'Bifidobacterium bifidum':        'Mucosal immunity, IgA production',
  'Bifidobacterium breve':          'Infant microbiome, allergy, eczema',
  'Bifidobacterium infantis':       'IBS-C, mucosal immunity, colonisation',
  'Bifidobacterium lactis':         'Immune enhancement, transit time',
  'Bifidobacterium longum':         'GABA, anxiety, gut-brain axis',
  'Akkermansia muciniphila':        'Gut barrier, metabolic health, weight',
  'Bacillus clausii':               'Antibiotic-associated diarrhoea, spore-forming',
  'Bacillus coagulans':             'IBS, spore-forming, heat-stable',
  'Bacillus indicus':               'Carotenoid production, spore-forming',
  'Bacillus subtilis':              'Pathogen inhibition, enzyme production',
  'Clostridium butyricum':          'Butyrate production, IBD support',
  'Enterococcus faecium':           'Colonisation resistance, immune modulation',
  'Lactococcus lactis':             'Nisin production, dairy fermentation',
  'Leuconostoc mesenteroides':      'Fermentation, dextran production',
  'Pediococcus acidilactici':       'Bacteriocin, probiotic stability',
  'Saccharomyces boulardii':        'Diarrhoea, C. diff, antibiotic recovery',
  'Saccharomyces cerevisiae':       'Immune modulation, gut barrier',
  'Streptococcus salivarius':       'Oral health, BLIS production',
  'Streptococcus thermophilus':     'Lactose digestion, yoghurt starter',
}

const CATEGORY_CONFIG = {
  absent: {
    label: 'Absent',
    sublabel: 'Supplementation needed',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700 border-red-200',
    dot: 'bg-red-500',
    alert: true,
  },
  low_optimal: {
    label: 'Low optimal',
    sublabel: 'Follow recommendations',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    alert: true,
  },
  high_optimal: {
    label: 'High optimal',
    sublabel: 'Follow recommendations',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
    dot: 'bg-orange-500',
    alert: false,
  },
  optimal: {
    label: 'Optimal',
    sublabel: 'Continue current diet',
    bg: 'bg-[#F2F9EC]',
    border: 'border-[#C8E9A8]',
    text: 'text-green-700',
    badge: 'bg-green-100 text-green-700 border-[#C8E9A8]',
    dot: 'bg-[#F2F9EC]0',
    alert: false,
  },
  atypical_high: {
    label: 'Atypical high',
    sublabel: 'Avoid supplementation',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
    alert: true,
  },
}

type ProbioticCategory = keyof typeof CATEGORY_CONFIG
// Add this type near the top (after CATEGORY_CONFIG)
type ProbioticsData = Record<ProbioticCategory, string[]>

export default function ProbioticsPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)
  const [activeFilter, setActiveFilter] = useState<'all' | ProbioticCategory>('all')

  const getSectionData = useMemo(
    () => (rep: { report_data: Record<string, unknown> | null }) => rep.report_data?.probiotics,
    []
  )

  const probioticsPreview = (report?.report_data?.probiotics ?? {}) as Record<string, string[]>
  const hasDataPreview = Object.values(probioticsPreview).some(v => Array.isArray(v) && v.length > 0)

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report,
    'Probiotic Status',
    getSectionData,
    hasDataPreview
  )

  if (loading) return <SectionLoading />
  if (!report) return null

  const probiotics = (report.report_data?.probiotics || {
    absent: [], low_optimal: [], high_optimal: [], optimal: [], atypical_high: []
  }) as ProbioticsData

  const hasData = Object.values(probiotics).some((v: any) => v?.length > 0)

  const totalTracked = Object.values(probiotics).reduce((sum: number, arr: any) => sum + (arr?.length || 0), 0)
  const optimalCount = (probiotics.optimal?.length || 0) + (probiotics.high_optimal?.length || 0)

  // Build flat list for filtered view
  type ProbioticItem = { name: string; category: ProbioticCategory; benefits: string }
  const allItems: ProbioticItem[] = []
  for (const cat of Object.keys(CATEGORY_CONFIG) as ProbioticCategory[]) {
    for (const name of (probiotics[cat] || [])) {
      allItems.push({
        name,
        category: cat,
        benefits: PROBIOTIC_BENEFITS[name] || 'Clinical probiotic',
      })
    }
  }

  const filtered = activeFilter === 'all'
    ? allItems
    : allItems.filter(p => p.category === activeFilter)

  const pageData = {
    total_tracked: totalTracked,
    optimal_count: optimalCount,
    absent_count: probiotics.absent?.length ?? 0,
    ...buildAiContextFields(analysis, analysing, error),
  }

  return (
    <SectionPageShell
      reportId={id}
      section="probiotics"
      label="Probiotic Status"
      patientName={report.patient_name}
      pageData={pageData}
    >
      <SectionHeader reportId={id} title="Probiotic Status" />

      {!hasData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3
          text-sm text-amber-700 mb-6">
          ⚠️ No probiotic data found. Re-upload the PDF to extract probiotic status.
        </div>
      )}

      {hasData && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {(Object.keys(CATEGORY_CONFIG) as ProbioticCategory[]).map(cat => {
              const config = CATEGORY_CONFIG[cat]
              const count = probiotics[cat]?.length || 0
              return (
                <div key={cat}
                  className={`border rounded-xl p-4 text-center ${config.bg} ${config.border}`}>
                  <div className={`text-2xl font-bold mb-1 ${config.text}`}>{count}</div>
                  <div className={`text-xs font-mono uppercase tracking-wide ${config.text}`}>
                    {config.label}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Coverage bar */}
          <div className="bg-white border border-[#E2F3D0] rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">
                Optimal coverage
              </p>
              <span className="text-xs font-mono text-gray-500">
                {optimalCount} of {totalTracked} in optimal range
              </span>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
              {(Object.keys(CATEGORY_CONFIG) as ProbioticCategory[]).map(cat => {
                const count = probiotics[cat]?.length || 0
                const pct = totalTracked > 0 ? (count / totalTracked) * 100 : 0
                if (pct === 0) return null
                const barColors: Record<string, string> = {
                  absent: 'bg-red-400', low_optimal: 'bg-amber-400',
                  high_optimal: 'bg-orange-400', optimal: 'bg-[#F2F9EC]0', atypical_high: 'bg-purple-400'
                }
                return (
                  <div key={cat}
                    className={`h-full ${barColors[cat]} transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                    title={`${CATEGORY_CONFIG[cat].label}: ${count}`}
                  />
                )
              })}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-2">
              {(Object.keys(CATEGORY_CONFIG) as ProbioticCategory[]).map(cat => {
                const count = probiotics[cat]?.length || 0
                if (count === 0) return null
                const config = CATEGORY_CONFIG[cat]
                return (
                  <div key={cat} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                    <span className="text-xs font-mono text-gray-500">
                      {config.label} ({count})
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Alert for absent */}
          {(probiotics.absent?.length || 0) > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
              <p className="text-xs font-mono text-red-700 uppercase tracking-wide font-medium mb-3">
                {probiotics.absent.length} probiotics absent - supplementation may be considered
              </p>
              <div className="grid grid-cols-2 gap-2">
                {probiotics.absent.map((name: string) => (
                  <div key={name} className="flex items-start gap-2">
                    <span className="text-red-400 flex-shrink-0 text-xs mt-0.5">✗</span>
                    <div>
                      <span className="text-xs font-medium text-red-800 italic">{name}</span>
                      {PROBIOTIC_BENEFITS[name] && (
                        <p className="text-xs text-red-600">{PROBIOTIC_BENEFITS[name]}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setActiveFilter('all')}
              className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition
                ${activeFilter === 'all'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
            >
              All ({totalTracked})
            </button>
            {(Object.keys(CATEGORY_CONFIG) as ProbioticCategory[]).map(cat => {
              const count = probiotics[cat]?.length || 0
              if (count === 0) return null
              const config = CATEGORY_CONFIG[cat]
              return (
                <button
                  key={cat}
                  onClick={() => setActiveFilter(cat)}
                  className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition
                    ${activeFilter === cat
                      ? `${config.bg} ${config.text} ${config.border}`
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                >
                  {config.label} ({count})
                </button>
              )
            })}
          </div>

          {/* Probiotic list */}
          <div className="space-y-2 mb-6">
            {filtered.map(p => {
              const config = CATEGORY_CONFIG[p.category]
              return (
                <div
                  key={`${p.name}-${p.category}`}
                  className={`border rounded-xl p-4 flex items-start justify-between
                    gap-3 flex-wrap ${config.bg} ${config.border}`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${config.dot}`} />
                    <div>
                      <div className={`text-sm font-medium italic text-gray-900`}>
                        {p.name}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{p.benefits}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono px-2 py-0.5 rounded border
                      ${config.badge}`}>
                      {config.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* What each category means */}
          <div className="bg-white border border-[#E2F3D0] rounded-xl p-5 mb-6">
            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-4">
              What each category means
            </p>
            <div className="space-y-3">
              {(Object.keys(CATEGORY_CONFIG) as ProbioticCategory[]).map(cat => {
                const config = CATEGORY_CONFIG[cat]
                return (
                  <div key={cat} className={`flex items-start gap-3 px-4 py-3
                    rounded-xl border ${config.bg} ${config.border}`}>
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${config.dot}`} />
                    <div>
                      <span className={`text-xs font-medium ${config.text}`}>
                        {config.label}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">- {config.sublabel}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <SectionAiPanel
            analysis={analysis}
            analysing={analysing}
            error={error}
            onRegenerate={() => report && analyse(report)}
            loadingMessage="Analysing probiotic profile…"
          />
        </>
      )}
    </SectionPageShell>
  )
}
