// The one place pdf.js is configured. The worker is bundled with the app
// rather than fetched from a CDN at runtime, so PDFs load even when the CDN is
// slow or blocked.
import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.js?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

// One worker shared by every document, started ahead of the first PDF so
// opening one doesn't wait for the worker script to download and start.
// Documents opened with it don't stop it when they're destroyed.
let worker = null
export function getPdfWorker() {
  if (!worker) worker = new pdfjsLib.PDFWorker({ name: 'simpl-pdf' })
  return worker
}

export function warmPdfWorker() {
  const start = () => { try { getPdfWorker() } catch {} }
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 2000 })
  else setTimeout(start, 500)
}

export default pdfjsLib
