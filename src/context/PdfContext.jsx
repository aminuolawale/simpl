import { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect } from 'react'
import pdfjsLib, { getPdfWorker } from '../lib/pdfjs'
import { readOutline } from '../lib/pdf'
import { cacheOpenedPdf, resolveResourcePdf } from '../lib/pdfSource'
import { clearPdfCache } from '../lib/pdfCache'
import { supabase } from '../lib/supabase'
import { warmPdfWorker } from '../lib/pdfjs'

// Two contexts: PdfContext holds things that change rarely (the document,
// zoom, loading state, actions); PdfPageContext holds the current page, which
// changes constantly while scrolling. Keeping them apart means pages that only
// load a PDF (and their note editors) don't re-render on every scroll.
const PdfContext = createContext(null)
const PdfPageContext = createContext(1)

export function PdfProvider({ children }) {
  const [pdfDoc, setPdfDoc] = useState(null)
  const [outline, setOutline] = useState([])
  const [pageCount, setPageCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [fileName, setFileName] = useState('')
  const [initialPage, setInitialPage] = useState(1)
  // Id of the resource the open document belongs to, when known.
  const [docId, setDocId] = useState(null)
  // 'idle' | 'loading' | 'ready' | 'error'
  const [status, setStatus] = useState('idle')

  const loadIdRef = useRef(0)
  const docRef = useRef(null)
  const lastLoadRef = useRef(null)
  const navigatorRef = useRef(null) // set by PageCanvas
  const docIdRef = useRef(null)
  // Timing of the current open, for performance measures: { start, how, firstDrawn }.
  const timingRef = useRef(null)

  // Record how long the current open took to show its first page, as a
  // performance measure named "pdf:open" (and a console line in development).
  const markFirstDraw = useCallback(() => {
    const t = timingRef.current
    if (!t || t.firstDrawn) return
    t.firstDrawn = true
    const detail = { how: t.how, ms: Math.round(performance.now() - t.start) }
    try { performance.measure('pdf:open', { start: t.start, detail }) } catch {}
    if (import.meta.env.DEV) console.info(`[pdf] first page in ${detail.ms} ms (${detail.how})`)
  }, [])

  // Load a document, replacing (and freeing) the previous one. Either
  // `path`, a resource's storage path (read from the device cache, else
  // downloaded and then cached), or `source`: { data } or { url }, where `url`
  // may be an async function returning the URL.
  const load = useCallback(async ({ source = null, path = null, startPage = 1, outline: knownOutline = null, name = '', id = null }) => {
    lastLoadRef.current = { source, path, startPage, outline: knownOutline, name, id }
    const loadId = ++loadIdRef.current
    const isCurrent = () => loadId === loadIdRef.current
    timingRef.current = { start: performance.now(), how: 'network', firstDrawn: false }

    // The same book is already open (e.g. moving between its sessions):
    // keep it and just go to the new start page.
    if (id && docIdRef.current === id && docRef.current) {
      const start = Math.min(Math.max(1, startPage || 1), docRef.current.numPages)
      timingRef.current.how = 'already open'
      setInitialPage(start)
      setCurrentPage(start)
      setStatus('ready')
      if (navigatorRef.current) {
        navigatorRef.current(start) // the page view is still showing it
        markFirstDraw()
      }
      return
    }

    docRef.current?.destroy()
    docRef.current = null
    docIdRef.current = null
    setPdfDoc(null)
    setPageCount(0)
    setDocId(null)
    setStatus('loading')

    let task
    try {
      let params = source
      let cached = false
      if (path) ({ source: params, cached } = await resolveResourcePdf(path))
      else if (typeof source.url === 'function') params = { url: await source.url() }
      if (!isCurrent()) return
      if (cached) timingRef.current.how = 'device cache'
      task = pdfjsLib.getDocument({ ...params, worker: getPdfWorker() })
      const pdf = await task.promise
      const resolved = knownOutline ?? await readOutline(pdf)
      if (!isCurrent()) { pdf.destroy(); return }
      docRef.current = pdf
      docIdRef.current = id
      if (path && !cached) cacheOpenedPdf(path, pdf)
      setPdfDoc(pdf)
      setOutline(resolved ?? [])
      setPageCount(pdf.numPages)
      const start = Math.min(Math.max(1, startPage || 1), pdf.numPages)
      setCurrentPage(start)
      setInitialPage(start)
      setFileName(name)
      setDocId(id)
      setStatus('ready')
    } catch (e) {
      task?.destroy()
      if (!isCurrent()) return
      console.error('Could not load PDF', e)
      setStatus('error')
      throw e
    }
  }, [markFirstDraw])

  const loadPdf = useCallback(
    async (file) => load({ source: { data: await file.arrayBuffer() }, name: file.name }),
    [load]
  )

  // `url` may be a string or an async function returning one (e.g. a signed URL).
  // `id` is the resource's id, used to tie clips to their source.
  const loadPdfFromUrl = useCallback(
    (url, startPage = 1, existingOutline = null, id = null) =>
      load({ source: { url }, startPage, outline: existingOutline, id }).catch(() => {}),
    [load]
  )

  // Open a resource's PDF by its storage path. `id` (the resource id) lets an
  // already-open copy be reused and ties clips to their source.
  const openResourcePdf = useCallback(
    ({ id, path, startPage = 1, outline = null }) =>
      load({ path, id, startPage, outline }).catch(() => {}),
    [load]
  )

  const retry = useCallback(() => {
    if (lastLoadRef.current) load(lastLoadRef.current).catch(() => {})
  }, [load])

  // Jump straight to a page (no scroll animation).
  const goToPage = useCallback((page) => navigatorRef.current?.(page), [])

  const zoomIn  = useCallback(() => setScale(s => Math.min(+(s + 0.2).toFixed(2), 3)), [])
  const zoomOut = useCallback(() => setScale(s => Math.max(+(s - 0.2).toFixed(2), 0.4)), [])

  // Free the document when the app unmounts.
  useEffect(() => () => docRef.current?.destroy(), [])

  // After signing out, close the open document and clear the device cache,
  // so nothing of this account's PDFs stays on the device.
  const closeDocument = useCallback(() => {
    loadIdRef.current++
    docRef.current?.destroy()
    docRef.current = null
    docIdRef.current = null
    setPdfDoc(null)
    setPageCount(0)
    setDocId(null)
    setStatus('idle')
  }, [])

  useEffect(() => {
    warmPdfWorker()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        closeDocument()
        clearPdfCache()
      }
    })
    return () => subscription.unsubscribe()
  }, [closeDocument])

  const value = useMemo(() => ({
    pdfDoc, docId, outline, pageCount, setCurrentPage, status, retry,
    scale, zoomIn, zoomOut, loadPdf, loadPdfFromUrl, openResourcePdf, closeDocument,
    fileName, initialPage, goToPage, navigatorRef, markFirstDraw,
  }), [pdfDoc, docId, outline, pageCount, status, retry, scale, zoomIn, zoomOut,
    loadPdf, loadPdfFromUrl, openResourcePdf, closeDocument, fileName, initialPage, goToPage, markFirstDraw])

  return (
    <PdfContext.Provider value={value}>
      <PdfPageContext.Provider value={currentPage}>
        {children}
      </PdfPageContext.Provider>
    </PdfContext.Provider>
  )
}

export function usePdf() {
  return useContext(PdfContext)
}

// The page currently in view. Only components that display it should use this.
export function useCurrentPage() {
  return useContext(PdfPageContext)
}
