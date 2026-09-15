'use client'
import { useState, useRef, useEffect } from 'react'
import { Sparkles, Loader2, Send, X, Check, AlertTriangle } from 'lucide-react'

const C = { accent: '#2563EB', accentSoft: '#EFF4FF', line: '#ECEBE3', ink: '#1A2417', danger: '#B3261E' }

type RecipeOverrides = Record<string, { ingredients: string; steps: string }>

// Rewrites every recipe currently showing anywhere in this patient's plan in
// one shot ("remove all the garlic," "no cashews anywhere") instead of a
// coach opening each recipe and editing it by hand. Calls the dedicated
// bulk endpoint (not AiEditButton's single-field ai-edit-field route) since
// this touches many recipe_bank rows at once and writes a per-roadmap
// override keyed by recipe id, never the shared recipe itself.
export default function AiBulkRecipeEditButton({ roadmapId, onApply }: {
  roadmapId: string
  onApply: (overrides: RecipeOverrides) => void
}) {
  const [open, setOpen] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<{ id: string; name: string; changed: boolean }[] | null>(null)
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
    if (!instruction.trim() || loading) return
    setLoading(true)
    setError('')
    setResults(null)
    try {
      const res = await fetch(`/api/compass/roadmaps/${roadmapId}/ai-bulk-edit-recipes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: instruction.trim() }),
      })
      const j = await res.json()
      if (!res.ok) { setError(j.error || 'Could not apply that edit.'); return }
      onApply(j.recipeContentOverrides as RecipeOverrides)
      setResults(j.results as { id: string; name: string; changed: boolean }[])
      setInstruction('')
    } catch { setError('Network error, try again.') }
    finally { setLoading(false) }
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} title="Ask AI to rewrite every recipe in this plan"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: open ? C.accentSoft : 'none', border: `1px solid ${open ? C.accent : C.line}`, borderRadius: 20, padding: '3px 9px', cursor: 'pointer', color: C.accent, fontSize: 11, fontWeight: 700 }}>
        <Sparkles size={11} /> Ask AI to edit all recipes
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, width: 340, background: '#fff', border: `1px solid ${C.accent}`, borderRadius: 12, padding: 12, boxShadow: '0 8px 24px rgba(17,24,39,0.15)', zIndex: 40 }}>
          <p style={{ fontSize: 11, color: '#8A9284', margin: '0 0 8px' }}>
            Applies to every recipe currently shown anywhere in this patient&rsquo;s plan. Only this plan&rsquo;s copy changes.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              ref={inputRef}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !loading) submit() }}
              placeholder='e.g. "remove all the garlic"'
              style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12.5, boxSizing: 'border-box' }}
            />
            <button type="button" onClick={submit} disabled={loading || !instruction.trim()}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, flexShrink: 0, borderRadius: 8, border: 'none', background: C.accent, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading || !instruction.trim() ? 0.6 : 1 }}>
              {loading ? <Loader2 size={13} style={{ animation: 'clpBulkAiSpin 1s linear infinite' }} /> : <Send size={13} />}
            </button>
            <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9284', flexShrink: 0 }}><X size={14} /></button>
          </div>
          {loading && <p style={{ fontSize: 11.5, color: C.ink, opacity: 0.7, margin: '8px 0 0' }}>Rewriting recipes, this can take a minute for a long plan...</p>}
          {error && <p style={{ fontSize: 11.5, color: C.danger, margin: '8px 0 0' }}>{error}</p>}
          {results && (
            <div style={{ marginTop: 10, maxHeight: 160, overflowY: 'auto', borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
              {results.map((r) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: C.ink, padding: '2px 0' }}>
                  {r.changed ? <Check size={12} color="#1E7A34" /> : <AlertTriangle size={12} color="#B08900" />}
                  <span>{r.name}{!r.changed && ' (no change)'}</span>
                </div>
              ))}
            </div>
          )}
          <style>{`@keyframes clpBulkAiSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
    </div>
  )
}
