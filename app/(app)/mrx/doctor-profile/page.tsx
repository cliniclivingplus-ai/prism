'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { CheckCircle2, PenLine, Lightbulb } from 'lucide-react'

interface DoctorProfile {
  name: string
  degree: string
  reg_no: string
  email: string
  signature_data_url: string | null
}

export default function DoctorProfilePage() {
  const router   = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'mrx' } }
  )

  const [profile,   setProfile]   = useState<DoctorProfile>({ name: '', degree: 'MBBS', reg_no: '', email: '', signature_data_url: null })
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [status,    setStatus]    = useState<'idle' | 'saved' | 'error'>('idle')
  const [sigPreview, setSigPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const email = session.user.email || ''
      const meta  = session.user.user_metadata

      const { data: doc } = await supabase.from('doctors')
  .select('name, degree, reg_no, signature_data_url')
  .eq('user_id', session.user.id).maybeSingle()

      setProfile({
        name:               doc?.name               || meta?.full_name || meta?.name || '',
        degree:             doc?.degree             || 'MBBS',
        reg_no:             doc?.reg_no             || '',
        email,
        signature_data_url: doc?.signature_data_url || null,
      })
      setLoading(false)
    }
    load()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Validate size (max 500KB)
    if (file.size > 500 * 1024) {
      alert('Signature image must be under 500KB. Please crop or compress it first.')
      return
    }
    const reader = new FileReader()
    reader.onload = ev => setSigPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const save = async () => {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
  
    const userId    = session.user.id
    const userEmail = session.user.email || ''
    const sigToSave = sigPreview ?? profile.signature_data_url
  
    const { data: existing } = await supabase
      .from('doctors').select('id').eq('id', userId).maybeSingle()
  
    let error: any = null
  
    if (existing?.id) {
      // Row exists — update only the editable fields
      const res = await supabase.from('doctors').update({
        name:               profile.name,
        degree:             profile.degree,
        reg_no:             profile.reg_no,
        signature_data_url: sigToSave,
      }).eq('id', userId)
      error = res.error
    } else {
      // New row — id = auth user id
      const res = await supabase.from('doctors').insert({
        id:                 userId,
        email:              userEmail,
        name:               profile.name,
        degree:             profile.degree,
        reg_no:             profile.reg_no,
        signature_data_url: sigToSave,
      })
      error = res.error
    }
  
    if (error) {
      console.error('Save failed:', error.message)
      setStatus('error')
    } else {
      if (sigPreview) {
        setProfile(prev => ({ ...prev, signature_data_url: sigPreview }))
        setSigPreview(null)
      }
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2500)
    }
    setSaving(false)
  }

  const removeSig = async () => {
    setSigPreview(null)
    setProfile(prev => ({ ...prev, signature_data_url: null }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#F8FAFC' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:32, height:32, border:'3px solid #538A22', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
        <p style={{ color:'#538A22', fontSize:14 }}>Loading profile…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  const activeSig = sigPreview ?? profile.signature_data_url

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', fontFamily:'Arial, sans-serif' }}>

      {/* Top bar */}
      <div style={{ background:'#1A3207', padding:'12px 32px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <button
            onClick={() => router.back()}
            style={{ background:'none', border:'none', color:'#A8D878', cursor:'pointer', fontSize:20, lineHeight:1 }}
          >←</button>
          <div>
            <p style={{ color:'white', fontWeight:'bold', fontSize:15, margin:0 }}>Doctor Profile</p>
            <p style={{ color:'#A8D878', fontSize:11, margin:0 }}>Living Plus · MicrobiomeRx</p>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {status === 'saved' && <span style={{ color:'#A8D878', fontSize:12, display:'inline-flex', alignItems:'center', gap:4 }}><CheckCircle2 size={12} /> Profile saved</span>}
          {status === 'error' && <span style={{ color:'#FCA5A5', fontSize:12 }}>Save failed — try again</span>}
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary-mrx"
            style={{
              background:'#538A22', color:'white', border:'none',
              padding:'8px 20px', borderRadius:8, fontSize:13,
              fontWeight:'bold', cursor:saving ? 'not-allowed' : 'pointer',
              opacity:saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:680, margin:'40px auto', padding:'0 24px' }}>

        {/* Info card */}
        <div style={{ background:'white', borderRadius:16, border:'1px solid #E2E8F0', overflow:'hidden', marginBottom:20 }}>
          <div style={{ background:'#F2F9EC', padding:'14px 24px', borderBottom:'1px solid #C8E9A8' }}>
            <p style={{ fontWeight:'bold', color:'#2A4D0D', fontSize:13, margin:0 }}>Doctor Information</p>
            <p style={{ color:'#538A22', fontSize:11, margin:'2px 0 0' }}>
              This appears on every prescription generated from your account
            </p>
          </div>
          <div style={{ padding:'24px', display:'flex', flexDirection:'column', gap:18 }}>

            {/* Email — read only */}
            <div>
              <label style={{ fontSize:11, fontWeight:'bold', color:'#94A3B8', textTransform:'uppercase', letterSpacing:1, display:'block', marginBottom:6 }}>
                Email (login)
              </label>
              <div style={{ fontSize:13, color:'#64748B', padding:'10px 14px', background:'#F8FAFC', borderRadius:8, border:'1px solid #E2E8F0' }}>
                {profile.email}
              </div>
            </div>

            {/* Name */}
            <div>
              <label style={{ fontSize:11, fontWeight:'bold', color:'#94A3B8', textTransform:'uppercase', letterSpacing:1, display:'block', marginBottom:6 }}>
                Full Name *
              </label>
              <input
                value={profile.name}
                onChange={e => setProfile(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Dr. Tejas Udayanand"
                style={{ width:'100%', fontSize:14, fontWeight:600, color:'#1E293B', padding:'10px 14px', borderRadius:8, border:'1px solid #E2E8F0', outline:'none', boxSizing:'border-box' }}
                onFocus={e => e.target.style.borderColor = '#538A22'}
                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              />
            </div>

            {/* Degree + Reg No row */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:'bold', color:'#94A3B8', textTransform:'uppercase', letterSpacing:1, display:'block', marginBottom:6 }}>
                  Degree *
                </label>
                <input
                  value={profile.degree}
                  onChange={e => setProfile(prev => ({ ...prev, degree: e.target.value }))}
                  placeholder="MBBS, MD, etc."
                  style={{ width:'100%', fontSize:13, color:'#1E293B', padding:'10px 14px', borderRadius:8, border:'1px solid #E2E8F0', outline:'none', boxSizing:'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#538A22'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:'bold', color:'#94A3B8', textTransform:'uppercase', letterSpacing:1, display:'block', marginBottom:6 }}>
                  Registration No. *
                </label>
                <input
                  value={profile.reg_no}
                  onChange={e => setProfile(prev => ({ ...prev, reg_no: e.target.value }))}
                  placeholder="e.g. 151589"
                  style={{ width:'100%', fontSize:13, color:'#1E293B', padding:'10px 14px', borderRadius:8, border:'1px solid #E2E8F0', outline:'none', boxSizing:'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#538A22'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Signature card */}
        <div style={{ background:'white', borderRadius:16, border:'1px solid #E2E8F0', overflow:'hidden', marginBottom:20 }}>
          <div style={{ background:'#F2F9EC', padding:'14px 24px', borderBottom:'1px solid #C8E9A8' }}>
            <p style={{ fontWeight:'bold', color:'#2A4D0D', fontSize:13, margin:0 }}>Signature</p>
            <p style={{ color:'#538A22', fontSize:11, margin:'2px 0 0' }}>
              Upload once — auto-appears on all prescriptions. PNG with transparent background preferred.
            </p>
          </div>
          <div style={{ padding:24 }}>
            {activeSig ? (
              /* Signature preview */
              <div>
                <div style={{
                  background:'#FAFFF7', border:'1px solid #C8E9A8', borderRadius:12,
                  padding:'24px', textAlign:'center', marginBottom:16,
                }}>
                  <img src={activeSig} alt="Signature" style={{ maxHeight:80, maxWidth:'100%' }} />
                  {sigPreview && (
                    <p style={{ fontSize:11, color:'#538A22', marginTop:8, fontStyle:'italic' }}>
                      ↑ New signature (not saved yet — click Save Profile)
                    </p>
                  )}
                </div>

                {/* Preview of how it looks on prescription */}
                <div style={{
                  background:'#F8FAFC', border:'1px dashed #CBD5E1', borderRadius:10,
                  padding:20, marginBottom:16,
                }}>
                  <p style={{ fontSize:10, color:'#94A3B8', marginBottom:12, textTransform:'uppercase', letterSpacing:1 }}>
                    Preview on prescription →
                  </p>
                  <div style={{ textAlign:'right' }}>
                    <img src={activeSig} alt="sig" style={{ height:48, marginLeft:'auto', display:'block', marginBottom:4 }} />
                    <div style={{ borderTop:'1.5px solid #1A3207', marginBottom:6 }} />
                    <p style={{ fontSize:13, fontWeight:'bold', color:'#1A3207' }}>{profile.name || 'Dr. Name'}</p>
                    <p style={{ fontSize:12, fontWeight:'bold', color:'#1A3207' }}>{profile.degree || 'MBBS'}</p>
                    {profile.reg_no && <p style={{ fontSize:11, color:'#555' }}>Reg. No.: {profile.reg_no}</p>}
                  </div>
                </div>

                <div style={{ display:'flex', gap:10 }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ flex:1, padding:'10px', borderRadius:8, border:'1px solid #E2E8F0', background:'white', color:'#64748B', fontSize:12, cursor:'pointer' }}
                  >
                    Replace signature
                  </button>
                  <button
                    onClick={removeSig}
                    style={{ padding:'10px 16px', borderRadius:8, border:'1px solid #FECACA', background:'white', color:'#EF4444', fontSize:12, cursor:'pointer' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              /* Upload zone */
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border:'2px dashed #C8E9A8', borderRadius:12, padding:'48px 24px',
                  textAlign:'center', cursor:'pointer', background:'#FAFFF7',
                  transition:'background 0.2s',
                }}
                onMouseOver={e => (e.currentTarget.style.background = '#F2F9EC')}
                onMouseOut={e => (e.currentTarget.style.background = '#FAFFF7')}
              >
                <div style={{ marginBottom:12, display:'flex', justifyContent:'center' }}><PenLine size={40} color="#538A22" /></div>
                <p style={{ fontWeight:'bold', color:'#538A22', fontSize:14, margin:'0 0 4px' }}>
                  Click to upload signature image
                </p>
                <p style={{ color:'#94A3B8', fontSize:12, margin:0 }}>
                  PNG preferred · transparent background · max 500KB
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display:'none' }}
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Tips */}
        <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:12, padding:'14px 20px' }}>
          <p style={{ fontWeight:'bold', color:'#92400E', fontSize:12, margin:'0 0 6px', display:'flex', alignItems:'center', gap:6 }}><Lightbulb size={13} /> Tips for a good signature image</p>
          <ul style={{ color:'#92400E', fontSize:11, margin:0, paddingLeft:16, lineHeight:1.8 }}>
            <li>Sign on white paper, photograph or scan it</li>
            <li>Use an app like Adobe Scan or CamScanner to remove the background</li>
            <li>PNG with transparent background looks most professional on prescriptions</li>
            <li>Crop tightly — only the signature, no extra white space</li>
          </ul>
        </div>

      </div>
    </div>
  )
}
