// Drives a continuous-scroll PDF view: sizes the page boxes, draws only the
// pages near the viewport (and frees the rest), tracks the current page, and
// jumps to pages exactly.
//
// The container must be the scrolling element and `position: relative`, so a
// page box's offsetTop is its scroll position. `pages[n]` is the (empty) box
// for page n, 1-based; the viewer puts a canvas in it once the page is drawn.

const PRERENDER_MARGIN = '100% 0px' // draw pages within one viewport above/below
const MAX_CONCURRENT_RENDERS = 2
const MAX_CANVAS_PIXELS = 16 * 1024 * 1024 // caps memory at high zoom on dense screens
const CURRENT_PAGE_LINE = 0.3 // the page under this fraction of the viewport is "current"
const SIZE_BATCH = 25 // pages measured per step of the background size pass

export function createPdfViewer({ pdfDoc, container, pages, initialPage = 1, scale, onPageChange, onFirstDraw }) {
  const pageCount = pdfDoc.numPages
  let destroyed = false
  let currentScale = scale

  // Page sizes at scale 1. Until a page is measured it is assumed to be the
  // size of page 1, then corrected by the background pass or when it's drawn.
  const sizes = new Array(pageCount + 1)
  let defaultSize = null
  const sizeOf = (n) => sizes[n] ?? defaultSize

  // While a page is pinned (after a jump, until the user scrolls), any layout
  // change re-aligns the view to it, so late size corrections can't push it away.
  let pinned = clamp(initialPage)
  let current = pinned

  const near = new Set()        // pages within the prerender margin
  const drawnAt = new Map()     // page → scale its canvas was drawn at
  const tasks = new Map()       // page → in-flight pdf.js render task
  const queue = new Set()       // pages waiting to be drawn
  const failed = new Set()      // pages whose draw failed; retried when they come back into view
  let active = 0
  let firstDrawDone
  const firstDraw = new Promise(r => { firstDrawDone = r })

  function clamp(n) {
    return Math.min(Math.max(1, Math.round(n) || 1), pageCount)
  }

  // ── layout ────────────────────────────────────────────────────────────────

  const boxHeight = (n) => Math.floor(sizeOf(n).h * currentScale)
  const boxWidth = (n) => Math.floor(sizeOf(n).w * currentScale)

  // Apply sizes to the given page boxes in one pass, then keep the reader's
  // place: re-align to the pinned page, or shift by the height change of
  // boxes entirely above the viewport.
  function resize(nums) {
    if (!defaultSize) return
    const top = container.scrollTop
    let shift = 0
    const changes = []
    for (const n of nums) {
      const el = pages[n]
      if (!el) continue
      const h = boxHeight(n)
      const old = el.offsetHeight
      if (old === h && el.style.width === `${boxWidth(n)}px`) continue
      if (el.offsetTop + old <= top) shift += h - old
      changes.push([el, boxWidth(n), h])
    }
    for (const [el, w, h] of changes) {
      el.style.width = `${w}px`
      el.style.height = `${h}px`
    }
    if (pinned) scrollToPage(pinned)
    else if (shift) container.scrollTop = top + shift
  }

  function learnSize(n, page) {
    const vp = page.getViewport({ scale: 1 })
    const s = sizes[n]
    if (s && s.w === vp.width && s.h === vp.height) return false
    sizes[n] = { w: vp.width, h: vp.height }
    return true
  }

  function scrollToPage(n) {
    const el = pages[n]
    if (el) container.scrollTop = el.offsetTop
  }

  // Measure every page in the background, a batch at a time, so jumps and the
  // scrollbar are accurate for documents with mixed page sizes. Waits for the
  // first page to be drawn so it doesn't compete with it for the network.
  async function measureAll() {
    await Promise.race([firstDraw, new Promise(r => setTimeout(r, 3000))])
    for (let start = 2; start <= pageCount && !destroyed; start += SIZE_BATCH) {
      const changed = []
      for (let n = start; n < start + SIZE_BATCH && n <= pageCount; n++) {
        try {
          if (learnSize(n, await pdfDoc.getPage(n))) changed.push(n)
        } catch {
          if (destroyed) return
        }
      }
      if (destroyed) return
      if (changed.length) resize(changed)
      await new Promise(r => setTimeout(r, 0)) // let drawing and input in between
    }
  }

  // ── current page ──────────────────────────────────────────────────────────

  function pageAt(y) {
    // Page boxes are in order, so binary-search the last one starting above y.
    let lo = 1, hi = pageCount
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (pages[mid].offsetTop <= y) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  function updateCurrent() {
    const next = pinned ?? pageAt(container.scrollTop + container.clientHeight * CURRENT_PAGE_LINE)
    if (next !== current) {
      current = next
      onPageChange(current)
    }
  }

  let scrollFrame = 0
  const onScroll = () => {
    if (scrollFrame) return
    scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; if (!destroyed) updateCurrent() })
  }
  // Any scrolling by the user ends a pin.
  const unpin = () => { pinned = null }

  // ── drawing ───────────────────────────────────────────────────────────────

  function schedule(n) {
    if (near.has(n) && drawnAt.get(n) !== currentScale && !tasks.has(n) && !failed.has(n)) queue.add(n)
  }

  function pump() {
    while (!destroyed && active < MAX_CONCURRENT_RENDERS && queue.size) {
      // Draw the page closest to the current one first.
      let best = null
      for (const n of queue) if (best === null || Math.abs(n - current) < Math.abs(best - current)) best = n
      queue.delete(best)
      draw(best)
    }
  }

  async function draw(n) {
    active++
    const drawScale = currentScale
    const stale = () => destroyed || !near.has(n) || drawScale !== currentScale
    let canvas = null
    try {
      const page = await pdfDoc.getPage(n)
      if (learnSize(n, page)) resize([n])
      if (stale()) return
      const vp = page.getViewport({ scale: drawScale })
      let ratio = window.devicePixelRatio || 1
      if (vp.width * vp.height * ratio * ratio > MAX_CANVAS_PIXELS) {
        ratio = Math.sqrt(MAX_CANVAS_PIXELS / (vp.width * vp.height))
      }
      // Draw off-screen, then swap in, so the old drawing (stretched after a
      // zoom) stays visible until the new one is ready.
      canvas = document.createElement('canvas')
      canvas.width = Math.floor(vp.width * ratio)
      canvas.height = Math.floor(vp.height * ratio)
      const task = page.render({
        canvasContext: canvas.getContext('2d', { alpha: false }),
        viewport: vp,
        transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0],
      })
      tasks.set(n, task)
      await task.promise
      if (stale()) return
      freeCanvas(pages[n])
      pages[n].appendChild(canvas)
      canvas = null
      drawnAt.set(n, drawScale)
      firstDrawDone()
      onFirstDraw?.()
    } catch (e) {
      if (e?.name !== 'RenderingCancelledException' && !destroyed) {
        console.error(`Could not draw page ${n}`, e)
        failed.add(n)
      }
    } finally {
      if (canvas) canvas.width = canvas.height = 0
      tasks.delete(n)
      active--
      if (!destroyed) { schedule(n); pump() }
    }
  }

  function freeCanvas(el) {
    for (const c of el.querySelectorAll('canvas')) {
      c.width = c.height = 0 // releases the bitmap now rather than at GC
      c.remove()
    }
  }

  function release(n) {
    queue.delete(n)
    tasks.get(n)?.cancel()
    drawnAt.delete(n)
    failed.delete(n)
    if (pages[n]) freeCanvas(pages[n])
  }

  const observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const n = +e.target.dataset.page
      if (e.isIntersecting) near.add(n)
      else { near.delete(n); release(n) }
    }
    for (const n of near) schedule(n)
    pump()
  }, { root: container, rootMargin: PRERENDER_MARGIN })

  // ── public ────────────────────────────────────────────────────────────────

  // Jump straight to page n and hold it there until the user scrolls.
  function goTo(n) {
    if (destroyed) return
    pinned = clamp(n)
    scrollToPage(pinned)
    updateCurrent()
  }

  // Change zoom, keeping the same spot of the same page in view.
  function setScale(next) {
    if (destroyed || next === currentScale) return
    const anchor = pinned ?? current
    const el = pages[anchor]
    const fraction = el.offsetHeight ? (container.scrollTop - el.offsetTop) / el.offsetHeight : 0
    currentScale = next
    for (const t of tasks.values()) t.cancel()
    failed.clear()
    const wasPinned = pinned
    pinned = null
    resize(Array.from({ length: pageCount }, (_, i) => i + 1))
    pinned = wasPinned
    container.scrollTop = el.offsetTop + (pinned ? 0 : fraction * el.offsetHeight)
    for (const n of near) schedule(n)
    pump()
  }

  function destroy() {
    destroyed = true
    observer.disconnect()
    cancelAnimationFrame(scrollFrame)
    container.removeEventListener('scroll', onScroll)
    for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown']) container.removeEventListener(ev, unpin)
    for (const t of tasks.values()) t.cancel()
    for (let n = 1; n <= pageCount; n++) if (pages[n]) freeCanvas(pages[n])
  }

  // ── start ─────────────────────────────────────────────────────────────────

  container.addEventListener('scroll', onScroll, { passive: true })
  for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown']) {
    container.addEventListener(ev, unpin, { passive: true })
  }

  ;(async () => {
    try {
      // Size every box like page 1, plus the start page's real size, then jump.
      const first = await pdfDoc.getPage(1)
      if (destroyed) return
      learnSize(1, first)
      defaultSize = sizes[1]
      if (pinned !== 1) learnSize(pinned, await pdfDoc.getPage(pinned))
      if (destroyed) return
      resize(Array.from({ length: pageCount }, (_, i) => i + 1))
      scrollToPage(pinned)
      onPageChange(current)
      for (let n = 1; n <= pageCount; n++) observer.observe(pages[n])
      measureAll()
    } catch (e) {
      if (!destroyed) console.error('Could not lay out PDF', e)
    }
  })()

  return { goTo, setScale, destroy }
}
