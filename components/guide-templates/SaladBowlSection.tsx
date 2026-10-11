'use client'
import { Plus, X } from 'lucide-react'
import InlineEditableText from '@/components/InlineEditableText'
import { splitPastedList, isMultiItemPaste } from '@/lib/pastedList'
import type { SaladBowlGroup } from '@/lib/saladBowl'

// The "make your own salad bowl" chart, shared by every template so the
// thirteen of them can never drift apart. Each template passes its own
// colours; the structure and editing behaviour live here once.
//
// Read-only for the patient, click-to-edit for the coach: headings and
// ingredients are editable text, items can be removed or added, and a
// pasted list fills several at once (same rule as the checklist blocks).
export type SaladBowlTheme = {
  ink: string
  muted: string
  accent: string
  line: string
  cardBg: string
}

export default function SaladBowlSection({
  groups,
  theme,
  editable = false,
  onChange,
  columnMin = 180,
}: {
  groups: SaladBowlGroup[]
  theme: SaladBowlTheme
  editable?: boolean
  onChange?: (groups: SaladBowlGroup[]) => void
  columnMin?: number
}) {
  const update = (next: SaladBowlGroup[]) => onChange?.(next)
  const setGroup = (index: number, group: SaladBowlGroup) =>
    update(groups.map((g, i) => (i === index ? group : g)))

  return (
    <div
      data-salad-bowl
      style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${columnMin}px, 1fr))`, gap: 14, marginTop: 16 }}
    >
      {groups.map((group, gi) => (
        <div
          key={gi}
          style={{ background: theme.cardBg, border: `1px solid ${theme.line}`, borderRadius: 12, padding: '14px 16px', minWidth: 0 }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <InlineEditableText
              editable={editable}
              value={group.heading}
              onSave={(heading) => setGroup(gi, { ...group, heading })}
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: theme.accent,
                flex: 1,
              }}
            />
            {editable && (
              <button
                type="button"
                title="Remove this group"
                onClick={() => update(groups.filter((_, i) => i !== gi))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.muted, padding: 0, lineHeight: 1 }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {group.items.map((item, ii) => (
              <li key={ii} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: '0.85rem', color: theme.ink, lineHeight: 1.45 }}>
                <span aria-hidden style={{ color: theme.accent, flexShrink: 0 }}>·</span>
                {editable ? (
                  <>
                    <InlineEditableText
                      editable
                      value={item}
                      onSave={(next) => {
                        // A pasted list becomes several ingredients, not one
                        // long line — ten pasted names give ten entries.
                        const lines = isMultiItemPaste(next) ? splitPastedList(next) : [next]
                        const items = [...group.items]
                        items.splice(ii, 1, ...lines)
                        setGroup(gi, { ...group, items })
                      }}
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => setGroup(gi, { ...group, items: group.items.filter((_, i) => i !== ii) })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.muted, padding: 0, lineHeight: 1, flexShrink: 0 }}
                    >
                      <X size={11} />
                    </button>
                  </>
                ) : (
                  <span style={{ minWidth: 0 }}>{item}</span>
                )}
              </li>
            ))}
          </ul>

          {editable && (
            <button
              type="button"
              onClick={() => setGroup(gi, { ...group, items: [...group.items, 'New ingredient'] })}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, background: 'none',
                border: `1px dashed ${theme.line}`, borderRadius: 8, padding: '4px 9px', color: theme.accent,
                cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
              }}
            >
              <Plus size={11} /> Add ingredient
            </button>
          )}
        </div>
      ))}

      {editable && (
        <button
          type="button"
          onClick={() => update([...groups, { heading: 'New group', items: ['New ingredient'] }])}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 90,
            background: 'none', border: `1px dashed ${theme.line}`, borderRadius: 12, color: theme.accent,
            cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
          }}
        >
          <Plus size={13} /> Add group
        </button>
      )}
    </div>
  )
}
