'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import { ImageIcon, Loader2, Search, FolderOpen, Images } from 'lucide-react'

const C = { accent: '#2563EB', accentSoft: '#EFF4FF', line: '#ECEBE3', danger: '#B3261E', muted: '#8A9284', ink: '#1C2B29' }

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

type BankImage = { id: string; label: string; tags: string[]; image_url: string }

// module-scoped so every ImageInsertButton on the page shares one fetch of
// the Picture Bank, same pattern as useKeywordLinkBank.
let bankCache: BankImage[] | null = null
let bankInflight: Promise<BankImage[]> | null = null
function fetchBank(): Promise<BankImage[]> {
  if (bankCache) return Promise.resolve(bankCache)
  if (!bankInflight) {
    bankInflight = fetch('/api/compass/guide-images')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: BankImage[]) => { bankCache = data; return data })
      .catch(() => [])
  }
  return bankInflight
}

// Inserting a picture now offers two sources: pick an existing, already-
// labeled Picture Bank image (instant, no upload) or upload a new one from
// the coach's own machine (the original flow — see
// app/api/compass/inline-image/route.ts). Either way the result is the
// same `![alt](url)` line, rendered as a real <img> by renderMarkdownBold.
export default function ImageInsertButton({ value, onChange }: {
  value: string
  onChange: (next: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'choose' | 'bank' | 'upload'>('choose')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [bank, setBank] = useState<BankImage[]>(bankCache ?? [])
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (mode === 'bank') fetchBank().then(setBank)
  }, [mode])
  useEffect(() => { if (mode === 'bank') searchRef.current?.focus() }, [mode])
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) { setOpen(false); setMode('choose') }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const labeled = bank.filter((img) => img.label.trim() && img.tags.length > 0)
    if (!q) return labeled
    return labeled.filter((img) => img.label.toLowerCase().includes(q) || img.tags.some((t) => t.includes(q)))
  }, [bank, query])

  function insert(url: string, alt: string) {
    const next = value && value.trim() ? `${value.replace(/\n+$/, '')}\n![${alt}](${url})` : `![${alt}](${url})`
    onChange(next)
    setOpen(false)
    setMode('choose')
  }

  async function handleFile(file: File) {
    setError('')
    if (!ALLOWED_TYPES.has(file.type)) { setError('Use a PNG, JPEG, or WebP image'); return }
    if (file.size > MAX_BYTES) { setError('Image must be under 5MB'); return }

    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/compass/inline-image', { method: 'POST', body: form })
      const json = await res.json().catch(() => null)
      if (!res.ok) { setError(json?.error || 'Upload failed'); return }
      insert(json.url, 'picture')
    } catch {
      setError('Network error — try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', display: 'inline-block' }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
      />
      <button type="button" onClick={() => setOpen((o) => !o)} disabled={uploading} title="Add a picture to this section"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: open ? C.accentSoft : 'none', border: `1px solid ${open ? C.accent : C.line}`, borderRadius: 20, padding: '3px 9px', cursor: uploading ? 'default' : 'pointer', color: C.accent, fontSize: 11, fontWeight: 700, opacity: uploading ? 0.6 : 1 }}>
        {uploading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <ImageIcon size={11} />} {uploading ? 'Uploading…' : 'Picture'}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, width: mode === 'bank' ? 320 : 220, maxHeight: mode === 'bank' ? 420 : undefined, display: 'flex', flexDirection: 'column', background: '#fff', border: `1px solid ${C.accent}`, borderRadius: 12, boxShadow: '0 8px 24px rgba(17,24,39,0.15)', zIndex: 40, overflow: 'hidden' }}>
          {mode === 'choose' && (
            <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button type="button" onClick={() => setMode('bank')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '9px 10px', border: 'none', background: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, color: C.ink }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.accentSoft }} onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}>
                <Images size={14} color={C.accent} /> Picture bank
              </button>
              <button type="button" onClick={() => { setOpen(false); setMode('choose'); inputRef.current?.click() }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '9px 10px', border: 'none', background: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, color: C.ink }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.accentSoft }} onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}>
                <FolderOpen size={14} color={C.accent} /> Upload from folder
              </button>
            </div>
          )}

          {mode === 'bank' && (
            <>
              <div style={{ padding: 10, borderBottom: `1px solid ${C.line}`, position: 'relative' }}>
                <Search size={13} color={C.muted} style={{ position: 'absolute', left: 19, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search the picture bank…"
                  style={{ width: '100%', padding: '7px 10px 7px 28px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12.5, boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ overflowY: 'auto', padding: 8 }}>
                {results.length === 0 ? (
                  <p style={{ fontSize: 12, color: C.muted, margin: 0, padding: '14px 4px' }}>
                    {bank.length === 0 ? 'No labeled pictures in the bank yet.' : `No matches for "${query}".`}
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {results.map((img) => (
                      <button key={img.id} type="button" onClick={() => insert(img.image_url, img.label)} title={img.label}
                        style={{ padding: 0, border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: '#fff', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ width: '100%', height: 56, background: `url(${img.image_url}) center/cover` }} />
                        <span style={{ fontSize: 9.5, padding: '3px 4px', color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
      {error && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, width: 200, background: '#fff', border: `1px solid ${C.danger}`, borderRadius: 10, padding: '8px 10px', fontSize: 11.5, color: C.danger, boxShadow: '0 8px 24px rgba(17,24,39,0.15)', zIndex: 40 }}>
          {error}
        </div>
      )}
    </div>
  )
}
