import { X } from 'lucide-react'
import { extractImages } from '@/lib/renderMarkdownBold'

// The textarea a coach types/pastes ![alt](url) into shows only that raw
// text — no rendered preview — so picking or uploading a picture had no
// visible confirmation it actually landed, and no way to remove one short
// of hand-editing the raw markdown line. Small thumbnail strip under the
// box, one per image currently in that text, each with its own delete —
// removing a thumbnail strips exactly that one `![alt](url)` occurrence
// (and the newline it sat on) out of the text, same one-line-per-item
// convention every other insert here follows.
export default function ImagePreviewStrip({ value, onChange }: {
  value: string
  onChange: (next: string) => void
}) {
  const images = extractImages(value)
  if (images.length === 0) return null

  function remove(url: string) {
    const token = `![${images.find((i) => i.url === url)?.alt ?? ''}](${url})`
    const next = value
      .replace(`\n${token}`, '') // as a line of its own (the common case)
      .replace(token, '') // inline within a line, if it wasn't
    onChange(next)
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {images.map((img, i) => (
        <div key={i} title={img.alt || 'picture'} style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: 7, border: '1px solid #ECEBE3', background: `url(${img.url}) center/cover` }} />
          <button type="button" onClick={() => remove(img.url)} title="Remove this picture"
            style={{ position: 'absolute', top: -6, right: -6, width: 17, height: 17, borderRadius: '50%', border: '1px solid #ECEBE3', background: '#fff', color: '#B3261E', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            <X size={10} />
          </button>
        </div>
      ))}
    </div>
  )
}
