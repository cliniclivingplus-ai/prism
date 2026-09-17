'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Wand2, Pencil } from 'lucide-react'
import CaseWorkspace from '@/components/CaseWorkspace'
import EditSessionModal from '@/components/EditSessionModal'

export default function SessionDetailClient({
  session,
  patient,
}: {
  session: any
  patient: any
}) {
  const [showEditModal, setShowEditModal] = useState(false)

  const hasContent =
    session.pre_meeting_notes ||
    session.gemini_doc_raw ||
    session.post_meeting_notes ||
    (Array.isArray(session.qa_pairs) && session.qa_pairs.length > 0)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Link
        href={`/compass/patients/${patient.id}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: '#6b7280',
          textDecoration: 'none',
          marginBottom: 20,
        }}
      >
        <ArrowLeft size={14} /> {patient.full_name}
      </Link>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
            Session
          </h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 3 }}>
            {new Date(session.session_date || session.created_at).toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowEditModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 15px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#fff',
              color: '#374151',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Pencil size={14} /> Edit session inputs
          </button>

          {hasContent && (
            <Link
              href={`/compass/patients/${patient.id}/sessions/${session.id}/interpret`}
              className="btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#538A22',
                color: '#fff',
                padding: '9px 16px',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              <Wand2 size={15} /> Generate Dashboard
            </Link>
          )}
        </div>
      </div>

      {/* Pre & Post notes summary card */}
      {(session.pre_meeting_notes || session.post_meeting_notes) && (
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: '16px 20px',
            border: '1px solid #e5e7eb',
            marginBottom: 16,
          }}
        >
          {session.pre_meeting_notes && (
            <div style={{ marginBottom: session.post_meeting_notes ? 14 : 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 6,
                }}
              >
                Pre-Meeting Notes
              </div>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                {session.pre_meeting_notes}
              </p>
            </div>
          )}
          {session.post_meeting_notes && (
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 6,
                }}
              >
                Post-Meeting Notes
              </div>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                {session.post_meeting_notes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Case workspace */}
      <CaseWorkspace
        sessionId={session.id}
        patientId={patient.id}
        patientName={patient.full_name}
        transcript={session.gemini_doc_raw ?? ''}
        geminiSummary={session.gemini_summary_raw ?? ''}
      />

      {showEditModal && (
        <EditSessionModal
          session={session}
          patientId={patient.id}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  )
}
