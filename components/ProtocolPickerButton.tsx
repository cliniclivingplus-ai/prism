'use client'
import { useMemo, useRef, useState, useEffect } from 'react'
import { ListPlus, Search, Check } from 'lucide-react'
import { LIFESTYLE_PROTOCOLS } from '@/lib/lifestyleProtocols'

const C = { accent: '#2563EB', accentSoft: '#EFF4FF', line: '#ECEBE3', muted: '#8A9284', ink: '#1C2B29' }

// Lets a coach pick from the clinic's own curated bank of real, previously-
// used lifestyle protocol lines (see lib/lifestyleProtocols.ts) instead of
// typing one from scratch every time. Appends the chosen line as a new line
// in whichever period textarea it's attached to (Morning/Afternoon/Evening
// or Breakfast/Lunch/Dinner) — same one-item-per-line convention parseBullets
// already reads everywhere else in this editor. Sits next to LinkInsertButton.
export default function ProtocolPickerButton({ value, onChange }: {
  value: string
  onChange: (next: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { if (open) searchRef.current?.focus() }, [open])
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return LIFESTYLE_PROTOCOLS
      .filter((cat) => category === 'all' || cat.id === category)
      .map((cat) => ({ ...cat, items: cat.items.filter((item) => !q || item.toLowerCase().includes(q)) }))
      .filter((cat) => cat.items.length > 0)
  }, [category, query])

  function addItem(item: string) {
    const next = value && value.trim() ? `${value.replace(/\n+$/, '')}\n${item}` : item
    onChange(next)
    setJustAdded(item)
    setTimeout(() => setJustAdded((cur) => (cur === item ? null : cur)), 1200)
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setOpen((o) => !o)} title="Pick from saved lifestyle protocols"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: open ? C.accentSoft : 'none', border: `1px solid ${open ? C.accent : C.line}`, borderRadius: 20, padding: '3px 9px', cursor: 'pointer', color: C.accent, fontSize: 11, fontWeight: 700 }}>
        <ListPlus size={11} /> Pick
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, width: 320, maxHeight: 360, display: 'flex', flexDirection: 'column', background: '#fff', border: `1px solid ${C.accent}`, borderRadius: 12, boxShadow: '0 8px 24px rgba(17,24,39,0.15)', zIndex: 40, overflow: 'hidden' }}>
          <div style={{ padding: 10, borderBottom: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} color={C.muted} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search protocols…"
                style={{ width: '100%', padding: '7px 10px 7px 28px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12.5, boxSizing: 'border-box' }}
              />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12, color: C.ink, background: '#fff' }}>
              <option value="all">All categories</option>
              {LIFESTYLE_PROTOCOLS.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>
          <div style={{ overflowY: 'auto', padding: '4px 0' }}>
            {results.length === 0 ? (
              <p style={{ fontSize: 12, color: C.muted, margin: 0, padding: '14px 12px' }}>No protocols match &quot;{query}&quot;.</p>
            ) : (
              results.map((cat) => (
                <div key={cat.id} style={{ padding: '6px 0' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: C.muted, padding: '4px 12px' }}>{cat.label}</div>
                  {cat.items.map((item) => (
                    <button key={item} type="button" onClick={() => addItem(item)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12.5, color: C.ink, lineHeight: 1.4 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = C.accentSoft }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}>
                      {justAdded === item ? <Check size={13} color={C.accent} style={{ flexShrink: 0 }} /> : <span style={{ width: 13, flexShrink: 0 }} />}
                      {item}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
