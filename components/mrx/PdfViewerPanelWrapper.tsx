'use client'

import dynamic from 'next/dynamic'

const PdfViewerPanel = dynamic(
  () => import('@/components/mrx/PdfViewerPanel'),
  { ssr: false }
)

export default function PdfViewerPanelWrapper() {
  return <PdfViewerPanel />
}
