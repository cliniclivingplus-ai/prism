'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, FileText, CheckCircle2, Loader2, Sparkles, Pencil } from 'lucide-react'
import ImportFromDrive from '@/components/ImportFromDrive'

const C = {
  green: '#538A22',
  greenDeep: '#2F5214',
  greenSoft: '#F2F9EC',
  greenBorder: '#C8E9A8',
  amber: '#D98A2B',
  amberSoft: '#FBF1E3',
  ink: '#1A2417',
  muted: '#6b7280',
  faint: '#8A9284',
  line: '#ECEBE3',
  card: '#FFFFFF',
}

export type SessionInputs = {
  id: string
  patient_id?: string
  gemini_doc_raw?: string | null
  gemini_summary_raw?: string | null
  pre_meeting_notes?: string | null
  post_meeting_notes?: string | null
}

export default function EditSessionModal({
  session,
  patientId,
  onClose,
  onSaved,
}: {
  session: SessionInputs
  patientId?: string
  onClose: () => void
  onSaved?: (updatedSession: any) => void
}) {
  const router = useRouter()
  const pid = patientId || session.patient_id || ''

  const [geminiDoc, setGeminiDoc] = useState(session.gemini_doc_raw || '')
  const [geminiSummary, setGeminiSummary] = useState(session.gemini_summary_raw || '')
  const [preNotes, setPreNotes] = useState(session.pre_meeting_notes || '')
  const [postNotes, setPostNotes] = useState(session.post_meeting_notes || '')

  const [importedTranscriptName, setImportedTranscriptName] = useState('')
  const [transcriptImportError, setTranscriptImportError] = useState('')

  const [importedSummaryName, setImportedSummaryName] = useState('')
  const [summaryImportError, setSummaryImportError] = useState('')

  const [reparse, setReparse] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState('')

  const transcriptChanged = (session.gemini_doc_raw || '') !== geminiDoc

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setStatusMsg('Saving updated inputs…')

    try {
      // 1. Update session in Supabase
      const res = await fetch(`/api/compass/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gemini_doc_raw: geminiDoc || null,
          gemini_summary_raw: geminiSummary || null,
          pre_meeting_notes: preNotes || null,
          post_meeting_notes: postNotes || null,
          // If transcript changed, clear existing case_summary so workspace regenerates cleanly
          ...(transcriptChanged && reparse ? { case_summary: null } : {}),
        }),
      })

      if (!res.ok) {
        const j = await res.json().catch(() => null)
        setError(j?.error || 'Failed to update session inputs.')
        setSaving(false)
        return
      }

      const updatedSession = await res.json()

      // 2. Optional: Re-extract clinical data from new transcript if selected & transcript is non-empty
      if (transcriptChanged && reparse && geminiDoc.trim().length > 50 && pid) {
        setStatusMsg('Re-extracting clinical profile and Q&A from new transcript…')
        await fetch('/api/compass/parse-gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gemini_doc: geminiDoc,
            patient_id: pid,
            session_id: session.id,
          }),
        }).catch(() => {})
      }

      onSaved?.(updatedSession)
      router.refresh()
      onClose()
    } catch {
      setError('Network error — check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(26,36,23,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 100,
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.card,
          borderRadius: 16,
          padding: '24px 26px',
          maxWidth: 640,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: C.muted,
          }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: C.greenSoft,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Pencil size={18} color={C.green} />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
              Edit Session Inputs
            </h2>
            <p style={{ fontSize: 12.5, color: C.muted, margin: 0 }}>
              Change the transcript, Gemini summary, or pre/post meeting notes for this session.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Meeting Transcript */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.greenDeep,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                Meeting Transcript
              </label>
              {geminiDoc.trim().length > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.green,
                    background: C.greenSoft,
                    borderRadius: 20,
                    padding: '2px 8px',
                  }}
                >
                  {geminiDoc.trim().split(/\s+/).length} words
                </span>
              )}
            </div>

            {/* Drive Import Card */}
            <div
              style={{
                background: C.greenSoft,
                border: `1px solid ${C.greenBorder}`,
                borderRadius: 12,
                padding: '12px 14px',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>
                  Replace from Google Drive
                </div>
                <div style={{ fontSize: 11.5, color: C.greenDeep }}>
                  Pick a new Google Doc transcript to replace current transcript
                </div>
                {importedTranscriptName && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 12,
                      color: C.greenDeep,
                      fontWeight: 600,
                      marginTop: 4,
                    }}
                  >
                    <CheckCircle2 size={13} /> Imported “{importedTranscriptName}”
                  </div>
                )}
                {transcriptImportError && (
                  <div style={{ color: '#B3261E', fontSize: 11.5, marginTop: 4 }}>
                    {transcriptImportError}
                  </div>
                )}
              </div>
              <ImportFromDrive
                onImport={(text, fileName) => {
                  setGeminiDoc(text)
                  setImportedTranscriptName(fileName)
                  setTranscriptImportError('')
                }}
                onError={(msg) => setTranscriptImportError(msg)}
              />
            </div>

            <textarea
              value={geminiDoc}
              onChange={(e) => setGeminiDoc(e.target.value)}
              rows={6}
              placeholder="Paste or edit the full meeting transcript here…"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${C.line}`,
                fontSize: 13,
                resize: 'vertical',
                color: C.ink,
                fontFamily: 'inherit',
                lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Gemini Meeting Summary */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                color: C.greenDeep,
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              Gemini Meeting Summary{' '}
              <span style={{ fontWeight: 500, color: C.faint, textTransform: 'none' }}>
                · optional
              </span>
            </label>

            <div
              style={{
                background: C.greenSoft,
                border: `1px solid ${C.greenBorder}`,
                borderRadius: 12,
                padding: '12px 14px',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>
                  Replace summary from Google Drive
                </div>
                {importedSummaryName && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 12,
                      color: C.greenDeep,
                      fontWeight: 600,
                      marginTop: 4,
                    }}
                  >
                    <CheckCircle2 size={13} /> Imported “{importedSummaryName}”
                  </div>
                )}
                {summaryImportError && (
                  <div style={{ color: '#B3261E', fontSize: 11.5, marginTop: 4 }}>
                    {summaryImportError}
                  </div>
                )}
              </div>
              <ImportFromDrive
                onImport={(text, fileName) => {
                  setGeminiSummary(text)
                  setImportedSummaryName(fileName)
                  setSummaryImportError('')
                }}
                onError={(msg) => setSummaryImportError(msg)}
              />
            </div>

            <textarea
              value={geminiSummary}
              onChange={(e) => setGeminiSummary(e.target.value)}
              rows={4}
              placeholder="Paste or edit Gemini auto-generated meeting summary here…"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${C.line}`,
                fontSize: 13,
                resize: 'vertical',
                color: C.ink,
                fontFamily: 'inherit',
                lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Pre & Post Notes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: C.faint,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  marginBottom: 6,
                }}
              >
                Pre-Meeting Notes
              </label>
              <textarea
                value={preNotes}
                onChange={(e) => setPreNotes(e.target.value)}
                rows={3}
                placeholder="Notes before session…"
                style={{
                  width: '100%',
                  padding: '9px 11px',
                  borderRadius: 9,
                  border: `1px solid ${C.line}`,
                  fontSize: 12.5,
                  color: C.ink,
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: C.faint,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  marginBottom: 6,
                }}
              >
                Post-Meeting Notes
              </label>
              <textarea
                value={postNotes}
                onChange={(e) => setPostNotes(e.target.value)}
                rows={3}
                placeholder="Notes after session…"
                style={{
                  width: '100%',
                  padding: '9px 11px',
                  borderRadius: 9,
                  border: `1px solid ${C.line}`,
                  fontSize: 12.5,
                  color: C.ink,
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          {/* Re-parse checkbox option if transcript changed */}
          {transcriptChanged && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                fontSize: 12.5,
                color: C.ink,
                background: C.greenSoft,
                border: `1px solid ${C.greenBorder}`,
                borderRadius: 10,
                padding: '10px 12px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={reparse}
                onChange={(e) => setReparse(e.target.checked)}
                style={{ accentColor: C.green }}
              />
              <span>
                <strong>Re-extract patient clinical data &amp; reset AI case workspace</strong> using new transcript
              </span>
            </label>
          )}

          {saving && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12.5,
                color: C.greenDeep,
                fontWeight: 600,
              }}
            >
              <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> {statusMsg}
            </div>
          )}

          {error && (
            <div style={{ color: '#B3261E', fontSize: 12.5, fontWeight: 600 }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '9px 16px',
                borderRadius: 9,
                border: `1px solid ${C.line}`,
                background: C.card,
                color: C.muted,
                fontSize: 13,
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '9px 18px',
                borderRadius: 9,
                border: 'none',
                background: C.green,
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(83,138,34,0.25)',
              }}
            >
              {saving ? 'Saving changes…' : 'Save session inputs'}
            </button>
          </div>
        </form>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
