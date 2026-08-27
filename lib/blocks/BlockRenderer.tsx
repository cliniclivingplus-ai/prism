'use client'

// Renders an AI-generated (and coach-edited) consultation-checklist page —
// the block palette is fixed (see types.ts); this is the ONLY thing that
// ever turns block data into markup, so both the coach's editor and the
// patient's public page render identically from the same source.
import type { CSSProperties } from 'react'
import { CheckCircle2, Circle, ChefHat } from 'lucide-react'
import type { ChecklistPageBlock } from './types'
import { resolveBlockIcon } from './icons'
import { Card, PullQuote, PieChart, DEFAULT_ACCENT, DEFAULT_ACCENT_SOFT, DEFAULT_LINE, DEFAULT_CARD_BG } from './primitives'
import { renderMarkdownBold } from '@/lib/renderMarkdownBold'

export type RecipeLookup = { id: string; name: string; image_url?: string | null; protein_label?: string | null }
export type ImageLookup = { id: string; label: string; image_url: string }

// Color tokens every block type renders with. Defaults match the original
// fixed blue Checklist look exactly, so the standalone Checklist feature
// (which never passes a theme) is completely unaffected — only a caller
// that explicitly hands in its own palette (the roadmap dashboard
// templates, one per template's own color scheme) gets themed blocks.
export type BlockTheme = { accent: string; accentSoft: string; line: string; card: string; ink: string; muted: string }
export const DEFAULT_BLOCK_THEME: BlockTheme = {
  accent: DEFAULT_ACCENT, accentSoft: DEFAULT_ACCENT_SOFT, line: DEFAULT_LINE, card: DEFAULT_CARD_BG,
  ink: '#111827', muted: '#6B7280',
}

// Maps a dashboard template/palette onto BlockTheme so custom blocks
// (including tables) inherit that template's colors instead of the fixed
// checklist blue or a coach-picked swatch.
export function toBlockTheme(p: {
  accent: string
  accentSoft: string
  ink: string
  muted: string
  line?: string
  rule?: string
  border?: string
  card?: string
  paper?: string
}): BlockTheme {
  return {
    accent: p.accent,
    accentSoft: p.accentSoft,
    ink: p.ink,
    muted: p.muted,
    line: p.line ?? p.rule ?? p.border ?? DEFAULT_LINE,
    card: p.card ?? p.paper ?? DEFAULT_CARD_BG,
  }
}

// Design-time width of the manual canvas — the coach's editor and the
// public/patient view both scale a canvas of exactly this width to fit
// whatever viewport it's shown on (see ScaledCanvasView.tsx), rather than
// reflowing individual blocks per breakpoint.
export const CANVAS_WIDTH = 720

export function computeCanvasHeight(blocks: ChecklistPageBlock[]): number {
  return blocks.reduce((max, b) => Math.max(max, (b.layout?.y ?? 0) + (b.layout?.h ?? 0)), 0) + 32
}

export function BlockRenderer({
  blocks, recipesById, imagesById, checkedItems, onCheckItem, selectable, selectedBlockId, onSelectBlock, layoutMode = 'stack', onBlockRef, theme = DEFAULT_BLOCK_THEME, honorLayoutBg = true,
}: {
  blocks: ChecklistPageBlock[]
  recipesById?: Record<string, RecipeLookup>
  imagesById?: Record<string, ImageLookup>
  checkedItems?: Record<string, boolean>
  onCheckItem?: (key: string, checked: boolean) => void
  selectable?: boolean
  selectedBlockId?: string | null
  onSelectBlock?: (id: string) => void
  // 'canvas' requires every block to already carry layout (x/y/w/h) — used
  // once a checklist has manual layout data. Falls back to the original
  // stacked flow otherwise, so old/AI-fresh checklists are unaffected.
  layoutMode?: 'stack' | 'canvas'
  // Stack mode only — lets the manual editor measure each block's rendered
  // position/size once, to seed initial canvas layout data.
  onBlockRef?: (id: string, el: HTMLDivElement | null) => void
  // A roadmap-dashboard caller's own palette — tables, borders, and accents
  // match whichever template is selected.
  theme?: BlockTheme
  // Checklist canvas still honors a coach-picked `layout.bg`. Roadmap custom
  // blocks never do — color comes only from the active template theme.
  honorLayoutBg?: boolean
}) {
  if (layoutMode === 'canvas') {
    const height = computeCanvasHeight(blocks)
    return (
      <div style={{ position: 'relative', width: CANVAS_WIDTH, height }}>
        {blocks.map((block) => {
          const l = block.layout
          if (!l) return null
          return (
            <div key={block.id} style={{ position: 'absolute', left: l.x, top: l.y, width: l.w, height: l.h }}>
              <BlockCard block={block} selectable={selectable} selected={selectedBlockId === block.id} onClick={() => onSelectBlock?.(block.id)} fill background={honorLayoutBg ? l.bg : undefined} theme={theme}>
                <BlockBody block={block} recipesById={recipesById ?? {}} imagesById={imagesById ?? {}} checkedItems={checkedItems ?? {}} onCheckItem={onCheckItem} theme={theme} />
              </BlockCard>
            </div>
          )
        })}
      </div>
    )
  }
  return (
    <div>
      {blocks.map((block) => (
        <div key={block.id} ref={onBlockRef ? (el) => onBlockRef(block.id, el) : undefined}>
          <BlockCard block={block} selectable={selectable} selected={selectedBlockId === block.id} onClick={() => onSelectBlock?.(block.id)} theme={theme}>
            <BlockBody block={block} recipesById={recipesById ?? {}} imagesById={imagesById ?? {}} checkedItems={checkedItems ?? {}} onCheckItem={onCheckItem} theme={theme} />
          </BlockCard>
        </div>
      ))}
    </div>
  )
}

export function BlockCard({ block, selectable, selected, onClick, children, fill, background, theme = DEFAULT_BLOCK_THEME }: { block: ChecklistPageBlock; selectable?: boolean; selected?: boolean; onClick?: () => void; children: React.ReactNode; fill?: boolean; background?: string; theme?: BlockTheme }) {
  // 'visible' rather than 'auto': block height is always kept in sync with
  // real content height by the manual editor (see registerContentEl in the
  // editor page), so nothing should ever need an internal scrollbar. Using
  // 'visible' means content is never clipped even for the one frame before
  // that sync catches up.
  const fillStyle: CSSProperties = fill ? { width: '100%', height: '100%', boxSizing: 'border-box', overflow: 'visible', marginBottom: 0 } : {}
  if (block.type === 'hero') {
    return (
      <div onClick={selectable ? onClick : undefined} style={{
        textAlign: 'center', padding: '2.5rem 1.5rem', marginBottom: 16, borderRadius: 20,
        background: background ?? theme.accentSoft, border: `1px solid ${selected ? theme.accent : 'transparent'}`,
        cursor: selectable ? 'pointer' : 'default', ...fillStyle,
      }}>
        {children}
      </div>
    )
  }
  if (block.type === 'image') {
    // No Card padding — the picture fills its box edge to edge.
    return (
      <div onClick={selectable ? onClick : undefined} style={{
        borderRadius: 16, overflow: 'hidden', marginBottom: 16,
        border: `1px solid ${selected ? theme.accent : theme.line}`,
        background: background ?? '#F3F4F6', cursor: selectable ? 'pointer' : 'default', ...fillStyle,
      }}>
        {children}
      </div>
    )
  }
  return (
    <Card onClick={selectable ? onClick : undefined} selected={selected} background={background ?? theme.card} borderColor={theme.line} style={fillStyle}>
      {children}
    </Card>
  )
}

export function BlockBody({ block, recipesById, imagesById, checkedItems, onCheckItem, theme = DEFAULT_BLOCK_THEME }: { block: ChecklistPageBlock; recipesById: Record<string, RecipeLookup>; imagesById: Record<string, ImageLookup>; checkedItems: Record<string, boolean>; onCheckItem?: (key: string, checked: boolean) => void; theme?: BlockTheme }) {
  switch (block.type) {
    case 'hero':
      return (
        <>
          <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.1rem)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: theme.ink }}>{block.title}</h1>
          {block.subtitle && <p style={{ fontSize: 14, color: theme.muted, marginTop: 8 }}>{renderMarkdownBold(block.subtitle)}</p>}
        </>
      )

    case 'stat_row':
      return (
        <>
          {block.title && <BlockTitle theme={theme}>{block.title}</BlockTitle>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginTop: block.title ? 14 : 0 }}>
            {block.items.map((it, i) => {
              const Icon = resolveBlockIcon(it.icon)
              return (
                <div key={i} style={{ padding: 14, borderRadius: 12, background: theme.accentSoft }}>
                  <Icon size={16} color={theme.accent} />
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8, color: theme.ink }}>{it.value}</div>
                  <div style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{it.label}</div>
                </div>
              )
            })}
          </div>
        </>
      )

    case 'pull_quote':
      return block.attribution
        ? <PullQuote initials={block.attribution.charAt(0)} name={block.attribution} quote={block.text} quoteIsItalic accentColor={theme.accent} accentSoft={theme.accentSoft} borderColor={theme.line} />
        : <PullQuote showAvatar={false} quote={block.text} quoteIsItalic accentColor={theme.accent} accentSoft={theme.accentSoft} borderColor={theme.line} />

    case 'checklist':
      return (
        <>
          {block.title && <BlockTitle theme={theme}>{block.title}</BlockTitle>}
          <ul style={{ listStyle: 'none', margin: block.title ? '14px 0 0' : 0, padding: 0 }}>
            {block.items.map((it, i) => {
              const key = `${block.id}:${i}`
              const checked = !!checkedItems[key]
              return (
                <li key={i} onClick={onCheckItem ? () => onCheckItem(key, !checked) : undefined}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, cursor: onCheckItem ? 'pointer' : 'default' }}>
                  {checked ? <CheckCircle2 size={17} color={theme.accent} style={{ flexShrink: 0, marginTop: 1 }} /> : <Circle size={17} color="#9CA3AF" style={{ flexShrink: 0, marginTop: 1 }} />}
                  <span style={{ fontSize: 14, color: checked ? theme.muted : theme.ink, textDecoration: checked ? 'line-through' : 'none' }}>{renderMarkdownBold(it.text)}</span>
                </li>
              )
            })}
          </ul>
        </>
      )

    case 'icon_grid':
      return (
        <>
          {block.title && <BlockTitle theme={theme}>{block.title}</BlockTitle>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: block.title ? 14 : 0 }}>
            {block.items.map((it, i) => {
              const Icon = resolveBlockIcon(it.icon)
              return (
                <div key={i} style={{ border: `1px solid ${theme.line}`, borderRadius: 14, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: theme.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} color={theme.accent} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: theme.ink }}>{it.topic}</div>
                  </div>
                  <p style={{ fontSize: 12.5, color: theme.muted, lineHeight: 1.5, margin: 0 }}>{renderMarkdownBold(it.text)}</p>
                </div>
              )
            })}
          </div>
        </>
      )

    case 'goal_icons':
      return (
        <>
          {block.title && <BlockTitle theme={theme}>{block.title}</BlockTitle>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 16, marginTop: block.title ? 16 : 0 }}>
            {block.items.map((it, i) => {
              const Icon = resolveBlockIcon(it.icon)
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: theme.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={30} color={theme.accent} strokeWidth={2} />
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: theme.ink, lineHeight: 1.3 }}>{it.label}</div>
                </div>
              )
            })}
          </div>
        </>
      )

    case 'recipe_gallery': {
      const recipes = block.recipe_ids.map((id) => recipesById[id]).filter((r): r is RecipeLookup => !!r)
      if (recipes.length === 0) return null
      return (
        <>
          {block.title && <BlockTitle theme={theme}>{block.title}</BlockTitle>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: block.title ? 14 : 0 }}>
            {recipes.map((r) => (
              <div key={r.id} style={{ border: `1px solid ${theme.line}`, borderRadius: 12, overflow: 'hidden' }}>
                {r.image_url ? (
                  <img src={r.image_url} alt={r.name} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: 90, background: theme.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChefHat size={18} color={theme.accent} /></div>
                )}
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: theme.ink }}>{r.name}</div>
                  {r.protein_label && <div style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{r.protein_label}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )
    }

    case 'image_gallery': {
      const images = block.image_ids.map((id) => imagesById[id]).filter((im): im is ImageLookup => !!im)
      if (images.length === 0) return null
      return (
        <>
          {block.title && <BlockTitle theme={theme}>{block.title}</BlockTitle>}
          <div style={{ display: 'grid', gridTemplateColumns: images.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: block.title ? 14 : 0 }}>
            {images.map((im) => (
              <img key={im.id} src={im.image_url} alt={im.label} style={{ width: '100%', height: images.length === 1 ? 220 : 130, objectFit: 'cover', borderRadius: 12 }} />
            ))}
          </div>
        </>
      )
    }

    case 'chart':
      return (
        <>
          {block.title && <BlockTitle theme={theme}>{block.title}</BlockTitle>}
          {block.chartType === 'donut' ? (
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginTop: block.title ? 14 : 0 }}>
              <PieChart data={block.data} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {block.data.map((d, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: theme.muted }}>{d.label}: <strong style={{ color: theme.ink }}>{d.value}</strong></div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: block.title ? 14 : 0 }}>
              {(() => {
                const max = Math.max(...block.data.map((d) => d.value), 1)
                return block.data.map((d, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3, color: theme.ink }}>
                      <span>{d.label}</span><span style={{ fontWeight: 700 }}>{d.value}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: theme.accentSoft }}>
                      <div style={{ height: 8, borderRadius: 4, background: theme.accent, width: `${(d.value / max) * 100}%`, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}
        </>
      )

    case 'text_block':
      return (
        <>
          {block.title && <BlockTitle theme={theme}>{block.title}</BlockTitle>}
          <p style={{ fontSize: 13.5, color: theme.muted, lineHeight: 1.6, margin: block.title ? '10px 0 0' : 0 }}>{renderMarkdownBold(block.text)}</p>
        </>
      )

    case 'table':
      return (
        <>
          {block.title && <BlockTitle theme={theme}>{block.title}</BlockTitle>}
          <div style={{ overflowX: 'auto', marginTop: block.title ? 12 : 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr>
                  {block.headers.map((h, i) => (
                    <th key={i} style={{ textAlign: 'left', padding: '7px 10px', borderBottom: `2px solid ${theme.line}`, color: theme.ink, fontWeight: 800, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{ padding: '7px 10px', borderBottom: `1px solid ${theme.line}`, color: theme.muted }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )

    case 'image': {
      const img = imagesById[block.image_id]
      if (!img) return null
      return (
        <>
          <img src={img.image_url} alt={block.caption || img.label} style={{ width: '100%', height: block.layout ? '100%' : 320, objectFit: 'cover', display: 'block' }} />
          {block.caption && <div style={{ padding: '8px 12px', fontSize: 12, color: theme.muted }}>{block.caption}</div>}
        </>
      )
    }

    default:
      return null
  }
}

function BlockTitle({ children, theme = DEFAULT_BLOCK_THEME }: { children: React.ReactNode; theme?: BlockTheme }) {
  return <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: theme.ink }}>{children}</h2>
}
