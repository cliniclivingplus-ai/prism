'use client'
// app/feedback/page.tsx
// Shared feedback board - all submitted doctor feedback visible to everyone.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/mrx/supabase'
import { getUser }  from '@/lib/mrx/auth'

// ─── Types ───────────────────────────────────────────────────────────────────

type Category = 'suggestion' | 'bug' | 'feature' | 'other'

interface FeedbackRow {
  id:         string
  doctor_id:  string | null
  category:   Category
  message:    string
  status:     string
  created_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<Category, { label: string; icon: string; badge: string }> = {
  suggestion: { label: 'Suggestion',     icon: '💡', badge: 'bg-blue-50 border-blue-200 text-blue-700'     },
  bug:        { label: 'Bug / Issue',    icon: '🐛', badge: 'bg-red-50 border-red-200 text-red-700'        },
  feature:    { label: 'Feature request',icon: '✨', badge: 'bg-purple-50 border-purple-200 text-purple-700'},
  other:      { label: 'Other',          icon: '💬', badge: 'bg-gray-100 border-gray-200 text-gray-600'    },
}

const ALL_CATEGORIES: (Category | 'all')[] = ['all', 'suggestion', 'feature', 'bug', 'other']

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const [rows,      setRows]      = useState<FeedbackRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<Category | 'all'>('all')
  const [myId,      setMyId]      = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    async function load() {
      const user = await getUser()
      setMyId(user?.id ?? null)

      const { data, error } = await supabase
        .from('doctor_feedback')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) setRows(data as FeedbackRow[])
      setLoading(false)
    }
    load()
  }, [showModal])  // reload after modal submit

  const filtered = filter === 'all' ? rows : rows.filter(r => r.category === filter)

  const counts = ALL_CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = cat === 'all' ? rows.length : rows.filter(r => r.category === cat).length
    return acc
  }, {})

  return (
    <div className="min-h-screen" style={{ background: '#F8FAF6' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="border-b border-[#C8E9A8] bg-[#F2F9EC] px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/mrx/dashboard"
            className="flex items-center gap-1.5 text-xs font-mono text-[#538A22] hover:text-[#1A3207] transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Dashboard
          </Link>
          <span className="text-gray-300">·</span>
          <div>
            <h1 className="text-sm font-semibold text-[#1A3207]">Feedback Board</h1>
            <p className="text-[10px] font-mono text-gray-400 mt-0.5">
              Suggestions and ideas from the team - {rows.length} total
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="btn-primary-mrx flex items-center gap-2 px-4 py-2 bg-[#538A22] hover:bg-[#3D6B16]
            text-white text-xs font-mono font-semibold rounded-xl transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add feedback
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* ── Category filter ───────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-6">
          {ALL_CATEGORIES.map(cat => {
            const cfg = cat === 'all' ? null : CATEGORY_CONFIG[cat]
            const active = filter === cat
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition
                  ${active
                    ? 'bg-[#1A3207] border-[#1A3207] text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-[#C8E9A8] hover:bg-[#F2F9EC]'}`}
              >
                {cfg ? <span>{cfg.icon}</span> : <span>📋</span>}
                {cat === 'all' ? 'All' : cfg!.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-white/20' : 'bg-gray-100'
                }`}>
                  {counts[cat]}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── Feed ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 rounded-full animate-spin border-2 border-[#E2F3D0] border-t-[#538A22]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 font-mono text-sm">
            No feedback yet in this category.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(row => {
              const cfg    = CATEGORY_CONFIG[row.category] ?? CATEGORY_CONFIG.other
              const isOwn  = row.doctor_id === myId
              return (
                <div
                  key={row.id}
                  className={`bg-white border rounded-xl px-5 py-4 transition
                    ${isOwn ? 'border-[#C8E9A8]' : 'border-gray-100'}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${cfg.badge}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                      {isOwn && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded border
                          bg-[#F2F9EC] border-[#C8E9A8] text-[#538A22]">
                          You
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">
                      {timeAgo(row.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed">{row.message}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Submit modal ─────────────────────────────────────────────────── */}
      {showModal && (
        <FeedbackModal
          myId={myId}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

// ─── Inline submit modal ──────────────────────────────────────────────────────

function FeedbackModal({ myId, onClose }: { myId: string | null; onClose: () => void }) {
  const [category, setCategory] = useState<Category>('suggestion')
  const [message,  setMessage]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!message.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { error: dbError } = await supabase
        .from('doctor_feedback')
        .insert({ doctor_id: myId, category, message: message.trim() })
      if (dbError) throw dbError
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E2F3D0] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-[#F2F9EC] border-b border-[#E2F3D0] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#1A3207]">Share your feedback</p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">Visible to all doctors on the team</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {done ? (
          <div className="px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-[#F2F9EC] border border-[#C8E9A8] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[#538A22]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-800 mb-1">Posted!</p>
            <p className="text-xs text-gray-400 font-mono">Your feedback is now visible to everyone.</p>
            <button
              onClick={onClose}
              className="btn-primary-mrx mt-6 px-5 py-2 bg-[#538A22] text-white text-xs font-mono rounded-lg hover:bg-[#3D6B16] transition"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {/* Category */}
            <div>
              <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-2">Category</p>
              <div className="flex flex-wrap gap-2">
                {(['suggestion', 'bug', 'feature', 'other'] as Category[]).map(cat => {
                  const cfg = CATEGORY_CONFIG[cat]
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition
                        ${category === cat
                          ? 'bg-[#538A22] border-[#538A22] text-white'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-[#C8E9A8]'}`}
                    >
                      <span>{cfg.icon}</span>{cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Message */}
            <div>
              <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-2">Message</p>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Describe what you'd like to see changed or improved…"
                rows={5}
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 outline-none
                  focus:border-[#538A22] focus:ring-2 focus:ring-green-50 bg-[#F2F9EC]
                  placeholder-gray-400 resize-none font-mono text-gray-800 transition"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-xs text-red-700 font-mono">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 border border-gray-200 text-gray-500 text-xs font-mono rounded-xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || loading}
                className="btn-primary-mrx flex-1 py-2.5 bg-[#538A22] hover:bg-[#3D6B16] disabled:bg-gray-200
                  disabled:text-gray-400 text-white text-xs font-mono rounded-xl transition font-semibold"
              >
                {loading ? 'Posting…' : 'Post feedback →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
