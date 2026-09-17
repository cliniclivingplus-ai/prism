'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import { ChefHat, X } from 'lucide-react'

const C = { accent: '#2563EB', accentSoft: '#EFF4FF', line: '#ECEBE3', muted: '#8A9284', ink: '#1A2417' }

type BankRecipeLite = { id: string; name: string }

// Sibling to LinkInsertButton, for the one case a coach can't just paste a
// URL for: linking a lifestyle line ("Okra water in the morning") to one of
// this clinic's OWN recipes, which have no public URL of their own — they
// only ever render as a card inside a patient's own guide. Points at that
// same guide's own Recipes section via a real, plain http(s) URL (the only
// kind renderMarkdownBold ever turns into a real link — see its comment),
// so it survives being forwarded same as any other link; the guide reads
// the #recipe-<id> fragment on load and opens that exact recipe (see each
// template's own "open from link" effect).
export default function RecipeLinkInsertButton({ getTextarea, value, onChange, recipeBank, shareToken }: {
  getTextarea: () => HTMLTextAreaElement | null
  value: string
  onChange: (next: string) => void
  recipeBank: BankRecipeLite[]
  shareToken?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
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
    let start = el?.selectionStart ?? 0
    let end = el?.selectionEnd ?? 0
    // A double- or triple-click in a <textarea> can include the trailing
    // newline in the selection (browser-dependent) — left in, that newline
    // lands inside the [label](url) brackets and breaks every downstream
    // parser that splits this text back into one bullet per line (see
    // LinkInsertButton, which has the same exposure but is rarely triple-
    // clicked since coaches usually drag-select a shorter phrase there).
    while (end > start && (value[end - 1] === '\n' || value[end - 1] === '\r')) end--
    while (start < end && (value[start] === '\n' || value[start] === '\r')) start++
    const hasSelection = !!el && start !== end
    setSelection(hasSelection ? { start, end } : null)
    setQuery('')
    setOpen(true)
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? recipeBank.filter((r) => r.name.toLowerCase().includes(q)) : recipeBank
    return list.slice(0, 40)
  }, [query, recipeBank])

  function pick(recipe: BankRecipeLite) {
    if (!selection || !shareToken) return
    const url = `${window.location.origin}/share/roadmap/${shareToken}#recipe-${recipe.id}`
    const phrase = value.slice(selection.start, selection.end)
    const next = value.slice(0, selection.start) + `[${phrase}](${url})` + value.slice(selection.end)
    onChange(next)
    setOpen(false)
    requestAnimationFrame(() => getTextarea()?.focus())
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); openPopover() }} title="Link the selected text to a recipe from the recipe bank"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: open ? C.accentSoft : 'none', border: `1px solid ${open ? C.accent : C.line}`, borderRadius: 20, padding: '3px 9px', cursor: 'pointer', color: C.accent, fontSize: 11, fontWeight: 700 }}>
        <ChefHat size={11} /> Recipe
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, width: 280, background: '#fff', border: `1px solid ${C.accent}`, borderRadius: 12, padding: 12, boxShadow: '0 8px 24px rgba(17,24,39,0.15)', zIndex: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: selection && shareToken ? 8 : 0 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: C.ink }}>Link to a recipe</span>
            <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><X size={14} /></button>
          </div>
          {!selection ? (
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Select a phrase in the text box first, then click Recipe again.</p>
          ) : !shareToken ? (
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Save this roadmap and generate its share link first — a recipe link needs somewhere to open.</p>
          ) : (
            <>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recipes…"
                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12.5, boxSizing: 'border-box', marginBottom: 8 }}
              />
              <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 2 }}>
                {results.length === 0 && <p style={{ fontSize: 12, color: C.muted, margin: '4px 0' }}>No recipes match &quot;{query}&quot;.</p>}
                {results.map((r) => (
                  <button key={r.id} type="button" onClick={() => pick(r)}
                    style={{ textAlign: 'left', padding: '7px 9px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', fontSize: 12.5, color: C.ink }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.accentSoft }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}>
                    {r.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
