'use client'

/**
 * app/report/[id]/nutrition/page.tsx
 *
 * Displays categorised 3-phase dietary frequency data from BugSpeaks report.
 * Reads from report.report_data.nutrition_data (shape: Record<category, Record<foodName, [p1, p2, p3]>>)
 */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/mrx/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

type FreqCode = 'daily' | 'alt' | '3day' | 'avoid'
type NutritionData = Record<string, Record<string, [FreqCode, FreqCode, FreqCode]>>

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  'Greens & Vegetables':      '🥦',
  'Fruits':                   '🍎',
  'Pulses & Legumes':         '🫘',
  'Cereals':                  '🌾',
  'Fats & Oils':              '🫙',
  'Herbs & Condiments':       '🌿',
  'Egg & Meat':               '🥚',
  'Dietary Supplements':      '💊',
  'Nuts & Seed Oils':         '🥜',
  'Drinks & Beverages':       '🍵',
  'Milk & Fermented Products':'🥛',
}

const FREQ_CONFIG: Record<FreqCode, { label: string; color: string; bg: string; dot: string }> = {
  daily: {
    label: 'Daily',
    color: 'text-[var(--pista-700)]',
    bg:    'bg-[var(--pista-100)]',
    dot:   'bg-[var(--pista-500)]',
  },
  alt: {
    label: 'Alternate',
    color: 'text-blue-700',
    bg:    'bg-blue-50',
    dot:   'bg-blue-500',
  },
  '3day': {
    label: '3×/week',
    color: 'text-amber-700',
    bg:    'bg-amber-50',
    dot:   'bg-amber-500',
  },
  avoid: {
    label: 'Avoid',
    color: 'text-red-700',
    bg:    'bg-red-50',
    dot:   'bg-red-500',
  },
}

const PHASE_LABELS = ['Phase 1', 'Phase 2', 'Phase 3']

// ── Component ─────────────────────────────────────────────────────────────────

export default function NutritionPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [nutrition, setNutrition] = useState<NutritionData | null>(null)
  const [patientName, setPatientName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [activePhase, setActivePhase]     = useState<0 | 1 | 2>(0)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [search, setSearch]               = useState('')

  // ── Auth + data fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/login'); return }

      const { data, error: fetchErr } = await supabase
        .from('reports')
        .select('report_data, patient_name')
        .eq('id', id)
        .single()

      if (fetchErr || !data) {
        setError('Report not found.')
        setLoading(false)
        return
      }

      // Debug: log all top-level keys so we can find the right one
      console.log('[nutrition] report_data keys:', Object.keys(data.report_data ?? {}))

      // Try all known key names for nutrition data
      const rd = data.report_data ?? {}
      const nd = (
        rd.nutrition ??
        rd.nutrition_data ??
        rd.nutritionData ??
        rd.dietary_data
      ) as NutritionData | undefined

      console.log('[nutrition] nd found:', !!nd, nd ? Object.keys(nd).slice(0, 3) : 'none')

      if (!nd || Object.keys(nd).length === 0) {
        setError('No nutrition data found. Please re-upload the report.')
        setLoading(false)
        return
      }

      setNutrition(nd)
      setPatientName(data.patient_name ?? '')
      setActiveCategory(Object.keys(nd)[0])
      setLoading(false)
    }
    load()
  }, [id])

  // ── Derived data ─────────────────────────────────────────────────────────────

  const categories   = nutrition ? Object.keys(nutrition) : []
  const currentCat   = activeCategory && nutrition ? nutrition[activeCategory] : null

  // Filter by search + phase freq
  const filteredItems = currentCat
    ? Object.entries(currentCat).filter(([name]) =>
        name.toLowerCase().includes(search.toLowerCase())
      )
    : []

  // Group filtered items by their phase freq for the active phase
  const grouped: Record<FreqCode, string[]> = { daily: [], alt: [], '3day': [], avoid: [] }
  filteredItems.forEach(([name, freqs]) => {
    const f = freqs[activePhase]
    grouped[f].push(name)
  })

  // Stats for the active category
  const stats = currentCat
    ? (['daily', 'alt', '3day', 'avoid'] as FreqCode[]).map(f => ({
        freq: f,
        count: Object.values(currentCat).filter(fr => fr[activePhase] === f).length,
      }))
    : []

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--pista-50)]">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-[var(--pista-500)] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-[var(--pista-700)] font-medium">Loading nutrition data…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--pista-50)]">
      <div className="text-center max-w-sm space-y-4 p-8 bg-white rounded-2xl shadow-sm border border-[var(--pista-100)]">
        <div className="text-4xl">🥗</div>
        <h2 className="font-semibold text-gray-800">No Nutrition Data</h2>
        <p className="text-sm text-gray-500">{error}</p>
        <button
          onClick={() => router.push(`/mrx/report/${id}`)}
          className="text-sm text-[var(--pista-600)] hover:underline"
        >
          ← Back to report
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[var(--pista-50)]">

      {/* ── Header ── */}
      <div className="bg-white border-b border-[var(--pista-100)] px-6 py-4 flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push(`/mrx/report/${id}`)}
            className="text-xs text-gray-400 hover:text-[var(--pista-600)] mb-1 flex items-center gap-1"
          >
            ← Back to report
          </button>
          <h1 className="text-xl font-bold text-gray-900">Nutrition Recommendations</h1>
          {patientName && (
            <p className="text-sm text-gray-500 mt-0.5">{patientName}</p>
          )}
        </div>

        {/* Phase switcher */}
        <div className="flex gap-1 bg-[var(--pista-50)] border border-[var(--pista-200)] rounded-xl p-1">
          {PHASE_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => setActivePhase(i as 0 | 1 | 2)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activePhase === i
                  ? 'bg-[var(--pista-600)] text-white shadow-sm'
                  : 'text-[var(--pista-700)] hover:bg-[var(--pista-100)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">

        {/* ── Left sidebar - category list ── */}
        <aside className="w-56 shrink-0 bg-white border-r border-[var(--pista-100)] overflow-y-auto py-3">
          {categories.map(cat => {
            const items   = nutrition![cat]
            const total   = Object.keys(items).length
            const avoids  = Object.values(items).filter(fr => fr[activePhase] === 'avoid').length
            const isActive = cat === activeCategory

            return (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setSearch('') }}
                className={`w-full text-left px-4 py-3 flex items-start gap-2.5 transition-all border-l-2 ${
                  isActive
                    ? 'bg-[var(--pista-50)] border-[var(--pista-500)]'
                    : 'border-transparent hover:bg-gray-50'
                }`}
              >
                <span className="text-lg leading-none mt-0.5">
                  {CATEGORY_EMOJI[cat] ?? '🍽️'}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold leading-tight ${isActive ? 'text-[var(--pista-700)]' : 'text-gray-700'}`}>
                    {cat}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {total} items
                    {avoids > 0 && (
                      <span className="text-red-400 ml-1">· {avoids} avoid</span>
                    )}
                  </p>
                </div>
              </button>
            )
          })}
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto">
          {activeCategory && currentCat && (
            <>
              {/* Category header + stats */}
              <div className="bg-white border-b border-[var(--pista-100)] px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{CATEGORY_EMOJI[activeCategory] ?? '🍽️'}</span>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{activeCategory}</h2>
                      <p className="text-xs text-gray-400">
                        {Object.keys(currentCat).length} food items · {PHASE_LABELS[activePhase]}
                      </p>
                    </div>
                  </div>

                  {/* Mini freq stats */}
                  <div className="flex gap-2">
                    {stats.map(({ freq, count }) => {
                      const cfg = FREQ_CONFIG[freq]
                      return (
                        <div key={freq} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${cfg.bg}`}>
                          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          <span className={`text-xs font-semibold ${cfg.color}`}>
                            {count} {cfg.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Search */}
                <div className="mt-3">
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search foods…"
                    className="w-full max-w-xs text-sm border border-[var(--pista-200)] rounded-lg px-3 py-1.5 bg-[var(--pista-50)] focus:outline-none focus:ring-1 focus:ring-[var(--pista-400)] placeholder-gray-400"
                  />
                </div>
              </div>

              {/* Food grid - grouped by freq */}
              <div className="p-6 space-y-6">
                {(['daily', 'alt', '3day', 'avoid'] as FreqCode[]).map(freq => {
                  const foods = grouped[freq]
                  if (foods.length === 0) return null
                  const cfg = FREQ_CONFIG[freq]

                  return (
                    <section key={freq}>
                      {/* Section header */}
                      <div className={`flex items-center gap-2 mb-3`}>
                        <span className={`w-3 h-3 rounded-full ${cfg.dot}`} />
                        <h3 className={`text-sm font-bold uppercase tracking-wide ${cfg.color}`}>
                          {cfg.label}
                        </h3>
                        <span className={`text-xs ${cfg.color} opacity-60`}>
                          {foods.length} items
                        </span>
                      </div>

                      {/* Food chips */}
                      <div className="flex flex-wrap gap-2">
                        {foods.sort().map(food => (
                          <FoodChip
                            key={food}
                            name={food}
                            freqs={currentCat[food]}
                            activePhase={activePhase}
                          />
                        ))}
                      </div>
                    </section>
                  )
                })}

                {filteredItems.length === 0 && (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    No foods match "{search}"
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

// ── FoodChip ──────────────────────────────────────────────────────────────────

function FoodChip({
  name,
  freqs,
  activePhase,
}: {
  name: string
  freqs: [FreqCode, FreqCode, FreqCode]
  activePhase: 0 | 1 | 2
}) {
  const [open, setOpen] = useState(false)
  const cfg = FREQ_CONFIG[freqs[activePhase]]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:shadow-sm ${cfg.bg} ${cfg.color} border-transparent hover:border-current`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {name}
      </button>

      {/* Popover: all 3 phase freqs */}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-2 z-20 bg-white rounded-xl shadow-lg border border-gray-100 p-3 min-w-[160px]">
            <p className="text-xs font-bold text-gray-700 mb-2">{name}</p>
            <div className="space-y-1.5">
              {freqs.map((f, i) => {
                const c = FREQ_CONFIG[f]
                return (
                  <div key={i} className="flex items-center justify-between gap-4">
                    <span className="text-[10px] text-gray-400">{PHASE_LABELS[i]}</span>
                    <span className={`flex items-center gap-1 text-[10px] font-semibold ${c.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                      {c.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}