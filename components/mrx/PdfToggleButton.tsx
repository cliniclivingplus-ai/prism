'use client'
// components/PdfToggleButton.tsx
// Drop this anywhere in a section page or SectionHeader to open the PDF panel.
// Pass the pdf_url from report_data (or however it's stored in your Supabase reports table).
//
// Usage:
//   <PdfToggleButton pdfUrl={report.pdf_url} />

import { usePdfPanel } from '@/lib/mrx/PdfPanelContext'

type Props = {
  pdfUrl: string | null | undefined
  variant?: 'default' | 'header'
}

export default function PdfToggleButton({ pdfUrl, variant = 'default' }: Props) {
  const { isPdfOpen, openPdf, closePdf } = usePdfPanel()

  if (!pdfUrl) return null

  const label = isPdfOpen ? 'Close PDF' : 'View PDF'

  if (variant === 'header') {
    return (
      <button
        onClick={() => isPdfOpen ? closePdf() : openPdf(pdfUrl)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all"
        style={{
          background: isPdfOpen ? '#538A22' : '#FFFFFF',
          border: `1px solid ${isPdfOpen ? '#538A22' : '#E2F3D0'}`,
          color: isPdfOpen ? '#FFFFFF' : '#4B5563',
        }}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        {label}
      </button>
    )
  }

  return (
    <button
      onClick={() => isPdfOpen ? closePdf() : openPdf(pdfUrl)}
      className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${
        isPdfOpen
          ? 'bg-[#538A22] text-white border-[#538A22]'
          : 'bg-white text-[#538A22] border-[#C8E9A8] hover:bg-[#F2F9EC]'
      }`}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      {label}
    </button>
  )
}
