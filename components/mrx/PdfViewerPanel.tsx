'use client'
// components/PdfViewerPanel.tsx
// Fixed left PDF panel - report content and assistant sit to the right.
// Text selection inside the panel shows an "Ask Assistant →" popup.

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { usePdfPanel, PDF_PANEL_W } from '@/lib/mrx/PdfPanelContext'
import { useAssistant } from '@/lib/mrx/AssistantContext'
import { Lightbulb } from 'lucide-react'

// PDF.js worker, served from our own origin rather than unpkg.
//
// Was: `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs` — a
// protocol-relative CDN URL, meaning the clinical PDF viewer stopped working
// whenever unpkg was unreachable or blocked by clinic network policy, and a
// third party served executable code into the page.
//
// scripts/copy-pdf-worker.mjs copies the worker out of react-pdf's own
// pdfjs-dist (5.4.x — deliberately not this app's top-level 6.x, which would
// trip pdf.js's API/Worker version check) into public/ on prebuild/predev.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

export default function PdfViewerPanel() {
  const { isPdfOpen, closePdf, pdfUrl, setPendingSelection } = usePdfPanel()
  const { open: openAssistant } = useAssistant()

  const [numPages,    setNumPages]    = useState<number>(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale,       setScale]       = useState(1.0)
  const [loadError,   setLoadError]   = useState<string | null>(null)
  const [popup,       setPopup]       = useState<{ x: number; y: number; text: string } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Detect text selection inside the PDF panel
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) { setPopup(null); return }
    const text = selection.toString().trim()
    if (!text || text.length < 3) { setPopup(null); return }

    const range  = selection.getRangeAt(0)
    const rect   = range.getBoundingClientRect()
    const panel  = panelRef.current?.getBoundingClientRect()
    if (!panel) return

    setPopup({
      x: rect.left + rect.width / 2 - panel.left,
      y: rect.top - panel.top - 44,   // 44px above selection
      text,
    })
  }, [])

  // Clear popup on click outside
  useEffect(() => {
    const hide = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPopup(null)
      }
    }
    document.addEventListener('mousedown', hide)
    return () => document.removeEventListener('mousedown', hide)
  }, [])

  const sendToAssistant = useCallback(() => {
    if (!popup) return
    setPendingSelection(popup.text)
    openAssistant()
    setPopup(null)
    window.getSelection()?.removeAllRanges()
  }, [popup, setPendingSelection, openAssistant])

  useEffect(() => {
    if (isPdfOpen) setLoadError(null)
  }, [isPdfOpen, pdfUrl])

  const pdfOptions = useMemo(
    () => (pdfUrl?.startsWith('/api/') ? { withCredentials: true } : undefined),
    [pdfUrl]
  )

  if (!isPdfOpen || !pdfUrl) return null

  return (
    <div
      ref={panelRef}
      onMouseUp={handleMouseUp}
      style={{
        width:      PDF_PANEL_W,
        left:       0,
        transition: 'transform 0.25s ease',
        transform:  isPdfOpen ? 'translateX(0)' : 'translateX(-100%)',
      }}
      className="fixed top-0 h-screen z-30 bg-white border-r border-[#E2F3D0] flex flex-col select-text"
    >

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2F3D0] bg-[#F2F9EC] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#538A22] font-semibold uppercase tracking-widest">PDF Report</span>
          {numPages > 0 && (
            <span className="text-xs font-mono text-gray-400">{currentPage} / {numPages}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
              className="w-6 h-6 rounded text-gray-500 hover:bg-[#E2F3D0] transition text-sm flex items-center justify-center">−</button>
            <span className="text-xs font-mono text-gray-400 w-10 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(2.0, s + 0.1))}
              className="w-6 h-6 rounded text-gray-500 hover:bg-[#E2F3D0] transition text-sm flex items-center justify-center">+</button>
          </div>
          <button onClick={closePdf} className="text-gray-400 hover:text-gray-700 transition" aria-label="Close PDF">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Selection hint ───────────────────────────────────────────────── */}
      <div className="px-4 py-2 bg-[#F2F9EC] border-b border-[#E2F3D0] flex-shrink-0">
        <p className="text-[10px] font-mono text-[#538A22] flex items-center gap-1">
          <Lightbulb size={11} /> Best viewed at 70% zoom
        </p>
      </div>

      {/* ── PDF Pages ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-gray-100 relative">

        {/* Text selection popup */}
        {popup && (
          <button
            onMouseDown={(e) => { e.preventDefault(); sendToAssistant() }}
            style={{ position: 'absolute', left: popup.x - 70, top: popup.y, zIndex: 50 }}
            className="bg-[#538A22] hover:bg-[#3D6B16] text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg transition-colors whitespace-nowrap flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z" />
            </svg>
            Ask Assistant →
          </button>
        )}

        <Document
          file={pdfUrl}
          options={pdfOptions}
          onLoadSuccess={({ numPages }) => {
            setNumPages(numPages)
            setCurrentPage(1)
            setLoadError(null)
          }}
          onLoadError={() => {
            setLoadError(
              'PDF not found in storage. Use "Add PDF" on the report page to attach the file.'
            )
          }}
          loading={
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-6 h-6 border-2 border-[#538A22] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-400 font-mono">Loading PDF…</p>
            </div>
          }
          error={
            <div className="flex items-center justify-center h-64 px-6 text-center">
              <p className="text-xs text-red-600 font-mono leading-relaxed">
                {loadError || 'Failed to load PDF.'}
              </p>
            </div>
          }
        >
          {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
            <div
              key={pageNum}
              id={`pdf-page-${pageNum}`}
              className="mb-3 shadow-sm mx-auto"
              style={{ width: 'fit-content' }}
            >
              <Page
                pageNumber={pageNum}
                scale={scale}
                onRenderSuccess={() => { if (pageNum === 1) setCurrentPage(1) }}
                renderAnnotationLayer
                renderTextLayer   // enables text selection
              />
            </div>
          ))}
        </Document>
      </div>

      {/* ── Page navigation ─────────────────────────────────────────────── */}
      {numPages > 1 && (
        <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-[#E2F3D0] bg-white flex-shrink-0">
          <button
            onClick={() => { const p = Math.max(1, currentPage - 1); setCurrentPage(p); document.getElementById(`pdf-page-${p}`)?.scrollIntoView({ behavior: 'smooth' }) }}
            disabled={currentPage === 1}
            className="text-xs font-mono text-gray-500 hover:text-[#538A22] disabled:text-gray-300 transition"
          >← Prev</button>
          <span className="text-xs font-mono text-gray-400">Page {currentPage} of {numPages}</span>
          <button
            onClick={() => { const p = Math.min(numPages, currentPage + 1); setCurrentPage(p); document.getElementById(`pdf-page-${p}`)?.scrollIntoView({ behavior: 'smooth' }) }}
            disabled={currentPage === numPages}
            className="text-xs font-mono text-gray-500 hover:text-[#538A22] disabled:text-gray-300 transition"
          >Next →</button>
        </div>
      )}
    </div>
  )
}
