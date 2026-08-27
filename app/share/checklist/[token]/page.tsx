'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { BlockRenderer, computeCanvasHeight } from '@/lib/blocks/BlockRenderer'
import { ScaledCanvasView } from '@/lib/blocks/ScaledCanvasView'
import type { ChecklistPageBlock } from '@/lib/blocks/types'

type Recipe = { id: string; name: string; image_url?: string | null; protein_label?: string | null }
type GuideImage = { id: string; label: string; image_url: string }
type Checklist = { id: string; title: string | null; blocks: ChecklistPageBlock[]; recipe_ids: string[]; image_ids: string[]; checked_items: Record<string, boolean> }

// Public, no-login page — same trust model as /dashboard/[roadmapId]. A
// coach shares this URL directly with the patient; the AI-designed page
// renders read-only except for checking off items on any checklist block.
export default function PublicChecklistPage() {
  const params = useParams()
  const token = params.token as string

  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [recipesById, setRecipesById] = useState<Record<string, Recipe>>({})
  const [imagesById, setImagesById] = useState<Record<string, GuideImage>>({})
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let alive = true
    // One public, token-addressed call. It returns the checklist together
    // with only the recipes and images this checklist references — the old
    // version fetched the entire recipe bank and image bank to the patient's
    // browser and filtered client-side.
    fetch(`/api/share/checklist/${token}`)
      .then((r) => r.json())
      .then(async (j: Checklist & { error?: string; recipes?: Recipe[]; images?: GuideImage[] }) => {
        if (!alive) return
        if (j.error) { setNotFound(true); return }
        setChecklist(j)
        setCheckedItems(j.checked_items || {})
        const [recipes, images] = [j.recipes ?? [], j.images ?? []]
        if (!alive) return
        setRecipesById(Object.fromEntries((Array.isArray(recipes) ? recipes : []).filter((r: Recipe) => j.recipe_ids.includes(r.id)).map((r: Recipe) => [r.id, r])))
        setImagesById(Object.fromEntries((Array.isArray(images) ? images : []).filter((im: GuideImage) => j.image_ids.includes(im.id)).map((im: GuideImage) => [im.id, im])))
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [token])

  async function handleCheckItem(key: string, checked: boolean) {
    setCheckedItems((prev) => {
      const next = { ...prev }
      if (checked) next[key] = true
      else delete next[key]
      return next
    })
    try {
      const res = await fetch(`/api/share/checklist/${token}/check`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_key: key, checked }),
      })
      if (!res.ok) throw new Error()
    } catch {
      // Revert on failure — never leave the UI showing a check that didn't persist.
      setCheckedItems((prev) => {
        const next = { ...prev }
        if (checked) delete next[key]
        else next[key] = true
        return next
      })
    }
  }

  if (loading) return <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}><Loader2 size={22} style={{ animation: 'clpSpin 1s linear infinite' }} /><style>{`@keyframes clpSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style></div>
  if (notFound || !checklist) return <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px', textAlign: 'center', color: '#6b7280' }}>This checklist could not be found.</div>

  // A checklist only has layout data once a coach has opened "Manual edit"
  // on it at least once — anything AI-generated but never manually touched
  // (and every checklist made before this feature existed) keeps rendering
  // through the original stacked flow, unaffected.
  const hasLayout = checklist.blocks.some((b) => b.layout)

  if (hasLayout) {
    return (
      <div style={{ padding: '32px 20px 64px' }}>
        <ScaledCanvasView canvasHeight={computeCanvasHeight(checklist.blocks)}>
          <BlockRenderer
            blocks={checklist.blocks}
            recipesById={recipesById}
            imagesById={imagesById}
            checkedItems={checkedItems}
            onCheckItem={handleCheckItem}
            layoutMode="canvas"
          />
        </ScaledCanvasView>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 64px' }}>
      <BlockRenderer
        blocks={checklist.blocks}
        recipesById={recipesById}
        imagesById={imagesById}
        checkedItems={checkedItems}
        onCheckItem={handleCheckItem}
      />
    </div>
  )
}
