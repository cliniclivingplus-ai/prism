'use client'
import { useState, useRef } from 'react'
import { ImageIcon, Loader2 } from 'lucide-react'

const C = { accent: '#2563EB', line: '#ECEBE3', danger: '#B3261E', muted: '#8A9284' }

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

// Uploads a picture and appends it as a new line — `![picture](url)` —
// same one-item-per-line convention every other insert here follows
// (LinkInsertButton, ProtocolPickerButton). renderMarkdownBold turns that
// into a real <img> everywhere this text is shown (patient dashboard, PDF).
// No cropping/tagging UI — this is a single inline picture for one spot,
// not a Picture Bank entry (see app/api/compass/inline-image/route.ts).
export default function ImageInsertButton({ value, onChange }: {
  value: string
  onChange: (next: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

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

      const next = value && value.trim() ? `${value.replace(/\n+$/, '')}\n![picture](${json.url})` : `![picture](${json.url})`
      onChange(next)
    } catch {
      setError('Network error — try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
      />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} title="Upload a picture into this section"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: `1px solid ${C.line}`, borderRadius: 20, padding: '3px 9px', cursor: uploading ? 'default' : 'pointer', color: C.accent, fontSize: 11, fontWeight: 700, opacity: uploading ? 0.6 : 1 }}>
        {uploading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <ImageIcon size={11} />} {uploading ? 'Uploading…' : 'Picture'}
      </button>
      {error && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, width: 200, background: '#fff', border: `1px solid ${C.danger}`, borderRadius: 10, padding: '8px 10px', fontSize: 11.5, color: C.danger, boxShadow: '0 8px 24px rgba(17,24,39,0.15)', zIndex: 40 }}>
          {error}
        </div>
      )}
    </div>
  )
}
