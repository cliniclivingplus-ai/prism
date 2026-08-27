'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, History, ChevronRight } from 'lucide-react'

const C = {
  green: '#538A22', greenDeep: '#2F5214', greenSoft: '#F2F9EC', greenBorder: '#C8E9A8',
  ink: '#1A2417', muted: '#6b7280', faint: '#8A9284', line: '#ECEBE3', card: '#FFFFFF',
}

type VersionRow = { id: string; session_id: string | null; overview: string | null; duration_months: number | null; archived_at: string }

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// Every past version of a roadmap's content, archived automatically the
// moment a coach refreshes it against a later session (see
// interpret/route.ts) — the live shareable link never changes, this is
// just a way to look back at what it used to say. Coach-side only.
export default function RoadmapHistoryPage() {
  const params = useParams()
  const patientId = params.id as string
  const roadmapId = params.roadmapId as string

  const [loading, setLoading] = useState(true)
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/compass/roadmaps/${roadmapId}/versions`)
      .then((r) => r.json())
      .then((j) => { if (Array.isArray(j)) setVersions(j); else setError('Could not load version history.') })
      .catch(() => setError('Network error — try again.'))
      .finally(() => setLoading(false))
  }, [roadmapId])

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <Link href={`/compass/patients/${patientId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.faint, textDecoration: 'none', marginBottom: 18, fontWeight: 500 }}>
        <ArrowLeft size={14} /> Back to patient
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <History size={20} color={C.green} />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: 0 }}>Roadmap history</h1>
      </div>
      <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 22px' }}>
        The shareable dashboard link always shows the current content — this is just a coach-side record of what it used to say before each refresh.
      </p>

      {loading ? (
        <div style={{ height: 100, background: C.card, borderRadius: 14, border: `1px solid ${C.line}`, opacity: 0.6 }} />
      ) : error ? (
        <p style={{ fontSize: 13, color: '#B3261E' }}>{error}</p>
      ) : versions.length === 0 ? (
        <div style={{ background: C.card, borderRadius: 14, border: `1px dashed ${C.greenBorder}`, padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: C.ink, fontWeight: 600, margin: 0 }}>No archived versions yet</p>
          <p style={{ fontSize: 13, color: C.muted, margin: '6px 0 0' }}>
            A version is saved automatically each time this roadmap gets refreshed from a later session.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {versions.map((v, i) => (
            <Link key={v.id} href={`/compass/patients/${patientId}/roadmap-history/${roadmapId}/${v.id}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 18px', textDecoration: 'none', boxShadow: '0 1px 2px rgba(26,36,23,0.03)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Archived {fmtDate(v.archived_at)}</span>
                  {i === 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: C.greenDeep, background: C.greenSoft, borderRadius: 20, padding: '2px 8px' }}>MOST RECENT</span>}
                </div>
                {v.overview && (
                  <p style={{ fontSize: 12.5, color: C.muted, margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.overview}</p>
                )}
              </div>
              <ChevronRight size={16} color={C.faint} style={{ flexShrink: 0 }} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
