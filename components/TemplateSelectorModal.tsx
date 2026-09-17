'use client'

import { useState } from 'react'
import { Layout, Palette, Sparkles, Check, Search, X, Info, Calendar, BookOpen, Layers } from 'lucide-react'
import { PALETTES, PALETTE_LIST } from '@/components/guide-templates/palettes'

export type TemplateMeta = {
  id: string
  name: string
  category: 'journey' | 'protocol'
  categoryLabel: string
  tagline: string
  description: string
  bestFor: string
  recommendedDuration: string
  icon: string
  palettePreview: string[]
}

export const ALL_TEMPLATES_CATALOG: TemplateMeta[] = [
  // Full Journey & Multi-Month Layouts
  {
    id: 'classic',
    name: 'Classic Dashboard',
    category: 'journey',
    categoryLabel: 'Full Journey / Monthly',
    tagline: 'Structured & Card-Based',
    description: 'Clean, card-organized patient dashboard with distinct sections for goals, daily routines, meals, and recipe cards.',
    bestFor: 'Standard multi-month patient care & comprehensive lifestyle management.',
    recommendedDuration: '1–6 Months',
    icon: '📊',
    palettePreview: ['#1C2B29', '#538A22', '#ECEBE3', '#2563EB'],
  },
  {
    id: 'almanac',
    name: 'Almanac Editorial',
    category: 'journey',
    categoryLabel: 'Full Journey / Monthly',
    tagline: 'Warm Paper & Magazine Aesthetics',
    description: 'Rich editorial design featuring warm paper textures, gold accents, Fraunces serif typography, and elegant dusk section bands.',
    bestFor: 'Premium holistic wellness guides, luxury patient onboarding & lifestyle books.',
    recommendedDuration: '1–6 Months',
    icon: '📖',
    palettePreview: ['#1E2019', '#D4AF37', '#FDFBF7', '#8C6D3B'],
  },
  {
    id: 'pulse',
    name: 'Pulse Clinical',
    category: 'journey',
    categoryLabel: 'Full Journey / Monthly',
    tagline: 'Vibrant, Active & Pill-Styled',
    description: 'Modern clinical design with rounded card tiles, energetic teal accents, pill chips, and high-visibility habit stats.',
    bestFor: 'Active lifestyle coaching, sports nutrition, and high-engagement habit plans.',
    recommendedDuration: '1–3 Months',
    icon: '⚡',
    palettePreview: ['#0F172A', '#0D9488', '#F1F5F9', '#2563EB'],
  },
  {
    id: 'onyx',
    name: 'Onyx Executive',
    category: 'journey',
    categoryLabel: 'Full Journey / Monthly',
    tagline: 'Sleek Dark-Mode & Minimalist',
    description: 'Sophisticated dark theme with fine borders, crisp typography, and high-contrast dark accents.',
    bestFor: 'Executive health programs, concierge clients, and premium night-mode viewing.',
    recommendedDuration: '1–6 Months',
    icon: '🖤',
    palettePreview: ['#0F172A', '#334155', '#1E293B', '#94A3B8'],
  },
  {
    id: 'vitals',
    name: 'Vitals Biomarker',
    category: 'journey',
    categoryLabel: 'Full Journey / Monthly',
    tagline: 'Metric-Forward & Ring Charts',
    description: 'Data-driven layout featuring progress ring wheels, health score badges, and structured metric tracking.',
    bestFor: 'Functional medicine, metabolic health, and lab report follow-ups.',
    recommendedDuration: '1–3 Months',
    icon: '📈',
    palettePreview: ['#1E1B4B', '#7C3AED', '#F5F3FF', '#4F46E5'],
  },

  // Focused Week & Sprint Protocols
  {
    id: 'week',
    name: 'Week Protocol (Classic)',
    category: 'protocol',
    categoryLabel: 'Weekly Protocol / Sprint',
    tagline: '7-Day Step-by-Step Sprint',
    description: 'Focused single-week habit checklist with daily targets, interactive goal toggles, and grocery list.',
    bestFor: '7-day kickstarts, initial detoxes, or step-by-step habit onboarding.',
    recommendedDuration: '1 Week',
    icon: '📅',
    palettePreview: ['#14532D', '#16A34A', '#F0FDF4', '#15803D'],
  },
  {
    id: 'week-care',
    name: 'Care Canvas',
    category: 'protocol',
    categoryLabel: 'Weekly Protocol / Sprint',
    tagline: 'Warm, Compassionate & Nurturing',
    description: 'Soft card layout with gentle pastel tones designed for patient comfort and stress-free habit adoption.',
    bestFor: 'Medical nutrition, recovery plans, and sensitive care protocols.',
    recommendedDuration: '1–2 Weeks',
    icon: '🛡️',
    palettePreview: ['#831843', '#DB2777', '#FDF2F8', '#BE185D'],
  },
  {
    id: 'week-bloom',
    name: 'Bloom Floral',
    category: 'protocol',
    categoryLabel: 'Weekly Protocol / Sprint',
    tagline: 'Soft Pastel & Botanical',
    description: 'Elegant botanical aesthetic with rose, sage, and soft cream undertones for mindful habit tracking.',
    bestFor: 'Hormonal balance, gut health resets, and women’s wellness protocols.',
    recommendedDuration: '1–2 Weeks',
    icon: '🌸',
    palettePreview: ['#881337', '#FB7185', '#FFF1F2', '#E11D48'],
  },
  {
    id: 'week-aurora',
    name: 'Aurora Gradient',
    category: 'protocol',
    categoryLabel: 'Weekly Protocol / Sprint',
    tagline: 'Soft Atmospheric Gradients',
    description: 'Relaxing gradient card layout designed to promote stress reduction and circadian rhythm alignment.',
    bestFor: 'Sleep optimization, stress management, and adrenal recovery.',
    recommendedDuration: '1–2 Weeks',
    icon: '🌌',
    palettePreview: ['#312E81', '#6366F1', '#EEF2FF', '#4338CA'],
  },
  {
    id: 'week-earth',
    name: 'Earth Natural',
    category: 'protocol',
    categoryLabel: 'Weekly Protocol / Sprint',
    tagline: 'Organic & Terracotta Earth Tones',
    description: 'Warm earth tones, olive greens, and warm sand backgrounds for grounded, natural lifestyle guidance.',
    bestFor: 'Plant-based diet shifts, whole-food resets, and Ayurvedic protocols.',
    recommendedDuration: '1–2 Weeks',
    icon: '🌿',
    palettePreview: ['#365314', '#65A30D', '#F7FEE7', '#4D7C0F'],
  },
  {
    id: 'week-editorial',
    name: 'Editorial Minimal',
    category: 'protocol',
    categoryLabel: 'Weekly Protocol / Sprint',
    tagline: 'Clean Typographic Print',
    description: 'High-typography print aesthetic with clean dividing lines and understated serif accents.',
    bestFor: 'Clean, distraction-free daily guidance and minimal protocols.',
    recommendedDuration: '1–2 Weeks',
    icon: '📰',
    palettePreview: ['#0C4A6E', '#0EA5E9', '#F0F9FF', '#0284C7'],
  },
  {
    id: 'week-neon',
    name: 'Neon Cyber',
    category: 'protocol',
    categoryLabel: 'Weekly Protocol / Sprint',
    tagline: 'High-Energy & High-Contrast',
    description: 'Vibrant neon green & dark contrast design for intense athletic or high-energy habit challenges.',
    bestFor: 'Fitness bootcamps, fat-loss sprints, and high-energy habit challenges.',
    recommendedDuration: '1 Week',
    icon: '⚡',
    palettePreview: ['#064E3B', '#10B981', '#ECFDF5', '#059669'],
  },
  {
    id: 'week-brutal',
    name: 'Brutal Outline',
    category: 'protocol',
    categoryLabel: 'Weekly Protocol / Sprint',
    tagline: 'Bold Outlines & Maximum Visibility',
    description: 'Neo-brutalist high-visibility cards with strong black outlines and vibrant pop accents.',
    bestFor: 'High-clarity habit enforcement and ultra-readable daily protocols.',
    recommendedDuration: '1 Week',
    icon: '💥',
    palettePreview: ['#7C2D12', '#EA580C', '#FFEDD5', '#C2410C'],
  },
]

export default function TemplateSelectorModal({
  currentTemplate,
  currentTheme,
  onSelectTemplate,
  onSelectTheme,
}: {
  currentTemplate: string
  currentTheme: string
  onSelectTemplate: (templateId: string) => void
  onSelectTheme: (themeId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [filterCategory, setFilterCategory] = useState<'all' | 'journey' | 'protocol'>('all')
  const [search, setSearch] = useState('')

  const activeTemplateMeta = ALL_TEMPLATES_CATALOG.find((t) => t.id === currentTemplate) || ALL_TEMPLATES_CATALOG[0]

  const filteredTemplates = ALL_TEMPLATES_CATALOG.filter((t) => {
    const matchesCat = filterCategory === 'all' || t.category === filterCategory
    const q = search.trim().toLowerCase()
    const matchesQuery = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tagline.toLowerCase().includes(q) || t.bestFor.toLowerCase().includes(q)
    return matchesCat && matchesQuery
  })

  return (
    <>
      {/* Trigger Banner / Selector Bar */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 14,
          padding: '14px 18px',
          marginTop: 14,
          marginBottom: 14,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
              }}
            >
              {activeTemplateMeta.icon}
            </div>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: '#64748B' }}>
                Plan Template &amp; Visual Architecture
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <span>{activeTemplateMeta.name}</span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: activeTemplateMeta.category === 'journey' ? '#EFF6FF' : '#F0FDF4',
                    color: activeTemplateMeta.category === 'journey' ? '#2563EB' : '#16A34A',
                  }}
                >
                  {activeTemplateMeta.categoryLabel}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 10,
              padding: '8px 16px',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
            }}
          >
            <Layout size={14} /> Explore &amp; Switch Templates ({ALL_TEMPLATES_CATALOG.length})
          </button>
        </div>

        {/* Color Palette Selector Bar */}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Palette size={12} /> Color Theme:
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {PALETTE_LIST.map((p) => {
              const isActive = currentTheme === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectTheme(p.id)}
                  title={`Apply ${p.label} color scheme`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 16,
                    cursor: 'pointer',
                    fontSize: 11.5,
                    fontWeight: isActive ? 700 : 500,
                    border: isActive ? `2px solid ${PALETTES[p.id].accent}` : '1px solid #E2E8F0',
                    background: isActive ? PALETTES[p.id].accentSoft : '#FFFFFF',
                    color: PALETTES[p.id].ink,
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: PALETTES[p.id].accent, flexShrink: 0 }} />
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Modal / Gallery Picker */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 120,
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              background: '#FFFFFF',
              borderRadius: 18,
              padding: '24px 28px',
              maxWidth: 960,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              border: '1px solid #E2E8F0',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layout size={20} color="#2563EB" /> All Plan Templates ({ALL_TEMPLATES_CATALOG.length})
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>
                  Pick any template to change the patient&apos;s visual layout. All data (recipes, schedule, guidelines, supplements) transfers seamlessly!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Nutritionist Guidance Alert Box */}
            <div
              style={{
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: 10,
                padding: '10px 14px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12,
                color: '#166534',
              }}
            >
              <Info size={16} color="#16A34A" style={{ flexShrink: 0 }} />
              <span>
                <strong>Quick Tip:</strong> Use <strong>Full Journey Layouts</strong> for 1 to 6-month holistic programs. Use <strong>Weekly Protocols</strong> for 7 to 14-day habit kickstarts, detoxes, or step-by-step habit challenges.
              </span>
            </div>

            {/* Filter Tabs & Search */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
              <div style={{ display: 'flex', gap: 6, background: '#F1F5F9', padding: 3, borderRadius: 10 }}>
                <button
                  type="button"
                  onClick={() => setFilterCategory('all')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: filterCategory === 'all' ? '#FFFFFF' : 'transparent',
                    color: filterCategory === 'all' ? '#0F172A' : '#64748B',
                    boxShadow: filterCategory === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  All Templates ({ALL_TEMPLATES_CATALOG.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('journey')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: filterCategory === 'journey' ? '#FFFFFF' : 'transparent',
                    color: filterCategory === 'journey' ? '#2563EB' : '#64748B',
                    boxShadow: filterCategory === 'journey' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Full Journey (5)
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('protocol')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: filterCategory === 'protocol' ? '#FFFFFF' : 'transparent',
                    color: filterCategory === 'protocol' ? '#16A34A' : '#64748B',
                    boxShadow: filterCategory === 'protocol' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Weekly Protocols (8)
                </button>
              </div>

              <div style={{ position: 'relative', width: 240 }}>
                <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by keyword..."
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 30px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 12,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Template Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {filteredTemplates.map((t) => {
                const isSelected = currentTemplate === t.id
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      onSelectTemplate(t.id)
                    }}
                    style={{
                      border: isSelected ? '2px solid #2563EB' : '1px solid #E2E8F0',
                      borderRadius: 14,
                      padding: 16,
                      background: isSelected ? '#EFF6FF' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: isSelected ? '0 4px 14px rgba(37,99,235,0.15)' : 'none',
                    }}
                  >
                    <div>
                      {/* Card Top Row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 22 }}>{t.icon}</span>
                          <div>
                            <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', display: 'block', lineHeight: 1.2 }}>
                              {t.name}
                            </span>
                            <span style={{ fontSize: 10.5, color: '#64748B', fontWeight: 600 }}>{t.tagline}</span>
                          </div>
                        </div>

                        {isSelected && (
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: '#2563EB',
                              color: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Check size={13} />
                          </span>
                        )}
                      </div>

                      {/* Swatch Preview Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '8px 0 10px' }}>
                        {t.palettePreview.map((hex, idx) => (
                          <span key={idx} style={{ width: 16, height: 16, borderRadius: 4, background: hex, border: '1px solid rgba(0,0,0,0.1)' }} />
                        ))}
                        <span style={{ fontSize: 10, color: '#64748B', marginLeft: 4, fontWeight: 600 }}>
                          {t.category === 'journey' ? 'Full Layout' : 'Protocol Canvas'}
                        </span>
                      </div>

                      {/* Description */}
                      <p style={{ fontSize: 11.5, color: '#334155', lineHeight: 1.5, margin: '0 0 10px' }}>{t.description}</p>

                      {/* Best For Note */}
                      <div style={{ fontSize: 10.5, color: '#64748B', background: isSelected ? '#DBEAFE' : '#F8FAFC', padding: '6px 8px', borderRadius: 6, marginBottom: 12 }}>
                        <strong>Best for:</strong> {t.bestFor}
                      </div>
                    </div>

                    {/* Bottom Action Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={11} /> {t.recommendedDuration}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectTemplate(t.id)
                        }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 6,
                          border: 'none',
                          background: isSelected ? '#2563EB' : '#F1F5F9',
                          color: isSelected ? '#FFFFFF' : '#0F172A',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {isSelected ? 'Active Layout' : 'Apply Template'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
