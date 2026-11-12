import { useEffect, useRef, useCallback } from 'react'
import { usePdf } from '../context/PdfContext'
import styles from './PageCanvas.module.css'

export default function PageCanvas() {
  const { pdfDoc, pageCount, scale, setCurrentPage } = usePdf()
  const containerRef = useRef(null)
  const observerRef = useRef(null)
  const renderingRef = useRef({})

  const renderPage = useCallback(async (pageNum) => {
    if (!pdfDoc || renderingRef.current[pageNum]) return
    renderingRef.current[pageNum] = true

    const canvas = document.getElementById(`pdf-canvas-${pageNum}`)
    if (!canvas) { renderingRef.current[pageNum] = false; return }

    try {
      const page = await pdfDoc.getPage(pageNum)
      const viewport = page.getViewport({ scale })
      const ctx = canvas.getContext('2d')

      const dpr = window.devicePixelRatio || 1
      canvas.width = viewport.width * dpr
      canvas.height = viewport.height * dpr
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`

      const wrapper = canvas.parentElement
      if (wrapper) {
        wrapper.style.width = `${viewport.width}px`
        wrapper.style.height = `${viewport.height}px`
      }

      ctx.scale(dpr, dpr)
      await page.render({ canvasContext: ctx, viewport }).promise
    } catch {}

    renderingRef.current[pageNum] = false
  }, [pdfDoc, scale])

  // Pre-size all page wrappers so scrollIntoView lands accurately before pages render
  useEffect(() => {
    if (!pdfDoc) return
    let cancelled = false

    const presizeAll = async () => {
      for (let i = 1; i <= pageCount; i++) {
        if (cancelled) return
        const page = await pdfDoc.getPage(i)
        const viewport = page.getViewport({ scale })
        const wrapper = document.getElementById(`pdf-page-${i}`)
        if (wrapper) {
          wrapper.style.width = `${viewport.width}px`
          wrapper.style.height = `${viewport.height}px`
        }
      }
    }

    presizeAll()
    return () => { cancelled = true }
  }, [pdfDoc, scale, pageCount])

  // Clear canvases and reset render flags when scale changes
  useEffect(() => {
    renderingRef.current = {}
    if (!pdfDoc) return
    for (let i = 1; i <= pageCount; i++) {
      const canvas = document.getElementById(`pdf-canvas-${i}`)
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [scale, pdfDoc, pageCount])

  // Intersection observer: render pages on enter, track current page
  useEffect(() => {
    if (!pdfDoc) return

    // Track intersection ratios for all pages so we can pick the most visible
    const ratioMap = {}

    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageNum = parseInt(entry.target.dataset.page, 10)
          ratioMap[pageNum] = entry.intersectionRatio
          if (entry.isIntersecting) renderPage(pageNum)
        })

        // Pick the page with the highest visibility
        let best = null
        let bestRatio = 0
        Object.entries(ratioMap).forEach(([num, ratio]) => {
          if (ratio > bestRatio) { bestRatio = ratio; best = parseInt(num, 10) }
        })
        if (best) setCurrentPage(best)
      },
      { root: containerRef.current, threshold: Array.from({ length: 11 }, (_, i) => i / 10) }
    )

    document.querySelectorAll('[data-page]').forEach((el) => {
      observerRef.current.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [pdfDoc, pageCount, renderPage, setCurrentPage])

  if (!pdfDoc) return null

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.pages}>
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => (
          <div
            key={pageNum}
            id={`pdf-page-${pageNum}`}
            className={styles.pageWrapper}
            data-page={pageNum}
          >
            <canvas id={`pdf-canvas-${pageNum}`} className={styles.canvas} />
          </div>
        ))}
      </div>
    </div>
  )
}
