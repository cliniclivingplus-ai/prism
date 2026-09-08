import { extractImages } from '@/lib/renderMarkdownBold'

// The textarea a coach types/pastes ![alt](url) into shows only that raw
// text — no rendered preview — so picking or uploading a picture had no
// visible confirmation it actually landed. Small thumbnail strip under the
// box, one per image currently in that text, so a coach can see it without
// switching to the patient-facing page.
export default function ImagePreviewStrip({ value }: { value: string }) {
  const images = extractImages(value)
  if (images.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {images.map((img, i) => (
        <div key={i} title={img.alt || 'picture'}
          style={{ width: 44, height: 44, borderRadius: 7, border: '1px solid #ECEBE3', background: `url(${img.url}) center/cover`, flexShrink: 0 }} />
      ))}
    </div>
  )
}
