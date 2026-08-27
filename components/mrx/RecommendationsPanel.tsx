'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  reportId: string
  reportData: any
  patient: any
  existingRecs?: any
}

type Recs = {
  summary: string
  key_findings: any[]
  supplement_suggestions: any[]
  lifestyle_recommendations: {
    sleep: any[]
    stress: any[]
    movement: any[]
    habits: any[]
  }
  clinical_notes: any[]
  clp_treatments: any[]
  follow_up_timeline: string
  red_flags: string[]
  enterotype: string | null
  enterotype_reason: string | null
  rules_version: string
}

const SEVERITY: Record<string, string> = {
  high:     'bg-red-50 text-red-700 border-red-200',
  moderate: 'bg-amber-50 text-amber-700 border-amber-200',
  low:      'bg-blue-50 text-blue-700 border-blue-200',
}

const EVIDENCE: Record<string, string> = {
  strong:   'bg-[#F2F9EC] text-green-700 border-[#C8E9A8]',
  moderate: 'bg-amber-50 text-amber-700 border-amber-200',
  emerging: 'bg-background text-gray-500 border-gray-200',
}

const CONFIDENCE_SOURCE: Record<string, string> = {
  threshold_distance:       'Score vs reference range',
  validated_clinical_rule:  'Validated clinical rule',
  population_study:         'Population cohort study',
}

const TIER_STYLE: Record<string, string> = {
  urgent:  'bg-red-50 text-red-700 border-red-200',
  monitor: 'bg-amber-50 text-amber-700 border-amber-200',
  support: 'bg-blue-50 text-blue-700 border-blue-200',
}
const TIER_LABEL: Record<string, string> = {
  urgent:  'Urgent',
  monitor: 'Monitor',
  support: 'Support',
}

const LIFESTYLE_SECTIONS: {
  key: keyof Recs['lifestyle_recommendations']
  label: string
  icon: string
  bg: string
  border: string
  text: string
}[] = [
  { key: 'sleep',    label: 'Sleep',           icon: '🌙', bg: 'bg-indigo-50',  border: 'border-indigo-200', text: 'text-indigo-800' },
  { key: 'stress',   label: 'Stress & Mind',   icon: '🧠', bg: 'bg-purple-50',  border: 'border-purple-200', text: 'text-purple-800' },
  { key: 'movement', label: 'Movement',         icon: '🏃', bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-800'  },
  { key: 'habits',   label: 'Daily Habits',     icon: '🌿', bg: 'bg-[#F2F9EC]', border: 'border-[#C8E9A8]',  text: 'text-[#1A3207]'  },
]

function WhyButton({ finding, value, low, high, pmids, confidenceSource }: {
  finding: string; value: number | null; low: number; high: number
  pmids: string[]; confidenceSource: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)} className="text-xs font-mono text-blue-600 hover:text-blue-800 transition underline">
        {open ? 'Hide ↑' : 'Why? →'}
      </button>
      {open && (
        <div className="mt-2 bg-white border border-blue-100 rounded-lg p-3 space-y-2">
          <p className="text-xs text-gray-700"><span className="font-medium">Finding: </span>{finding}</p>
          {value !== null && value !== undefined && (
            <p className="text-xs text-gray-600">
              <span className="font-medium">Patient score: </span>
              <span className="font-mono">{value}</span>
              <span className="text-gray-400 ml-1">(reference range: {low} – {high})</span>
            </p>
          )}
          <p className="text-xs text-gray-400 font-mono">
            Confidence basis: {CONFIDENCE_SOURCE[confidenceSource] || confidenceSource}
          </p>
          {pmids?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[#E2F3D0]">
              <span className="text-xs text-gray-400 font-mono self-center">Evidence:</span>
              {pmids.map((p: string, i: number) => (
                <a key={i} href={`https://pubmed.ncbi.nlm.nih.gov/${p.replace('PMID:','')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs font-mono text-blue-600 hover:underline">
                  {p} ↗
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function RecommendationsPanel({ reportId, reportData, patient, existingRecs }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [recs, setRecs] = useState<Recs | null>(existingRecs || null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'findings' | 'supplements' | 'lifestyle' | 'clinical' | 'treatments'>('findings')

  const generate = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/mrx/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: reportId, report_data: reportData, patient }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      // Navigate to doctor review screen with the saved rules_output
      router.push(`/mrx/report/${reportId}/review`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  // ── EMPTY STATE ────────────────────────────────────────────────────────────
  if (!recs && !loading) return (
    <div className="bg-white border border-[#E2F3D0] rounded-2xl p-10 text-center">
      <div className="text-5xl mb-4"></div>
      <h3 className="text-xl font-light text-gray-900 mb-2">AI Recommendation Engine</h3>
      <p className="text-sm text-gray-400 leading-relaxed mb-6 max-w-md mx-auto">
        Runs a deterministic rules engine on the report scores, matches supplements from the clinical database, and generates evidence-based clinical notes. For doctor review only.
      </p>
      <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
        {['Rules engine', 'Supplement DB', 'Contraindication check', 'Evidence citations', 'Enterotype', 'LP Treatments', 'Lifestyle'].map(item => (
          <span key={item} className="text-xs font-mono px-2 py-1 bg-background border border-[#E2F3D0] rounded text-gray-500">{item}</span>
        ))}
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4 text-left">{error}</div>}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button onClick={generate} className="px-8 py-3 bg-primary hover:bg-primary-hover shadow-sm text-white font-medium rounded-xl text-sm transition-all">
          Generate recommendations →
        </button>
      </div>
      <p className="text-xs text-gray-400 font-mono mt-3">For physician use only · Not a prescription</p>
    </div>
  )

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="bg-white border border-[#E2F3D0] rounded-2xl p-16 text-center">
      <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-sm text-gray-600 font-medium mb-1">Running analysis…</p>
      <p className="text-xs text-gray-400 font-mono">Rules engine → contraindication check → supplement matching → LP treatment matching → lifestyle analysis → clinical notes</p>
    </div>
  )

  if (!recs) return null

  const lifestyleCount = recs.lifestyle_recommendations
    ? Object.values(recs.lifestyle_recommendations).reduce((sum, arr) => sum + (arr?.length || 0), 0)
    : 0

  const tabs = [
    { id: 'findings'    as const, label: 'Key findings',   count: recs.key_findings?.length || 0 },
    { id: 'supplements' as const, label: 'Supplements',    count: recs.supplement_suggestions?.length || 0 },
    { id: 'lifestyle'   as const, label: 'Lifestyle',      count: lifestyleCount },
    { id: 'treatments'  as const, label: 'LP Treatments', count: recs.clp_treatments?.length || 0 },
    { id: 'clinical'    as const, label: 'Clinical notes', count: recs.clinical_notes?.length || 0 },
  ]

  return (
    <div className="bg-white border border-[#E2F3D0] rounded-2xl overflow-hidden">

      {/* HEADER */}
      <div className="px-6 py-5 border-b border-[#E2F3D0]">
        <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">AI Recommendation Engine</span>
              <span className="text-xs font-mono bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">Doctor view only · Not a prescription</span>
              {recs.rules_version && (
                <span className="text-xs font-mono bg-background text-gray-400 border border-gray-200 px-2 py-0.5 rounded">Rules {recs.rules_version}</span>
              )}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed max-w-2xl">{recs.summary}</p>
          </div>
          <button onClick={() => { setRecs(null); setError(null) }} className="text-xs font-mono text-gray-400 hover:text-[#538A22] transition flex-shrink-0">Regenerate</button>
        </div>

        {/* Enterotype */}
        {recs.enterotype && (
          <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <div className="text-xs font-mono text-blue-700 uppercase tracking-wide mb-1 font-medium">Enterotype classification</div>
            <div className="text-sm text-blue-900 font-medium mb-1">{recs.enterotype}</div>
            <p className="text-xs text-blue-700 leading-relaxed">{recs.enterotype_reason}</p>
          </div>
        )}

        {/* Red flags */}
        {recs.red_flags?.length > 0 && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <div className="text-xs font-mono text-red-700 uppercase tracking-wide mb-2 font-medium">⚠ Requires urgent review</div>
            {recs.red_flags.map((f: string, i: number) => <p key={i} className="text-sm text-red-700">{f}</p>)}
          </div>
        )}

        {recs.follow_up_timeline && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-gray-400">Suggested follow-up:</span>
            <span className="text-xs font-mono text-green-700 bg-[#F2F9EC] border border-[#C8E9A8] px-2 py-0.5 rounded">{recs.follow_up_timeline}</span>
          </div>
        )}
      </div>

      {/* TABS */}
      <div className="flex border-b border-[#E2F3D0] bg-background overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${tab === t.id ? 'border-green-600 text-green-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
            {t.count > 0 && <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${tab === t.id ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="p-6">

        {/* FINDINGS */}
        {tab === 'findings' && (
          <div className="space-y-3">
            {recs.key_findings?.length === 0 && <p className="text-sm text-gray-400 text-center py-8 font-mono">No findings outside reference range</p>}
            {recs.key_findings?.map((f: any, i: number) => (
              <div key={i} className="p-4 bg-background rounded-xl border border-[#E2F3D0]">
                <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-mono px-2 py-1 rounded border ${SEVERITY[f.severity] || SEVERITY.low}`}>{f.severity}</span>
                    <span className="text-xs font-mono text-gray-400 uppercase tracking-wide">{f.category}</span>
                  </div>
                  {f.confidence > 0 && (
                    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${f.confidence >= 0.85 ? 'bg-[#F2F9EC] text-green-700 border-[#C8E9A8]' : f.confidence >= 0.70 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-background text-gray-500 border-gray-200'}`}>
                      {f.confidence >= 0.85 ? 'High' : f.confidence >= 0.70 ? 'Moderate' : 'Low'} confidence ({Math.round(f.confidence * 100)}%)
                    </span>
                  )}
                </div>
                <div className="text-sm font-medium text-gray-900 mb-1">{f.finding}</div>
                <WhyButton finding={f.finding} value={f.value} low={f.threshold_low} high={f.threshold_high} pmids={f.pmids} confidenceSource={f.confidence_source} />
              </div>
            ))}
          </div>
        )}

        {/* SUPPLEMENTS */}
        {tab === 'supplements' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400 font-mono border-l-2 border-amber-300 pl-3 py-1">
              Suggestions for clinical consideration only. No doses provided - physician judgment, patient age, medications, and comorbidities must be assessed.
            </p>
            {recs.supplement_suggestions?.length === 0 && <p className="text-sm text-gray-400 text-center py-8 font-mono">No supplement suggestions triggered</p>}
            {recs.supplement_suggestions?.map((s: any, i: number) => (
              <div key={i} className="border border-[#E2F3D0] rounded-xl p-5 bg-white">
                {s.contraindicated_with?.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                    <div className="text-xs font-mono text-red-700 font-medium mb-1">⚠ Contraindication check</div>
                    {s.contraindicated_with.map((c: string, j: number) => (
                      <p key={j} className="text-xs text-red-600">{c}</p>
                    ))}
                  </div>
                )}
                <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <div className="text-sm font-medium text-gray-900 mb-0.5">{s.supplement}</div>
                    {s.category && <div className="text-xs font-mono text-gray-400">{s.category}</div>}
                  </div>
                  <span className={`text-xs font-mono px-2 py-1 rounded border flex-shrink-0 ${EVIDENCE[s.evidence_level] || EVIDENCE.emerging}`}>{s.evidence_level} evidence</span>
                </div>
                {s.rationale && <p className="text-xs text-gray-600 leading-relaxed mb-3">{s.rationale}</p>}
                <div className="text-xs font-mono text-gray-400 bg-background px-3 py-1.5 rounded border border-[#E2F3D0] mb-3">Triggered by: {s.triggered_by}</div>
                {s.pmids?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs text-gray-400 font-mono self-center">Evidence:</span>
                    {s.pmids.map((p: string, j: number) => (
                      <a key={j} href={`https://pubmed.ncbi.nlm.nih.gov/${p.replace('PMID:', '')}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-mono text-blue-600 hover:underline bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">{p} ↗</a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── LIFESTYLE ──────────────────────────────────────────────────────── */}
        {tab === 'lifestyle' && (
          <div className="space-y-6">
            <p className="text-xs text-gray-400 font-mono border-l-2 border-[#C8E9A8] pl-3 py-1">
              Lifestyle suggestions are personalised to this patient's microbiome findings. Improving these areas can significantly enhance gut health outcomes over 3–6 months.
            </p>

            {(!recs.lifestyle_recommendations || lifestyleCount === 0) && (
              <p className="text-sm text-gray-400 text-center py-8 font-mono">No lifestyle recommendations generated.</p>
            )}

            {LIFESTYLE_SECTIONS.map(section => {
              const items: any[] = recs.lifestyle_recommendations?.[section.key] || []
              if (items.length === 0) return null
              return (
                <div key={section.key}>
                  {/* Section heading */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">{section.icon}</span>
                    <span className="text-xs font-mono uppercase tracking-widest text-gray-500">{section.label}</span>
                    <span className="text-xs font-mono text-gray-400 ml-auto">{items.length} suggestions</span>
                  </div>

                  <div className="space-y-3">
                    {items.map((item: any, i: number) => (
                      <div key={i} className={`rounded-xl border p-4 ${section.bg} ${section.border}`}>
                        <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                          <div className={`text-sm font-medium ${section.text}`}>{item.suggestion}</div>
                          {item.priority && (
                            <span className={`text-xs font-mono px-2 py-0.5 rounded border flex-shrink-0 ${
                              item.priority === 'high'
                                ? 'bg-red-50 text-red-600 border-red-200'
                                : item.priority === 'moderate'
                                ? 'bg-amber-50 text-amber-600 border-amber-200'
                                : 'bg-gray-50 text-gray-500 border-gray-200'
                            }`}>
                              {item.priority} priority
                            </span>
                          )}
                        </div>
                        {item.reason && (
                          <p className="text-xs text-gray-600 leading-relaxed mt-1">{item.reason}</p>
                        )}
                        {item.how && (
                          <div className="mt-2 pt-2 border-t border-white/60">
                            <span className="text-xs font-mono text-gray-400 uppercase tracking-wide">How: </span>
                            <span className="text-xs text-gray-600">{item.how}</span>
                          </div>
                        )}
                        {item.microbiome_link && (
                          <div className="mt-2 flex items-start gap-1.5">
                            <span className="text-xs font-mono text-[#538A22] flex-shrink-0">→ Gut link:</span>
                            <span className="text-xs text-[#1A3207]">{item.microbiome_link}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* LP TREATMENTS */}
        {tab === 'treatments' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400 font-mono border-l-2 border-[#C8E9A8] pl-3 py-1">
              LP treatment suggestions are matched deterministically from patient findings. For physician discussion with patient only. Not a treatment prescription.
            </p>

            <div className="flex items-center gap-3 bg-[#F2F9EC] border border-[#C8E9A8] rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-[#538A22] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">LP</span>
              </div>
              <div>
                <div className="text-xs font-medium text-[#1A3207]">Living Plus - Gut Management Programme</div>
                <div className="text-xs text-[#538A22] font-mono">Treatments matched to this patient's microbiome report</div>
              </div>
            </div>

            {(!recs.clp_treatments || recs.clp_treatments.length === 0) && (
              <div className="text-center py-12">
                <p className="text-sm text-gray-400 font-mono">No LP treatments matched for this report.</p>
                <p className="text-xs text-gray-300 font-mono mt-1">Findings may not map to a listed LP condition.</p>
              </div>
            )}

            {recs.clp_treatments?.map((t: any, i: number) => (
              <div key={i} className="border border-[#E2F3D0] rounded-xl overflow-hidden bg-white">
                <div className="flex items-start justify-between px-5 pt-5 pb-3 gap-3 flex-wrap">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded border ${TIER_STYLE[t.tier] || TIER_STYLE.support}`}>
                        {TIER_LABEL[t.tier] || t.tier}
                      </span>
                      <span className="text-xs font-mono text-gray-400 uppercase tracking-wide">LP Treatment</span>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900">{t.condition}</h4>
                  </div>
                </div>

                <div className="px-5 pb-3">
                  <p className="text-xs text-gray-500 leading-relaxed">{t.what_it_is}</p>
                </div>

                <div className="mx-5 mb-3 bg-background border border-[#E2F3D0] rounded-lg px-3 py-2">
                  <div className="text-xs font-mono text-gray-400 mb-1">Triggered by findings:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {t.triggered_by?.map((trigger: string, j: number) => (
                      <span key={j} className="text-xs font-mono bg-white border border-[#C8E9A8] text-[#538A22] px-2 py-0.5 rounded">
                        {trigger}
                      </span>
                    ))}
                  </div>
                </div>

                {t.symptoms_addressed?.length > 0 && (
                  <div className="px-5 pb-3">
                    <div className="text-xs font-mono text-gray-400 uppercase tracking-wide mb-2">Symptoms addressed</div>
                    <div className="flex flex-wrap gap-1.5">
                      {t.symptoms_addressed.map((s: string, j: number) => (
                        <span key={j} className="text-xs text-gray-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {t.treatments?.length > 0 && (
                  <div className="px-5 pb-5">
                    <div className="text-xs font-mono text-gray-400 uppercase tracking-wide mb-2">Treatments provided by LP</div>
                    <ul className="space-y-1.5">
                      {t.treatments.map((tx: string, j: number) => (
                        <li key={j} className="flex items-start gap-2">
                          <span className="text-[#538A22] mt-0.5 flex-shrink-0">→</span>
                          <span className="text-xs text-gray-700 leading-relaxed">{tx}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}

            {recs.clp_treatments?.length > 0 && (
              <div className="bg-[#F2F9EC] border border-[#C8E9A8] rounded-xl px-5 py-4 text-center">
                <p className="text-xs text-[#1A3207] font-medium mb-1">Discuss these LP treatment options with the patient at the next consultation.</p>
                <p className="text-xs text-[#538A22] font-mono">For physician use only · Not a patient-facing document</p>
              </div>
            )}
          </div>
        )}

        {/* CLINICAL NOTES */}
        {tab === 'clinical' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400 font-mono border-l-2 border-blue-300 pl-3 py-1">
              Clinical decision support - physician use only. All language is observational and advisory. Clinical judgment and patient context apply.
            </p>
            {recs.clinical_notes?.length === 0 && <p className="text-sm text-gray-400 text-center py-8 font-mono">No clinical notes generated</p>}
            {recs.clinical_notes?.map((note: any, i: number) => (
              <div key={i} className="border border-[#E2F3D0] rounded-xl p-5 bg-white">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-mono text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">{note.area}</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-mono text-gray-400 uppercase tracking-wide block mb-1">Observation</span>
                    <p className="text-sm text-gray-700 leading-relaxed">{note.observation}</p>
                  </div>
                  <div className="border-l-2 border-[#C8E9A8] pl-3">
                    <span className="text-xs font-mono text-gray-400 uppercase tracking-wide block mb-1">Consider</span>
                    <p className="text-sm text-[#1A3207] leading-relaxed">{note.consideration}</p>
                  </div>
                  {note.follow_up && (
                    <div className="border-l-2 border-gray-200 pl-3">
                      <span className="text-xs font-mono text-gray-400 uppercase tracking-wide block mb-1">Follow-up</span>
                      <p className="text-sm text-gray-500 leading-relaxed">{note.follow_up}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
