'use client'

import { useState } from 'react'
import { X, Upload, FileText, CheckCircle2, Loader2, Sparkles, Plus, Calendar } from 'lucide-react'
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

export type SessionOption = {
  id: string
  session_type?: string
  session_date?: string
  created_at?: string
  pre_meeting_notes?: string
  post_meeting_notes?: string
}

export default function UploadNotesModal({
  patientId,
  patientName,
  sessions = [],
  initialSessionId,
  hasRoadmap = false,
  onClose,
  onNotesUploaded,
}: {
  patientId: string
  patientName?: string
  sessions?: SessionOption[]
  initialSessionId?: string
  hasRoadmap?: boolean
  onClose: () => void
  onNotesUploaded?: (session: any, roadmapUpdated: boolean) => void
}) {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(initialSessionId || (sessions.length > 0 ? sessions[0].id : 'new'))
  const [newSessionName, setNewSessionName] = useState(`Consultation ${sessions.length + 1}`)
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().slice(0, 10))
  const [noteType, setNoteType] = useState<'post' | 'pre' | 'transcript'>('post')

  const [notesText, setNotesText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importedDriveName, setImportedDriveName] = useState('')
  const [driveImportError, setDriveImportError] = useState('')

  const [updateDashboard, setUpdateDashboard] = useState(hasRoadmap)
  const [uploading, setUploading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setImportedDriveName('')
    setDriveImportError('')
    setError('')

    // Read plain text files directly into notesText preview if plain text
    if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const reader = new FileReader()
      reader.onload = (evt) => {
        if (typeof evt.target?.result === 'string') {
          setNotesText(evt.target.result)
        }
      }
      reader.readAsText(file)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!notesText.trim() && !selectedFile) {
      setError('Please upload a note file, import from Google Drive, or paste text notes.')
      return
    }

    setUploading(true)
    setError('')
    setStatusMsg('Processing consultation notes…')

    try {
      const formData = new FormData()
      formData.append('patient_id', patientId)
      formData.append('session_id', selectedSessionId)
      if (selectedSessionId === 'new') {
        formData.append('session_name', newSessionName || `Consultation ${sessions.length + 1}`)
        formData.append('session_date', newSessionDate ? new Date(newSessionDate).toISOString() : new Date().toISOString())
      }
      formData.append('note_type', noteType)
      formData.append('notes_text', notesText)
      formData.append('regenerate_dashboard', updateDashboard ? 'true' : 'false')

      if (selectedFile) {
        formData.append('file', selectedFile)
      }

      if (updateDashboard) {
        setStatusMsg('Saving notes & updating patient dashboard…')
      } else {
        setStatusMsg('Saving consultation notes…')
      }

      const res = await fetch('/api/compass/upload-notes', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json().catch(() => null)

      if (!res.ok) {
        setError(json?.error || 'Failed to upload notes. Please try again.')
        setUploading(false)
        return
      }

      onNotesUploaded?.(json.session, json.roadmapUpdated)
      onClose()
    } catch {
      setError('Network error uploading notes — please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(26,36,23,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 110,
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.card,
          borderRadius: 16,
          padding: '24px 26px',
          maxWidth: 620,
          width: '100%',
          maxHeight: '92vh',
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
              width: 40,
              height: 40,
              borderRadius: 12,
              background: C.greenSoft,
              border: `1px solid ${C.greenBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Upload size={20} color={C.green} />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
              Upload Consultation Notes
            </h2>
            <p style={{ fontSize: 12.5, color: C.muted, margin: 0 }}>
              {patientName ? `Add or upload notes for ${patientName}` : 'Add or upload notes across consultations'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Target Consultation Session */}
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.greenDeep, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
              Select Consultation Session
            </label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 11px',
                borderRadius: 9,
                border: `1px solid ${C.line}`,
                fontSize: 13,
                fontWeight: 600,
                color: C.ink,
                background: '#fff',
              }}
            >
              {sessions.map((s, idx) => (
                <option key={s.id} value={s.id}>
                  {s.session_type || `Consultation ${sessions.length - idx}`} ({new Date(s.session_date || s.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})
                </option>
              ))}
              <option value="new">+ Add as New Consultation Session</option>
            </select>
          </div>

          {/* New Session Options if selected */}
          {selectedSessionId === 'new' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 12, borderRadius: 10, background: C.greenSoft, border: `1px solid ${C.greenBorder}` }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.greenDeep, marginBottom: 4 }}>
                  Consultation Title
                </label>
                <input
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="e.g. Consultation 2"
                  style={{ width: '100%', padding: '7px 9px', borderRadius: 7, border: `1px solid ${C.line}`, fontSize: 12.5, color: C.ink }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.greenDeep, marginBottom: 4 }}>
                  Consultation Date
                </label>
                <input
                  type="date"
                  value={newSessionDate}
                  onChange={(e) => setNewSessionDate(e.target.value)}
                  style={{ width: '100%', padding: '7px 9px', borderRadius: 7, border: `1px solid ${C.line}`, fontSize: 12.5, color: C.ink }}
                />
              </div>
            </div>
          )}

          {/* Note Type Selector */}
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.greenDeep, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
              Note Category
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <button
                type="button"
                onClick={() => setNoteType('post')}
                style={{
                  padding: '9px 8px',
                  borderRadius: 9,
                  border: `1.5px solid ${noteType === 'post' ? C.green : C.line}`,
                  background: noteType === 'post' ? C.greenSoft : '#fff',
                  color: noteType === 'post' ? C.greenDeep : C.ink,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Post-session Notes
              </button>
              <button
                type="button"
                onClick={() => setNoteType('pre')}
                style={{
                  padding: '9px 8px',
                  borderRadius: 9,
                  border: `1.5px solid ${noteType === 'pre' ? C.green : C.line}`,
                  background: noteType === 'pre' ? C.greenSoft : '#fff',
                  color: noteType === 'pre' ? C.greenDeep : C.ink,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Pre-session Notes
              </button>
              <button
                type="button"
                onClick={() => setNoteType('transcript')}
                style={{
                  padding: '9px 8px',
                  borderRadius: 9,
                  border: `1.5px solid ${noteType === 'transcript' ? C.green : C.line}`,
                  background: noteType === 'transcript' ? C.greenSoft : '#fff',
                  color: noteType === 'transcript' ? C.greenDeep : C.ink,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Full Transcript / Doc
              </button>
            </div>
          </div>

          {/* Import / Upload Options */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: C.greenDeep, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Upload Note File or Import
              </label>
              <ImportFromDrive
                onImport={(text, fileName) => {
                  setNotesText(text)
                  setImportedDriveName(fileName)
                  setSelectedFile(null)
                  setDriveImportError('')
                }}
                onError={(msg) => setDriveImportError(msg)}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 14px',
                  borderRadius: 9,
                  border: `1px solid ${C.greenBorder}`,
                  background: C.greenSoft,
                  color: C.greenDeep,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Upload size={14} /> Choose File (.pdf, .docx, .txt)
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.csv"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>

              {selectedFile && (
                <div style={{ fontSize: 12, color: C.greenDeep, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={13} color={C.green} /> {selectedFile.name}
                </div>
              )}

              {importedDriveName && (
                <div style={{ fontSize: 12, color: C.greenDeep, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={13} color={C.green} /> Drive doc: “{importedDriveName}”
                </div>
              )}
            </div>

            {driveImportError && (
              <div style={{ color: '#B3261E', fontSize: 11.5, marginTop: 4 }}>{driveImportError}</div>
            )}
          </div>

          {/* Notes Content Textarea */}
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.greenDeep, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
              Notes Text / Content
            </label>
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              rows={5}
              placeholder="Type or paste consultation notes, symptoms, diet updates, clinical observations..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${C.line}`,
                fontSize: 13,
                color: C.ink,
                fontFamily: 'inherit',
                lineHeight: 1.5,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Dashboard integration checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: C.greenSoft, padding: '10px 12px', borderRadius: 9, border: `1px solid ${C.greenBorder}` }}>
            <input
              type="checkbox"
              checked={updateDashboard}
              onChange={(e) => setUpdateDashboard(e.target.checked)}
              style={{ accentColor: C.green, width: 16, height: 16 }}
            />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: C.greenDeep }}>
              Take all consultation notes into account &amp; update patient dashboard
            </span>
          </label>

          {error && <p style={{ fontSize: 12.5, color: '#B3261E', margin: 0 }}>{error}</p>}
          {uploading && statusMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.greenDeep, fontWeight: 600 }}>
              <Loader2 size={14} style={{ animation: 'clpSpin 1s linear infinite' }} /> {statusMsg}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              style={{
                padding: '9px 16px',
                borderRadius: 9,
                border: `1px solid ${C.line}`,
                background: C.card,
                color: C.muted,
                fontSize: 13,
                fontWeight: 600,
                cursor: uploading ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              style={{
                padding: '9px 18px',
                borderRadius: 9,
                border: 'none',
                background: C.green,
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {uploading ? (
                <>
                  <Loader2 size={14} style={{ animation: 'clpSpin 1s linear infinite' }} /> Saving…
                </>
              ) : (
                <>
                  <Upload size={14} /> Save &amp; Upload Notes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
