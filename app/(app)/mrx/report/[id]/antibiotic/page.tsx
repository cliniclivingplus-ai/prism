/**
 * app/report/[id]/antibiotic/page.tsx
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

// ─── Constants ────────────────────────────────────────────────────────────────

const RECOVERY_REF_LOW  = 65.14
const RECOVERY_REF_HIGH = 88.66

const DRUG_CLASSES: Record<string, string[]> = {
  'Beta-lactams': [
    'Amoxicillin','Amoxicillin+Clavulanic_Acid','Ampicillin','Ampicillin+Clavulanic_Acid',
    'Aztreonam','Carbapenem','Cefepime','Cefixime','Cefotaxime','Cefotaxime+Clavulanic_Acid',
    'Cefoxitin','Ceftazidime','Ceftazidime+Avibactam','Ceftriaxone','Cephalothin','Cephamycin',
    'Ertapenem','Imipenem','Meropenem','Methicillin','Monobactam','Penicillin','Piperacillin',
    'Piperacillin+Tazobactam','Temocillin','Ticarcillin','Ticarcillin+Clavulanic_Acid',
  ],
  'Aminoglycosides': ['Amikacin','Gentamicin','Hygromycin','Kanamycin','Kasugamycin','Spectinomycin','Streptomycin','Tobramycin'],
  'Macrolides':      ['Azithromycin','Carbomycin','Erythromycin','Oleandomycin','Spiramycin','Telithromycin','Tylosin'],
  'Tetracyclines':   ['Doxycycline','Glycylcycline','Minocycline','Tetracenomycin','Tetracycline','Tigecycline'],
  'Fluoroquinolones':['Ciprofloxacin','Nalidixic_Acid'],
  'Glycopeptides':   ['Teicoplanin','Vancomycin'],
  'Lincosamides':    ['Clindamycin','Lincomycin','Lincosamide'],
  'Oxazolidinones':  ['Linezolid'],
  'Streptogramins':  ['Dalfopristin','Pristinamycin','Quinupristin','Quinupristin+Dalfopristin','Virginiamycin_M','Virginiamycin_S'],
  'Rifamycins':      ['Rifampin','Rifamycin'],
  'Polymyxins':      ['Colistin'],
  'Others': [
    'Aminocoumarin','Avilamycin','Benzalkonium_Chloride','Bicyclomycin','Bleomycin',
    'Diaminopyrimidine','Elfamycin','Florfenicol','Fosfomycin','Fusidic_Acid','Isoniazid',
    'Mupirocin','Nitrofuran','Nitroimidazole','Phenicol','Pleuromutilin','Rhodamine',
    'Streptothricin','Sulfamethoxazole','Thiostrepton','Tiamulin','Triclosan','Trimethoprim',
    'Viomycin','Zorbamycin',
  ],
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ResistanceEntry = { name: string; status: string; cls: string; isResistant: boolean }
type RecoveryStatus  = 'low' | 'high' | 'optimal' | 'unknown'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStringField(rd: Record<string, unknown> | null, key: string): string | null {
  const v = rd?.[key]; return typeof v === 'string' ? v : null
}
function getNumberField(rd: Record<string, unknown> | null, key: string): number | null {
  const v = rd?.[key]; return typeof v === 'number' ? v : null
}
function getResistanceMap(rd: Record<string, unknown> | null): Record<string, string> {
  const v = rd?.antibiotic_resistance
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>)
      .filter(([, s]) => typeof s === 'string')
      .map(([k, s]) => [k, s as string])
  )
}
function getDrugClass(name: string): string {
  return Object.entries(DRUG_CLASSES).find(([, names]) => names.includes(name))?.[0] || 'Others'
}
function buildResistanceEntries(map: Record<string, string>): ResistanceEntry[] {
  return Object.entries(map)
    .map(([name, status]) => ({ name, status, cls: getDrugClass(name), isResistant: status === 'Resistant' }))
    .sort((a, b) => (a.isResistant === b.isResistant ? a.name.localeCompare(b.name) : a.isResistant ? -1 : 1))
}
function getRecoveryStatus(score: number | null, tag: string | null): RecoveryStatus {
  if (score != null) {
    if (score < RECOVERY_REF_LOW)  return 'low'
    if (score > RECOVERY_REF_HIGH) return 'high'
    return 'optimal'
  }
  if (tag === 'Ideal') return 'optimal'
  if (tag === 'Non-Ideal') return 'low'
  return 'unknown'
}

// ─── Recovery bar - same style as foundation page ─────────────────────────────

function RecoveryBar({ score }: { score: number }) {
  const min    = 0
  const max    = RECOVERY_REF_HIGH * 1.3
  const range  = max - min
  const pct    = (v: number) => Math.max(0, Math.min(100, ((v - min) / range) * 100))

  const refL   = pct(RECOVERY_REF_LOW)
  const refW   = pct(RECOVERY_REF_HIGH) - refL
  const dotL   = pct(score)

  const status = getRecoveryStatus(score, null)
  const dotClr = status === 'low' ? '#f87171' : status === 'high' ? '#f59e0b' : '#6EA832'

  return (
    <div className="mt-4">
      {/* Score badge */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className={`text-4xl font-bold mb-0.5
            ${status === 'optimal' ? 'text-[#538A22]' : status === 'low' ? 'text-amber-600' : 'text-red-600'}`}>
            {score.toFixed(3)}
          </div>
          <div className="text-xs font-mono text-gray-400 uppercase tracking-wide">Recovery score</div>
        </div>
        <div className="text-right text-xs font-mono text-gray-400">
          <div>Ref range</div>
          <div className="text-[#538A22] font-medium">{RECOVERY_REF_LOW} – {RECOVERY_REF_HIGH}</div>
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-3 bg-gray-100 rounded-full overflow-visible mb-2">
        {/* Reference zone */}
        <div
          className="absolute top-0 h-full rounded-full bg-[#C8E9A8]"
          style={{ left: `${refL}%`, width: `${refW}%` }}
        />
        {/* Patient dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4
                     rounded-full border-2 border-white shadow-md z-10"
          style={{ left: `${dotL}%`, backgroundColor: dotClr }}
        />
      </div>

      {/* Axis labels */}
      <div className="flex justify-between text-[10px] font-mono text-gray-400">
        <span>{min}</span>
        <span className="text-[#538A22]">{RECOVERY_REF_LOW} – {RECOVERY_REF_HIGH}</span>
        <span>{max.toFixed(0)}</span>
      </div>

      {/* Status message */}
      <div className={`mt-4 rounded-xl border p-4 text-sm leading-relaxed
        ${status === 'optimal' ? 'bg-[#F2F9EC] border-[#C8E9A8] text-[#3D6B16]' :
          status === 'low'     ? 'bg-amber-50 border-amber-200 text-amber-800'    :
                                 'bg-red-50 border-red-200 text-red-700'}`}>
        {status === 'optimal' && <>
          ✓ <strong>Good recovery potential.</strong> Score is within the healthy reference range ({RECOVERY_REF_LOW}–{RECOVERY_REF_HIGH}).
          The microbiome has sufficient resilience to recover post-antibiotic treatment.
          Probiotic supplementation during the course is still recommended.
        </>}
        {status === 'low' && <>
          ⚠ <strong>Below reference range.</strong> Score ({score.toFixed(3)}) is below the healthy range ({RECOVERY_REF_LOW}–{RECOVERY_REF_HIGH}).
          The microbiome may struggle to recover after antibiotics.
          Strong probiotic and prebiotic support during and after the course is recommended.
        </>}
        {status === 'high' && <>
          ↑ <strong>Above reference range.</strong> Score ({score.toFixed(3)}) is above the upper limit ({RECOVERY_REF_HIGH}).
          Clinical correlation recommended.
        </>}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AntibioticsPage() {
  const id = useParams().id as string
  const { report, loading } = useSectionReport(id)
  const [search, setSearch]         = useState('')
  const [activeClass, setActiveClass] = useState('All')
  const [activeTab, setActiveTab]   = useState<'resistance' | 'recovery'>('resistance')
  const [viewMode, setViewMode]     = useState<'split' | 'all'>('split')

  const getSectionData = useMemo(
    () => (rep: SectionReport) => {
      const rd  = rep.report_data
      const map = getResistanceMap(rd)
      const entries = buildResistanceEntries(map)
      return {
        recovery_score:       getNumberField(rd, 'antibiotic_recovery'),
        recovery_tag:         getStringField(rd, 'antibiotic_recovery_tag'),
        recovery_status:      getRecoveryStatus(getNumberField(rd, 'antibiotic_recovery'), getStringField(rd, 'antibiotic_recovery_tag')),
        resistance_tag:       getStringField(rd, 'antibiotic_resistance_tag'),
        total_antibiotics:    entries.length,
        resistant_count:      entries.filter(e => e.isResistant).length,
        resistant_antibiotics:entries.filter(e => e.isResistant).map(e => ({ name: e.name, class: e.cls })),
      }
    },
    [],
  )

  const { analysing, analysis, error, analyse } = useSectionAnalysis(
    report, 'antibiotic_resistance_recovery', getSectionData,
  )

  if (loading) return <SectionLoading />
  if (!report)  return null

  const rd             = report.report_data
  const resistanceMap  = getResistanceMap(rd)
  const allEntries     = buildResistanceEntries(resistanceMap)
  const resistantEntries = allEntries.filter(e => e.isResistant)
  const sensitiveEntries = allEntries.filter(e => !e.isResistant)
  const resistanceTag  = getStringField(rd, 'antibiotic_resistance_tag')
  const recoveryTag    = getStringField(rd, 'antibiotic_recovery_tag')
  const recoveryScore  = getNumberField(rd, 'antibiotic_recovery')
  const recoveryStatus = getRecoveryStatus(recoveryScore, recoveryTag)
  const hasNoData      = allEntries.length === 0 && recoveryScore == null && !recoveryTag

  const filtered = allEntries.filter(e => {
    const matchClass  = activeClass === 'All' || e.cls === activeClass
    const matchSearch = e.name.toLowerCase().replace(/_/g, ' ').includes(search.toLowerCase())
    return matchClass && matchSearch
  })
  const filteredResistant = filtered.filter(e => e.isResistant)
  const filteredSensitive = filtered.filter(e => !e.isResistant)

  return (
    <SectionPageShell
      reportId={id}
      section="antibiotic"
      label="Antibiotic Resistance & Recovery"
      patientName={report.patient_name}
      pageData={{
        resistant_count:   resistantEntries.length,
        sensitive_count:   sensitiveEntries.length,
        total_antibiotics: allEntries.length,
        resistance_tag:    resistanceTag,
        recovery_score:    recoveryScore,
        recovery_tag:      recoveryTag,
        recovery_status:   recoveryStatus,
        ...buildAiContextFields(analysis, analysing, error),
      }}
    >
      <SectionHeader reportId={id} title="Antibiotic Resistance & Recovery" />

      <div className="space-y-5">

        {/* ── Disclaimer ───────────────────────────────────────────────── */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-800 leading-relaxed">
          ⚠️ Identifies <strong>acquired resistance genes</strong> from metagenomic sequencing -
          not equivalent to standard AST/MIC testing. Results should be interpreted alongside
          clinical presentation and validated microbiology data before treatment decisions.
        </div>

        {/* ── Tab switcher ─────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-100 shadow-sm w-fit">
          {(['resistance', 'recovery'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-sm font-medium px-5 py-2 rounded-lg transition-colors
                ${activeTab === tab ? 'bg-[#538A22] text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab === 'resistance' ? 'Antibiotic Resistance' : 'Recovery Potential'}
            </button>
          ))}
        </div>

        {/* ════════ RESISTANCE TAB ════════════════════════════════════════ */}
        {activeTab === 'resistance' && (
          <>
            {/* Summary stats */}
            {!hasNoData && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-amber-600 mb-1">{resistantEntries.length}</div>
                  <div className="text-[10px] font-mono text-amber-600 uppercase tracking-wide">Resistant</div>
                </div>
                <div className="bg-[#F2F9EC] border border-[#C8E9A8] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[#538A22] mb-1">{sensitiveEntries.length}</div>
                  <div className="text-[10px] font-mono text-[#538A22] uppercase tracking-wide">Sensitive</div>
                </div>
                <div className="bg-white border border-[#E2F3D0] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-gray-700 mb-1">{allEntries.length}</div>
                  <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wide">
                    {resistanceTag ? `Tracked · ${resistanceTag}` : 'Total tracked'}
                  </div>
                </div>
              </div>
            )}

            {/* Resistant alert */}
            {resistantEntries.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <p className="text-xs font-mono text-amber-800 uppercase tracking-wide font-medium mb-3">
                  ⚠ {resistantEntries.length} resistance gene{resistantEntries.length > 1 ? 's' : ''} detected - clinical review recommended
                </p>
                <div className="flex flex-wrap gap-2">
                  {resistantEntries.map(e => (
                    <span key={e.name}
                      className="text-xs font-medium px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                      {e.name.replace(/_/g, ' ')}
                      <span className="text-amber-500 font-normal ml-1">· {e.cls}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {resistantEntries.length === 0 && allEntries.length > 0 && (
              <div className="bg-[#F2F9EC] border border-[#C8E9A8] rounded-xl p-5 flex items-center gap-3">
                <span className="text-2xl">✓</span>
                <div>
                  <p className="text-sm font-semibold text-[#1A3207]">No antibiotic resistance genes detected</p>
                  <p className="text-xs text-[#538A22] mt-0.5">All {allEntries.length} tracked antibiotics show Sensitive status</p>
                </div>
              </div>
            )}

            {hasNoData && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
                <p className="text-sm font-medium text-amber-800 mb-1">No resistance data found</p>
                <p className="text-xs text-amber-600">Re-upload this report to extract antibiotic resistance data.</p>
              </div>
            )}

            {!hasNoData && (
              <>
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    placeholder="Search antibiotic..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="text-xs font-mono border border-gray-200 rounded-lg px-3 py-1.5
                               bg-white placeholder-gray-300 focus:outline-none focus:border-[#538A22] w-44"
                  />
                  <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-0.5">
                    {(['split', 'all'] as const).map(mode => (
                      <button key={mode} onClick={() => setViewMode(mode)}
                        className={`text-xs px-3 py-1 rounded-md font-medium transition
                          ${viewMode === mode ? 'bg-gray-900 text-white' : 'text-gray-500'}`}>
                        {mode === 'split' ? 'Split view' : 'Full list'}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {['All', ...Object.keys(DRUG_CLASSES)].map(cls => (
                      <button key={cls} onClick={() => setActiveClass(cls)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition font-mono
                          ${activeClass === cls
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                        {cls}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Split view */}
                {viewMode === 'split' && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
                      <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                        <span className="text-sm font-semibold text-amber-800">⚠ Resistant</span>
                        <span className="text-xs font-mono text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                          {filteredResistant.length}
                        </span>
                      </div>
                      <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
                        {filteredResistant.length === 0
                          ? <p className="px-4 py-6 text-xs text-gray-400 italic text-center">None detected ✓</p>
                          : filteredResistant.map(e => (
                            <div key={e.name} className="px-4 py-2.5 flex items-center justify-between gap-3 bg-amber-50">
                              <div>
                                <p className="text-sm font-medium text-amber-900">{e.name.replace(/_/g, ' ')}</p>
                                <p className="text-xs text-amber-500">{e.cls}</p>
                              </div>
                              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-800 border border-amber-300 shrink-0">
                                Resistant
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-[#C8E9A8] overflow-hidden">
                      <div className="px-4 py-3 bg-[#F2F9EC] border-b border-[#E2F3D0] flex items-center justify-between">
                        <span className="text-sm font-semibold text-[#3D6B16]">✓ Sensitive</span>
                        <span className="text-xs font-mono text-[#538A22] bg-[#E2F3D0] px-2 py-0.5 rounded-full border border-[#A8D878]">
                          {filteredSensitive.length}
                        </span>
                      </div>
                      <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
                        {filteredSensitive.length === 0
                          ? <p className="px-4 py-6 text-xs text-gray-400 italic text-center">No results</p>
                          : filteredSensitive.map(e => (
                            <div key={e.name} className="px-4 py-2.5 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-gray-700">{e.name.replace(/_/g, ' ')}</p>
                                <p className="text-xs text-gray-400">{e.cls}</p>
                              </div>
                              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#E2F3D0] text-[#3D6B16] border border-[#A8D878] shrink-0">
                                Sensitive
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Full list */}
                {viewMode === 'all' && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">All Antibiotics</span>
                      <span className="text-xs font-mono text-gray-400">{filtered.length} shown</span>
                    </div>
                    <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                      {filtered.length === 0
                        ? <p className="px-5 py-6 text-sm text-gray-400 italic">No antibiotics match.</p>
                        : filtered.map(e => (
                          <div key={e.name}
                            className={`px-5 py-2.5 flex items-center justify-between gap-4 ${e.isResistant ? 'bg-amber-50' : ''}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${e.isResistant ? 'bg-amber-500' : 'bg-[#8BC44F]'}`} />
                              <div>
                                <p className={`text-sm font-medium ${e.isResistant ? 'text-amber-900' : 'text-gray-700'}`}>
                                  {e.name.replace(/_/g, ' ')}
                                </p>
                                <p className="text-xs text-gray-400">{e.cls}</p>
                              </div>
                            </div>
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border shrink-0
                              ${e.isResistant
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-[#E2F3D0] text-[#3D6B16] border-[#A8D878]'}`}>
                              {e.isResistant ? 'Resistant' : 'Sensitive'}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ════════ RECOVERY TAB ══════════════════════════════════════════ */}
        {activeTab === 'recovery' && (
          <div className="space-y-5">

            {/* Recovery score card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-start justify-between gap-4 mb-1">
                <div>
                  <h2 className="font-semibold text-gray-800 text-lg">Antibiotic Recovery Potential</h2>
                  <p className="text-xs font-mono text-gray-400 mt-0.5">Handbook Page No. 21</p>
                </div>
                {recoveryTag && (
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border shrink-0
                    ${recoveryTag === 'Ideal'     ? 'bg-[#E2F3D0] text-[#3D6B16] border-[#A8D878]'   :
                      recoveryTag === 'Non-Ideal' ? 'bg-red-50 text-red-700 border-red-200'           :
                                                    'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    {recoveryTag}
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-500 leading-relaxed mb-2">
                Antibiotics are known to disrupt the microbiota ecosystem dramatically.
                Research suggests that recovery of the microbial ecosystem may be dependent
                on a few species of bacteria among other factors.
              </p>

              {recoveryScore != null
                ? <RecoveryBar score={recoveryScore} />
                : (
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                    <p className="text-sm text-amber-700">
                      {recoveryTag
                        ? `Recovery potential: ${recoveryTag} (numeric score not extracted)`
                        : 'Recovery score not found - re-upload PDF to extract data'}
                    </p>
                  </div>
                )}
            </div>

            {/* Legend */}
            <div className="bg-white border border-[#E2F3D0] rounded-xl p-5">
              <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-4">How to read the bar</p>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="flex gap-2 items-start">
                  <div className="mt-1 w-4 h-2 rounded-full bg-[#C8E9A8] flex-shrink-0" />
                  <div><div className="font-medium text-gray-700 mb-0.5">Green zone</div><div className="text-gray-500">Healthy reference range ({RECOVERY_REF_LOW}–{RECOVERY_REF_HIGH})</div></div>
                </div>
                <div className="flex gap-2 items-start">
                  <div className="mt-0.5 w-3 h-3 rounded-full bg-[#6EA832] border-2 border-white shadow flex-shrink-0" />
                  <div><div className="font-medium text-gray-700 mb-0.5">Green dot</div><div className="text-gray-500">Score within reference range - good recovery potential</div></div>
                </div>
                <div className="flex gap-2 items-start">
                  <div className="mt-0.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-white shadow flex-shrink-0" />
                  <div><div className="font-medium text-gray-700 mb-0.5">Amber dot</div><div className="text-gray-500">Score below reference - reduced recovery potential</div></div>
                </div>
              </div>
            </div>

            {/* What affects recovery */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-4">What Affects Recovery Potential</h3>
              <div className="space-y-3">
                {[
                  { title: 'Keystone species', desc: 'Higher abundance of Faecalibacterium prausnitzii, Akkermansia muciniphila, and Lactobacillus species correlates with faster microbiome recovery.' },
                  { title: 'Dietary fibre', desc: 'Varied fibre intake feeds surviving microbes and accelerates ecosystem rebuilding. Target 25–30g fibre/day during and after antibiotic treatment.' },
                  { title: 'Probiotic supplementation', desc: 'Multi-strain probiotics (Lactobacillus + Bifidobacterium) taken 2 hours apart from antibiotics significantly improve recovery speed.' },
                  { title: 'Antibiotic class & duration', desc: 'Broad-spectrum antibiotics (fluoroquinolones, carbapenems) cause deeper dysbiosis and require longer recovery than narrow-spectrum alternatives.' },
                ].map(item => (
                  <div key={item.title} className="p-3 rounded-xl bg-[#F2F9EC] border border-[#E2F3D0]">
                    <p className="text-sm font-medium text-[#1A3207]">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Support protocol */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Support Protocol</h3>
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  {
                    phase: 'During antibiotic course',
                    style: 'border-amber-200 bg-amber-50', tc: 'text-amber-700',
                    items: ['Take probiotics 2h apart from antibiotics', 'Increase dietary fibre (oats, legumes, vegetables)', 'Eat fermented foods: yoghurt, kefir, kimchi', 'Avoid alcohol and ultra-processed foods', 'Stay well hydrated (2L+ water/day)'],
                  },
                  {
                    phase: 'After antibiotic course',
                    style: 'border-[#C8E9A8] bg-[#F2F9EC]', tc: 'text-[#538A22]',
                    items: ['Continue probiotics 4–8 weeks post-course', 'Prebiotic foods: garlic, onion, banana, oats', 'Fermented foods: kefir, sauerkraut, yoghurt', 'Monitor for C. diff symptoms (diarrhoea, fever)', 'Consider retesting microbiome after 3 months'],
                  },
                ].map(({ phase, style, tc, items }) => (
                  <div key={phase} className={`rounded-xl border p-4 ${style}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${tc}`}>{phase}</p>
                    <ul className="space-y-1.5">
                      {items.map(item => (
                        <li key={item} className="flex items-start gap-2 text-xs text-gray-600">
                          <span className="text-[#538A22] flex-shrink-0 mt-0.5">→</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <SectionAiPanel
          analysis={analysis}
          analysing={analysing}
          error={error}
          onRegenerate={() => report && analyse(report)}
          subtitle="Resistance profile and recovery potential interpretation"
        />
      </div>
    </SectionPageShell>
  )
}