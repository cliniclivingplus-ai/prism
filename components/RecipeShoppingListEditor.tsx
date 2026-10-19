'use client'

import { memo, useMemo, useState } from 'react'
import { ChevronDown, Pencil, Trash2, Check } from 'lucide-react'
import { GROCERY_CATEGORY_ORDER, type GroceryCategory } from '@/lib/groceryList'
import { extractRecipeShoppingList, normalizeShoppingDraft, type ShoppingRecipe } from '@/lib/recipeShoppingList'

export function RecipeShoppingListEditor({ roadmapId, recipes, savedList, onSaved }: {
  roadmapId?: string
  recipes: ShoppingRecipe[]
  savedList: GroceryCategory[] | null
  onSaved: (categories: GroceryCategory[]) => void
}) {
  const extraction = useMemo(() => extractRecipeShoppingList(recipes), [recipes])
  const [draft, setDraft] = useState<GroceryCategory[]>(() => savedList ?? extraction.categories)
  const [dirty, setDirty] = useState(!savedList)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showReview, setShowReview] = useState(true)
  const [activeItem, setActiveItem] = useState<{ category: number; item: number } | null>(null)
  const [editingCategory, setEditingCategory] = useState<number | null>(null)
  const button = { padding: '6px 10px', border: '1px solid #aaa5', borderRadius: 7, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 11.5 } as const
  const input = { padding: '5px 8px', border: '1px solid #aaa6', borderRadius: 6, background: 'transparent', color: 'inherit', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.4, minWidth: 0 } as const
  const iconButton = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, padding: 0, border: 0, borderRadius: 5, color: 'inherit', background: 'transparent', cursor: 'pointer', flexShrink: 0 } as const
  function change(next: GroceryCategory[]) { setDraft(next); setDirty(true); setMessage(''); setError('') }
  async function save() {
    if (saving) return
    if (!roadmapId) { setError('This plan cannot be saved. Open it from the patient dashboard.'); return }
    setSaving(true); setError(''); setMessage('')
    const next = normalizeShoppingDraft(draft)
    try {
      const response = await fetch(`/api/compass/roadmaps/${roadmapId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guide_overrides: { grocery_list_override: next } }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not save shopping list.')
      if (JSON.stringify(body.guide_overrides?.grocery_list_override) !== JSON.stringify(next)) throw new Error('Save could not be confirmed. Your draft is still here; please retry.')
      setDraft(next); setDirty(false); onSaved(next); setMessage('Shopping list saved.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save. Your draft is still here.') }
    finally { setSaving(false) }
  }
  function move(category: number, item: number, head: string) {
    const text = draft[category].items[item]
    const next = draft.map((cat, i) => i === category ? { ...cat, items: cat.items.filter((_, j) => j !== item) } : { ...cat, items: [...cat.items] })
    const target = next.find((cat) => cat.head === head)
    if (target) target.items.push(text); else next.push({ head, items: [text] })
    change(next); setActiveItem(null)
  }
  return <div className="recipe-shopping-editor" style={{ maxWidth: 780, margin: '0 auto', fontSize: 12.5 }}>
    <style>{`.recipe-shopping-editor summary::-webkit-details-marker{display:none}.recipe-shopping-editor .shopping-chevron{transform:rotate(-90deg);transition:transform .15s}.recipe-shopping-editor details[open]>summary .shopping-chevron{transform:rotate(0deg)}`}</style>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
      <div>
        <h3 style={{ margin: '0 0 3px', fontSize: 17, fontWeight: 650 }}>Your shopping list</h3>
        <span style={{ fontSize: 11.5, opacity: .65 }}>{draft.reduce((total, cat) => total + cat.items.length, 0)} items · Open a category to edit</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7 }}>
        <button type="button" style={button} disabled={saving} onClick={() => { change(extraction.categories); setShowReview(true); setActiveItem(null); setEditingCategory(null) }}>Extract from recipes</button>
        <button type="button" style={{ ...button, background: '#7a533312', fontWeight: 650 }} disabled={saving || !dirty} onClick={save}>{saving ? 'Saving…' : 'Save shopping list'}</button>
      </div>
    </div>
    <div role="status" style={{ fontSize: 11, opacity: .6, marginBottom: 10 }}>{message || (dirty ? 'Unsaved changes' : 'Saved list')}</div>
    {error && <p role="alert" style={{ color: '#bb493b' }}>{error}</p>}
    <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      {!draft.length && <p>No shopping ingredients found. Add recipes to the plan or enter an item below.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 8, alignItems: 'start' }}>
        {draft.map((cat, category) => <details key={category} open={activeItem?.category === category || editingCategory === category ? true : undefined} style={{ border: '1px solid #aaa4', borderRadius: 9, background: '#ffffff12' }}>
          <summary style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 12px', cursor: 'pointer', listStyle: 'none', userSelect: 'none' }}>
            <ChevronDown className="shopping-chevron" size={13} style={{ opacity: .5, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, fontWeight: 650 }}>{cat.head}</span>
            <span style={{ fontSize: 10, opacity: .55, background: '#8881', borderRadius: 10, padding: '1px 6px' }}>{cat.items.length}</span>
          </summary>
          <div style={{ padding: '0 12px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderTop: '1px solid #aaa3', paddingTop: 6, marginBottom: 4 }}>
              {editingCategory === category ? <>
                <input aria-label={`Category ${category + 1}`} value={cat.head} style={{ ...input, flex: 1, width: '100%' }} onChange={(event) => change(draft.map((c, i) => i === category ? { ...c, head: event.target.value } : c))} />
                <button type="button" style={iconButton} aria-label="Done editing category" onClick={() => setEditingCategory(null)}><Check size={13} /></button>
              </> : <button type="button" style={{ ...iconButton, width: 'auto', padding: '0 3px', gap: 4, fontSize: 10, opacity: .65 }} onClick={() => setEditingCategory(category)}><Pencil size={10} /> Rename</button>}
              <button type="button" style={{ ...iconButton, marginLeft: 'auto', opacity: .5 }} aria-label={`Remove category ${cat.head}`} onClick={() => { change(draft.filter((_, i) => i !== category)); setActiveItem(null); setEditingCategory(null) }}><Trash2 size={12} /></button>
            </div>
            {cat.items.map((item, index) => <div key={index} style={{ padding: '4px 0', borderBottom: '1px solid #aaa2' }}>
              {activeItem?.category === category && activeItem.item === index ? <>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input aria-label={`Item ${index + 1} in ${cat.head}`} value={item} style={{ ...input, flex: 1, width: '100%' }} onChange={(event) => change(draft.map((c, i) => i === category ? { ...c, items: c.items.map((value, j) => j === index ? event.target.value : value) } : c))} />
                  <button type="button" style={iconButton} aria-label="Done editing item" onClick={() => setActiveItem(null)}><Check size={13} /></button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                  <span style={{ fontSize: 10, opacity: .6 }}>Move to</span>
                  <select aria-label={`Move ${item || 'item'} to category`} style={{ ...input, flex: 1, maxWidth: '100%', fontSize: 11 }} value={cat.head} onChange={(event) => move(category, index, event.target.value)}>
                    {[...new Set([...GROCERY_CATEGORY_ORDER, ...draft.map((c) => c.head)])].map((head) => <option key={head} value={head}>{head}</option>)}
                  </select>
                  <button type="button" style={{ ...iconButton, opacity: .6 }} aria-label={`Remove ${item || 'item'}`} onClick={() => { change(draft.map((c, i) => i === category ? { ...c, items: c.items.filter((_, j) => j !== index) } : c)); setActiveItem(null) }}><Trash2 size={12} /></button>
                </div>
              </> : <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 25 }}>
                <span style={{ flex: 1, fontSize: 12, overflowWrap: 'anywhere' }}>{item || 'New item'}</span>
                <button type="button" style={{ ...iconButton, opacity: .5 }} aria-label={`Edit ${item || 'item'}`} onClick={() => { setActiveItem({ category, item: index }); setEditingCategory(null) }}><Pencil size={11} /></button>
              </div>}
            </div>)}
            <button type="button" style={{ ...button, border: 0, padding: '7px 0 0', fontSize: 10.5, opacity: .7 }} onClick={() => { change(draft.map((c, i) => i === category ? { ...c, items: [...c.items, ''] } : c)); setActiveItem({ category, item: cat.items.length }) }}>+ Add item</button>
          </div>
        </details>)}
      </div>
      <button type="button" style={{ ...button, marginTop: 8, fontSize: 10.5, border: 0, opacity: .65 }} onClick={() => { change([...draft, { head: 'Other', items: [''] }]); setEditingCategory(draft.length); setActiveItem({ category: draft.length, item: 0 }) }}>+ Add category</button>
    </fieldset>
    {showReview && extraction.issues.length > 0 && <details style={{ marginTop: 12, fontSize: 11, opacity: .8 }}>
      <summary>{extraction.issues.length} ingredient lines need review</summary>
      <p style={{ fontSize: 12 }}>These lines could not be confidently extracted. Check them before saving.</p>
      <ul style={{ fontSize: 12 }}>{extraction.issues.map((issue, i) => <li key={i}><strong>{issue.recipe}:</strong> {issue.line}</li>)}</ul>
    </details>}
  </div>
}

export default memo(RecipeShoppingListEditor)
