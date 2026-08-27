'use client'
// components/LayoutShell.tsx
// Wraps all page content.
// - PDF panel is fixed LEFT  → push content right via marginLeft
// - Assistant panel is fixed RIGHT → push content left via marginRight

import { ReactNode } from 'react'
import { useAssistant } from '@/lib/mrx/AssistantContext'
import { usePdfPanel, PDF_PANEL_W } from '@/lib/mrx/PdfPanelContext'

const SIDEBAR_W = 400  // px - keep in sync with ClinicalAssistant panel width

export default function LayoutShell({ children }: { children: ReactNode }) {
  const { isOpen }    = useAssistant()
  const { isPdfOpen } = usePdfPanel()

  return (
    <div
      style={{
        marginLeft:  isPdfOpen ? PDF_PANEL_W : 0,
        marginRight: isOpen    ? SIDEBAR_W   : 0,
        transition:  'margin-left 0.25s ease, margin-right 0.25s ease',
        minHeight:   '100vh',
      }}
    >
      {children}
    </div>
  )
}
