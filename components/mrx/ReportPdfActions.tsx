'use client'

import { useRef, useState, useEffect } from 'react'
import PdfToggleButton from '@/components/mrx/PdfToggleButton'
import { uploadReportPdf, reportPdfViewUrl } from '@/lib/mrx/reportPdf'
import { usePdfPanel } from '@/lib/mrx/PdfPanelContext'

type Props = {
  reportId: string
  initialPdfStored?: boolean
}

export default function ReportPdfActions({ reportId, initialPdfStored }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading,  setUploading]  = useState(false)
  const [pdfStored,  setPdfStored]  = useState<boolean | null>(initialPdfStored ?? null)
  const [pdfPending, setPdfPending] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const { openPdf, closePdf, isPdfOpen } = usePdfPanel()

  const pdfUrl = reportPdfViewUrl(reportId)

  useEffect(() => {
    let cancelled = false
    let attempts  = 0
    const MAX     = 15
    const DELAY   = 2000

    async function check() {
      if (cancelled) return
      try {
        const res = await fetch(pdfUrl, { method: 'HEAD', credentials: 'include' })
        if (cancelled) return

        if (res.ok) {
          setPdfStored(true)
          setPdfPending(false)
          return
        }

        if (initialPdfStored && attempts < MAX) {
          attempts++
          setPdfPending(true)
          setTimeout(check, DELAY)
        } else {
          setPdfStored(false)
          setPdfPending(false)
        }
      } catch {
        if (!cancelled) { setPdfStored(false); setPdfPending(false) }
      }
    }

    check()
    return () => { cancelled = true }
  }, [pdfUrl, initialPdfStored])

  const handleFile = async (f: File) => {
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      await uploadReportPdf(reportId, f)
      setPdfStored(true)
      setPdfPending(false)
      if (isPdfOpen) closePdf()
      openPdf(`${pdfUrl}?t=${Date.now()}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'PDF upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2 items-center">

        {/* Confirmed in storage → show toggle button */}
        {pdfStored === true && !pdfPending && (
          <PdfToggleButton pdfUrl={pdfUrl} variant="header" />
        )}

        {/* Background upload still in flight → spinner only, nothing clickable */}
        {pdfPending && (
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium"
            style={{ background: '#F2F9EC', border: '1px solid #E2F3D0', color: '#538A22' }}
          >
            <div className="w-3 h-3 rounded-full border-2 border-[#538A22] border-t-transparent animate-spin" />
            PDF uploading…
          </div>
        )}

        {/* No PDF and not pending → "Add PDF" (only for reports where doctor skipped upload) */}
        {pdfStored === false && !pdfPending && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
              style={{ background: '#FFFFFF', border: '1px solid #E2F3D0', color: '#538A22' }}
            >
              {uploading ? 'Saving PDF…' : 'Add PDF'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
                e.target.value = ''
              }}
            />
          </>
        )}

        {/* null = still doing first HEAD check → show nothing */}

      </div>
      {error && (
        <p className="text-[10px] text-red-600 font-mono max-w-xs text-right">{error}</p>
      )}
    </div>
  )
}
