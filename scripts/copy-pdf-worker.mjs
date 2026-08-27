// Copies the pdf.js worker that react-pdf actually bundles into public/, so
// the viewer loads it from our own origin instead of a CDN.
//
// Why not just point at the top-level pdfjs-dist: react-pdf pins pdfjs-dist
// 5.4.x as a hard dependency, while this app's own PDF parsing runs on
// pdfjs-dist 6.x. npm nests them, so two copies exist. pdf.js refuses to run
// when the worker's version differs from the API's ("The API version does not
// match the Worker version"), so the worker must come from react-pdf's copy,
// not ours. Resolving it here keeps that coupling explicit and verified at
// build time rather than discovered at runtime.
import { createRequire } from 'node:module'
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

const reactPdfPkg = require.resolve('react-pdf/package.json')
const pdfjsPkg = require.resolve('pdfjs-dist/package.json', { paths: [dirname(reactPdfPkg)] })
const version = require(pdfjsPkg).version

const src = join(dirname(pdfjsPkg), 'build', 'pdf.worker.min.mjs')
const destDir = join(process.cwd(), 'public')
const dest = join(destDir, 'pdf.worker.min.mjs')

mkdirSync(destDir, { recursive: true })
copyFileSync(src, dest)
console.log(`[pdf-worker] copied pdfjs-dist ${version} worker (react-pdf's copy) -> public/pdf.worker.min.mjs`)
