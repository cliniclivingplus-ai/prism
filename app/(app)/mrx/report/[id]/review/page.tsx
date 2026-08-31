'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import SectionPageShell from '@/components/mrx/SectionPageShell'
import { useSectionReport } from '@/lib/mrx/sectionPage'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

type ItemStatus = 'kb' | 'modified' | 'added' | 'removed'
interface EditableItem {
  key: string; label: string; aicProduct?: string
  detail: string; rationale: string; doctorNote: string
  status: ItemStatus; priority?: string; category?: string
  phase?: string; contraindications?: string; isNew?: boolean
  source?: 'kb' | 'aic'
}
interface ReviewSections { supplements: EditableItem[]; therapies: EditableItem[]; dietary: EditableItem[] }
interface ReportSummary {
  id: string; patient_name: string; patient_age_sex: string
  rych_index: number; rych_tier: number; rych_tier_label: string
  marker_count: number; conditions_flagged: string[]
  contraindication_alerts: Array<{ marker: string; alert: string; severity: string }>
}

interface FilterResult {
  name: string
  tier: 'must' | 'recommended' | 'optional' | 'remove'
  reason: string
  new?: boolean
  detail?: string
  phase?: string
}

const PHASE_ORDER = ['Phase 1', 'Phase 1+2', 'Phase 2', 'Phase 3']
const PHASE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  'Phase 1':   { bg: '#538A22', text: '#fff',    border: '#538A22' },
  'Phase 1+2': { bg: '#6EA832', text: '#fff',    border: '#6EA832' },
  'Phase 2':   { bg: '#A8D878', text: '#2A4D0D', border: '#8BC44F' },
  'Phase 3':   { bg: '#C8E9A8', text: '#2A4D0D', border: '#A8D878' },
}

function groupByPhase(items: EditableItem[]) {
  const groups: Record<string, EditableItem[]> = {}
  for (const item of items) {
    const key = item.phase || 'Other'
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  const result: { phase: string; items: EditableItem[] }[] = []
  for (const p of PHASE_ORDER) if (groups[p]?.length) result.push({ phase: p, items: groups[p] })
  for (const k of Object.keys(groups)) if (!PHASE_ORDER.includes(k)) result.push({ phase: k, items: groups[k] })
  return result
}

function groupDietaryByPhase(items: EditableItem[]) {
  const groups: Record<string, EditableItem[]> = {}
  for (const item of items) {
    const match = (item.phase || '').match(/Phase\s*\d+(\+\d+)?/i)
    const basePhase = match ? match[0] : (item.phase || 'Other')
    if (!groups[basePhase]) groups[basePhase] = []
    groups[basePhase].push(item)
  }
  const result: { phase: string; items: EditableItem[] }[] = []
  for (const p of PHASE_ORDER) if (groups[p]?.length) result.push({ phase: p, items: groups[p] })
  for (const k of Object.keys(groups)) if (!PHASE_ORDER.includes(k)) result.push({ phase: k, items: groups[k] })
  return result
}

function PhaseDivider({ phase }: { phase: string }) {
  const c = PHASE_STYLE[phase] ?? { bg: '#F2F9EC', text: '#538A22', border: '#C8E9A8' }
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="h-px flex-1" style={{ background: '#E2F3D0' }} />
      <span className="text-[10px] font-bold tracking-widest uppercase px-3 py-0.5 rounded-full"
        style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
        {phase}
      </span>
      <div className="h-px flex-1" style={{ background: '#E2F3D0' }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// FILTER PANEL — conversational AI
// ─────────────────────────────────────────────────────────────────
function FilterPanel({ supplements, onApply, onClose,
  persistedMessages, persistedResults, persistedPhase,
  onMessagesChange, onResultsChange, onPhaseChange,
}: {
  supplements: EditableItem[]
  onApply: (results: FilterResult[]) => void
  onClose: () => void
  persistedMessages: {role:'ai'|'doctor';text:string}[]
  persistedResults: FilterResult[]
  persistedPhase: 'chat'|'results'
  onMessagesChange: (m:{role:'ai'|'doctor';text:string}[]) => void
  onResultsChange: (r:FilterResult[]) => void
  onPhaseChange: (p:'chat'|'results') => void
}): React.ReactElement {
  const [messages,   setMessagesLocal] = useState(persistedMessages)
  const [inputVal,   setInputVal]      = useState('')
  const [loading,    setLoading]       = useState(false)
  const [results,    setResultsLocal]  = useState(persistedResults)
  const [phase,      setPhaseLocal]    = useState(persistedPhase)
  const [applyTiers, setApplyTiers]   = useState<Set<string>>(new Set(['must','recommended']))
  const bottomRef  = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (persistedMessages.length > 0) return
    if (startedRef.current) return
    startedRef.current = true
    const t = setTimeout(() => startConversation(), 50)
    return () => { clearTimeout(t) }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function startConversation() {
    setLoading(true)
    try {
      const res = await fetch('/api/mrx/filter-supplements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplements, messages: [], mode: 'start' }),
      })
      const data = await res.json()
      const m = [{ role: 'ai' as const, text: data.text || "Hi! Tell me about the patient — any allergies, medications, or conditions I should know about?" }]
      setMessagesLocal(m); onMessagesChange(m)
    } catch(e) {
      const m = [{ role: 'ai' as const, text: "Hi! I've studied your supplement list. Tell me about the patient — any allergies, medications, or conditions?" }]
      setMessagesLocal(m); onMessagesChange(m)
    }
    setLoading(false)
  }

  async function sendMessage() {
    if (!inputVal.trim() || loading) return
    const userMsg = inputVal.trim()
    setInputVal('')
    const newMessages = [...messages, { role: 'doctor' as const, text: userMsg }]
    setMessagesLocal(newMessages)
    onMessagesChange(newMessages)
    if (results.length > 0) { setPhaseLocal('chat'); onPhaseChange('chat') }
    setLoading(true)
    try {
      const res = await fetch('/api/mrx/filter-supplements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplements, messages: newMessages, mode: 'chat', hasExistingResults: results.length > 0 }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`)
      if (data.type === 'results') {
        const followUp = { role: 'ai' as const, text: "Filter updated. Click '← Continue chat' anytime to refine further." }
        const withResult = [...(data.text ? [...newMessages, { role: 'ai' as const, text: data.text }] : newMessages), followUp]
        setMessagesLocal(withResult); onMessagesChange(withResult)
        setResultsLocal(data.results || []); onResultsChange(data.results || [])
        setPhaseLocal('results'); onPhaseChange('results')
      } else {
        const withAi = [...newMessages, { role: 'ai' as const, text: data.text || 'Sorry, something went wrong. Please try again.' }]
        setMessagesLocal(withAi); onMessagesChange(withAi)
      }
    } catch(e) {
      const withErr = [...newMessages, { role: 'ai' as const, text: 'Sorry, something went wrong. Please try again.' }]
      setMessagesLocal(withErr); onMessagesChange(withErr)
    }
    setLoading(false)
  }

  const grouped = {
    must:        results.filter(r => r.tier === 'must'),
    recommended: results.filter(r => r.tier === 'recommended'),
    optional:    results.filter(r => r.tier === 'optional'),
    remove:      results.filter(r => r.tier === 'remove'),
  }
  const TIERS = [
    { key:'must' as const,        label:'Keep — Essential',   bg:'#F0FDF4', text:'#15803D', border:'#BBF7D0' },
    { key:'recommended' as const, label:'Keep — Recommended', bg:'#EFF6FF', text:'#1D4ED8', border:'#BFDBFE' },
    { key:'optional' as const,    label:'Optional',           bg:'#F8FAFC', text:'#64748B', border:'#E2E8F0' },
    { key:'remove' as const,      label:'Remove',             bg:'#FEF2F2', text:'#DC2626', border:'#FECACA' },
  ]

  return (
    <div style={{ position:'fixed', top:0, right:0, bottom:0, width:440, background:'#fff', borderLeft:'1px solid #E2E8F0', zIndex:50, display:'flex', flexDirection:'column', boxShadow:'-4px 0 24px rgba(0,0,0,.08)' }}>
      <div style={{ padding:'14px 16px', borderBottom:'1px solid #E2E8F0', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#F2F9EC', flexShrink:0 }}>
        <div>
          <p style={{ fontSize:13, fontWeight:600, color:'#1A3207', margin:0 }}>🧬 AI Supplement Filter</p>
          <p style={{ fontSize:11, color:'#538A22', margin:0 }}>
            {phase === 'chat' ? `${supplements.length} supplements · conversational filter` : `Filter complete · ${grouped.must.length + grouped.recommended.length} to keep`}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {phase === 'results' && (
            <button onClick={() => { setPhaseLocal('chat'); onPhaseChange('chat') }}
              style={{ fontSize:11, color:'#538A22', background:'#F2F9EC', border:'1px solid #C8E9A8', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>
              ← Continue chat
            </button>
          )}
          {phase === 'chat' && results.length > 0 && (
            <button onClick={() => { setPhaseLocal('results'); onPhaseChange('results') }}
              style={{ fontSize:11, color:'#1D4ED8', background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>
              View results →
            </button>
          )}
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#6B7280', lineHeight:1 }}>✕</button>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:16 }}>
        {phase === 'chat' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display:'flex', justifyContent: m.role === 'doctor' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth:'85%', padding:'10px 13px',
                  borderRadius: m.role === 'doctor' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: m.role === 'doctor' ? '#538A22' : '#F2F9EC',
                  color: m.role === 'doctor' ? '#fff' : '#1A3207',
                  fontSize:13, lineHeight:1.55,
                  border: m.role === 'ai' ? '1px solid #C8E9A8' : 'none',
                }}>
                  {m.role === 'ai' && <p style={{ fontSize:10, fontWeight:600, color:'#538A22', margin:'0 0 4px', textTransform:'uppercase', letterSpacing:.5 }}>AI Pharmacist</p>}
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display:'flex', justifyContent:'flex-start' }}>
                <div style={{ padding:'10px 14px', background:'#F2F9EC', border:'1px solid #C8E9A8', borderRadius:'16px 16px 16px 4px', display:'flex', gap:4 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#538A22', animation:`blink 1s ${i*0.2}s infinite ease-in-out` }} />)}
                </div>
              </div>
            )}
            <style>{`@keyframes blink{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}`}</style>
            <div ref={bottomRef} />
          </div>
        )}
        {phase === 'results' && (
          <div>
            <div style={{ background:'#F2F9EC', border:'1px solid #C8E9A8', borderRadius:10, padding:'10px 12px', marginBottom:10, fontSize:12, color:'#3D6B16', lineHeight:1.5 }}>
              Based on our conversation, here's the filtered prescription:
            </div>
            <div style={{ marginBottom:14 }}>
              <p style={{ fontSize:11, color:'#6B7280', marginBottom:6 }}>Select tiers to apply:</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {[
                  { key:'must', label:'Essential', bg:'#F0FDF4', text:'#15803D', border:'#BBF7D0' },
                  { key:'recommended', label:'Recommended', bg:'#EFF6FF', text:'#1D4ED8', border:'#BFDBFE' },
                  { key:'optional', label:'Optional', bg:'#F8FAFC', text:'#64748B', border:'#E2E8F0' },
                ].map(t => {
                  const active = applyTiers.has(t.key)
                  return (
                    <button key={t.key} onClick={() => { setApplyTiers(prev => { const next = new Set(prev); next.has(t.key) ? next.delete(t.key) : next.add(t.key); return next }) }}
                      style={{ fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:20, cursor:'pointer', background:active?t.bg:'#fff', color:active?t.text:'#9CA3AF', border:`1px solid ${active?t.border:'#E2E8F0'}` }}>
                      {active ? '✓ ' : ''}{t.label} ({grouped[t.key as keyof typeof grouped]?.length || 0})
                    </button>
                  )
                })}
              </div>
            </div>
            {TIERS.map(t => {
              const items = grouped[t.key]
              if (!items.length) return null
              return (
                <div key={t.key} style={{ marginBottom:14 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                    <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:t.bg, color:t.text, border:`1px solid ${t.border}` }}>{t.label}</span>
                    <span style={{ fontSize:11, color:'#9CA3AF' }}>{items.length}</span>
                  </div>
                  {items.map((r, i) => (
                    <div key={i} style={{ padding:'8px 0', borderBottom:'1px solid #F1F5F9' }}>
                      <p style={{ fontSize:13, fontWeight:500, color:'#1E293B', margin:'0 0 2px' }}>{r.name}</p>
                      <p style={{ fontSize:11, color:'#64748B', margin:0 }}>{r.reason}</p>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ padding:'12px 16px', borderTop:'1px solid #E2E8F0', flexShrink:0 }}>
        {phase === 'chat' ? (
          <div style={{ display:'flex', gap:8 }}>
            <input value={inputVal} onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){sendMessage();e.preventDefault()} }}
              placeholder="Type your answer or ask a question…" disabled={loading} autoFocus
              style={{ flex:1, fontSize:13, padding:'9px 12px', border:'1px solid #E2E8F0', borderRadius:10, outline:'none', background:loading?'#F8FAFC':'#fff' }} />
            <button onClick={sendMessage} disabled={!inputVal.trim()||loading}
              style={{ padding:'9px 16px', background:inputVal.trim()&&!loading?'#538A22':'#E2E8F0', color:inputVal.trim()&&!loading?'#fff':'#9CA3AF', border:'none', borderRadius:10, fontSize:15, fontWeight:600, cursor:inputVal.trim()&&!loading?'pointer':'default', flexShrink:0 }}>
              →
            </button>
          </div>
        ) : (
          <button onClick={() => onApply(results.filter(r => r.tier === 'remove' || applyTiers.has(r.tier)))}
            className="btn-primary-mrx"
            style={{ width:'100%', padding:'11px 0', background:'#538A22', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            ✓ Apply filter to prescription
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
function rychBadge(tier: number) {
  if (tier === 3) return { bg:'bg-red-100', text:'text-red-700', border:'border-red-200', label:'Severe' }
  if (tier === 2) return { bg:'bg-amber-100', text:'text-amber-700', border:'border-amber-200', label:'Moderate' }
  return { bg:'bg-[#E2F3D0]', text:'text-[#3D6B16]', border:'border-[#C8E9A8]', label:'Mild' }
}

function statusBadge(status: ItemStatus, source?: string) {
  if (source === 'aic' && status === 'kb') return 'bg-blue-100 text-blue-700 border-blue-200'
  switch (status) {
    case 'kb':       return 'bg-slate-100 text-slate-500 border-slate-200'
    case 'modified': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'added':    return 'bg-[#E2F3D0] text-[#3D6B16] border-[#C8E9A8]'
    case 'removed':  return 'bg-red-100 text-red-500 border-red-200'
  }
}

function statusLabel(status: ItemStatus, source?: string) {
  if (source === 'aic' && status === 'kb') return 'AIC Rec'
  switch (status) {
    case 'kb':       return 'From KB'
    case 'modified': return 'Modified'
    case 'added':    return 'Added'
    case 'removed':  return 'Removed'
  }
}

// ─────────────────────────────────────────────────────────────────
// ITEM CARD
// ─────────────────────────────────────────────────────────────────
function ItemCard({ item, isFlashing, onToggle, onNoteChange, onDetailChange, onLabelChange, onConfirmNew, onDiscard, disabled }: {
  item: EditableItem; isFlashing: boolean
  onToggle: (key: string) => void
  onNoteChange: (key: string, note: string) => void
  onDetailChange: (key: string, detail: string) => void
  onLabelChange: (key: string, label: string) => void
  onConfirmNew: (key: string) => void
  onDiscard: (key: string) => void
  disabled?: boolean
}) {
  const [editingDetail, setEditingDetail] = useState(false)
  const [editingNote,   setEditingNote]   = useState(false)
  const isRemoved = item.status === 'removed'

  if (item.isNew) {
    return (
      <div id={`item-${item.key}`} className="rounded-xl border-2 p-4 space-y-3 transition-all duration-300"
        style={{ borderColor:'#538A22', background:'#F2F9EC', boxShadow:isFlashing?'0 0 0 5px rgba(83,138,34,0.18)':'none' }}>
        <p className="text-xs font-semibold" style={{ color:'#538A22' }}>New Item</p>
        <input autoFocus placeholder="Name  (e.g. Curcumin)"
          className="w-full text-sm font-semibold bg-white rounded-lg px-3 py-2 outline-none border"
          style={{ borderColor:'#C8E9A8' }} value={item.label}
          onChange={e => onLabelChange(item.key, e.target.value)} />
        <input placeholder="AIC Product name  (optional)"
          className="w-full text-xs bg-white rounded-lg px-3 py-2 outline-none border"
          style={{ borderColor:'#C8E9A8' }} value={item.aicProduct ?? ''}
          onChange={e => onLabelChange(item.key+'__aic', e.target.value)} />
        <input placeholder="Dose & timing  (e.g. 500 mg 2x/day · With meals · 6 weeks)"
          className="w-full text-xs bg-white rounded-lg px-3 py-2 outline-none border"
          style={{ borderColor:'#C8E9A8' }} value={item.detail}
          onChange={e => onDetailChange(item.key, e.target.value)} />
        <textarea placeholder="Clinical rationale  (optional)" rows={2}
          className="w-full text-xs bg-white rounded-lg px-3 py-2 outline-none border resize-none"
          style={{ borderColor:'#C8E9A8' }} value={item.rationale}
          onChange={e => onNoteChange(item.key+'__rationale', e.target.value)} />
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-slate-400 mr-0.5">Phase:</span>
          {PHASE_ORDER.map(p => {
            const active = item.phase === p; const c = PHASE_STYLE[p]
            return (
              <button key={p} type="button" onClick={() => onLabelChange(item.key+'__phase', p)}
                className="text-[10px] px-2.5 py-1 rounded-full border transition-all"
                style={{ background:active?c.bg:'#fff', color:active?c.text:'#888', borderColor:active?c.border:'#e5e7eb', fontWeight:active?600:400 }}>
                {p}
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={() => onDiscard(item.key)} className="text-xs text-red-400 hover:text-red-600">✕ Discard</button>
          <button type="button" onClick={() => onConfirmNew(item.key)} disabled={!item.label.trim()}
            className="text-xs font-semibold px-4 py-1.5 rounded-full disabled:opacity-40"
            style={{ background:'#538A22', color:'#fff' }}>✓ Add Item</button>
        </div>
      </div>
    )
  }

  return (
    <div id={`item-${item.key}`} className="rounded-xl border p-4 transition-all duration-500"
      style={{ borderColor:isFlashing?'#538A22':isRemoved?'#FECACA':'#e2e8f0', background:isFlashing?'#F2F9EC':isRemoved?'#FEF2F2':'#fff', boxShadow:isFlashing?'0 0 0 3px rgba(83,138,34,0.18)':'none', opacity:isRemoved?0.6:1 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <button onClick={() => !disabled && onToggle(item.key)} disabled={disabled}
            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isRemoved?'border-red-300 bg-white':'border-[#538A22] bg-[#538A22]'} ${disabled?'opacity-50 cursor-not-allowed':''}`}>
            {!isRemoved && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
          </button>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm ${isRemoved?'line-through text-slate-400':'text-slate-800'}`}>{item.label}</p>
            {item.aicProduct && (
              <div className="mt-1">
                <span className="inline-flex items-center rounded-full border border-[#C8E9A8] bg-[#F2F9EC] px-2 py-0.5 text-[10px] font-medium text-[#3D6B16]">
                  AIC Product: {item.aicProduct}
                </span>
              </div>
            )}
            {editingDetail ? (
              <textarea autoFocus className="mt-1 w-full text-xs text-slate-600 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1 resize-none focus:outline-none" rows={2}
                value={item.detail} onChange={e => onDetailChange(item.key, e.target.value)} onBlur={() => setEditingDetail(false)} />
            ) : (
              <p className={`mt-0.5 text-xs text-slate-500 ${!disabled&&!isRemoved?'cursor-text hover:text-slate-700':''}`}
                onClick={() => !disabled&&!isRemoved&&setEditingDetail(true)}>
                {item.detail || <span className="italic text-slate-300">No detail</span>}
              </p>
            )}
            {item.rationale && <p className="mt-1.5 text-xs text-slate-400 leading-relaxed border-l-2 border-slate-200 pl-2">{item.rationale}</p>}
            {item.contraindications && <p className="mt-1.5 text-xs text-red-600 font-medium">⚠ {item.contraindications}</p>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusBadge(item.status, item.source)}`}>
            {statusLabel(item.status, item.source)}
          </span>
          {item.category && <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{item.category}</span>}
          {item.phase && <span className="text-[10px] text-[#538A22] bg-[#F2F9EC] px-2 py-0.5 rounded-full">{item.phase}</span>}
        </div>
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3">
        {editingNote ? (
          <textarea autoFocus className="w-full text-xs bg-[#F2F9EC] border border-[#C8E9A8] rounded-lg px-3 py-2 resize-none focus:outline-none placeholder:text-slate-400" rows={2}
            placeholder="Add doctor note…" value={item.doctorNote}
            onChange={e => onNoteChange(item.key, e.target.value)} onBlur={() => setEditingNote(false)} />
        ) : (
          <button onClick={() => !disabled&&!isRemoved&&setEditingNote(true)} disabled={disabled}
            className={`w-full text-left text-xs text-slate-400 transition-colors ${!disabled?'hover:text-[#538A22]':'cursor-default'}`}>
            {item.doctorNote ? <span className="text-[#3D6B16] font-medium">📝 {item.doctorNote}</span> : <span className="italic">{disabled?'':'+ Add doctor note'}</span>}
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// SECTION
// ─────────────────────────────────────────────────────────────────
function Section({ title, icon, count, children, onAddItem, disabled, extraAction }: {
  title: string; icon: string; count: number; children: React.ReactNode
  onAddItem: () => void; disabled?: boolean; extraAction?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 bg-[#F2F9EC] border-b border-[#C8E9A8]">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h3 className="font-semibold text-[#2A4D0D] text-sm">{title}</h3>
          <span className="text-xs text-[#538A22] bg-[#E2F3D0] px-2 py-0.5 rounded-full font-medium">{count}</span>
        </div>
        <div className="flex items-center gap-2">
          {extraAction}
          {!disabled && (
            <button onClick={onAddItem} className="text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 hover:opacity-90 active:scale-95" style={{ background:'#538A22', color:'#fff' }}>
              <span className="text-sm leading-none">+</span> Add
            </button>
          )}
        </div>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────
export default function DoctorReviewPage() {
  const params   = useParams()
  const router   = useRouter()
  const reportId = params.id as string
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: 'mrx' } })
  const { report: shellReport, loading: shellLoading } = useSectionReport(reportId)

  const [filterMessages, setFilterMessages] = useState<{role:'ai'|'doctor';text:string}[]>([])
  const [filterResults,  setFilterResults]  = useState<FilterResult[]>([])
  const [filterPhase,    setFilterPhase]    = useState<'chat'|'results'>('chat')
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [approving,  setApproving]  = useState(false)
  const [unlocking,  setUnlocking]  = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle'|'saved'|'error'>('idle')
  const [isApproved, setIsApproved] = useState(false)
  const [approvedAt, setApprovedAt] = useState<string|null>(null)
  const [approveError, setApproveError] = useState<string|null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [report,     setReport]     = useState<ReportSummary|null>(null)
  const [sections,   setSections]   = useState<ReviewSections>({ supplements:[], therapies:[], dietary:[] })
  const [clinicalImpression, setClinicalImpression] = useState('')
  const [doctorNotes,        setDoctorNotes]        = useState('')
  const [prescriptionId,     setPrescriptionId]     = useState<string|null>(null)
  const [flashKey,    setFlashKey]    = useState<string|null>(null)
  const [scrollToKey, setScrollToKey] = useState<string|null>(null)
  const [showFilter,    setShowFilter]    = useState(false)
  const [filterApplied, setFilterApplied] = useState(false)
  const [filterSummary, setFilterSummary] = useState('')

  const isEditable = !isApproved || isEditMode

  useEffect(() => {
    if (!scrollToKey) return
    const el = document.getElementById(`item-${scrollToKey}`)
    if (el) { el.scrollIntoView({ behavior:'smooth', block:'center' }); setScrollToKey(null) }
  }, [sections, scrollToKey])

  useEffect(() => {
    async function load() {
      const { data:{ session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data:rep } = await supabase.from('reports')
        .select('id, patient_name, patient_age_sex, patient_id, rules_output, aic_supplement_recommendations')
        .eq('id', reportId).single()
      if (!rep) { router.push('/mrx/dashboard'); return }

      const ro = rep.rules_output as any
      setReport({
        id:rep.id, patient_name:rep.patient_name||'Unknown Patient', patient_age_sex:rep.patient_age_sex||'',
        rych_index:Number(ro?.rych_index??0), rych_tier:Number(ro?.rych_tier??1),
        rych_tier_label:ro?.rych_tier_label??'Unknown', marker_count:Number(ro?.marker_count??0),
        conditions_flagged:(ro?.conditions_flagged??[]) as string[],
        contraindication_alerts:(ro?.contraindication_alerts??[]) as any[],
      })

      let baseSections: ReviewSections = { supplements:[], therapies:[], dietary:[] }
      if (ro) {
        baseSections = {
          supplements:(ro.supplements??[]).map((s:any,i:number)=>({ key:`supp_${i}`, label:s.product_name, aicProduct:s.aic_product_name, detail:[s.dose,s.timing,s.duration].filter(Boolean).join(' · '), rationale:s.mechanism, doctorNote:'', status:'kb' as ItemStatus, category:s.aic_category, phase:s.protocol_phase, contraindications:'' })),
          therapies:(ro.therapies??[]).map((t:any,i:number)=>({ key:`ther_${i}`, label:t.modality||t.therapy_type, detail:[t.frequency,t.course_length].filter(Boolean).join(' · '), rationale:t.dosing_protocol, doctorNote:'', status:'kb' as ItemStatus, category:t.therapy_type, phase:t.tier_indication, contraindications:t.contraindication_screen })),
          dietary:(ro.dietary??[]).map((d:any,i:number)=>({ key:`diet_${i}`, label:`${d.condition_name} - ${d.phase}`, detail:d.duration, rationale:d.specific_instructions, doctorNote:'', status:'kb' as ItemStatus, phase:d.phase, contraindications:'' })),
        }
      }

      const { data:rx } = await supabase.from('prescriptions').select('*').eq('report_id',reportId).maybeSingle()
      if (rx) {
        setPrescriptionId(rx.id); setIsApproved(!!rx.approved_at); setApprovedAt(rx.approved_at??null)
        const rxData = rx.rx_data as any
        if (rxData?.sections)            baseSections = rxData.sections
        if (rxData?.clinical_impression) setClinicalImpression(rxData.clinical_impression)
        if (rxData?.doctor_notes)        setDoctorNotes(rxData.doctor_notes)
      }

      const normalisePhase = (p:string) => { const m=(p||'').match(/Phase\s*(\d+(\+\d+)?)/i); return m?`Phase ${m[1]}`:'Phase 2' }
      let aicData = rep.aic_supplement_recommendations as any

      if (!aicData && ro) {
        try {
          const aicRes = await fetch('/api/mrx/aic-supplements', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ report_id:reportId, report_data:ro }) })
          if (aicRes.ok) aicData = await aicRes.json()
        } catch(e) { console.warn('AIC generation failed:', e) }
      }

      if (aicData) {
        const aicAll:any[] = [...(aicData.phase1??[]),...(aicData.phase2_infection_control??[]),...(aicData.phase2_probiotics??[]),...(aicData.phase2_nutrition??[]),...(aicData.phase3??[])]
        const existingAicNames = new Set(baseSections.supplements.map(s=>s.aicProduct?.toLowerCase().trim()).filter(Boolean))
        const existingLabels   = new Set(baseSections.supplements.map(s=>s.label?.toLowerCase().trim()))
        const aicItems: EditableItem[] = aicAll
          .filter(r => { const aicName=(r.aic_product_name||r.product?.name||r.product_name||'').toLowerCase().trim(); const prodName=(r.product?.name||r.product_name||'').toLowerCase().trim(); return !existingAicNames.has(aicName)&&!existingLabels.has(prodName) })
          .map((r,i) => ({ key:`aic_${r.product_key||i}`, label:r.product?.name||r.product_name||r.product_key||'', aicProduct:'', detail:[r.product?.dose,r.product?.timing].filter(Boolean).join(' · '), rationale:r.ai_rationale||r.product?.subtitle||'', doctorNote:'', status:'kb' as ItemStatus, source:'aic' as const, category:r.product?.category||r.aic_category||'', phase:normalisePhase(r.product?.phase?`Phase ${r.product.phase}`:r.protocol_phase||''), contraindications:'' }))
        baseSections = { ...baseSections, supplements:[...baseSections.supplements,...aicItems] }
      }

      setSections(baseSections)
      setLoading(false)
    }
    load()
  }, [reportId, supabase, router])

  const toggleItem = useCallback((section: keyof ReviewSections, key: string) => {
    setSections(prev => ({ ...prev, [section]:prev[section].map(item => item.key===key?{...item,status:item.status==='removed'?'kb':'removed'}:item) }))
  }, [])

  const updateNote = useCallback((section: keyof ReviewSections, key: string, note: string) => {
    if (key.endsWith('__rationale')) { const rk=key.replace('__rationale',''); setSections(prev=>({...prev,[section]:prev[section].map(item=>item.key===rk?{...item,rationale:note}:item)})); return }
    setSections(prev => ({ ...prev, [section]:prev[section].map(item => item.key===key?{...item,doctorNote:note,status:item.status==='kb'?'modified':item.status}:item) }))
  }, [])

  const updateDetail = useCallback((section: keyof ReviewSections, key: string, detail: string) => {
    setSections(prev => ({ ...prev, [section]:prev[section].map(item => item.key===key?{...item,detail,status:item.status==='kb'?'modified':item.status}:item) }))
  }, [])

  const updateLabel = useCallback((section: keyof ReviewSections, key: string, value: string) => {
    if (key.endsWith('__aic')) { const rk=key.replace('__aic',''); setSections(prev=>({...prev,[section]:prev[section].map(item=>item.key===rk?{...item,aicProduct:value}:item)})); return }
    if (key.endsWith('__phase')) { const rk=key.replace('__phase',''); setSections(prev=>({...prev,[section]:prev[section].map(item=>item.key===rk?{...item,phase:value}:item)})); return }
    setSections(prev => ({ ...prev, [section]:prev[section].map(item => item.key===key?{...item,label:value}:item) }))
  }, [])

  const addItem = useCallback((section: keyof ReviewSections) => {
    const key=`${section}_added_${Date.now()}`
    setSections(prev => ({ ...prev, [section]:[...prev[section],{key,label:'',detail:'',rationale:'',doctorNote:'',status:'added' as ItemStatus,isNew:true,phase:'Phase 1'}] }))
    setFlashKey(key); setScrollToKey(key); setTimeout(()=>setFlashKey(null),1800)
  }, [])

  const confirmNewItem = useCallback((section: keyof ReviewSections, key: string) => {
    setSections(prev => ({ ...prev, [section]:prev[section].map(item=>item.key===key?{...item,isNew:false}:item) }))
    setFlashKey(key); setTimeout(()=>setFlashKey(null),1200)
  }, [])

  const discardItem = useCallback((section: keyof ReviewSections, key: string) => {
    setSections(prev => ({ ...prev, [section]:prev[section].filter(item=>item.key!==key) }))
  }, [])

  const applyFilter = useCallback((results: FilterResult[]) => {
    setSections(prev => {
      const existingResults = results.filter(r => !r.new)
      const newResults      = results.filter(r => r.new && r.tier !== 'remove')

      const norm = (s?: string) => (s || '').toLowerCase().trim()
      // A result name can be "Label / AICProduct" or just "Label" — compare
      // against every half, since the model echoes back whichever form
      // was in the original supplement list.
      const partsOf = (s: string) => s.split('/').map(p => norm(p)).filter(Boolean)

      const updatedExisting = prev.supplements.map(item => {
        // Check BOTH item.label and item.aicProduct — previously this only
        // checked (item.aicProduct || item.label), which silently failed to
        // match any item whose result name led with the label half
        // (e.g. "Triphala / Happy Bowels" vs. an item keyed only by
        // aicProduct "Happy Bowels"), causing correctly-KEPT items to be
        // marked removed since no match was ever found for them.
        const itemNames = [norm(item.label), norm(item.aicProduct)].filter(Boolean)
        const matchedResult = existingResults.find(r => {
          const resultParts = partsOf(r.name)
          return itemNames.some(iName =>
            resultParts.some(rPart => iName.includes(rPart) || rPart.includes(iName))
          )
        })
        if (matchedResult?.tier === 'remove') return {...item, status:'removed' as ItemStatus}
        if (!matchedResult && existingResults.length > 0) return {...item, status:'removed' as ItemStatus}
        if (matchedResult && item.status === 'removed') return {...item, status:'kb' as ItemStatus}
        return item
      })

      // Avoid adding a duplicate if a "new" item actually matches something already on the list
      const existingNames = new Set(
        updatedExisting.flatMap(i => [norm(i.label), norm(i.aicProduct)].filter(Boolean))
      )
      const brandNewItems: EditableItem[] = newResults
        .filter(r => !partsOf(r.name).some(p => existingNames.has(p)))
        .map((r, i) => ({
          key: `filter_added_${Date.now()}_${i}`,
          label: r.name,
          detail: r.detail || '',
          rationale: r.reason,
          doctorNote: '',
          status: 'added' as ItemStatus,
          phase: r.phase || 'Phase 2',
        }))

      return { ...prev, supplements: [...updatedExisting, ...brandNewItems] }
    })
    const must = results.filter(r=>r.tier==='must').length
    const rec  = results.filter(r=>r.tier==='recommended').length
    const rem  = results.filter(r=>r.tier==='remove').length
    const added = results.filter(r=>r.new && r.tier!=='remove').length
    setFilterSummary(`${must} essential · ${rec} recommended · ${rem} removed${added ? ` · ${added} added` : ''}`)
    setFilterApplied(true); setShowFilter(false)
  }, [])

  const buildPayload = () => ({ sections, clinical_impression:clinicalImpression, doctor_notes:doctorNotes, rules_version:'v2.0.0', saved_at:new Date().toISOString() })

  const saveDraft = async () => {
    setSaving(true)
    const payload=buildPayload(); const session=await supabase.auth.getSession()
    const doctorId=session.data.session?.user.id; const patientId=(report as any)?.patient_id??null
    let error:any=null,data:any=null
    if (prescriptionId) { const res=await supabase.from('prescriptions').update({rx_data:payload,doctor_id:doctorId}).eq('id',prescriptionId).select('id').single(); error=res.error;data=res.data }
    else { const res=await supabase.from('prescriptions').upsert({report_id:reportId,patient_id:patientId,doctor_id:doctorId,rx_data:payload},{onConflict:'report_id'}).select('id').single(); error=res.error;data=res.data }
    if (error) { console.error('Save failed:',error.code,error.message); setSaveStatus('error') }
    else { if(data?.id)setPrescriptionId(data.id); setSaveStatus('saved'); setTimeout(()=>setSaveStatus('idle'),2500) }
    setSaving(false)
  }

  // Approval goes through /api/mrx/prescriptions/approve. It used to write
  // from the browser inside a setTimeout that closed over a stale
  // prescriptionId, and treated "no error" as success — but PostgREST reports
  // no error when an UPDATE matches zero rows, so approval silently did
  // nothing and reverted on reload. The route resolves the row server-side
  // and fails loudly when nothing changed.
  const setApproval = async (approved: boolean) => {
    approved ? setApproving(true) : setUnlocking(true)
    setApproveError(null)
    try {
      if (approved) await saveDraft()

      const res = await fetch('/api/mrx/prescriptions/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved,
          reportId,
          prescriptionId,
          patientId: (report as any)?.patient_id ?? null,
          rxData: approved ? buildPayload() : undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Could not update approval.')

      if (json.id) setPrescriptionId(json.id)
      setIsApproved(Boolean(json.approved_at))
      setApprovedAt(json.approved_at ?? null)
      setIsEditMode(false)
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : 'Could not update approval.')
    } finally {
      setApproving(false); setUnlocking(false)
    }
  }

  const approveRx = () => setApproval(true)

  const unlockForEdit = () => setApproval(false)

  const pageData = useMemo(()=>{
    if(!report)return{}
    const aS=sections.supplements.filter(s=>s.status!=='removed')
    const aT=sections.therapies.filter(s=>s.status!=='removed')
    const aD=sections.dietary.filter(s=>s.status!=='removed')
    return { rych_index:report.rych_index,rych_tier_label:report.rych_tier_label,marker_count:report.marker_count,conditions_flagged:report.conditions_flagged,contraindication_alerts:report.contraindication_alerts,is_approved:isApproved,approved_at:approvedAt,clinical_impression:clinicalImpression,doctor_notes:doctorNotes,
      active_supplements:aS.map(s=>({name:s.label,detail:s.detail,rationale:s.rationale,phase:s.phase,category:s.category,doctor_note:s.doctorNote})),
      active_therapies:aT.map(t=>({name:t.label,detail:t.detail,rationale:t.rationale,contraindications:t.contraindications,doctor_note:t.doctorNote})),
      active_dietary:aD.map(d=>({name:d.label,detail:d.detail,rationale:d.rationale,doctor_note:d.doctorNote})),
      removed_items:[...sections.supplements,...sections.therapies,...sections.dietary].filter(i=>i.status==='removed').map(i=>i.label),
      doctor_added:[...sections.supplements,...sections.therapies,...sections.dietary].filter(i=>i.status==='added'&&!i.isNew).map(i=>i.label),
    }
  },[report,sections,clinicalImpression,doctorNotes,isApproved,approvedAt])

  if (loading||shellLoading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-[3px] border-[#538A22] border-t-transparent animate-spin"/>
        <p className="text-sm text-slate-500">Loading review…</p>
      </div>
    </div>
  )
  if (!report||!shellReport) return null

  const rychColor       = rychBadge(report.rych_tier)
  const activeSupps     = sections.supplements.filter(s=>s.status!=='removed')
  const activeTherapies = sections.therapies.filter(s=>s.status!=='removed')
  const activeDietary   = sections.dietary.filter(s=>s.status!=='removed')

  return (
    <SectionPageShell reportId={reportId} section="review" label="Doctor Review" patientName={report.patient_name} pageData={pageData}>
    <div className="min-h-screen bg-slate-50 pb-20">

      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={()=>router.back()} className="text-slate-400 hover:text-slate-700">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <div>
              <p className="text-slate-800 font-semibold text-sm leading-tight">{report.patient_name}</p>
              <p className="text-slate-500 text-xs">{report.patient_age_sex} · Doctor Review</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${rychColor.bg} ${rychColor.border}`}>
              <span className={`text-xs font-bold ${rychColor.text}`}>Rych {report.rych_index}</span>
              <span className={`text-[10px] ${rychColor.text}`}>· {rychColor.label}</span>
            </div>
            <span className="text-slate-500 text-xs">{report.marker_count} markers flagged</span>
            <span className="text-slate-500 text-xs">{report.conditions_flagged.length} conditions</span>
          </div>
          <div className="flex items-center gap-2">
            {isApproved&&!isEditMode&&<span className="text-xs text-[#538A22] hidden sm:block">✓ Approved {approvedAt?new Date(approvedAt).toLocaleDateString():''}</span>}
            {isEditMode&&<span className="text-xs text-amber-500 hidden sm:block animate-pulse">✏ Editing approved RX</span>}
            {/* A failed approval used to be console.error only, so the UI just
                looked like nothing happened. */}
            {approveError&&(
              <span role="alert" className="text-xs font-semibold" style={{color:'var(--rust-600)'}}>
                ⚠ {approveError}
              </span>
            )}
          </div>
        </div>
      </div>

      {isApproved&&isEditMode&&(
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5">
          <div className="max-w-7xl mx-auto"><span className="text-amber-600 text-xs font-medium">✏ You are editing an approved prescription. Re-approve to lock changes.</span></div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 gap-5 grid grid-cols-1 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">

          {report.contraindication_alerts.length>0&&(
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-red-700 flex items-center gap-2"><span>⚠</span> Contraindication Alerts</p>
              {report.contraindication_alerts.map((a,i)=>(
                <div key={i} className={`text-xs rounded-lg px-3 py-2 ${a.severity==='CRITICAL'?'bg-red-100 text-red-700 font-medium border border-red-200':'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  <span className="font-semibold">{a.marker}:</span> {a.alert}
                </div>
              ))}
            </div>
          )}

          {report.conditions_flagged.length>0&&(
            <div className="flex flex-wrap gap-2">
              {report.conditions_flagged.map(c=><span key={c} className="text-xs bg-[#E2F3D0] text-[#3D6B16] border border-[#C8E9A8] px-3 py-1 rounded-full font-medium">{c}</span>)}
            </div>
          )}

          {filterApplied&&(
            <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, padding:'8px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:12, color:'#1D4ED8' }}>🧬 Filter applied: {filterSummary}</span>
              <button onClick={()=>{setFilterApplied(false);setFilterSummary('')}} style={{ fontSize:11, color:'#6B7280', background:'none', border:'none', cursor:'pointer' }}>✕ Clear</button>
            </div>
          )}

          <Section title="Supplements" icon="💊" count={activeSupps.length} onAddItem={()=>addItem('supplements')} disabled={!isEditable}
            extraAction={isEditable?(
              <button onClick={()=>setShowFilter(true)}
                style={{ fontSize:11, fontWeight:600, padding:'5px 10px', background:'#EFF6FF', color:'#1D4ED8', border:'1px solid #BFDBFE', borderRadius:20, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                🧬 AI Filter
              </button>
            ):undefined}>
            {sections.supplements.length===0
              ?<p className="text-xs text-slate-400 italic text-center py-4">No supplements generated.</p>
              :groupByPhase(sections.supplements).map(({phase,items})=>(
                <div key={phase}>
                  <PhaseDivider phase={phase}/>
                  {items.map(item=>(
                    <div key={item.key} className="mb-3">
                      <ItemCard item={item} isFlashing={flashKey===item.key}
                        onToggle={(key:string)=>toggleItem('supplements',key)}
                        onNoteChange={(key:string,note:string)=>updateNote('supplements',key,note)}
                        onDetailChange={(key:string,detail:string)=>updateDetail('supplements',key,detail)}
                        onLabelChange={(key:string,val:string)=>updateLabel('supplements',key,val)}
                        onConfirmNew={(key:string)=>confirmNewItem('supplements',key)}
                        onDiscard={(key:string)=>discardItem('supplements',key)}
                        disabled={!isEditable}/>
                    </div>
                  ))}
                </div>
              ))
            }
          </Section>

          <Section title="LP Therapies" icon="⚗️" count={activeTherapies.length} onAddItem={()=>addItem('therapies')} disabled={!isEditable}>
            {sections.therapies.length===0
              ?<p className="text-xs text-slate-400 italic text-center py-4">No therapies generated.</p>
              :sections.therapies.map(item=>(
                <ItemCard key={item.key} item={item} isFlashing={flashKey===item.key}
                  onToggle={(key:string)=>toggleItem('therapies',key)}
                  onNoteChange={(key:string,note:string)=>updateNote('therapies',key,note)}
                  onDetailChange={(key:string,detail:string)=>updateDetail('therapies',key,detail)}
                  onLabelChange={(key:string,val:string)=>updateLabel('therapies',key,val)}
                  onConfirmNew={(key:string)=>confirmNewItem('therapies',key)}
                  onDiscard={(key:string)=>discardItem('therapies',key)}
                  disabled={!isEditable}/>
              ))
            }
          </Section>

          <Section title="Dietary Protocol" icon="🥗" count={activeDietary.length} onAddItem={()=>addItem('dietary')} disabled={!isEditable}>
            {sections.dietary.length===0
              ?<p className="text-xs text-slate-400 italic text-center py-4">No dietary protocols generated.</p>
              :groupDietaryByPhase(sections.dietary).map(({phase,items})=>(
                <div key={phase}>
                  <PhaseDivider phase={phase}/>
                  {items.map(item=>(
                    <div key={item.key} className="mb-3">
                      <ItemCard item={item} isFlashing={flashKey===item.key}
                        onToggle={(key:string)=>toggleItem('dietary',key)}
                        onNoteChange={(key:string,note:string)=>updateNote('dietary',key,note)}
                        onDetailChange={(key:string,detail:string)=>updateDetail('dietary',key,detail)}
                        onLabelChange={(key:string,val:string)=>updateLabel('dietary',key,val)}
                        onConfirmNew={(key:string)=>confirmNewItem('dietary',key)}
                        onDiscard={(key:string)=>discardItem('dietary',key)}
                        disabled={!isEditable}/>
                    </div>
                  ))}
                </div>
              ))
            }
          </Section>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">RX Summary</p>
            <div className="space-y-2">
              {[
                { label:'Supplements',   count:activeSupps.length },
                { label:'AIC Recs',      count:sections.supplements.filter(s=>s.source==='aic'&&s.status!=='removed').length },
                { label:'Therapies',     count:activeTherapies.length },
                { label:'Dietary phases',count:activeDietary.length },
                { label:'Removed items', count:[...sections.supplements,...sections.therapies,...sections.dietary].filter(i=>i.status==='removed').length },
                { label:'Doctor added',  count:[...sections.supplements,...sections.therapies,...sections.dietary].filter(i=>i.status==='added'&&!i.isNew).length },
              ].map(row=>(
                <div key={row.label} className="flex justify-between text-xs">
                  <span className="text-slate-500">{row.label}</span>
                  <span className="font-semibold text-slate-700">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Clinical Impression</p>
            <textarea className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#538A22] placeholder:text-slate-300 disabled:opacity-60" rows={5} placeholder="Overall clinical assessment…" value={clinicalImpression} onChange={e=>setClinicalImpression(e.target.value)} disabled={!isEditable}/>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Doctor Notes</p>
            <textarea className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#538A22] placeholder:text-slate-300 disabled:opacity-60" rows={4} placeholder="Internal notes, follow-up plan…" value={doctorNotes} onChange={e=>setDoctorNotes(e.target.value)} disabled={!isEditable}/>
          </div>
          {isApproved&&!isEditMode&&(
            <div className="bg-[#F2F9EC] rounded-2xl border border-[#C8E9A8] p-4 text-center">
              <p className="text-xs text-[#3D6B16] font-semibold">RX Approved</p>
              {approvedAt&&<p className="text-xs text-[#538A22] mt-1">{new Date(approvedAt).toLocaleString()}</p>}
              <p className="text-[10px] text-slate-400 mt-2">Use the Edit button below to make changes.</p>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {saveStatus==='saved'&&<span className="text-xs text-[#538A22] animate-pulse whitespace-nowrap">✓ Draft saved</span>}
            {saveStatus==='error'&&<span className="text-xs text-red-500 whitespace-nowrap">Save failed - try again</span>}
            {isApproved&&!isEditMode&&saveStatus==='idle'&&<span className="text-xs text-[#538A22] truncate">✓ Approved · {approvedAt?new Date(approvedAt).toLocaleString():''}</span>}
            {isEditMode&&saveStatus==='idle'&&<span className="text-xs text-amber-500 whitespace-nowrap">✏ Editing - re-approve to lock</span>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
          <button
  onClick={async () => {
    await saveDraft()
    window.open(`/mrx/report/${reportId}/prescription-print`, '_blank')
  }}
  disabled={saving}
  className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"
>
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
  {saving ? 'Saving…' : 'Download'}
</button>
            {isApproved&&!isEditMode&&<button onClick={()=>setIsEditMode(true)} className="px-3 py-2 text-xs font-medium rounded-lg border border-amber-400 text-amber-600 hover:bg-amber-50 flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>Edit RX</button>}
            {isEditMode&&<button onClick={()=>setIsEditMode(false)} className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50">Cancel</button>}
            {isEditMode&&<button onClick={unlockForEdit} disabled={unlocking} className="px-3 py-2 text-xs font-medium rounded-lg border border-red-300 text-red-500 hover:bg-red-50 disabled:opacity-40">{unlocking?'Unlocking…':'🔓 Remove Approval'}</button>}
            {isEditable&&<button onClick={saveDraft} disabled={saving} className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40">{saving?'Saving…':'Save Draft'}</button>}
            {!isApproved
              ?<button onClick={approveRx} disabled={approving} className="btn-primary-mrx px-5 py-2 text-xs font-semibold rounded-lg bg-[#538A22] text-white hover:bg-[#3D6B16] disabled:opacity-50">{approving?'Approving…':'✓ Approve RX'}</button>
              :isEditMode
                ?<button onClick={approveRx} disabled={approving} className="px-5 py-2 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">{approving?'Saving…':'✓ Re-approve RX'}</button>
                :<span className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#E2F3D0] text-[#3D6B16] border border-[#C8E9A8]">✓ Approved</span>
            }
          </div>
        </div>
      </div>
    </div>

    {showFilter&&(
      <FilterPanel
        supplements={sections.supplements.filter(s=>s.status!=='removed')}
        onApply={applyFilter}
        onClose={()=>setShowFilter(false)}
        persistedMessages={filterMessages}
        persistedResults={filterResults}
        persistedPhase={filterPhase}
        onMessagesChange={setFilterMessages}
        onResultsChange={setFilterResults}
        onPhaseChange={setFilterPhase}
      />
    )}
    </SectionPageShell>
  )
}