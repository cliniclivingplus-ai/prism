// components/FilterPanel.tsx
// Drop this file at components/FilterPanel.tsx and import into the review page

'use client'
import { useState } from 'react'

export interface FilterResult {
  name: string
  tier: 'must' | 'recommended' | 'optional' | 'remove'
  reason: string
}

interface Props {
  supplements: Array<{ label: string; aicProduct?: string; phase?: string; category?: string }>
  onApply: (results: FilterResult[]) => void
  onClose: () => void
}

const QS = [
  { id:'q1', label:'1 of 5', title:'Primary treatment goal for this patient', type:'single',
    opts:['Infection / pathogen clearance','Gut repair and leaky gut healing','Microbiome diversity restoration','Anti-inflammatory and immune support','Nutritional deficiency correction','Full comprehensive protocol'] },
  { id:'q2', label:'2 of 5', title:'Max supplements the patient can realistically take daily', type:'single',
    opts:['1–4 (minimal, must-haves only)','5–8 (moderate)','9–14 (committed)','15+ (full protocol, highly motivated)'] },
  { id:'q3', label:'3 of 5', title:'Active conditions present (select all that apply)', type:'multi',
    opts:['Bacterial / parasitic infection detected','Leaky gut / intestinal permeability','Confirmed nutritional deficiency','Constipation or poor gut motility','Systemic inflammation or immune issues','Mitochondrial / energy dysfunction','Histamine sensitivity','None of the above'] },
  { id:'q4', label:'4 of 5', title:'Patient dietary preference', type:'single',
    opts:['No restrictions','Vegetarian (no meat, dairy/eggs ok)','Vegan (strict plant-based)','Not confirmed'] },
  { id:'q5', label:'5 of 5', title:'Where is the patient in treatment?', type:'single',
    opts:['Just starting — Phase 1 only','Phase 1 core + selective Phase 2','Full Phase 1 and Phase 2','Phase 2 and 3 maintenance'] },
]

const QUICK_NOTES = [
  'avoid Ox Bile products','patient has kidney disease',
  'Phase 1 only for now','budget conscious patient',
  'elderly patient — start slow','severe infection — be aggressive',
  'already on probiotics','child patient',
  'pregnancy — avoid contraindicated items','liver disease present',
]

export default function FilterPanel({ supplements, onApply, onClose }: Props) {
  const [step,    setStep]    = useState(0)
  const [answers, setAnswers] = useState<Record<string,string[]>>({})
  const [notes,   setNotes]   = useState<string[]>([])
  const [noteVal, setNoteVal] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<FilterResult[]>([])

  const q = QS[step]
  const sel = answers[q?.id] || []
  const total = QS.length + 1 // +1 for notes step
  const pct = Math.round((step / total) * 100)

  function pick(val: string, type: string) {
    setAnswers(prev => {
      if (type === 'single') return { ...prev, [q.id]: [val] }
      const cur = prev[q.id] || []
      return { ...prev, [q.id]: cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val] }
    })
  }

  function addNote(v?: string) {
    const n = (v || noteVal).trim()
    if (n && !notes.includes(n)) { setNotes(p => [...p, n]); setNoteVal('') }
  }

  async function runFilter(): Promise<void> {
    setLoading(true)
    const suppList = supplements.map((s, i) =>
      `${i+1}. ${s.label}${s.aicProduct && s.aicProduct !== s.label ? ` / ${s.aicProduct}` : ''} (${[s.category, s.phase].filter(Boolean).join(', ')})`
    ).join('\n')

    const notesBlock = notes.length
      ? `\nDoctor clinical notes (treat each as a hard constraint):\n${notes.map((n,i)=>`${i+1}. ${n}`).join('\n')}`
      : ''

    const prompt = `You are a senior clinical nutritionist filtering a gut microbiome supplement list for a specific patient.

Patient profile:
- Primary goal: ${(answers.q1||[])[0]||'comprehensive'}
- Max daily supplements: ${(answers.q2||[])[0]||'5-8'}
- Active conditions: ${(answers.q3||[]).join(', ')||'not specified'}
- Diet: ${(answers.q4||[])[0]||'no restrictions'}
- Treatment phase: ${(answers.q5||[])[0]||'Phase 1 and 2'}${notesBlock}

Full supplement list (${supplements.length} items):
${suppList}

Return ONLY a valid JSON array, no markdown, no preamble. Each object:
{"name":"exact name from the list above","tier":"must|recommended|optional|remove","reason":"one concise clinical sentence"}

Rules:
- Every supplement must appear exactly once
- Respect ALL doctor clinical notes as hard constraints
- Respect dietary restrictions strictly (vegan = no Ox Bile products)
- Limit "must" to max 6 items
- Respect the count limit from the profile
- "must" = directly addresses primary goal, correct phase, no conflict
- "recommended" = useful secondary support
- "optional" = low priority right now
- "remove" = wrong phase, dietary conflict, redundant, or not indicated`

    try {
      const res = await fetch('/api/anthropic-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      // Fallback: call Anthropic directly (works in browser via Next.js proxy or direct)
      const data = res.ok ? await res.json() : null
      let text = data?.content?.[0]?.text || ''

      if (!text) {
        // Direct call if proxy not available
        const direct = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 2000,
            messages: [{ role: 'user', content: prompt }]
          })
        })
        const d2 = await direct.json()
        text = d2?.content?.[0]?.text || '[]'
      }

      const parsed: FilterResult[] = JSON.parse(text.replace(/```json|```/g,'').trim())
      setResults(parsed)
    } catch(e) {
      setResults([{ name: 'Filter error', tier: 'optional', reason: 'Could not generate filter. Check API connection.' }])
    }
    setLoading(false)
    setStep(total + 1)
  }

  const grouped = {
    must:        results.filter(r => r.tier === 'must'),
    recommended: results.filter(r => r.tier === 'recommended'),
    optional:    results.filter(r => r.tier === 'optional'),
    remove:      results.filter(r => r.tier === 'remove'),
  }

  const TIERS = [
    { key: 'must' as const,        label: 'Must include',       bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
    { key: 'recommended' as const, label: 'Recommended',        bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
    { key: 'optional' as const,    label: 'Optional',           bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0' },
    { key: 'remove' as const,      label: 'Consider removing',  bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  ]

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
      background: '#fff', borderLeft: '1px solid #E2E8F0', zIndex: 50,
      display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,.08)',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F2F9EC' }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1A3207', margin: 0 }}>🧬 AI Supplement Filter</p>
          <p style={{ fontSize: 11, color: '#538A22', margin: 0 }}>{supplements.length} supplements · answer questions to prioritise</p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6B7280', lineHeight: 1 }}>✕</button>
      </div>

      {/* Progress bar */}
      {step <= total && (
        <div style={{ height: 3, background: '#E2F3D0' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: '#538A22', transition: 'width .3s' }} />
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* Q&A steps */}
        {step < QS.length && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>{q.label}</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1E293B', marginBottom: 12 }}>{q.title}</p>
            {q.opts.map(o => {
              const active = sel.includes(o)
              return (
                <div key={o} onClick={() => pick(o, q.type)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: `1px solid ${active ? '#538A22' : '#E2E8F0'}`, borderRadius: 8, cursor: 'pointer', marginBottom: 6, background: active ? '#F2F9EC' : '#fff', transition: 'all .15s' }}>
                  <input type={q.type === 'single' ? 'radio' : 'checkbox'} checked={active} readOnly style={{ accentColor: '#538A22' }} />
                  <span style={{ fontSize: 13, color: '#334155' }}>{o}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Notes step */}
        {step === QS.length && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Clinical notes</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1E293B', marginBottom: 6 }}>Add clinical constraints for this patient</p>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 12, lineHeight: 1.5 }}>Each note becomes a hard instruction to Claude. Be specific — "patient has kidney disease", "avoid Ox Bile", "Phase 1 only".</p>

            {/* Existing notes */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, minHeight: 28 }}>
              {notes.length === 0 && <span style={{ fontSize: 12, color: '#9CA3AF' }}>No notes yet</span>}
              {notes.map((n, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: '#F2F9EC', border: '1px solid #C8E9A8', borderRadius: 20, fontSize: 12, color: '#3D6B16' }}>
                  {n}
                  <button onClick={() => setNotes(p => p.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9CA3AF', fontSize: 13, lineHeight: 1 }}>✕</button>
                </span>
              ))}
            </div>

            {/* Input */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <input value={noteVal} onChange={e => setNoteVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { addNote(); e.preventDefault() } }}
                placeholder="e.g. patient has liver disease"
                autoFocus
                style={{ flex: 1, fontSize: 13, padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 8, outline: 'none' }} />
              <button onClick={() => addNote()} style={{ padding: '7px 12px', background: '#538A22', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>+ Add</button>
            </div>

            {/* Quick notes */}
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>Quick add:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {QUICK_NOTES.map(n => (
                <button key={n} onClick={() => addNote(n)}
                  disabled={notes.includes(n)}
                  style={{ fontSize: 11, padding: '3px 8px', background: notes.includes(n) ? '#F1F5F9' : '#fff', color: notes.includes(n) ? '#94A3B8' : '#475569', border: '1px solid #E2E8F0', borderRadius: 20, cursor: notes.includes(n) ? 'default' : 'pointer' }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ fontSize: 28, letterSpacing: 4 }}>
              <span style={{ animation: 'pulse 1s infinite' }}>•</span>
              <span style={{ animation: 'pulse 1s .2s infinite' }}>•</span>
              <span style={{ animation: 'pulse 1s .4s infinite' }}>•</span>
            </div>
            <style>{`@keyframes pulse{0%,100%{opacity:.2}50%{opacity:1}}`}</style>
            <p style={{ marginTop: 12, fontSize: 13, color: '#64748B' }}>Analysing {supplements.length} supplements…</p>
            {notes.length > 0 && <p style={{ fontSize: 12, color: '#94A3B8' }}>Applying {notes.length} clinical note{notes.length > 1 ? 's' : ''}</p>}
          </div>
        )}

        {/* Results */}
        {!loading && step > total && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1E293B', margin: '0 0 2px' }}>Filter results</p>
                <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
                  {grouped.must.length + grouped.recommended.length} core · {grouped.optional.length} optional · {grouped.remove.length} to remove
                </p>
              </div>
              <button onClick={() => { setStep(0); setAnswers({}); setNotes([]); setResults([]) }}
                style={{ fontSize: 11, color: '#64748B', background: 'none', border: '1px solid #E2E8F0', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                ↺ Redo
              </button>
            </div>

            {notes.length > 0 && (
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', marginBottom: 12, fontSize: 11, color: '#64748B' }}>
                Notes applied: {notes.map(n => `"${n}"`).join(' · ')}
              </div>
            )}

            {TIERS.map(t => {
              const items = grouped[t.key]
              if (!items.length) return null
              return (
                <div key={t.key} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: t.bg, color: t.text, border: `1px solid ${t.border}` }}>
                      {t.label}
                    </span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{items.length}</span>
                  </div>
                  {items.map((r, i) => (
                    <div key={i} style={{ padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#1E293B', margin: '0 0 2px' }}>{r.name}</p>
                      <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>{r.reason}</p>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 8 }}>
        {step < QS.length && (
          <>
            {step > 0 && <button onClick={() => setStep(s => s - 1)} style={{ flex: 0, padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>← Back</button>}
            <button onClick={() => sel.length && setStep(s => s + 1)} disabled={!sel.length}
              style={{ flex: 1, padding: '8px 0', background: sel.length ? '#538A22' : '#E2E8F0', color: sel.length ? '#fff' : '#9CA3AF', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: sel.length ? 'pointer' : 'default' }}>
              {step === QS.length - 1 ? 'Add notes →' : 'Next →'}
            </button>
          </>
        )}
        {step === QS.length && (
          <>
            <button onClick={() => setStep(s => s - 1)} style={{ flex: 0, padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>← Back</button>
            <button onClick={() => { setStep(s => s + 1); runFilter() }}
              style={{ flex: 1, padding: '8px 0', background: '#538A22', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              🧬 Generate filter
            </button>
          </>
        )}
        {!loading && step > total && (
          <button onClick={() => onApply(results)}
            style={{ flex: 1, padding: '10px 0', background: '#538A22', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            ✓ Apply to prescription
          </button>
        )}
      </div>
    </div>
  )
}