'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export const PDF_PANEL_W = 420
export const ASSISTANT_W = 400

type PdfPanelCtx = {
  isPdfOpen: boolean
  openPdf:   (url: string) => void
  closePdf:  () => void
  togglePdf: () => void
  pdfUrl:    string | null
  pendingSelection:    string | null
  setPendingSelection: (text: string | null) => void
}

const Ctx = createContext<PdfPanelCtx>({
  isPdfOpen:           false,
  openPdf:             () => {},
  closePdf:            () => {},
  togglePdf:           () => {},
  pdfUrl:              null,
  pendingSelection:    null,
  setPendingSelection: () => {},
})

export function PdfPanelProvider({ children }: { children: ReactNode }) {
  const [isPdfOpen, setIsPdfOpen] = useState(false)
  const [pdfUrl,    setPdfUrl]    = useState<string | null>(null)
  const [pendingSelection, setPendingSelection] = useState<string | null>(null)

  const openPdf   = useCallback((url: string) => { setPdfUrl(url); setIsPdfOpen(true)  }, [])
  const closePdf  = useCallback(() => setIsPdfOpen(false), [])
  const togglePdf = useCallback(() => setIsPdfOpen(v => !v), [])

  return (
    <Ctx.Provider value={{ isPdfOpen, openPdf, closePdf, togglePdf, pdfUrl, pendingSelection, setPendingSelection }}>
      {children}
    </Ctx.Provider>
  )
}

export function usePdfPanel() { return useContext(Ctx) }
