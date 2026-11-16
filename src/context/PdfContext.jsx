import { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect } from 'react'
import pdfjsLib from '../lib/pdfjs'
import { readOutline } from '../lib/pdf'

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

  // Load a document, replacing (and freeing) the previous one. `source` is
  // { data } or { url }; `url` may be an async function returning the URL, so
  // a failure to get a signed URL is reported (and retried) like any other.
  const load = useCallback(async ({ source, startPage = 1, outline: knownOutline = null, name = '', id = null }) => {
    lastLoadRef.current = { source, startPage, outline: knownOutline, name, id }
    const loadId = ++loadIdRef.current
    const isCurrent = () => loadId === loadIdRef.current

    docRef.current?.destroy()
    docRef.current = null
    setPdfDoc(null)
    setPageCount(0)
    setDocId(null)
    setStatus('loading')

    let task
    try {
      let params = source
      if (typeof source.url === 'function') params = { url: await source.url() }
      if (!isCurrent()) return
      task = pdfjsLib.getDocument(params)
      const pdf = await task.promise
      const resolved = knownOutline ?? await readOutline(pdf)
      if (!isCurrent()) { pdf.destroy(); return }
      docRef.current = pdf
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
  }, [])

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

  const retry = useCallback(() => {
    if (lastLoadRef.current) load(lastLoadRef.current).catch(() => {})
  }, [load])

  // Jump straight to a page (no scroll animation).
  const goToPage = useCallback((page) => navigatorRef.current?.(page), [])

  const zoomIn  = useCallback(() => setScale(s => Math.min(+(s + 0.2).toFixed(2), 3)), [])
  const zoomOut = useCallback(() => setScale(s => Math.max(+(s - 0.2).toFixed(2), 0.4)), [])

  // Free the document when the app unmounts.
  useEffect(() => () => docRef.current?.destroy(), [])

  const value = useMemo(() => ({
    pdfDoc, docId, outline, pageCount, setCurrentPage, status, retry,
    scale, zoomIn, zoomOut, loadPdf, loadPdfFromUrl, fileName, initialPage,
    goToPage, navigatorRef,
  }), [pdfDoc, docId, outline, pageCount, status, retry, scale, zoomIn, zoomOut,
    loadPdf, loadPdfFromUrl, fileName, initialPage, goToPage])

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
