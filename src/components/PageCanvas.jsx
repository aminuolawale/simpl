import { useEffect, useRef, useCallback } from 'react'
import { usePdf } from '../context/PdfContext'
import styles from './PageCanvas.module.css'

export default function PageCanvas() {
  const { pdfDoc, pageCount, scale, currentPage, setCurrentPage, initialPage } = usePdf()
  const containerRef = useRef(null)
  const observerRef = useRef(null)
  const renderingRef = useRef({})
  const positionedDocRef = useRef(null)
  const currentPageRef = useRef(currentPage)
  currentPageRef.current = currentPage

  // Resize a page wrapper. If the page is entirely above the viewport, shift the
  // scroll position by the height change so the page being read stays put.
  const sizeWrapper = useCallback((wrapper, width, height) => {
    const container = containerRef.current
    const oldHeight = wrapper.offsetHeight
    const above = container &&
      wrapper.getBoundingClientRect().bottom <= container.getBoundingClientRect().top
    wrapper.style.width = `${width}px`
    wrapper.style.height = `${height}px`
    if (above) container.scrollTop += wrapper.offsetHeight - oldHeight
  }, [])

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
      if (wrapper) sizeWrapper(wrapper, viewport.width, viewport.height)

      ctx.scale(dpr, dpr)
      await page.render({ canvasContext: ctx, viewport }).promise
    } catch {}

    renderingRef.current[pageNum] = false
  }, [pdfDoc, scale, sizeWrapper])

  // Pre-size all page wrappers so scrollIntoView lands accurately before pages render
  useEffect(() => {
    if (!pdfDoc) return
    let cancelled = false

    const presizeAll = async () => {
      // One getPage call — apply its dimensions to every wrapper immediately
      const firstPage = await pdfDoc.getPage(1)
      if (cancelled) return
      const { width, height } = firstPage.getViewport({ scale })
      for (let i = 1; i <= pageCount; i++) {
        const wrapper = document.getElementById(`pdf-page-${i}`)
        if (wrapper) {
          wrapper.style.width = `${width}px`
          wrapper.style.height = `${height}px`
        }
      }

      // Position the reader: a newly loaded document opens at its initial page;
      // after a zoom, stay on the page being read. Always scroll (even to page 1)
      // so no scroll position carries over from a previously shown document.
      const isNewDoc = positionedDocRef.current !== pdfDoc
      positionedDocRef.current = pdfDoc
      const target = Math.min(Math.max(1, isNewDoc ? initialPage : currentPageRef.current), pageCount)
      const container = containerRef.current
      const el = document.getElementById(`pdf-page-${target}`)
      if (container) {
        if (target <= 1 || !el) container.scrollTop = 0
        else el.scrollIntoView({ block: 'start' })
      }

      // Background pass: correct pages whose dimensions differ from page 1
      for (let i = 2; i <= pageCount; i++) {
        if (cancelled) return
        const page = await pdfDoc.getPage(i)
        const vp = page.getViewport({ scale })
        if (vp.width === width && vp.height === height) continue
        const wrapper = document.getElementById(`pdf-page-${i}`)
        if (wrapper) sizeWrapper(wrapper, vp.width, vp.height)
      }
    }

    presizeAll()
    return () => { cancelled = true }
  }, [pdfDoc, scale, pageCount, initialPage, sizeWrapper])

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

    const ratioMap = {}

    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageNum = parseInt(entry.target.dataset.page, 10)
          ratioMap[pageNum] = entry.intersectionRatio
          if (entry.isIntersecting) renderPage(pageNum)
        })

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
