'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FileCheck2, ChevronRight } from 'lucide-react'
import ChecklistCreateForm from './ChecklistCreateForm'

const C = {
  green: '#538A22', greenSoft: '#F2F9EC', greenBorder: '#C8E9A8',
  ink: '#1A2417', muted: '#6b7280', faint: '#8A9284', line: '#ECEBE3', card: '#FFFFFF',
}

type ChecklistSummary = { id: string; title: string | null; condition_goal: string; status: string; created_at: string }

export default function ChecklistTab({ patientId }: { patientId: string }) {
  const router = useRouter()
  const [checklists, setChecklists] = useState<ChecklistSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    fetch(`/api/compass/checklists?patient_id=${patientId}`)
      .then((r) => r.json())
      .then((j) => setChecklists(Array.isArray(j) ? j : []))
      .finally(() => setLoading(false))
  }, [patientId])

  if (loading) return <div style={{ height: 100, background: C.card, borderRadius: 14, border: `1px solid ${C.line}`, opacity: 0.6 }} />

  return (
    <div>
      {!showCreate && (
        <button onClick={() => setShowCreate(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: 'none', background: C.green, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 16 }}>
          <Plus size={14} /> New checklist
        </button>
      )}

      {showCreate && (
        <div style={{ marginBottom: 16 }}>
          <ChecklistCreateForm patientId={patientId} onCreated={(id) => router.push(`/compass/patients/${patientId}/checklist/${id}`)} />
        </div>
      )}

      {checklists.length === 0 && !showCreate && (
        <div style={{ background: C.card, borderRadius: 14, border: `1px dashed ${C.greenBorder}`, padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: C.greenSoft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            <FileCheck2 size={20} color={C.green} />
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>No checklists yet</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>A quick, AI-designed goal checklist for the next consultation, not a multi-month plan.</div>
        </div>
      )}

      {checklists.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {checklists.map((c) => (
            <button key={c.id} onClick={() => router.push(`/compass/patients/${patientId}/checklist/${c.id}`)}
              style={{ textAlign: 'left', background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: C.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileCheck2 size={16} color={C.green} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || 'Untitled checklist'}</div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.condition_goal}</div>
              </div>
              <ChevronRight size={16} color={C.faint} style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
