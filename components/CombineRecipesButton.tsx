'use client'
import { useState, useRef, useEffect } from 'react'
import { Layers, X, Check, Search } from 'lucide-react'
import type { DayMealSlot } from '@/lib/pdf/ClientGuideDocument'

const C = { accent: '#2563EB', accentSoft: '#EFF4FF', line: '#ECEBE3', ink: '#1A2417', muted: '#6b7280', green: '#15803D' }

export type BankRecipe = { id: string; name: string; ingredients: string; steps: string; image_url?: string | null; protein_label?: string | null }
export type RecipeOverrides = Record<string, { ingredients?: string; steps?: string; name?: string; hidden?: boolean }>

const MEAL_SLOT_OPTIONS: { key: DayMealSlot; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast (Morning)' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snack' },
  { key: 'dessert', label: 'Dessert' },
]

export default function CombineRecipesButton({
  recipes,
  recipeOverrides,
  manualRecipes = {},
  weeklyManualRecipes = {},
  weekMealMatches,
  onApply,
}: {
  recipes: BankRecipe[]
  recipeOverrides: RecipeOverrides
  manualRecipes?: Partial<Record<DayMealSlot, string[]>>
  weeklyManualRecipes?: Record<number, Partial<Record<DayMealSlot, string[]>>>
  weekMealMatches?: Record<DayMealSlot, { recipe: { id: string } }[]>
  onApply: (
    nextOverrides: RecipeOverrides,
    nextManualRecipes: Partial<Record<DayMealSlot, string[]>>,
    nextWeeklyManualRecipes: Record<number, Partial<Record<DayMealSlot, string[]>>>
  ) => void
}) {
  const [open, setOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [customTitle, setCustomTitle] = useState('')
  const [targetSlot, setTargetSlot] = useState<DayMealSlot>('breakfast')
  const [hideOthers, setHideOthers] = useState(true)
  const [search, setSearch] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  // Filter out recipes marked as hidden already
  const visibleRecipes = recipes.filter((r) => !recipeOverrides[r.id]?.hidden)

  // Auto-generate suggested combined title when selection changes
  const toggleSelect = (id: string) => {
    let next: string[]
    if (selectedIds.includes(id)) {
      next = selectedIds.filter((x) => x !== id)
    } else {
      next = [...selectedIds, id]
    }
    setSelectedIds(next)

    // Suggest title by joining names of selected recipes
    const selectedObj = next.map((selId) => recipes.find((r) => r.id === selId)).filter((r): r is BankRecipe => !!r)
    const suggestedTitle = selectedObj.map((r) => recipeOverrides[r.id]?.name ?? r.name).join(' & ')
    setCustomTitle(suggestedTitle)
  }

  function handleCombine() {
    if (selectedIds.length < 2) return

    const primaryId = selectedIds[0]
    const secondaryIds = selectedIds.slice(1)
    const selectedRecipes = selectedIds.map((id) => recipes.find((r) => r.id === id)).filter((r): r is BankRecipe => !!r)

    const finalTitle = customTitle.trim() || selectedRecipes.map((r) => recipeOverrides[r.id]?.name ?? r.name).join(' & ')

    // Build combined ingredients
    const combinedIngredients = selectedRecipes
      .map((r) => {
        const titleName = recipeOverrides[r.id]?.name ?? r.name
        const ings = (recipeOverrides[r.id]?.ingredients ?? r.ingredients).trim()
        return `-- ${titleName} --\n${ings}`
      })
      .join('\n\n')

    // Build combined steps
    const combinedSteps = selectedRecipes
      .map((r) => {
        const titleName = recipeOverrides[r.id]?.name ?? r.name
        const stps = (recipeOverrides[r.id]?.steps ?? r.steps).trim()
        return `-- ${titleName} --\n${stps}`
      })
      .join('\n\n')

    const nextOverrides: RecipeOverrides = { ...recipeOverrides }

    // Primary recipe becomes the combined recipe card
    nextOverrides[primaryId] = {
      ...nextOverrides[primaryId],
      name: finalTitle,
      ingredients: combinedIngredients,
      steps: combinedSteps,
      hidden: false,
    }

    // Hide secondary recipe cards if hideOthers is checked
    if (hideOthers) {
      secondaryIds.forEach((id) => {
        nextOverrides[id] = {
          ...nextOverrides[id],
          hidden: true,
        }
      })
    }

    const slots: DayMealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert']

    // Update manualRecipes
    const nextManual: Partial<Record<DayMealSlot, string[]>> = {}
    slots.forEach((s) => {
      let baseList: string[]
      if (manualRecipes[s] && Array.isArray(manualRecipes[s])) {
        baseList = manualRecipes[s]!
      } else if (weekMealMatches && weekMealMatches[s]) {
        baseList = weekMealMatches[s].map((m) => m.recipe.id)
      } else {
        baseList = []
      }
      let filtered = baseList.filter((id) => id !== primaryId && !secondaryIds.includes(id))
      if (s === targetSlot) {
        if (!filtered.includes(primaryId)) {
          filtered = [...filtered, primaryId]
        }
      }
      nextManual[s] = filtered
    })

    // Update weeklyManualRecipes
    const nextWeekly: Record<number, Partial<Record<DayMealSlot, string[]>>> = { ...weeklyManualRecipes }
    const existingWeekNumbers = Object.keys(nextWeekly).map(Number)
    const targetWeeks = existingWeekNumbers.length > 0 ? existingWeekNumbers : [1]

    targetWeeks.forEach((wn) => {
      const weekSlots = nextWeekly[wn] || {}
      const nextWeekSlots: Partial<Record<DayMealSlot, string[]>> = {}

      slots.forEach((s) => {
        let baseList: string[]
        if (weekSlots[s] && Array.isArray(weekSlots[s])) {
          baseList = weekSlots[s]!
        } else if (manualRecipes[s] && Array.isArray(manualRecipes[s])) {
          baseList = manualRecipes[s]!
        } else if (weekMealMatches && weekMealMatches[s]) {
          baseList = weekMealMatches[s].map((m) => m.recipe.id)
        } else {
          baseList = []
        }
        let filtered = baseList.filter((id) => id !== primaryId && !secondaryIds.includes(id))
        if (s === targetSlot) {
          if (!filtered.includes(primaryId)) {
            filtered = [...filtered, primaryId]
          }
        }
        nextWeekSlots[s] = filtered
      })
      nextWeekly[wn] = nextWeekSlots
    })

    onApply(nextOverrides, nextManual, nextWeekly)
    setSuccessMsg(`Combined into "${finalTitle}" under ${MEAL_SLOT_OPTIONS.find((s) => s.key === targetSlot)?.label}!`)
    setTimeout(() => {
      setSuccessMsg('')
      setOpen(false)
      setSelectedIds([])
      setCustomTitle('')
    }, 1500)
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Combine 2 or more recipes into 1 single recipe card and select meal slot"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: open ? C.accentSoft : 'none',
          border: `1px solid ${open ? C.accent : C.line}`,
          borderRadius: 20,
          padding: '3px 10px',
          cursor: 'pointer',
          color: C.accent,
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        <Layers size={11} /> Combine 2+ recipes
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 6,
            width: 340,
            background: '#fff',
            border: `1px solid ${C.accent}`,
            borderRadius: 12,
            padding: 14,
            boxShadow: '0 8px 24px rgba(17,24,39,0.15)',
            zIndex: 45,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Combine Recipes</span>
            <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}>
              <X size={14} />
            </button>
          </div>
          <p style={{ fontSize: 11, color: C.muted, margin: '0 0 10px' }}>
            Select 2 or more dishes, pick a meal slot (e.g. Breakfast, Lunch, Dinner), and merge them into 1 recipe card.
          </p>

          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={12} color={C.muted} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter recipes..."
              style={{ width: '100%', padding: '5px 8px 5px 26px', borderRadius: 7, border: `1px solid ${C.line}`, fontSize: 12, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ maxHeight: 140, overflowY: 'auto', border: `1px solid ${C.line}`, borderRadius: 8, padding: 6, marginBottom: 10 }}>
            {visibleRecipes
              .filter((r) => (recipeOverrides[r.id]?.name ?? r.name).toLowerCase().includes(search.toLowerCase()))
              .map((r) => {
                const displayName = recipeOverrides[r.id]?.name ?? r.name
                const isSelected = selectedIds.includes(r.id)
                return (
                  <label
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 6px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: isSelected ? 700 : 400,
                      cursor: 'pointer',
                      background: isSelected ? C.accentSoft : 'transparent',
                      color: isSelected ? C.accent : C.ink,
                    }}
                  >
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(r.id)} style={{ cursor: 'pointer' }} />
                    <span>{displayName}</span>
                  </label>
                )
              })}
          </div>

          {selectedIds.length >= 2 && (
            <>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: C.muted, marginBottom: 3 }}>
                  Assign to Meal Slot
                </div>
                <select
                  value={targetSlot}
                  onChange={(e) => setTargetSlot(e.target.value as DayMealSlot)}
                  style={{ width: '100%', padding: '6px 9px', borderRadius: 7, border: `1px solid ${C.line}`, fontSize: 12, color: C.ink, boxSizing: 'border-box' }}
                >
                  {MEAL_SLOT_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: C.muted, marginBottom: 3 }}>
                  Combined Recipe Name
                </div>
                <input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Dosa & Coconut Chutney"
                  style={{ width: '100%', padding: '6px 9px', borderRadius: 7, border: `1px solid ${C.line}`, fontSize: 12, color: C.ink, boxSizing: 'border-box' }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.ink, marginBottom: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={hideOthers} onChange={(e) => setHideOthers(e.target.checked)} />
                <span>Hide individual secondary recipe cards after merging</span>
              </label>

              <button
                type="button"
                onClick={handleCombine}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: C.accent,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Check size={13} /> Merge {selectedIds.length} recipes into 1
              </button>
            </>
          )}

          {selectedIds.length < 2 && (
            <p style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', margin: 0 }}>
              {selectedIds.length === 0 ? 'Select at least 2 recipes above to combine.' : 'Select 1 more recipe to combine with.'}
            </p>
          )}

          {successMsg && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: C.green, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Check size={13} /> {successMsg}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
