'use client'
import { useEffect, useState } from 'react'
import { Loader2, Save, RotateCcw, Check } from 'lucide-react'
import { FOUNDER_PHOTO_URL, FOUNDER_INTRO } from '@/lib/founderInfo'

const C = {
  ink: '#111827', muted: '#6b7280', faint: '#9ca3af', line: '#e5e7eb',
  card: '#ffffff', green: '#2e7d32', greenDeep: '#1b5e20', danger: '#b4462f', paper: '#faf7f2',
}

// The founder's note every new plan starts with. It lives here, editable by
// any coach, instead of in the code — the clinic writes its own welcome and
// changes it whenever they like, without a developer.
export default function FounderNotePage() {
  const [text, setText] = useState('')
  const [savedText, setSavedText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    fetch('/api/compass/settings/founder-note')
      .then((r) => r.json())
      .then((j) => {
        setText(j.text || '')
        setSavedText(j.text || '')
      })
      .catch(() => setError('Could not load the note.'))
      .finally(() => setLoading(false))
  }, [])

  async function save(next?: string) {
    const body = next ?? text
    setSaving(true)
    setError('')
    try {
      const r = await fetch('/api/compass/settings/founder-note', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) {
        setError(j?.error || `Could not save (${r.status}).`)
        return
      }
      setText(j.text)
      setSavedText(j.text)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2500)
    } catch {
      setError('Network error — try again.')
    } finally {
      setSaving(false)
    }
  }

  const dirty = text !== savedText
  // What a patient called Kavya, working towards a steadier gut, would read.
  const preview = text
    .replace(/\{first_name\}/g, 'Kavya')
    .replace(/\{goal\}/g, 'feeling steady and symptom-free after meals')
    .replace(/^\s*,\s*/, '')
    .trim()

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 4px 48px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Founder&apos;s note</h1>
      <p style={{ fontSize: 13.5, color: C.muted, marginTop: 0, marginBottom: 20, maxWidth: 680 }}>
        The welcome note every new plan opens with. Edit it here and every plan generated from now on uses it.
        Plans where a coach has already rewritten the note for their own patient keep that version.
      </p>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted, fontSize: 13 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
              The note
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={18}
              spellCheck
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.line}`,
                fontSize: 13.5, lineHeight: 1.65, color: C.ink, boxSizing: 'border-box',
                fontFamily: 'inherit', resize: 'vertical',
              }}
            />
            <div style={{ fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>
              Leave a blank line between paragraphs. Two placeholders fill themselves in for each patient:
              <br />
              <code style={{ background: C.paper, padding: '1px 5px', borderRadius: 4 }}>{'{first_name}'}</code> their first name
              {'  ·  '}
              <code style={{ background: C.paper, padding: '1px 5px', borderRadius: 4 }}>{'{goal}'}</code> what this plan is working towards.
              <br />
              Remove either one and the note simply reads the same for everyone.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <button
                onClick={() => save()}
                disabled={saving || !dirty}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8,
                  border: 'none', background: C.green, color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: saving || !dirty ? 'default' : 'pointer', opacity: saving || !dirty ? 0.55 : 1,
                }}
              >
                {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                {saving ? 'Saving…' : 'Save note'}
              </button>
              <button
                onClick={() => setText(savedText)}
                disabled={!dirty || saving}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8,
                  border: `1px solid ${C.line}`, background: '#fff', color: C.ink, fontSize: 12.5, fontWeight: 600,
                  cursor: !dirty || saving ? 'default' : 'pointer', opacity: !dirty || saving ? 0.5 : 1,
                }}
              >
                <RotateCcw size={13} /> Undo changes
              </button>
              {justSaved && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: C.greenDeep, fontWeight: 600 }}>
                  <Check size={14} /> Saved — new plans will use this
                </span>
              )}
              {error && <span style={{ fontSize: 12.5, color: C.danger }}>{error}</span>}
            </div>
          </div>

          <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
              How a patient sees it
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- founder photo from our own storage bucket */}
              <img
                src={FOUNDER_PHOTO_URL}
                alt="Roshni Sanghvi"
                style={{ width: 56, height: 56, borderRadius: 28, objectFit: 'cover', border: `1px solid ${C.line}` }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Roshni Sanghvi</div>
                <div style={{ fontSize: 12, color: C.muted }}>Founder, Living Plus</div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>{FOUNDER_INTRO}</div>
              </div>
            </div>
            {preview.split('\n\n').filter(Boolean).map((para, i) => (
              <p key={i} style={{ fontSize: 13.5, lineHeight: 1.7, color: C.ink, margin: '0 0 10px' }}>{para}</p>
            ))}
            <div style={{ fontSize: 11.5, color: C.faint, marginTop: 12 }}>
              Shown for a patient named Kavya. Each plan uses that patient&apos;s own name and goal.
            </div>
          </div>
        </div>
      )}
      <style>{'@keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }'}</style>
    </div>
  )
}
