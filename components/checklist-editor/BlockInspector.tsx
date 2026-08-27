'use client'
import { useState, useRef, type CSSProperties, type ReactNode } from 'react'
import { Plus, Trash2, Search, ChefHat, Image as ImageIcon, Upload, Loader2 } from 'lucide-react'
import type { ChecklistPageBlock, BlockIconKey } from '@/lib/blocks/types'
import type { RecipeLookup, ImageLookup } from '@/lib/blocks/BlockRenderer'
import { IconPickerDropdown } from './IconPickerDropdown'
import { ColorSwatchPicker } from './ColorSwatchPicker'

const C = {
  green: '#538A22', ink: '#1A2417', muted: '#6b7280', faint: '#8A9284', line: '#ECEBE3', card: '#FFFFFF', danger: '#B3261E',
}
const inputStyle: CSSProperties = { width: '100%', padding: '7px 9px', borderRadius: 7, border: `1px solid ${C.line}`, fontSize: 12.5, color: C.ink, boxSizing: 'border-box', fontFamily: 'inherit' }
const labelStyle: CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, marginTop: 12 }
const rowBtnStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 11, padding: 2 }
const addBtnStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, background: 'none', border: `1px dashed ${C.line}`, borderRadius: 7, padding: '6px 10px', color: C.green, cursor: 'pointer', fontSize: 12, fontWeight: 700 }

type Recipe = RecipeLookup
type GuideImage = ImageLookup

// Structured, per-type manual editors for the checklist's "Manual edit"
// canvas — the coach's alternative/complement to the AI command box. Every
// change here goes through the same validateBlock() guard as AI output
// once saved (see PATCH /api/compass/checklists/[id]), so this UI only ever needs
// to produce well-shaped data, never sanitize it itself.
export function BlockInspector({ block, onChange, recipes, images, onImageUploaded, showBackgroundPicker = true }: {
  block: ChecklistPageBlock
  onChange: (updated: ChecklistPageBlock) => void
  recipes: Recipe[]
  images: GuideImage[]
  // Called with the new row after a coach uploads a picture directly from
  // this panel — lets the parent add it to its own images list/lookup
  // without a full refetch. New uploads land in the shared Picture bank
  // (same table/bucket as the dedicated Picture bank page), so they're
  // reusable everywhere afterward too.
  onImageUploaded?: (image: GuideImage) => void
  // Checklist editor keeps per-block background swatches. Roadmap custom
  // blocks inherit the active dashboard template instead — no color picker.
  showBackgroundPicker?: boolean
}) {
  const bg = block.layout?.bg

  function setBg(next: typeof bg) {
    onChange({ ...block, layout: block.layout ? { ...block.layout, bg: next } : block.layout })
  }

  return (
    <div>
      {showBackgroundPicker && (
        <>
          <div style={labelStyle}>Background</div>
          <ColorSwatchPicker value={bg} onChange={setBg} />
        </>
      )}
      <TypeSpecificEditor block={block} onChange={onChange} recipes={recipes} images={images} onImageUploaded={onImageUploaded} />
    </div>
  )
}

function TypeSpecificEditor({ block, onChange, recipes, images, onImageUploaded }: { block: ChecklistPageBlock; onChange: (updated: ChecklistPageBlock) => void; recipes: Recipe[]; images: GuideImage[]; onImageUploaded?: (image: GuideImage) => void }) {
  switch (block.type) {
    case 'hero':
      return (
        <>
          <Field label="Title" value={block.title} onChange={(v) => onChange({ ...block, title: v })} />
          <Field label="Subtitle" value={block.subtitle ?? ''} onChange={(v) => onChange({ ...block, subtitle: v || undefined })} />
        </>
      )

    case 'text_block':
      return (
        <>
          <Field label="Title" value={block.title ?? ''} onChange={(v) => onChange({ ...block, title: v || undefined })} />
          <Field label="Text" value={block.text} onChange={(v) => onChange({ ...block, text: v })} multiline />
        </>
      )

    case 'pull_quote':
      return (
        <>
          <Field label="Quote" value={block.text} onChange={(v) => onChange({ ...block, text: v })} multiline />
          <Field label="Attribution" value={block.attribution ?? ''} onChange={(v) => onChange({ ...block, attribution: v || undefined })} />
        </>
      )

    case 'checklist':
      return (
        <>
          <Field label="Title" value={block.title ?? ''} onChange={(v) => onChange({ ...block, title: v || undefined })} />
          <div style={labelStyle}>Items</div>
          {block.items.map((it, i) => (
            <ListRow key={i} onRemove={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}>
              <input style={inputStyle} value={it.text} onChange={(e) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? { text: e.target.value } : x)) })} />
            </ListRow>
          ))}
          <button type="button" style={addBtnStyle} onClick={() => onChange({ ...block, items: [...block.items, { text: '' }] })}><Plus size={13} /> Add item</button>
        </>
      )

    case 'stat_row':
      return (
        <>
          <Field label="Title" value={block.title ?? ''} onChange={(v) => onChange({ ...block, title: v || undefined })} />
          <div style={labelStyle}>Items</div>
          {block.items.map((it, i) => (
            <ListRow key={i} onRemove={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}>
              <IconPickerDropdown value={it.icon} allowNone onChange={(icon) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, icon } : x)) })} />
              <input style={inputStyle} placeholder="Value" value={it.value} onChange={(e) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
              <input style={inputStyle} placeholder="Label" value={it.label} onChange={(e) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            </ListRow>
          ))}
          <button type="button" style={addBtnStyle} onClick={() => onChange({ ...block, items: [...block.items, { label: '', value: '' }] })}><Plus size={13} /> Add stat</button>
        </>
      )

    case 'icon_grid':
      return (
        <>
          <Field label="Title" value={block.title ?? ''} onChange={(v) => onChange({ ...block, title: v || undefined })} />
          <div style={labelStyle}>Items</div>
          {block.items.map((it, i) => (
            <ListRow key={i} onRemove={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}>
              <IconPickerDropdown value={it.icon} allowNone onChange={(icon) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, icon } : x)) })} />
              <input style={inputStyle} placeholder="Topic" value={it.topic} onChange={(e) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, topic: e.target.value } : x)) })} />
              <input style={inputStyle} placeholder="Text" value={it.text} onChange={(e) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
            </ListRow>
          ))}
          <button type="button" style={addBtnStyle} onClick={() => onChange({ ...block, items: [...block.items, { topic: '', text: '' }] })}><Plus size={13} /> Add item</button>
        </>
      )

    case 'goal_icons':
      return (
        <>
          <Field label="Title" value={block.title ?? ''} onChange={(v) => onChange({ ...block, title: v || undefined })} />
          <div style={labelStyle}>Goals</div>
          {block.items.map((it, i) => (
            <ListRow key={i} onRemove={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}>
              <IconPickerDropdown value={it.icon} onChange={(icon) => icon && onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, icon } : x)) })} />
              <input style={inputStyle} placeholder="Label" value={it.label} onChange={(e) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            </ListRow>
          ))}
          <button type="button" style={addBtnStyle} onClick={() => onChange({ ...block, items: [...block.items, { icon: 'target' as BlockIconKey, label: '' }] })}><Plus size={13} /> Add goal</button>
        </>
      )

    case 'chart':
      return (
        <>
          <Field label="Title" value={block.title ?? ''} onChange={(v) => onChange({ ...block, title: v || undefined })} />
          <div style={labelStyle}>Chart type</div>
          <select style={inputStyle} value={block.chartType} onChange={(e) => onChange({ ...block, chartType: e.target.value as 'bar' | 'donut' })}>
            <option value="bar">Bar</option>
            <option value="donut">Donut</option>
          </select>
          <div style={labelStyle}>Data</div>
          {block.data.map((d, i) => (
            <ListRow key={i} onRemove={() => onChange({ ...block, data: block.data.filter((_, j) => j !== i) })}>
              <input style={inputStyle} placeholder="Label" value={d.label} onChange={(e) => onChange({ ...block, data: block.data.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <input style={inputStyle} type="number" placeholder="Value" value={d.value} onChange={(e) => onChange({ ...block, data: block.data.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) || 0 } : x)) })} />
            </ListRow>
          ))}
          <button type="button" style={addBtnStyle} onClick={() => onChange({ ...block, data: [...block.data, { label: '', value: 0 }] })}><Plus size={13} /> Add row</button>
        </>
      )

    case 'table':
      return (
        <>
          <Field label="Title" value={block.title ?? ''} onChange={(v) => onChange({ ...block, title: v || undefined })} />
          <div style={labelStyle}>Columns</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {block.headers.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <input style={{ ...inputStyle, width: 90 }} value={h} onChange={(e) => onChange({ ...block, headers: block.headers.map((x, j) => (j === i ? e.target.value : x)) })} />
                <button type="button" style={rowBtnStyle} onClick={() => onChange({ ...block, headers: block.headers.filter((_, j) => j !== i), rows: block.rows.map((r) => r.filter((_, j) => j !== i)) })}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
          {block.headers.length < 8 && (
            <button type="button" style={addBtnStyle} onClick={() => onChange({ ...block, headers: [...block.headers, `Col ${block.headers.length + 1}`], rows: block.rows.map((r) => [...r, '']) })}><Plus size={13} /> Add column</button>
          )}
          <div style={labelStyle}>Rows</div>
          {block.rows.map((row, ri) => (
            <ListRow key={ri} onRemove={() => onChange({ ...block, rows: block.rows.filter((_, j) => j !== ri) })}>
              {row.map((cell, ci) => (
                <input key={ci} style={inputStyle} value={cell} onChange={(e) => onChange({ ...block, rows: block.rows.map((r, j) => (j === ri ? r.map((c, k) => (k === ci ? e.target.value : c)) : r)) })} />
              ))}
            </ListRow>
          ))}
          {block.rows.length < 20 && (
            <button type="button" style={addBtnStyle} onClick={() => onChange({ ...block, rows: [...block.rows, block.headers.map(() => '')] })}><Plus size={13} /> Add row</button>
          )}
        </>
      )

    case 'recipe_gallery':
      return <GalleryEditor mode="recipe" ids={block.recipe_ids} items={recipes} onChange={(ids) => onChange({ ...block, recipe_ids: ids })} title={block.title} onTitleChange={(v) => onChange({ ...block, title: v || undefined })} />

    case 'image_gallery':
      return <GalleryEditor mode="image" ids={block.image_ids} items={images} onChange={(ids) => onChange({ ...block, image_ids: ids })} title={block.title} onTitleChange={(v) => onChange({ ...block, title: v || undefined })} onImageUploaded={onImageUploaded} />

    case 'image':
      return (
        <>
          <Field label="Caption (optional)" value={block.caption ?? ''} onChange={(v) => onChange({ ...block, caption: v || undefined })} />
          <GalleryEditor mode="image" single ids={block.image_id ? [block.image_id] : []} items={images}
            onChange={(ids) => onChange({ ...block, image_id: ids[0] ?? block.image_id })}
            onImageUploaded={onImageUploaded} />
        </>
      )

    default:
      return null
  }
}

function Field({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <>
      <div style={labelStyle}>{label}</div>
      {multiline ? (
        <textarea style={{ ...inputStyle, resize: 'vertical' as const }} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </>
  )
}

function ListRow({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>{children}</div>
      <button type="button" style={rowBtnStyle} onClick={onRemove}><Trash2 size={13} /></button>
    </div>
  )
}

function GalleryEditor<T extends { id: string }>({ mode, ids, items, onChange, title, onTitleChange, single, onImageUploaded }: {
  mode: 'recipe' | 'image'
  ids: string[]
  items: T[]
  onChange: (ids: string[]) => void
  title?: string
  onTitleChange?: (v: string) => void
  // Single-select (for the standalone `image` block, one picture rather
  // than a gallery grid) — picking replaces the selection instead of
  // toggling a multi-select set.
  single?: boolean
  onImageUploaded?: (image: GuideImage) => void
}) {
  const [search, setSearch] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const nameOf = (it: T) => (mode === 'recipe' ? (it as unknown as Recipe).name : (it as unknown as GuideImage).label)
  const filtered = search.trim() ? items.filter((it) => nameOf(it).toLowerCase().includes(search.trim().toLowerCase())) : items

  function toggle(id: string) {
    if (single) { onChange([id]); return }
    onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  }

  return (
    <>
      {onTitleChange && <Field label="Title" value={title ?? ''} onChange={onTitleChange} />}
      <div style={labelStyle}>{mode === 'recipe' ? 'Recipes' : 'Images'} ({ids.length} picked)</div>
      <div style={{ position: 'relative', marginBottom: 6 }}>
        <Search size={12} color={C.faint} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
        <input style={{ ...inputStyle, paddingLeft: 24 }} placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div style={{ maxHeight: 160, overflowY: 'auto', border: `1px solid ${C.line}`, borderRadius: 7, padding: 6 }}>
        {filtered.length === 0 && <div style={{ fontSize: 11.5, color: C.muted, padding: 4 }}>No results.</div>}
        {filtered.map((it) => (
          <label key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 3px', fontSize: 12, cursor: 'pointer' }}>
            <input type={single ? 'radio' : 'checkbox'} name={single ? 'gallery-single-pick' : undefined} checked={ids.includes(it.id)} onChange={() => toggle(it.id)} />
            {mode === 'recipe' ? <ChefHat size={12} color={C.faint} /> : <ImageIcon size={12} color={C.faint} />}
            <span>{nameOf(it)}</span>
          </label>
        ))}
      </div>
      {mode === 'image' && (
        <>
          <button type="button" style={addBtnStyle} onClick={() => setUploadOpen((o) => !o)}><Upload size={13} /> Upload new picture</button>
          {uploadOpen && (
            <ImageUploadForm onUploaded={(image) => {
              onImageUploaded?.(image)
              toggle(image.id)
              setUploadOpen(false)
            }} />
          )}
        </>
      )}
    </>
  )
}

function ImageUploadForm({ onUploaded }: { onUploaded: (image: GuideImage) => void }) {
  const [label, setLabel] = useState('')
  const [tags, setTags] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  async function upload() {
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('Choose a picture first.'); return }
    if (!label.trim()) { setError('Give it a short label.'); return }
    if (!tags.trim()) { setError('Add at least one tag.'); return }
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('label', label.trim())
      form.set('tags', tags.trim())
      const res = await fetch('/api/compass/guide-images', { method: 'POST', body: form })
      const j = await res.json()
      if (!res.ok) { setError(j.error || 'Upload failed.'); return }
      onUploaded(j as GuideImage)
    } catch { setError('Network error, try again.') }
    finally { setUploading(false) }
  }

  return (
    <div style={{ marginTop: 8, padding: 10, border: `1px solid ${C.line}`, borderRadius: 8, background: '#FAFAF8' }}>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ fontSize: 11.5, marginBottom: 8, width: '100%' }} />
      <input style={{ ...inputStyle, marginBottom: 6 }} placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
      <input style={{ ...inputStyle, marginBottom: 6 }} placeholder="Tags, comma separated" value={tags} onChange={(e) => setTags(e.target.value)} />
      {error && <div style={{ fontSize: 11, color: C.danger, marginBottom: 6 }}>{error}</div>}
      <button type="button" onClick={upload} disabled={uploading}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: 'none', background: C.green, color: '#fff', fontSize: 12, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
        {uploading ? <Loader2 size={13} style={{ animation: 'clpSpin 1s linear infinite' }} /> : <Upload size={13} />}
        {uploading ? 'Uploading…' : 'Upload'}
      </button>
      <style>{`@keyframes clpSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
