'use client'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { BLOCK_ICON_KEYS, type BlockIconKey } from '@/lib/blocks/types'
import { resolveBlockIcon } from '@/lib/blocks/icons'

const C = { line: '#ECEBE3', ink: '#1A2417', muted: '#6b7280', accent: '#2563EB', accentSoft: '#EFF4FF' }

// A small, fixed icon vocabulary picker — never free text, matching the
// same "structured fields only" trust model as AI-generated icon fields
// (see BLOCK_ICON_KEYS in lib/blocks/types.ts).
export function IconPickerDropdown({ value, onChange, allowNone }: { value?: BlockIconKey; onChange: (icon: BlockIconKey | undefined) => void; allowNone?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const CurrentIcon = value ? resolveBlockIcon(value) : null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.line}`, background: '#fff', cursor: 'pointer', fontSize: 12.5, color: C.ink }}>
        {CurrentIcon ? <CurrentIcon size={14} color={C.accent} /> : <span style={{ color: C.muted }}>No icon</span>}
        <ChevronDown size={12} color={C.muted} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 20, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, padding: 8, boxShadow: '0 8px 20px rgba(17,24,39,0.12)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, width: 180 }}>
          {allowNone && (
            <button type="button" onClick={() => { onChange(undefined); setOpen(false) }}
              style={{ gridColumn: 'span 5', fontSize: 11, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '4px 2px' }}>
              Clear icon
            </button>
          )}
          {BLOCK_ICON_KEYS.map((key) => {
            const Icon = resolveBlockIcon(key)
            const selected = value === key
            return (
              <button key={key} type="button" onClick={() => { onChange(key); setOpen(false) }} title={key}
                style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: `1px solid ${selected ? C.accent : 'transparent'}`, background: selected ? C.accentSoft : 'transparent', cursor: 'pointer' }}>
                <Icon size={15} color={C.accent} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
