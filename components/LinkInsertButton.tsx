'use client'
import { useState, useRef, useEffect } from 'react'
import { Link2, X, Check } from 'lucide-react'

const C = { accent: '#2563EB', accentSoft: '#EFF4FF', line: '#ECEBE3', danger: '#B3261E', muted: '#8A9284' }

// Lets a coach turn any phrase they've selected inside a plain <textarea>
// into an inline link — [phrase](url), the same narrow markdown grammar
// renderMarkdownBold already turns into a real <a> everywhere lifestyle/meal
// guideline text is shown (Week-family templates, the dashboard, etc).
// Deliberately no AI involved and no auto-generated URL: there is no real
// source URL anywhere in this app's data to link to automatically (see
// interpret/route.ts's KB search, which only has document titles), so the
// coach supplies the link themselves, same as inserting a hyperlink in Word.
export default function LinkInsertButton({ getTextarea, value, onChange }: {
  // A lazy getter rather than a ref object directly: the caller keeps one
  // ref map for several periods (Morning/Afternoon/Evening, etc), and
  // reading `.current` has to happen inside an event handler, never during
  // render — passing `() => refsMap.current[period]` keeps that read out of
  // the render phase entirely, satisfying the react-hooks/refs rule.
  getTextarea: () => HTMLTextAreaElement | null
  value: string
  onChange: (next: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  // Captured at click time (onMouseDown, before the button click would
  // otherwise blur the textarea and clear the visible selection) so the
  // popover always links exactly what was highlighted when it was opened.
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { if (open && selection) inputRef.current?.focus() }, [open, selection])
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function openPopover() {
    const el = getTextarea()
    const hasSelection = !!el && el.selectionStart !== el.selectionEnd
    setSelection(hasSelection ? { start: el!.selectionStart, end: el!.selectionEnd } : null)
    setUrl('')
    setError('')
    setOpen(true)
  }

  function submit() {
    if (!selection) return
    const trimmed = url.trim()
    if (!/^https?:\/\//i.test(trimmed)) { setError('Enter a full link starting with http:// or https://'); return }
    const phrase = value.slice(selection.start, selection.end)
    const next = value.slice(0, selection.start) + `[${phrase}](${trimmed})` + value.slice(selection.end)
    onChange(next)
    setOpen(false)
    setUrl('')
    requestAnimationFrame(() => getTextarea()?.focus())
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); openPopover() }} title="Turn the selected text into a link"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: open ? C.accentSoft : 'none', border: `1px solid ${open ? C.accent : C.line}`, borderRadius: 20, padding: '3px 9px', cursor: 'pointer', color: C.accent, fontSize: 11, fontWeight: 700 }}>
        <Link2 size={11} /> Link
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, width: 260, background: '#fff', border: `1px solid ${C.accent}`, borderRadius: 12, padding: 12, boxShadow: '0 8px 24px rgba(17,24,39,0.15)', zIndex: 40 }}>
          {!selection ? (
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Select a phrase in the text box first, then click Link again.</p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  ref={inputRef}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
                  placeholder="https://..."
                  style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12.5, boxSizing: 'border-box' }}
                />
                <button type="button" onClick={submit} disabled={!url.trim()}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, flexShrink: 0, borderRadius: 8, border: 'none', background: C.accent, color: '#fff', cursor: 'pointer', opacity: url.trim() ? 1 : 0.6 }}>
                  <Check size={13} />
                </button>
                <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, flexShrink: 0 }}><X size={14} /></button>
              </div>
              {error && <p style={{ fontSize: 11.5, color: C.danger, margin: '8px 0 0' }}>{error}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
