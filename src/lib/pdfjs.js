// The one place pdf.js is configured. The worker is bundled with the app
// rather than fetched from a CDN at runtime, so PDFs load even when the CDN is
// slow or blocked.
import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.js?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

export default pdfjsLib
