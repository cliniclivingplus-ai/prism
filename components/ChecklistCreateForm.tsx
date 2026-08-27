'use client'
import { useState, useEffect, useMemo } from 'react'
import { Wand2, Loader2, Search, ChefHat, Image as ImageIcon, LayoutList, Sparkles } from 'lucide-react'

const C = {
  green: '#538A22', greenDeep: '#2F5214', greenSoft: '#F2F9EC', greenBorder: '#C8E9A8',
  ink: '#1A2417', muted: '#6b7280', faint: '#8A9284', line: '#ECEBE3', card: '#FFFFFF',
  danger: '#B3261E',
}

type Recipe = { id: string; name: string; meal_type: string; image_url?: string | null }
type GuideImage = { id: string; label: string; image_url: string }

// A one-off, single-consultation page: coach describes the condition/goal
// in their own words and picks from the app's existing recipe bank and
// picture bank (never a fresh upload) — the AI decides sections/layout
// from there. See src/app/api/compass/checklists/route.ts.
export default function ChecklistCreateForm({ patientId, sessionId, onCreated }: { patientId: string; sessionId?: string; onCreated: (checklistId: string) => void }) {
  const [conditionGoal, setConditionGoal] = useState('')
  const [template, setTemplate] = useState<'standard' | 'pictorial'>('standard')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [images, setImages] = useState<GuideImage[]>([])
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<Set<string>>(new Set())
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set())
  const [recipeSearch, setRecipeSearch] = useState('')
  const [imageSearch, setImageSearch] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/compass/recipe-bank').then((r) => r.json()).then((j) => setRecipes(Array.isArray(j) ? j : [])).catch(() => {})
    fetch('/api/compass/guide-images').then((r) => r.json()).then((j) => setImages(Array.isArray(j) ? j : [])).catch(() => {})
  }, [])

  const filteredRecipes = useMemo(() => {
    const q = recipeSearch.trim().toLowerCase()
    return q ? recipes.filter((r) => r.name.toLowerCase().includes(q)) : recipes
  }, [recipes, recipeSearch])
  const filteredImages = useMemo(() => {
    const q = imageSearch.trim().toLowerCase()
    return q ? images.filter((im) => im.label.toLowerCase().includes(q)) : images
  }, [images, imageSearch])

  function toggle(set: Set<string>, setFn: (s: Set<string>) => void, id: string) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setFn(next)
  }

  async function generate() {
    if (!conditionGoal.trim()) { setError('Describe the condition and what you want to treat first.'); return }
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/compass/checklists', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId, session_id: sessionId, condition_goal: conditionGoal.trim(),
          recipe_ids: [...selectedRecipeIds], image_ids: [...selectedImageIds],
          style: template,
        }),
      })
      const j = await res.json()
      if (!res.ok) { setError(j.error || 'Generation failed'); return }
      onCreated(j.id)
    } catch { setError('Network error, try again.') }
    finally { setGenerating(false) }
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: '20px 22px' }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
        Template
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 18 }}>
        <button type="button" onClick={() => setTemplate('standard')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
            border: `1.5px solid ${template === 'standard' ? C.green : C.line}`, background: template === 'standard' ? C.greenSoft : '#fff' }}>
          <LayoutList size={18} color={template === 'standard' ? C.green : C.faint} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Standard</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Mix of text, stats and checklist</div>
          </div>
        </button>
        <button type="button" onClick={() => setTemplate('pictorial')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
            border: `1.5px solid ${template === 'pictorial' ? C.green : C.line}`, background: template === 'pictorial' ? C.greenSoft : '#fff' }}>
          <Sparkles size={18} color={template === 'pictorial' ? C.green : C.faint} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Pictorial goals</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Big icons, minimal wording</div>
          </div>
        </button>
      </div>

      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
        Condition and what you want to treat
      </label>
      <textarea
        value={conditionGoal}
        onChange={(e) => setConditionGoal(e.target.value)}
        placeholder="e.g. Patient has been struggling with afternoon energy crashes and sugar cravings. Focus this consultation on stabilising blood sugar and giving her 3-4 easy swaps she can start immediately."
        rows={4}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 13.5, color: C.ink, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' as const }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            <ChefHat size={13} /> Recipes ({selectedRecipeIds.size} picked)
          </div>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={13} color={C.faint} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} placeholder="Search recipes..."
              style={{ width: '100%', padding: '7px 10px 7px 28px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12.5, boxSizing: 'border-box' }} />
          </div>
          <div style={{ maxHeight: 190, overflowY: 'auto', border: `1px solid ${C.line}`, borderRadius: 8, padding: 8 }}>
            {filteredRecipes.length === 0 && <div style={{ fontSize: 12, color: C.muted, padding: 6 }}>No recipes found.</div>}
            {filteredRecipes.map((r) => (
              <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', fontSize: 12.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={selectedRecipeIds.has(r.id)} onChange={() => toggle(selectedRecipeIds, setSelectedRecipeIds, r.id)} />
                <span>{r.name}</span>
                <span style={{ fontSize: 10.5, color: C.faint, textTransform: 'capitalize' }}>{r.meal_type}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            <ImageIcon size={13} /> Images ({selectedImageIds.size} picked)
          </div>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={13} color={C.faint} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={imageSearch} onChange={(e) => setImageSearch(e.target.value)} placeholder="Search images..."
              style={{ width: '100%', padding: '7px 10px 7px 28px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12.5, boxSizing: 'border-box' }} />
          </div>
          <div style={{ maxHeight: 190, overflowY: 'auto', border: `1px solid ${C.line}`, borderRadius: 8, padding: 8 }}>
            {filteredImages.length === 0 && <div style={{ fontSize: 12, color: C.muted, padding: 6 }}>No images found.</div>}
            {filteredImages.map((im) => (
              <label key={im.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', fontSize: 12.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={selectedImageIds.has(im.id)} onChange={() => toggle(selectedImageIds, setSelectedImageIds, im.id)} />
                <span>{im.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {error && <p style={{ fontSize: 12.5, color: C.danger, marginTop: 12 }}>{error}</p>}

      <button onClick={generate} disabled={generating}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 18, padding: '10px 18px', background: C.green, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.8 : 1 }}>
        {generating ? <Loader2 size={15} style={{ animation: 'clpSpin 1s linear infinite' }} /> : <Wand2 size={15} />}
        {generating ? 'Designing your page...' : 'Generate checklist'}
      </button>
      <style>{`@keyframes clpSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
