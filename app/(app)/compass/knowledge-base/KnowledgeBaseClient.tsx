'use client'
import { useState, useRef } from 'react'
import { BookOpen, Podcast, FileText, Sparkles, Upload, Search, X, CheckCircle, Loader2, ChevronDown, Globe, Video } from 'lucide-react'

type KbDoc = {
  id: string
  title: string
  source_type: string
  tags: string[]
  created_at: string
}

type SearchResult = {
  id: string
  document_id: string
  content: string
  similarity: number
  document_title: string
  source_type: string
}

// Was missing 'website' and 'youtube' entirely, even though those are two
// of the library's real, populous categories (867 and 911 documents in
// the data that surfaced this) — every one of them fell back to the
// "Article" badge in the list, but wasn't counted as an Article in the
// stat tile either (that tile does an exact source_type match with no
// fallback), so the count silently read 0 for real, existing documents.
const sourceTypeConfig: Record<string, { icon: typeof BookOpen; color: string; label: string }> = {
  book:          { icon: BookOpen,  color: '#3b82f6', label: 'Book' },
  podcast:       { icon: Podcast,   color: '#8b5cf6', label: 'Podcast' },
  guideline:     { icon: FileText,  color: '#538A22', label: 'Guideline' },
  article:       { icon: FileText,  color: '#f59e0b', label: 'Article' },
  website:       { icon: Globe,     color: '#0891b2', label: 'Website' },
  youtube:       { icon: Video,     color: '#dc2626', label: 'YouTube' },
  'gemini-note': { icon: Sparkles,  color: '#ec4899', label: 'Gemini Note' },
}
const FALLBACK_CFG = { icon: FileText, color: '#6b7280', label: 'Other' }

export default function KnowledgeBaseClient({ initialDocuments, initialTotal, initialTypeCounts, pageSize }: {
  initialDocuments: KbDoc[]
  // True counts across the WHOLE library, computed server-side — not
  // derived from `documents`, which only ever holds the pages loaded so
  // far. The old version computed these by filtering the (accidentally
  // 1000-row-capped) `documents` array itself, so a category that wasn't
  // among the most recent 1000 inserts read as 0 even with thousands of
  // real documents in the database.
  initialTotal: number
  initialTypeCounts: Record<string, number>
  pageSize: number
}) {
  const [documents, setDocuments] = useState<KbDoc[]>(initialDocuments)
  const [total] = useState(initialTotal)
  const [typeCounts] = useState(initialTypeCounts)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState('')
  const hasMore = documents.length < total
  const [activeTab, setActiveTab] = useState<'library' | 'upload' | 'search'>('library')

  // Upload state
  const [uploadMode, setUploadMode] = useState<'txt' | 'text'>('txt')
  const [title, setTitle] = useState('')
  const [sourceType, setSourceType] = useState('book')
  const [tags, setTags] = useState('')
  const [manualText, setManualText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ chunks_created: number; characters: number } | null>(null)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchError, setSearchError] = useState('')
  const [expandedResult, setExpandedResult] = useState<string | null>(null)

  async function loadMore() {
    setLoadingMore(true)
    setLoadMoreError('')
    try {
      const res = await fetch(`/api/compass/kb?offset=${documents.length}`)
      const json = await res.json()
      if (!res.ok) { setLoadMoreError(json.error || 'Could not load more documents'); return }
      setDocuments(prev => [...prev, ...(json.documents ?? [])])
    } catch {
      setLoadMoreError('Network error — try again')
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleUpload() {
    if (!title.trim()) { setUploadError('Title is required'); return }
    setUploading(true)
    setUploadError('')
    setUploadResult(null)

    const form = new FormData()
    form.append('title', title)
    form.append('source_type', sourceType)
    form.append('tags', tags)
    if (uploadMode === 'txt' && file) form.append('file', file)
    if (uploadMode === 'text') form.append('manual_text', manualText)

    try {
      const res = await fetch('/api/compass/kb', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) { setUploadError(json.error || 'Upload failed'); return }

      setUploadResult(json)
      setDocuments(prev => [{
        id: json.document_id, title, source_type: sourceType,
        tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean),
        created_at: new Date().toISOString()
      }, ...prev])
      setTitle(''); setTags(''); setManualText(''); setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch {
      setUploadError('Network error — try again')
    } finally {
      setUploading(false)
    }
  }

  async function handleSearch() {
    if (searchQuery.trim().length < 3) { setSearchError('Type at least 3 characters'); return }
    setSearching(true)
    setSearchError('')
    setSearchResults([])

    try {
      const res = await fetch('/api/compass/kb/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, limit: 6 })
      })
      const json = await res.json()
      if (!res.ok) { setSearchError(json.error || 'Search failed'); return }
      setSearchResults(json.results || [])
      if ((json.results || []).length === 0) setSearchError('No relevant content found. Try different keywords.')
    } catch {
      setSearchError('Search failed — try again')
    } finally {
      setSearching(false)
    }
  }

  const tabStyle = (tab: string) => ({
    padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', border: 'none',
    background: activeTab === tab ? '#538A22' : '#fff',
    color: activeTab === tab ? '#fff' : '#6b7280',
    boxShadow: activeTab === tab ? 'none' : '0 0 0 1px #e5e7eb inset',
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>Knowledge Base</h1>
          <p style={{ color: '#6b7280', marginTop: 4, fontSize: 14 }}>{total.toLocaleString()} documents · {documents.length.toLocaleString()} loaded · powers the interpretation engine</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['library', 'upload', 'search'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(tab)}>
              {tab === 'library' ? '📚 Library' : tab === 'upload' ? '⬆️ Upload' : '🔍 Test Search'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats — counts come from the server (whole-table count queries),
          not from `documents`, which only ever holds what's been paged
          in so far. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 28 }}>
        {Object.entries(sourceTypeConfig).map(([type, { icon: Icon, color, label }]) => (
          <div key={type} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={16} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{(typeCounts[type] ?? 0).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{label}s</div>
            </div>
          </div>
        ))}
        {typeCounts.other > 0 && (
          <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: FALLBACK_CFG.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FALLBACK_CFG.icon size={16} color={FALLBACK_CFG.color} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{typeCounts.other.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>Other</div>
            </div>
          </div>
        )}
      </div>

      {/* LIBRARY TAB */}
      {activeTab === 'library' && (
        <div>
          {documents.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: '60px 24px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>
              <BookOpen size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p style={{ fontSize: 15, fontWeight: 500 }}>No documents yet</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Upload your first book, guideline, or podcast transcript</p>
              <button onClick={() => setActiveTab('upload')} style={{ marginTop: 16, padding: '8px 20px', background: '#538A22', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Upload a Document
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {documents.map(doc => {
                const cfg = sourceTypeConfig[doc.source_type] ?? FALLBACK_CFG
                const Icon = cfg.icon
                return (
                  <div key={doc.id} className="tool-card" style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: cfg.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} color={cfg.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{doc.title}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                        {cfg.label} · {new Date(doc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {doc.tags?.length > 0 && ` · ${doc.tags.join(', ')}`}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.color + '15', padding: '3px 10px', borderRadius: 20 }}>{cfg.label}</span>
                  </div>
                )
              })}
              {hasMore && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  {loadMoreError && <div style={{ fontSize: 13, color: '#dc2626' }}>{loadMoreError}</div>}
                  <button onClick={loadMore} disabled={loadingMore} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: '#fff', color: '#538A22', border: '1px solid #538A22', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loadingMore ? 'not-allowed' : 'pointer', opacity: loadingMore ? 0.7 : 1 }}>
                    {loadingMore ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                    {loadingMore ? 'Loading…' : `Load ${Math.min(pageSize, total - documents.length).toLocaleString()} more (${(total - documents.length).toLocaleString()} remaining)`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* UPLOAD TAB */}
      {activeTab === 'upload' && (
        <div style={{ maxWidth: 620 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, border: '1px solid #e5e7eb' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Add Document to Knowledge Base</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Title <span style={{ color: '#ef4444' }}>*</span></label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. The Gut-Brain Connection — Anthony William" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Type</label>
                <select value={sourceType} onChange={e => setSourceType(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, background: '#fff' }}>
                  <option value="book">Book</option>
                  <option value="podcast">Podcast</option>
                  <option value="guideline">Guideline</option>
                  <option value="article">Article</option>
                  <option value="website">Website</option>
                  <option value="youtube">YouTube</option>
                  <option value="gemini-note">Gemini Note</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Tags <span style={{ color: '#9ca3af', fontWeight: 400 }}>(comma separated)</span></label>
                <input value={tags} onChange={e => setTags(e.target.value)} placeholder="thyroid, gut health, diet" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }} />
              </div>
            </div>

            {/* Mode toggle */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {(['txt', 'text'] as const).map(mode => (
                  <button key={mode} onClick={() => setUploadMode(mode)} style={{ padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: uploadMode === mode ? '#538A22' : '#d1d5db', background: uploadMode === mode ? '#F2F9EC' : '#fff', color: uploadMode === mode ? '#538A22' : '#6b7280' }}>
                    {mode === 'txt' ? '📄 Upload .txt File' : '✏️ Paste Text'}
                  </button>
                ))}
              </div>

              {uploadMode === 'txt' ? (
                <div>
                  <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed #d1d5db', borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', background: file ? '#F2F9EC' : '#fafafa' }}>
                    <input ref={fileRef} type="file" accept=".txt" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
                    {file ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                        <CheckCircle size={18} color="#538A22" />
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#538A22' }}>{file.name}</span>
                        <button onClick={e => { e.stopPropagation(); setFile(null); if (fileRef.current) fileRef.current.value = '' }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={14} /></button>
                      </div>
                    ) : (
                      <>
                        <Upload size={24} color="#9ca3af" style={{ margin: '0 auto 8px' }} />
                        <p style={{ fontSize: 14, color: '#6b7280', fontWeight: 500 }}>Click to select a .txt file</p>
                        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Export your PDF as text first, then upload here</p>
                      </>
                    )}
                  </div>
                  {/* How to convert tip */}
                  <div style={{ marginTop: 10, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                    💡 <strong>To convert a PDF to .txt:</strong> Open in Adobe Reader or browser → File → Save as Text, or copy-paste the content into Notepad and save as .txt
                  </div>
                </div>
              ) : (
                <textarea value={manualText} onChange={e => setManualText(e.target.value)} rows={10} placeholder="Paste the full text content here..." style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical', fontFamily: 'monospace' }} />
              )}
            </div>

            {uploadError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{uploadError}</div>
            )}

            {uploadResult && (
              <div style={{ background: '#F2F9EC', border: '1px solid #C8E9A8', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ fontWeight: 600, color: '#3a6118', fontSize: 14 }}>✅ Ingested successfully</div>
                <div style={{ fontSize: 13, color: '#538A22', marginTop: 4 }}>
                  {uploadResult.chunks_created} chunks created · {uploadResult.characters.toLocaleString()} characters processed
                </div>
              </div>
            )}

            <button onClick={handleUpload} disabled={uploading} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', background: '#538A22', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
              {uploading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</> : <><Upload size={16} /> Ingest Document</>}
            </button>
          </div>
        </div>
      )}

      {/* SEARCH TAB */}
      {activeTab === 'search' && (
        <div style={{ maxWidth: 680 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Test Semantic Search</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Search the KB the same way the interpretation engine will — by meaning, not exact keywords.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="e.g. thyroid healing foods, gut inflammation diet" style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }} />
              <button onClick={handleSearch} disabled={searching} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#538A22', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: searching ? 'not-allowed' : 'pointer', opacity: searching ? 0.7 : 1 }}>
                {searching ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
                Search
              </button>
            </div>
          </div>

          {searchError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{searchError}</div>
          )}

          {searchResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{searchResults.length} relevant chunks found</p>
              {searchResults.map((r, i) => {
                const cfg = sourceTypeConfig[r.source_type] ?? sourceTypeConfig.article
                const Icon = cfg.icon
                const isExpanded = expandedResult === r.id
                return (
                  <div key={r.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', width: 20, flexShrink: 0, marginTop: 2 }}>#{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <Icon size={13} color={cfg.color} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{r.document_title}</span>
                          <span style={{ fontSize: 11, background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 20 }}>
                            {Math.round(r.similarity * 100)}% match
                          </span>
                        </div>
                        <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                          {isExpanded ? r.content : r.content.slice(0, 180) + (r.content.length > 180 ? '…' : '')}
                        </p>
                      </div>
                      {r.content.length > 180 && (
                        <button onClick={() => setExpandedResult(isExpanded ? null : r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', flexShrink: 0 }}>
                          <ChevronDown size={16} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
