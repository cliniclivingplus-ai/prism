'use client'
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'

// Click-to-edit primitive for coach inline editing directly on a
// patient-facing template (WeekTemplate first, more templates later).
//
// The `editable` flag is the whole security boundary here, and it is
// deliberately dumb: when false this renders a plain, inert element with no
// click handler, no hover affordance, nothing in the DOM hinting an edit
// control exists. The exact same JSX this file backs (WeekTemplate.tsx) is
// also what the public /share/roadmap/<token> page renders, so this
// component MUST default to read-only and never infer editability from
// anything except the boolean its caller passes straight through from its
// own `editable` prop — never from a route, a cookie, or a guess.
export default function InlineEditableText({
  value, onSave, editable, style, as = 'span', multiline = false, placeholder, onClick,
}: {
  value: string
  onSave: (next: string) => void
  editable: boolean
  style?: CSSProperties
  as?: 'span' | 'div'
  multiline?: boolean
  placeholder?: string
  // Fires only in read-only mode (e.g. a patient tapping to check off a
  // goal) — editable mode owns the click for entering edit state instead.
  onClick?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)

  // Keyed on `editing` alone (not `draft`), so this fires exactly once when
  // entering edit mode — not on every keystroke. An inline ref-callback
  // function is a fresh reference on every render, so using one here instead
  // (as an earlier version of this file did, to dodge an unrelated
  // set-state-in-effect lint warning elsewhere in this file) made React
  // detach/reattach it on every keystroke's re-render, calling .select()
  // again each time — which re-selected the whole field after every single
  // character, so typing a second letter just replaced the first. This
  // effect calls no setState, so it was never actually the lint problem.
  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  const Tag = as

  if (!editable) {
    return (
      <Tag style={style} onClick={onClick}>{value || placeholder || ''}</Tag>
    )
  }

  function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
  }
  function cancel() {
    setDraft(value)
    setEditing(false)
  }

  if (editing) {
    // `...style` first so the caller's own color/fontSize/lineHeight (often
    // light text on a dark section background, as in WeekTemplate's roadmap
    // section) survive — an input/textarea has no color of its own by
    // default, so overriding these with 'inherit' here would make edited
    // text invisible against a dark ancestor that never explicitly sets a
    // text color for it to inherit.
    const editStyle: CSSProperties = {
      ...style, display: 'block', width: '100%',
      background: 'rgba(120,120,120,0.12)', border: '1px dashed currentColor', borderRadius: 4, padding: '2px 4px', boxSizing: 'border-box',
    }
    return multiline ? (
      <textarea
        ref={inputRef as RefObject<HTMLTextAreaElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Escape') cancel() }}
        rows={Math.max(2, Math.ceil(draft.length / 42))}
        style={editStyle}
      />
    ) : (
      <input
        ref={inputRef as RefObject<HTMLInputElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') cancel()
        }}
        style={editStyle}
      />
    )
  }

  return (
    <Tag
      title="Click to edit"
      onClick={(e) => { e.stopPropagation(); setDraft(value); setEditing(true) }}
      style={{ ...style, cursor: 'text', borderRadius: 4, outline: '1px dashed transparent', outlineOffset: 2, transition: 'outline-color 0.15s ease' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.outlineColor = 'currentColor' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.outlineColor = 'transparent' }}
    >
      {value || placeholder || ''}
    </Tag>
  )
}
