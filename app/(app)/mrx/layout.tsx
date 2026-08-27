import type { Metadata } from 'next'
import { PageContextProvider } from '@/components/mrx/PageContext'
import { AssistantProvider } from '@/lib/mrx/AssistantContext'
import { PdfPanelProvider } from '@/lib/mrx/PdfPanelContext'
import ClinicalAssistant from '@/components/mrx/ClinicalAssistant'
import PdfViewerPanelWrapper from '@/components/mrx/PdfViewerPanelWrapper'
import LayoutShell from '@/components/mrx/LayoutShell'

// Was MicrobiomeRx's root layout (its own <html>/<body> and globals.css
// import). In the merged app the root layout lives at app/layout.tsx and the
// shared shell at app/(app)/layout.tsx, so this keeps only what is genuinely
// MicrobiomeRx-specific: the three context providers, the tool's own
// LayoutShell, and the two floating panels (clinical assistant + PDF viewer).
export const metadata: Metadata = {
  title: 'MicrobiomeRx — LP Workspace',
  description: 'Clinical gut microbiome analysis',
}

export default function MrxLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContextProvider>
      <AssistantProvider>
        <PdfPanelProvider>
          <LayoutShell>{children}</LayoutShell>
          <PdfViewerPanelWrapper />
          <ClinicalAssistant />
        </PdfPanelProvider>
      </AssistantProvider>
    </PageContextProvider>
  )
}
