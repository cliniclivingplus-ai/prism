'use client'

// Shared "custom blocks" strip rendered under every patient-facing dashboard
// template so custom blocks show up regardless of which one is selected.
// Renders nothing when there are none, so roadmaps that never used this
// feature are completely unaffected.
import { BlockRenderer, computeCanvasHeight, type RecipeLookup, type ImageLookup, type BlockTheme } from '@/lib/blocks/BlockRenderer'
import { ScaledCanvasView } from '@/lib/blocks/ScaledCanvasView'
import type { ChecklistPageBlock } from '@/lib/blocks/types'

export function CanvasBlocksSection({ blocks, recipesById, imagesById, theme }: {
  blocks: ChecklistPageBlock[]
  recipesById: Record<string, RecipeLookup>
  imagesById: Record<string, ImageLookup>
  // The active dashboard template's own palette — every block (including a
  // table's borders/header text) matches whichever template is selected
  // instead of one fixed color regardless of theme. Omit to fall back to
  // BlockRenderer's own default (should only happen if a caller forgets).
  theme?: BlockTheme
}) {
  if (!blocks || blocks.length === 0) return null
  return (
    <div style={{ padding: '8px 0 32px' }}>
      <ScaledCanvasView canvasHeight={computeCanvasHeight(blocks)}>
        <BlockRenderer
          blocks={blocks}
          recipesById={recipesById}
          imagesById={imagesById}
          layoutMode="canvas"
          theme={theme}
          honorLayoutBg={false}
        />
      </ScaledCanvasView>
    </div>
  )
}
