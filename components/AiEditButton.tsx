'use client'
import { useState, useRef, useEffect } from 'react'
import { Sparkles, Loader2, Send, X } from 'lucide-react'

const C = { accent: '#2563EB', accentSoft: '#EFF4FF', line: '#ECEBE3', ink: '#1A2417', danger: '#B3261E' }

// A small "ask AI to edit this" affordance, dropped next to any editable
// section in the Classic roadmap editor — sits alongside manual field
// editing, never replaces it (a coach can still just type). Applies the
// AI's result to local draft state exactly like a manual edit would;
// "Save changes" still has to be clicked separately to persist.
export default function AiEditButton<T>({ roadmapId, kind, value, context, onApply, label }: {
  roadmapId: string
  kind: 'text' | 'week' | 'care_team_member' | 'service' | 'power_point'
  value: T
  context?: string
  onApply: (next: T) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  async function submit() {
    if (!instruction.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/compass/roadmaps/${roadmapId}/ai-edit-field`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, current_value: value, instruction: instruction.trim(), context }),
      })
      const j = await res.json()
      if (!res.ok) { setError(j.error || 'Could not apply that edit.'); return }
      onApply(j.value as T)
      setOpen(false)
      setInstruction('')
    } catch { setError('Network error, try again.') }
    finally { setLoading(false) }
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} title="Ask AI to edit this"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: open ? C.accentSoft : 'none', border: `1px solid ${open ? C.accent : C.line}`, borderRadius: 20, padding: '3px 9px', cursor: 'pointer', color: C.accent, fontSize: 11, fontWeight: 700 }}>
        <Sparkles size={11} /> {label || 'Ask AI'}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, width: 320, background: '#fff', border: `1px solid ${C.accent}`, borderRadius: 12, padding: 12, boxShadow: '0 8px 24px rgba(17,24,39,0.15)', zIndex: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              ref={inputRef}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !loading) submit() }}
              placeholder='e.g. "make this shorter" or "add a note about her allergy"'
              style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12.5, boxSizing: 'border-box' }}
            />
            <button type="button" onClick={submit} disabled={loading || !instruction.trim()}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, flexShrink: 0, borderRadius: 8, border: 'none', background: C.accent, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading || !instruction.trim() ? 0.6 : 1 }}>
              {loading ? <Loader2 size={13} style={{ animation: 'clpAiSpin 1s linear infinite' }} /> : <Send size={13} />}
            </button>
            <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9284', flexShrink: 0 }}><X size={14} /></button>
          </div>
          {error && <p style={{ fontSize: 11.5, color: C.danger, margin: '8px 0 0' }}>{error}</p>}
          <style>{`@keyframes clpAiSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
    </div>
  )
}
