// Pulls each recipe's photo out of its cookbook page.
//
// JPEG streams (DCTDecode) are copied out byte for byte — no re-encoding, so
// no quality loss and no image library needed. Flate-compressed bitmaps are
// inflated and written as PNG with Node's own zlib. Anything else is left
// alone and reported rather than guessed at.
//
// Images live inside nested form XObjects in these files, so the resource
// tree is walked recursively; looking only at page-level resources finds
// nothing at all.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { deflateSync, inflateSync, crc32 } from 'node:zlib'
import { createHash } from 'node:crypto'
import { PDFDocument, PDFName, PDFDict, PDFRawStream, PDFArray } from 'pdf-lib'

const OUT = '.cookbook-images'

function imagesOnPage(doc, pageNode, seen = new Set(), depth = 0) {
  const found = []
  if (depth > 4) return found
  const resources = pageNode.Resources?.() ?? pageNode.get?.(PDFName.of('Resources'))
  const dict = resources instanceof PDFDict ? resources : doc.context.lookup(resources, PDFDict)
  if (!dict) return found
  // A form's Resources may have no XObject entry at all; lookup() with an
  // expected type throws on that rather than returning undefined.
  let xobjects
  try {
    xobjects = dict.lookup(PDFName.of('XObject'), PDFDict)
  } catch {
    return found
  }
  if (!xobjects) return found

  for (const [name, ref] of xobjects.entries()) {
    const refKey = ref.toString()
    if (seen.has(refKey)) continue
    seen.add(refKey)
    const stream = doc.context.lookup(ref)
    if (!stream || !stream.dict) continue
    const subtype = String(stream.dict.get(PDFName.of('Subtype')) || '')
    if (subtype === '/Image' && stream instanceof PDFRawStream) {
      found.push({ name: String(name), stream })
    } else if (subtype === '/Form') {
      found.push(...imagesOnPage(doc, stream.dict, seen, depth + 1))
    }
  }
  return found
}

function filterName(stream) {
  const f = stream.dict.get(PDFName.of('Filter'))
  if (!f) return ''
  if (f instanceof PDFArray) return f.asArray().map((x) => String(x)).join(',')
  return String(f)
}

// Minimal PNG writer: signature, IHDR, IDAT, IEND.
function toPng(width, height, rgb, channels) {
  const raw = Buffer.alloc((width * channels + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * channels + 1)] = 0 // no filter
    rgb.copy(raw, y * (width * channels + 1) + 1, y * width * channels, (y + 1) * width * channels)
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body) >>> 0)
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = channels === 3 ? 2 : 0 // truecolour or greyscale
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

export async function extractPageImages(file, wantedPages) {
  const doc = await PDFDocument.load(readFileSync(file), { updateMetadata: false, throwOnInvalidObject: false })
  const pages = doc.getPages()
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

  // Page furniture (the logo, the banner illustration) is the same image
  // reused on many pages; a dish photo belongs to one page only. So count
  // every image across the book first and keep only the unique ones —
  // picking "the largest image" alone returned the background artwork.
  const candidatesByPage = new Map()
  const hashCounts = new Map()
  for (const pageNumber of wantedPages) {
    const page = pages[pageNumber - 1]
    if (!page) continue
    const candidates = imagesOnPage(doc, page.node)
      .map(({ stream }) => {
        const width = Number(stream.dict.get(PDFName.of('Width'))?.toString() || 0)
        const height = Number(stream.dict.get(PDFName.of('Height'))?.toString() || 0)
        const bytes = stream.contents.length
        return {
          stream,
          width,
          height,
          area: width * height,
          bytesPerPixel: width && height ? bytes / (width * height) : 0,
          hash: createHash('md5').update(Buffer.from(stream.contents)).digest('hex'),
          filter: filterName(stream),
        }
      })
      .filter((c) => c.width >= 300 && c.height >= 300)
    const onThisPage = new Set()
    for (const c of candidates) {
      if (onThisPage.has(c.hash)) continue
      onThisPage.add(c.hash)
      hashCounts.set(c.hash, (hashCounts.get(c.hash) || 0) + 1)
    }
    candidatesByPage.set(pageNumber, candidates)
  }

  const results = new Map()
  for (const [pageNumber, candidates] of candidatesByPage) {
    const best = candidates
      .filter((c) => hashCounts.get(c.hash) === 1 && c.bytesPerPixel > 0.05)
      .sort((a, b) => b.area - a.area)[0]
    if (!best) continue

    try {
      if (best.filter.includes('DCTDecode')) {
        results.set(pageNumber, { buffer: Buffer.from(best.stream.contents), ext: 'jpg', width: best.width, height: best.height })
      } else if (best.filter.includes('FlateDecode')) {
        const colorSpace = String(best.stream.dict.get(PDFName.of('ColorSpace')) || '')
        const channels = /DeviceRGB|ICCBased/i.test(colorSpace) ? 3 : 1
        const data = inflateSync(Buffer.from(best.stream.contents))
        if (data.length < best.width * best.height * channels) continue
        results.set(pageNumber, {
          buffer: toPng(best.width, best.height, data, channels),
          ext: 'png',
          width: best.width,
          height: best.height,
        })
      }
    } catch {
      // An image we cannot decode is reported by its absence, never faked.
    }
  }
  return results
}

if (process.argv[1]?.endsWith('extract-images.mjs')) {
  const recipes = JSON.parse(readFileSync('.cookbooks_parsed.json', 'utf8'))
  const byFile = new Map()
  for (const r of recipes) {
    if (!byFile.has(r.sourceFile)) byFile.set(r.sourceFile, [])
    byFile.get(r.sourceFile).push(r)
  }
  const MAX = 5 * 1024 * 1024
  let withImage = 0, tooBig = 0, none = 0
  const manifest = []
  for (const [file, list] of byFile) {
    const images = await extractPageImages('D:/clp_base/clp_merge/recipes_shared by_Nithya/' + file, list.map((r) => r.page))
    for (const r of list) {
      const img = images.get(r.page)
      if (!img) { none++; continue }
      if (img.buffer.length > MAX) { tooBig++; continue }
      const safe = `${file.replace(/[^a-z0-9]/gi, '_').slice(0, 24)}_p${r.page}.${img.ext}`
      writeFileSync(`${OUT}/${safe}`, img.buffer)
      manifest.push({ name: r.name, sourceFile: file, page: r.page, path: `${OUT}/${safe}`, bytes: img.buffer.length, w: img.width, h: img.height })
      withImage++
    }
    console.log(`${file.slice(0, 36).padEnd(37)} ${images.size} images for ${list.length} recipes`)
  }
  writeFileSync('.cookbook-images.json', JSON.stringify(manifest, null, 2))
  console.log(`\nwith photo: ${withImage} · over 5MB (skipped): ${tooBig} · no usable image: ${none}`)
}
