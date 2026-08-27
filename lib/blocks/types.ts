// The fixed block-type vocabulary for AI-generated consultation checklists
// (see src/app/api/compass/checklists/route.ts and BlockRenderer.tsx). The AI never
// emits raw HTML/CSS — only data shaped like this, validated server-side
// against this exact list before it's ever stored or rendered.

export const BLOCK_TYPES = [
  'hero', 'stat_row', 'pull_quote', 'checklist', 'icon_grid', 'goal_icons',
  'recipe_gallery', 'image_gallery', 'chart', 'text_block', 'table', 'image',
] as const
export type BlockType = (typeof BLOCK_TYPES)[number]

// A small, fixed icon vocabulary — the AI references an icon by one of
// these string keys only, never arbitrary code. See icons.ts for the
// key -> lucide component mapping.
export const BLOCK_ICON_KEYS = [
  'moon', 'droplet', 'footprints', 'brain', 'utensils', 'smartphone', 'sun',
  'heart', 'star', 'target', 'flame', 'award', 'checkcircle', 'calendar', 'pill',
  'scale', 'apple', 'zap', 'clock',
] as const
export type BlockIconKey = (typeof BLOCK_ICON_KEYS)[number]

export type HeroBlock = { id: string; type: 'hero'; title: string; subtitle?: string }
export type StatRowBlock = { id: string; type: 'stat_row'; title?: string; items: { label: string; value: string; icon?: BlockIconKey }[] }
export type PullQuoteBlock = { id: string; type: 'pull_quote'; text: string; attribution?: string }
export type ChecklistItem = { text: string }
export type ChecklistBlock = { id: string; type: 'checklist'; title?: string; items: ChecklistItem[] }
export type IconGridBlock = { id: string; type: 'icon_grid'; title?: string; items: { icon?: BlockIconKey; topic: string; text: string }[] }
// Pictorial, near-wordless goal representation — a big icon plus a short
// (2-4 word) label, nothing else. For "show the goals visually" pages
// where icon_grid's full sentence per item would still be too much text.
export type GoalIconsBlock = { id: string; type: 'goal_icons'; title?: string; items: { icon: BlockIconKey; label: string }[] }
export type RecipeGalleryBlock = { id: string; type: 'recipe_gallery'; title?: string; recipe_ids: string[] }
export type ImageGalleryBlock = { id: string; type: 'image_gallery'; title?: string; image_ids: string[] }
export type ChartBlock = { id: string; type: 'chart'; title?: string; chartType: 'bar' | 'donut'; data: { label: string; value: number }[] }
export type TextBlock = { id: string; type: 'text_block'; title?: string; text: string }
// A genuinely editable grid — headers + rows of plain text cells. Capped in
// validateBlock to a sane size so a runaway edit can't produce an unusable page.
export type TableBlock = { id: string; type: 'table'; title?: string; headers: string[]; rows: string[][] }
// A single picture, unlike image_gallery's grid — freely resizable on the
// canvas (including height, unlike text-flow blocks) since a photo has no
// single "correct" content-driven height.
export type ImageBlock = { id: string; type: 'image'; image_id: string; caption?: string }

// Manual canvas position/size, plus an optional background swatch — set only
// once a coach opens "Manual edit" on a checklist (see ScaledCanvasView.tsx
// and the coach editor). A small fixed palette only, never an arbitrary
// color/CSS value, matching this feature's "structured fields only" trust
// model.
export const BLOCK_BG_SWATCHES = ['#FFFFFF', '#EFF4FF', '#F2F9EC', '#FFF7ED', '#FDF2F8', '#F5F3FF'] as const
export type BlockLayout = { x: number; y: number; w: number; h: number; bg?: (typeof BLOCK_BG_SWATCHES)[number] }

export type BlockData =
  | HeroBlock | StatRowBlock | PullQuoteBlock | ChecklistBlock | IconGridBlock | GoalIconsBlock
  | RecipeGalleryBlock | ImageGalleryBlock | ChartBlock | TextBlock | TableBlock | ImageBlock

export type ChecklistPageBlock = BlockData & { layout?: BlockLayout }

export type ConsultationChecklist = {
  id: string
  patient_id: string
  session_id: string | null
  title: string | null
  condition_goal: string
  recipe_ids: string[]
  image_ids: string[]
  blocks: ChecklistPageBlock[]
  checked_items: Record<string, boolean>
  kb_sources: { title: string; source_type: string }[]
  status: 'draft' | 'ready'
  created_at: string
  updated_at: string
}

const MAX_TABLE_COLS = 8
const MAX_TABLE_ROWS = 20

function layoutOpt(v: unknown): BlockLayout | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const num = (n: unknown): number | null => (typeof n === 'number' && isFinite(n) ? n : null)
  const x = num(o.x), y = num(o.y), w = num(o.w), h = num(o.h)
  if (x === null || y === null || w === null || h === null) return undefined
  const bg = typeof o.bg === 'string' && (BLOCK_BG_SWATCHES as readonly string[]).includes(o.bg) ? (o.bg as BlockLayout['bg']) : undefined
  return { x, y, w: Math.max(40, w), h: Math.max(40, h), ...(bg ? { bg } : {}) }
}

// Builds the block's own fields (unchanged per-type logic below); layout is
// attached once, uniformly, in validateBlock itself so every block type
// supports manual positioning without touching each case individually.
function buildBlock(type: BlockType, b: Record<string, unknown>, id: string, allowedRecipeIds: Set<string>, allowedImageIds: Set<string>): BlockData | null {
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
  const strOpt = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  const iconOpt = (v: unknown): BlockIconKey | undefined => (typeof v === 'string' && (BLOCK_ICON_KEYS as readonly string[]).includes(v) ? (v as BlockIconKey) : undefined)

  switch (type) {
    case 'hero': {
      const title = str(b.title)
      if (!title) return null
      return { id, type: 'hero', title, subtitle: strOpt(b.subtitle) }
    }
    case 'stat_row': {
      const items = Array.isArray(b.items) ? b.items : []
      const clean = items.map((it) => {
        const o = it as Record<string, unknown>
        const label = str(o.label)
        const value = str(o.value)
        if (!label || !value) return null
        return { label, value, icon: iconOpt(o.icon) }
      }).filter((x) => x !== null)
      if (clean.length === 0) return null
      return { id, type: 'stat_row', title: strOpt(b.title), items: clean }
    }
    case 'pull_quote': {
      const text = str(b.text)
      if (!text) return null
      return { id, type: 'pull_quote', text, attribution: strOpt(b.attribution) }
    }
    case 'checklist': {
      const items = Array.isArray(b.items) ? b.items : []
      const clean = items.map((it) => {
        const o = it as Record<string, unknown>
        const text = str(o.text)
        return text ? { text } : null
      }).filter((x): x is ChecklistItem => !!x)
      if (clean.length === 0) return null
      return { id, type: 'checklist', title: strOpt(b.title), items: clean }
    }
    case 'icon_grid': {
      const items = Array.isArray(b.items) ? b.items : []
      const clean = items.map((it) => {
        const o = it as Record<string, unknown>
        const topic = str(o.topic)
        const text = str(o.text)
        if (!topic || !text) return null
        return { topic, text, icon: iconOpt(o.icon) }
      }).filter((x) => x !== null)
      if (clean.length === 0) return null
      return { id, type: 'icon_grid', title: strOpt(b.title), items: clean }
    }
    case 'goal_icons': {
      const items = Array.isArray(b.items) ? b.items : []
      const clean = items.map((it) => {
        const o = it as Record<string, unknown>
        const label = str(o.label)
        const icon = iconOpt(o.icon)
        if (!label || !icon) return null
        return { icon, label }
      }).filter((x) => x !== null)
      if (clean.length === 0) return null
      return { id, type: 'goal_icons', title: strOpt(b.title), items: clean }
    }
    case 'recipe_gallery': {
      const ids = Array.isArray(b.recipe_ids) ? b.recipe_ids.filter((x): x is string => typeof x === 'string' && allowedRecipeIds.has(x)) : []
      if (ids.length === 0) return null
      return { id, type: 'recipe_gallery', title: strOpt(b.title), recipe_ids: ids }
    }
    case 'image_gallery': {
      const ids = Array.isArray(b.image_ids) ? b.image_ids.filter((x): x is string => typeof x === 'string' && allowedImageIds.has(x)) : []
      if (ids.length === 0) return null
      return { id, type: 'image_gallery', title: strOpt(b.title), image_ids: ids }
    }
    case 'chart': {
      const chartType = b.chartType === 'donut' ? 'donut' : b.chartType === 'bar' ? 'bar' : null
      const data = Array.isArray(b.data) ? b.data : []
      const clean = data.map((d) => {
        const o = d as Record<string, unknown>
        const label = str(o.label)
        const value = typeof o.value === 'number' && isFinite(o.value) ? o.value : null
        if (!label || value == null) return null
        return { label, value }
      }).filter((x): x is { label: string; value: number } => !!x)
      if (!chartType || clean.length === 0) return null
      return { id, type: 'chart', title: strOpt(b.title), chartType, data: clean }
    }
    case 'text_block': {
      const text = str(b.text)
      if (!text) return null
      return { id, type: 'text_block', title: strOpt(b.title), text }
    }
    case 'table': {
      const headersRaw = Array.isArray(b.headers) ? b.headers : []
      const headers = headersRaw.map((h) => str(h)).filter(Boolean).slice(0, MAX_TABLE_COLS)
      if (headers.length === 0) return null
      const rowsRaw = Array.isArray(b.rows) ? b.rows : []
      const rows = rowsRaw.slice(0, MAX_TABLE_ROWS).map((r) => {
        const cells = Array.isArray(r) ? r : []
        const row = headers.map((_, i) => str(cells[i]))
        return row
      })
      return { id, type: 'table', title: strOpt(b.title), headers, rows }
    }
    case 'image': {
      const imageId = str(b.image_id)
      if (!imageId || !allowedImageIds.has(imageId)) return null
      return { id, type: 'image', image_id: imageId, caption: strOpt(b.caption) }
    }
    default:
      return null
  }
}

// Strict runtime validation — every block the AI produces (at generation OR
// edit time), and every block the coach's manual editor saves, is checked
// against this before it's ever stored or rendered. An invalid block
// (unknown type, wrong shape, or a recipe/image id that wasn't actually in
// the coach's own picked set) is dropped rather than trusted — never
// crashes the page, never silently shows something nobody actually provided.
export function validateBlock(raw: unknown, allowedRecipeIds: Set<string>, allowedImageIds: Set<string>): ChecklistPageBlock | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Record<string, unknown>
  const id = typeof b.id === 'string' && b.id ? b.id : `blk_${Math.random().toString(36).slice(2, 10)}`
  const type = b.type
  if (typeof type !== 'string' || !(BLOCK_TYPES as readonly string[]).includes(type)) return null

  const built = buildBlock(type as BlockType, b, id, allowedRecipeIds, allowedImageIds)
  if (!built) return null

  const layout = layoutOpt(b.layout)
  return layout ? { ...built, layout } : built
}
