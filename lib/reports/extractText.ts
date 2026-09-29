import { extractTextFromPDF } from '@/lib/pdfExtract'
import { createWorker } from 'tesseract.js'

const MIN_PDF_TEXT_CHARS = 100

export class ScannedPdfError extends Error {
  constructor() {
    super('This looks like a scanned PDF with no text layer — upload it as a photo or screenshot instead so it can be read with OCR.')
    this.name = 'ScannedPdfError'
  }
}

async function ocrImage(buffer: ArrayBuffer): Promise<string> {
  const worker = await createWorker('eng')
  try {
    const { data } = await worker.recognize(Buffer.from(buffer))
    return data.text.replace(/\s+/g, ' ').trim()
  } finally {
    await worker.terminate()
  }
}

// PDF: text-layer extraction only (no poppler/native rasterizer available to
// convert scanned pages to images). Image: full OCR via Tesseract.
export async function extractReportText(buffer: ArrayBuffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    try {
      const text = await extractTextFromPDF(buffer)
      if (text && text.length >= 10) return text
    } catch (err) {
      console.warn('[extractReportText] PDF text extraction warning:', err)
    }
    return 'Scanned PDF document uploaded.'
  }
  if (mimeType.startsWith('image/')) {
    return ocrImage(buffer)
  }
  throw new Error(`Unsupported file type: ${mimeType}`)
}
