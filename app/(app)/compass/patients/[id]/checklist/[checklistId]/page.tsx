'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Rnd } from 'react-rnd'
import { ArrowLeft, Loader2, Link2, Check, Sparkles, X, Send, LayoutTemplate, Wand2, Plus, Copy, Trash2 } from 'lucide-react'
import { BlockRenderer, BlockCard, BlockBody, computeCanvasHeight, CANVAS_WIDTH, type RecipeLookup, type ImageLookup } from '@/lib/blocks/BlockRenderer'
import { BLOCK_TYPES, type ChecklistPageBlock, type BlockType, type BlockLayout } from '@/lib/blocks/types'
import { BlockInspector } from '@/components/checklist-editor/BlockInspector'

const C = {
  green: '#538A22', ink: '#1A2417', muted: '#6b7280', faint: '#8A9284', line: '#ECEBE3', card: '#FFFFFF',
  accent: '#2563EB', accentSoft: '#EFF4FF',
}

type Checklist = { id: string; patient_id: string; title: string | null; condition_goal: string; blocks: ChecklistPageBlock[]; recipe_ids: string[]; image_ids: string[]; status: string; share_token?: string | null; share_revoked_at?: string | null }

const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  hero: 'Heading', stat_row: 'Stat row', pull_quote: 'Quote', checklist: 'Checklist', icon_grid: 'Icon grid',
  goal_icons: 'Goal icons', chart: 'Chart', text_block: 'Text', table: 'Table',
  recipe_gallery: 'Recipe gallery', image_gallery: 'Image gallery', image: 'Image',
}
// Multi-select galleries need a real pick to be valid (validateBlock rejects
// an empty id list) — offered for editing on existing blocks, not as a
// quick-add default. 'image' (single picture) IS addable — see addBlock(),
// which seeds it with an existing picture rather than an empty id.
const ADDABLE_TYPES: BlockType[] = ['hero', 'stat_row', 'pull_quote', 'checklist', 'icon_grid', 'goal_icons', 'chart', 'text_block', 'table', 'image']

function defaultBlockFor(type: BlockType): ChecklistPageBlock {
  const id = `blk_${Math.random().toString(36).slice(2, 10)}`
  switch (type) {
    case 'hero': return { id, type, title: 'New heading' }
    case 'stat_row': return { id, type, items: [{ label: 'Label', value: '0' }] }
    case 'pull_quote': return { id, type, text: 'A short, motivating line.' }
    case 'checklist': return { id, type, items: [{ text: 'New item' }] }
    case 'icon_grid': return { id, type, items: [{ topic: 'Topic', text: 'Details' }] }
    case 'goal_icons': return { id, type, items: [{ icon: 'target', label: 'New goal' }] }
    case 'chart': return { id, type, chartType: 'bar', data: [{ label: 'A', value: 1 }] }
    case 'text_block': return { id, type, text: 'New text.' }
    case 'table': return { id, type, headers: ['Column 1'], rows: [['']] }
    default: return { id, type: 'text_block', text: '' }
  }
}

export default function ChecklistEditorPage() {
  const params = useParams()
  const router = useRouter()
  const patientId = params.id as string
  const checklistId = params.checklistId as string

  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [recipesById, setRecipesById] = useState<Record<string, RecipeLookup>>({})
  const [imagesById, setImagesById] = useState<Record<string, ImageLookup>>({})
  const [allRecipes, setAllRecipes] = useState<RecipeLookup[]>([])
  const [allImages, setAllImages] = useState<ImageLookup[]>([])
  const [loading, setLoading] = useState(true)

  const [mode, setMode] = useState<'ai' | 'manual'>('ai')
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [instruction, setInstruction] = useState('')
  const [applying, setApplying] = useState(false)
  const [editError, setEditError] = useState('')
  const [copied, setCopied] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The canvas is a fixed 720px design surface, but this panel is often
  // narrower — without this it just overflowed with a horizontal scrollbar
  // and blocks looked like they were floating in mostly-empty space. Scaling
  // the whole canvas down as one unit (same trick as ScaledCanvasView, the
  // read-only render) keeps blocks visible and proportioned; react-rnd's own
  // `scale` prop compensates its drag/resize math for the CSS transform.
  const canvasEditorRef = useRef<HTMLDivElement | null>(null)
  const [canvasEditorScale, setCanvasEditorScale] = useState(1)
  useEffect(() => {
    const el = canvasEditorRef.current
    if (!el) return
    const update = () => setCanvasEditorScale(Math.min(1, el.clientWidth / CANVAS_WIDTH))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [mode])

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch(`/api/compass/checklists/${checklistId}`).then((r) => r.json()),
      fetch('/api/compass/recipe-bank').then((r) => r.json()).catch(() => []),
      fetch('/api/compass/guide-images').then((r) => r.json()).catch(() => []),
    ]).then(([j, recipes, images]: [Checklist & { error?: string }, RecipeLookup[], ImageLookup[]]) => {
      if (!alive || j.error) return
      setChecklist(j)
      setAllRecipes(Array.isArray(recipes) ? recipes : [])
      setAllImages(Array.isArray(images) ? images : [])
      setRecipesById(Object.fromEntries((Array.isArray(recipes) ? recipes : []).filter((r) => j.recipe_ids.includes(r.id)).map((r) => [r.id, r])))
      setImagesById(Object.fromEntries((Array.isArray(images) ? images : []).filter((im) => j.image_ids.includes(im.id)).map((im) => [im.id, im])))
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [checklistId])

  useEffect(() => {
    if (selectedBlockId && mode === 'ai') inputRef.current?.focus()
  }, [selectedBlockId, mode])

  const scheduleSave = useCallback((blocks: ChecklistPageBlock[]) => {
    setSaveState('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/compass/checklists/${checklistId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocks }),
        })
        setSaveState(res.ok ? 'saved' : 'idle')
      } catch { setSaveState('idle') }
    }, 800)
  }, [checklistId])

  function updateBlocks(next: ChecklistPageBlock[]) {
    setChecklist((prev) => (prev ? { ...prev, blocks: next } : prev))
    scheduleSave(next)
  }

  // Saves immediately rather than waiting on the debounce, so leaving the
  // page (via "Done" or "Back to patient") never drops the last change made
  // right before navigating away.
  const flushSave = useCallback(async (blocks: ChecklistPageBlock[]) => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    setSaveState('saving')
    try {
      const res = await fetch(`/api/compass/checklists/${checklistId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks }),
      })
      setSaveState(res.ok ? 'saved' : 'idle')
    } catch { setSaveState('idle') }
  }, [checklistId])

  async function handleLeave() {
    if (checklist) await flushSave(checklist.blocks)
    router.push(`/compass/patients/${patientId}`)
  }

  // Switching into Manual edit for the first time on a checklist with no
  // layout data: measure the exact stacked render (currently on screen in
  // AI mode) and turn it into initial x/y/w/h per block, so nothing jumps.
  function enterManualMode() {
    if (!checklist) return
    const hasLayout = checklist.blocks.some((b) => b.layout)
    if (!hasLayout) {
      let y = 0
      const withLayout = checklist.blocks.map((b) => {
        const el = blockRefs.current.get(b.id)
        const h = el ? Math.max(60, Math.round(el.getBoundingClientRect().height)) : 120
        const layout: BlockLayout = { x: 0, y, w: CANVAS_WIDTH, h }
        y += h + 16
        return { ...b, layout }
      })
      updateBlocks(withLayout)
    }
    setMode('manual')
    setSelectedBlockId(null)
  }

  async function applyEdit() {
    if (!selectedBlockId || !instruction.trim() || !checklist) return
    setApplying(true)
    setEditError('')
    try {
      const res = await fetch(`/api/compass/checklists/${checklistId}/edit-block`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ block_id: selectedBlockId, instruction: instruction.trim() }),
      })
      const j = await res.json()
      if (!res.ok) { setEditError(j.error || 'Could not apply that edit.'); return }
      setChecklist((prev) => prev ? { ...prev, blocks: prev.blocks.map((b) => (b.id === selectedBlockId ? j.block : b)) } : prev)
      setInstruction('')
    } catch { setEditError('Network error, try again.') }
    finally { setApplying(false) }
  }

  // A picture uploaded from inside the block inspector lands in the shared
  // Picture bank immediately (see BlockInspector's ImageUploadForm) — add
  // it to local state right away so it's pickable/renderable without a
  // full page reload.
  function handleImageUploaded(image: ImageLookup) {
    setAllImages((prev) => [image, ...prev])
    setImagesById((prev) => ({ ...prev, [image.id]: image }))
  }

  function copyLink() {
    // Addressed by share_token, not by the checklist's row id — /checklist/<id>
    // is no longer a route, so this used to copy a dead link.
    const token = checklist?.share_revoked_at ? null : checklist?.share_token
    if (!token) return
    const url = `${window.location.origin}/share/checklist/${token}`
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  function addBlock(type: BlockType) {
    if (!checklist) return
    // 'image' needs a real image_id to ever be valid (same rule as the
    // galleries) — seed it with whatever's already in the Picture bank
    // rather than an empty id that would just get silently dropped on the
    // next save; the coach can swap it via the inspector right away.
    if (type === 'image' && allImages.length === 0) return
    const bottom = checklist.blocks.reduce((max, b) => Math.max(max, (b.layout?.y ?? 0) + (b.layout?.h ?? 0)), 0)
    const block: ChecklistPageBlock = type === 'image'
      ? { id: `blk_${Math.random().toString(36).slice(2, 10)}`, type: 'image', image_id: allImages[0].id }
      : defaultBlockFor(type)
    const layout: BlockLayout = { x: 0, y: bottom + 16, w: CANVAS_WIDTH, h: type === 'image' ? 240 : 140 }
    updateBlocks([...checklist.blocks, { ...block, layout }])
    setAddMenuOpen(false)
    setSelectedBlockId(block.id)
  }

  function duplicateBlock(id: string) {
    if (!checklist) return
    const block = checklist.blocks.find((b) => b.id === id)
    if (!block) return
    const clone: ChecklistPageBlock = { ...block, id: `blk_${Math.random().toString(36).slice(2, 10)}`, layout: block.layout ? { ...block.layout, x: block.layout.x + 20, y: block.layout.y + 20 } : undefined }
    updateBlocks([...checklist.blocks, clone])
    setSelectedBlockId(clone.id)
  }

  function deleteBlock(id: string) {
    if (!checklist) return
    updateBlocks(checklist.blocks.filter((b) => b.id !== id))
    if (selectedBlockId === id) setSelectedBlockId(null)
  }

  function updateBlock(updated: ChecklistPageBlock) {
    if (!checklist) return
    updateBlocks(checklist.blocks.map((b) => (b.id === updated.id ? updated : b)))
  }

  // Block height is never something the coach fights with — it's always
  // exactly the content's real height. When a block's rendered content
  // grows or shrinks (a row added, text wrapping, an icon changed), every
  // block below it (by y-order) shifts to absorb the difference, so
  // nothing overlaps and nothing clips behind a scrollbar.
  const contentObservers = useRef<Map<string, ResizeObserver>>(new Map())
  function registerContentEl(id: string, el: HTMLDivElement | null) {
    const existing = contentObservers.current.get(id)
    if (existing) { existing.disconnect(); contentObservers.current.delete(id) }
    if (!el) return
    const observer = new ResizeObserver(() => {
      const measured = Math.max(40, Math.round(el.scrollHeight))
      syncBlockHeight(id, measured)
    })
    observer.observe(el)
    contentObservers.current.set(id, observer)
  }
  function syncBlockHeight(id: string, measuredHeight: number) {
    setChecklist((prev) => {
      if (!prev) return prev
      const block = prev.blocks.find((b) => b.id === id)
      if (!block?.layout || Math.abs(block.layout.h - measuredHeight) < 2) return prev
      const next = applyLayoutCascade(prev.blocks, id, { h: measuredHeight })
      scheduleSave(next)
      return { ...prev, blocks: next }
    })
  }
  // Any manual layout change — resizing a block taller, or just dragging it
  // to a new spot — shifts every block below by however far this block's
  // own bottom edge moved, so moving or growing one block always makes room
  // instead of overlapping whatever comes after it. (Free-resized blocks
  // like `image` also need this for height itself: their content div always
  // fills the box exactly, so the ResizeObserver-driven auto-height sync
  // above never sees a mismatch to react to.)
  function applyLayoutCascade(blocks: ChecklistPageBlock[], id: string, patch: Partial<BlockLayout>) {
    const block = blocks.find((b) => b.id === id)
    if (!block?.layout) return blocks
    const oldY = block.layout.y
    const oldBottom = block.layout.y + block.layout.h
    const newLayout = { ...block.layout, ...patch }
    const delta = (newLayout.y + newLayout.h) - oldBottom
    return blocks.map((b) => {
      if (b.id === id) return { ...b, layout: newLayout }
      if (delta !== 0 && b.layout && b.layout.y > oldY) return { ...b, layout: { ...b.layout, y: Math.max(0, b.layout.y + delta) } }
      return b
    })
  }

  if (loading) return <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 0' }}><Loader2 size={22} style={{ animation: 'clpSpin 1s linear infinite' }} /><style>{`@keyframes clpSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style></div>
  if (!checklist) return <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 0', color: C.muted }}>Checklist not found.</div>

  const selectedBlock = checklist.blocks.find((b) => b.id === selectedBlockId) ?? null

  return (
    <div style={{ maxWidth: mode === 'manual' ? 1120 : 820, margin: '0 auto', paddingBottom: 120 }}>
      <button onClick={handleLeave} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.faint, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 18, fontWeight: 500 }}>
        <ArrowLeft size={14} /> Back to patient
      </button>

      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: '#FAF9F5', paddingTop: 8, paddingBottom: 12, marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: 0 }}>{checklist.title || 'Consultation checklist'}</h1>
            <p style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>
              {mode === 'ai' ? 'Click any section below, then describe the change you want in the box that appears.' : 'Drag to move, drag a side handle to resize width. Click a block to edit its content.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', border: `1px solid ${C.line}`, borderRadius: 9, overflow: 'hidden' }}>
              <button onClick={() => setMode('ai')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 12px', border: 'none', background: mode === 'ai' ? C.accentSoft : '#fff', color: mode === 'ai' ? C.accent : C.muted, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <Wand2 size={13} /> AI edit
              </button>
              <button onClick={enterManualMode} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 12px', border: 'none', borderLeft: `1px solid ${C.line}`, background: mode === 'manual' ? C.accentSoft : '#fff', color: mode === 'manual' ? C.accent : C.muted, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <LayoutTemplate size={13} /> Manual edit
              </button>
            </div>
            <button onClick={copyLink}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9, border: `1px solid ${C.line}`, background: '#fff', color: C.ink, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              {copied ? <><Check size={13} color={C.green} /> Copied</> : <><Link2 size={13} /> Copy patient link</>}
            </button>
          </div>
        </div>
      </div>

      {mode === 'ai' && (
        <>
          <BlockRenderer
            blocks={checklist.blocks}
            recipesById={recipesById}
            imagesById={imagesById}
            selectable
            selectedBlockId={selectedBlockId}
            onSelectBlock={(id) => { setSelectedBlockId(id === selectedBlockId ? null : id); setEditError('') }}
            onBlockRef={(id, el) => { if (el) blockRefs.current.set(id, el); else blockRefs.current.delete(id) }}
          />

          {selectedBlockId && (
            <div style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', width: 'min(560px, calc(100vw - 32px))', background: C.card, border: `1px solid ${C.accent}`, borderRadius: 16, padding: '14px 16px', boxShadow: '0 12px 32px rgba(17,24,39,0.18)', zIndex: 50 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Sparkles size={14} color={C.accent} />
                <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>Editing selected section</span>
                <button onClick={() => { setSelectedBlockId(null); setInstruction(''); setEditError('') }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.faint }}><X size={15} /></button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  ref={inputRef}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !applying) applyEdit() }}
                  placeholder='e.g. "make this shorter" or "turn this into a bar chart"'
                  style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 13, boxSizing: 'border-box' }}
                />
                <button onClick={applyEdit} disabled={applying || !instruction.trim()}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, borderRadius: 9, border: 'none', background: C.accent, color: '#fff', cursor: applying ? 'not-allowed' : 'pointer', opacity: applying || !instruction.trim() ? 0.6 : 1 }}>
                  {applying ? <Loader2 size={15} style={{ animation: 'clpSpin 1s linear infinite' }} /> : <Send size={15} />}
                </button>
              </div>
              {editError && <p style={{ fontSize: 12, color: '#B3261E', marginTop: 8, marginBottom: 0 }}>{editError}</p>}
            </div>
          )}
        </>
      )}

      {mode === 'manual' && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div ref={canvasEditorRef} style={{ flex: 1, minWidth: 0, border: `1px dashed ${C.line}`, borderRadius: 12, padding: 20, background: '#FAFAF8' }}>
            <div style={{ width: '100%', height: computeCanvasHeight(checklist.blocks) * canvasEditorScale }}>
              <div style={{ position: 'relative', width: CANVAS_WIDTH, height: computeCanvasHeight(checklist.blocks), background: '#fff', transform: `scale(${canvasEditorScale})`, transformOrigin: 'top left' }}>
                {checklist.blocks.map((block) => {
                  const l = block.layout
                  if (!l) return null
                  // Images have no single "correct" content-driven height —
                  // let them resize freely on every edge. Every other block
                  // type stays width-only, with height auto-synced to content.
                  const isImage = block.type === 'image'
                  return (
                    <Rnd
                      key={block.id}
                      bounds="parent"
                      scale={canvasEditorScale}
                      size={{ width: l.w, height: l.h }}
                      position={{ x: l.x, y: l.y }}
                      enableResizing={isImage
                        ? { left: true, right: true, top: true, bottom: true, topLeft: true, topRight: true, bottomLeft: true, bottomRight: true }
                        : { left: true, right: true, top: false, bottom: false, topLeft: false, topRight: false, bottomLeft: false, bottomRight: false }}
                      onDragStop={(_e, d) => updateBlocks(applyLayoutCascade(checklist.blocks, block.id, { x: Math.max(0, d.x), y: Math.max(0, d.y) }))}
                      onResizeStop={(_e, _dir, ref, _delta, position) => updateBlocks(applyLayoutCascade(checklist.blocks, block.id, { w: ref.offsetWidth, h: isImage ? ref.offsetHeight : l.h, x: position.x, y: isImage ? position.y : l.y }))}
                      style={{ zIndex: selectedBlockId === block.id ? 5 : 1 }}
                    >
                      <div ref={(el) => registerContentEl(block.id, el)} style={{ width: '100%', height: '100%' }} onClick={() => setSelectedBlockId(block.id)}>
                        <BlockCard block={block} selectable selected={selectedBlockId === block.id} fill background={l.bg}>
                          <BlockBody block={block} recipesById={recipesById} imagesById={imagesById} checkedItems={{}} />
                        </BlockCard>
                      </div>
                    </Rnd>
                  )
                })}
              </div>
            </div>
          </div>

          <div style={{ width: 300, flexShrink: 0, position: 'sticky', top: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <button onClick={() => setAddMenuOpen((o) => !o)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 9, border: `1px solid ${C.line}`, background: '#fff', color: C.ink, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                  <Plus size={14} /> Add block
                </button>
                {addMenuOpen && (
                  <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 20, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, padding: 6, boxShadow: '0 8px 20px rgba(17,24,39,0.12)' }}>
                    {ADDABLE_TYPES.map((t) => {
                      const disabled = t === 'image' && allImages.length === 0
                      return (
                        <button key={t} onClick={() => !disabled && addBlock(t)} disabled={disabled} title={disabled ? 'Upload a picture to the Picture bank first' : undefined}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 7, border: 'none', background: 'none', color: disabled ? C.faint : C.ink, fontSize: 12.5, cursor: disabled ? 'not-allowed' : 'pointer' }}>
                          {BLOCK_TYPE_LABELS[t]}{disabled ? ' (no pictures yet)' : ''}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <button onClick={handleLeave}
                className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', background: C.green, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                <Check size={13} /> Done
              </button>
            </div>
            <div style={{ fontSize: 11, color: C.faint, marginBottom: 10, minHeight: 14 }}>
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : ''}
            </div>

            {selectedBlock ? (
              <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.ink }}>{BLOCK_TYPE_LABELS[selectedBlock.type]}</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => duplicateBlock(selectedBlock.id)} title="Duplicate" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer' }}><Copy size={14} /></button>
                    <button onClick={() => deleteBlock(selectedBlock.id)} title="Delete" style={{ background: 'none', border: 'none', color: '#B3261E', cursor: 'pointer' }}><Trash2 size={14} /></button>
                  </div>
                </div>
                <BlockInspector block={selectedBlock} onChange={updateBlock} recipes={allRecipes} images={allImages} onImageUploaded={handleImageUploaded} />
              </div>
            ) : (
              <div style={{ fontSize: 12, color: C.muted, padding: '10px 4px' }}>Click a block on the canvas to edit it.</div>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes clpSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
