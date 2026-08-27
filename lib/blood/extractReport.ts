import { createWorker } from 'tesseract.js'

// Client-side (browser) extraction — runs entirely in the browser, both
// the PDF rendering AND the OCR itself. Two paths:
//  1. Real text layer present (most native-generated lab PDFs) -> read it
//     directly with pdfjs-dist, same call MicrobiomeRX's own extractSpecies.ts
//     already makes.
//  2. No usable text layer (a scan) -> render each page to a real browser
//     <canvas> with pdfjs-dist's own page.render(), then OCR it right
//     there with tesseract.js's browser/WASM build.
// A single image upload (photo/screenshot) always takes the OCR path.
//
// OCR deliberately never touches the server: a real multi-page scanned
// report (some of the coach's own sample reports run 28-43 pages) becomes
// tens of MB of page images at OCR-quality resolution, which blew past
// Vercel's 4.5MB serverless request-body limit ("Request Entity Too
// Large") when those images were uploaded for server-side OCR. Only the
// final extracted text (kilobytes, not megabytes) ever leaves the browser.

const MIN_TEXT_LAYER_CHARS = 200

export type ExtractResult = { text: string; ocrUsed: boolean }
export type ExtractProgress = { stage: 'reading' | 'ocr'; page?: number; totalPages?: number }

async function loadPdfjs() {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()
  return pdfjsLib
}

async function renderPageToCanvas(page: import('pdfjs-dist').PDFPageProxy): Promise<HTMLCanvasElement> {
  // Scale up from the PDF's native ~72dpi so small table text OCRs cleanly.
  const viewport = page.getViewport({ scale: 2.5 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported in this browser')
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  return canvas
}

async function ocrImages(images: (HTMLCanvasElement | Blob)[], onProgress?: (p: ExtractProgress) => void): Promise<string> {
  const worker = await createWorker('eng')
  try {
    const texts: string[] = []
    for (let i = 0; i < images.length; i++) {
      onProgress?.({ stage: 'ocr', page: i + 1, totalPages: images.length })
      const { data } = await worker.recognize(images[i])
      texts.push(data.text)
    }
    return texts.join('\n\n')
  } finally {
    await worker.terminate()
  }
}

export async function extractFromPdf(file: File, onProgress?: (p: ExtractProgress) => void): Promise<ExtractResult> {
  onProgress?.({ stage: 'reading' })
  const pdfjsLib = await loadPdfjs()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    fullText += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + '\n'
  }

  if (fullText.trim().length >= MIN_TEXT_LAYER_CHARS) {
    return { text: fullText, ocrUsed: false }
  }

  // Scanned PDF — render each page to a canvas and OCR it right here.
  const canvases: HTMLCanvasElement[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    canvases.push(await renderPageToCanvas(await pdf.getPage(i)))
  }
  const text = await ocrImages(canvases, onProgress)
  return { text, ocrUsed: true }
}

export async function extractFromFile(file: File, onProgress?: (p: ExtractProgress) => void): Promise<ExtractResult> {
  if (file.type === 'application/pdf') return extractFromPdf(file, onProgress)
  if (file.type.startsWith('image/')) {
    const text = await ocrImages([file], onProgress)
    return { text, ocrUsed: true }
  }
  throw new Error(`Unsupported file type: ${file.type}`)
}
