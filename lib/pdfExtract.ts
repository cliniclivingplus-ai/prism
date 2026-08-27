import { extractText } from 'unpdf'

export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true })
  return text.replace(/\s+/g, ' ').trim()
}
