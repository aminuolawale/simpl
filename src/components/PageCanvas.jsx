import { useEffect, useMemo, useRef } from 'react'
import { usePdf } from '../context/PdfContext'
import { createPdfViewer } from '../lib/pdfViewer'
import styles from './PageCanvas.module.css'

// The scrolling page view. React only renders the empty page boxes (once per
// document); drawing, sizing, scrolling and jumps are handled by the viewer.
export default function PageCanvas() {
  const { pdfDoc, pageCount, scale, setCurrentPage, initialPage, status, retry, navigatorRef } = usePdf()
  const containerRef = useRef(null)
  const pagesRef = useRef([])
  const viewerRef = useRef(null)
  const scaleRef = useRef(scale)
  scaleRef.current = scale

  useEffect(() => {
    if (!pdfDoc || !containerRef.current) return
    const viewer = createPdfViewer({
      pdfDoc,
      container: containerRef.current,
      pages: pagesRef.current,
      initialPage,
      scale: scaleRef.current,
      onPageChange: setCurrentPage,
    })
    viewerRef.current = viewer
    navigatorRef.current = viewer.goTo
    return () => {
      viewer.destroy()
      if (navigatorRef.current === viewer.goTo) navigatorRef.current = null
      viewerRef.current = null
    }
    // initialPage is set together with pdfDoc, so it's read once per document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc])

  useEffect(() => { viewerRef.current?.setScale(scale) }, [scale])

  const boxes = useMemo(() => {
    pagesRef.current = []
    return Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
      <div
        key={n}
        ref={el => { if (el) pagesRef.current[n] = el }}
        className={styles.pageWrapper}
        data-page={n}
        aria-label={`Page ${n}`}
      />
    ))
  }, [pdfDoc, pageCount])

  if (!pdfDoc) {
    if (status === 'error') {
      return (
        <div className={styles.message}>
          <p>The PDF couldn’t be loaded.</p>
          <button className={styles.retry} onClick={retry}>Try again</button>
        </div>
      )
    }
    if (status === 'loading') return <div className={styles.message}><p>Loading PDF…</p></div>
    return null
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.pages}>{boxes}</div>
    </div>
  )
}
