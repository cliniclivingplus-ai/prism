'use client'

import { useMemo, useState } from 'react'
import { GROCERY_CATEGORY_ORDER, type GroceryCategory } from '@/lib/groceryList'
import { extractRecipeShoppingList, normalizeShoppingDraft, type ShoppingRecipe } from '@/lib/recipeShoppingList'

export default function RecipeShoppingListEditor({ roadmapId, recipes, savedList, onSaved }: {
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
  const button = { padding: '7px 11px', border: '1px solid currentColor', borderRadius: 7, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 12 } as const
  const input = { padding: '7px 9px', border: '1px solid #aaa8', borderRadius: 6, background: 'transparent', color: 'inherit', font: 'inherit', minWidth: 0 } as const
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
    change(next)
  }
  return <div style={{ maxWidth: 900, margin: '0 auto' }}>
    <h3 style={{ margin: '0 0 10px' }}>Your shopping list</h3>
    <p style={{ fontSize: 13, opacity: .8 }}>Ingredients from the recipes in this plan. Edit items, move them to another category, or remove them, then save.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 15 }}>
      <button type="button" style={button} disabled={saving} onClick={() => { change(extraction.categories); setShowReview(true) }}>Extract from recipes</button>
      <button type="button" style={button} disabled={saving || !dirty} onClick={save}>{saving ? 'Saving…' : 'Save shopping list'}</button>
      <span role="status" style={{ alignSelf: 'center', fontSize: 12 }}>{message || (dirty ? 'Unsaved changes' : 'Saved list')}</span>
    </div>
    {error && <p role="alert" style={{ color: '#bb493b' }}>{error}</p>}
    <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      {!draft.length && <p>No shopping ingredients found. Add recipes to the plan or enter an item below.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
        {draft.map((cat, category) => <div key={category} style={{ border: '1px solid #aaa6', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
            <input aria-label={`Category ${category + 1}`} value={cat.head} style={{ ...input, flex: 1 }} onChange={(event) => change(draft.map((c, i) => i === category ? { ...c, head: event.target.value } : c))} />
            <button type="button" style={button} aria-label={`Remove category ${cat.head}`} onClick={() => change(draft.filter((_, i) => i !== category))}>×</button>
          </div>
          {cat.items.map((item, index) => <div key={index} style={{ display: 'flex', gap: 5, marginBottom: 7, flexWrap: 'wrap' }}>
            <input aria-label={`Item ${index + 1} in ${cat.head}`} value={item} style={{ ...input, flex: '1 1 140px' }} onChange={(event) => change(draft.map((c, i) => i === category ? { ...c, items: c.items.map((value, j) => j === index ? event.target.value : value) } : c))} />
            <select aria-label={`Move ${item || 'item'} to category`} style={{ ...input, width: 96, fontSize: 11 }} value={cat.head} onChange={(event) => move(category, index, event.target.value)}>
              {[...new Set([...GROCERY_CATEGORY_ORDER, ...draft.map((c) => c.head)])].map((head) => <option key={head} value={head}>{head}</option>)}
            </select>
            <button type="button" style={button} aria-label={`Remove ${item || 'item'}`} onClick={() => change(draft.map((c, i) => i === category ? { ...c, items: c.items.filter((_, j) => j !== index) } : c))}>×</button>
          </div>)}
          <button type="button" style={button} onClick={() => change(draft.map((c, i) => i === category ? { ...c, items: [...c.items, ''] } : c))}>+ Add item</button>
        </div>)}
      </div>
      <button type="button" style={{ ...button, marginTop: 12 }} onClick={() => change([...draft, { head: 'Other', items: [''] }])}>+ Add category</button>
    </fieldset>
    {showReview && extraction.issues.length > 0 && <details style={{ marginTop: 14 }}>
      <summary>{extraction.issues.length} ingredient lines need review</summary>
      <p style={{ fontSize: 12 }}>These lines could not be confidently extracted. Check them before saving.</p>
      <ul style={{ fontSize: 12 }}>{extraction.issues.map((issue, i) => <li key={i}><strong>{issue.recipe}:</strong> {issue.line}</li>)}</ul>
    </details>}
  </div>
}
