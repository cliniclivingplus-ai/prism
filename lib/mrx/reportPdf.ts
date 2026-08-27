/** Canonical Supabase Storage path for a report PDF. */
export function reportPdfStoragePath(reportId: string) {
  return `${reportId}.pdf`
}

/** Paths to try when loading (new id-based path first, then legacy filename). */
export function reportPdfDownloadPaths(reportId: string, pdfFilename?: string | null) {
  const paths = [reportPdfStoragePath(reportId)]
  if (pdfFilename && !paths.includes(pdfFilename)) {
    paths.push(pdfFilename)
  }
  return paths
}

/** Upload a PDF via the server API (uses service role - bypasses storage RLS). */
export async function uploadReportPdf(reportId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`/api/mrx/reports/${reportId}/pdf`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to save PDF to storage')
  }
}

export function reportPdfViewUrl(reportId: string) {
  return `/api/mrx/reports/${reportId}/pdf`
}
