import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CLIP_MIME, makeClip, useClipTarget } from '../lib/clip'
import styles from './PdfClipper.module.css'

const MIN_DRAG = 4  // px before a press becomes a selection
const MIN_SIZE = 8  // px; smaller selections are dropped

const clamp01 = v => Math.min(1, Math.max(0, v))

// Drag on a PDF page to draw a box around an equation, then drag the box into
// the note (or press Insert). Active only while a note editor is open beside
// the PDF to receive clips.
export default function PdfClipper({ containerRef, pagesRef, pdfDoc, docId }) {
  const target = useClipTarget()
  // { page, rect, drawing, clip, error } — rect is fractions of the page.
  const [sel, setSel] = useState(null)
  const dragImage = useRef(null)
  const enabled = !!target && !!pdfDoc

  useEffect(() => { setSel(null) }, [pdfDoc, enabled])

  // Crosshair over pages while clipping is available.
  useEffect(() => {
    const container = containerRef.current
    if (!enabled || !container) return
    container.dataset.clipping = ''
    return () => { delete container.dataset.clipping }
  }, [containerRef, enabled])

  // Draw a selection with the mouse or pen (touch keeps scrolling).
  useEffect(() => {
    const container = containerRef.current
    if (!enabled || !container) return
    const onDown = (e) => {
      if (e.button !== 0 || e.pointerType === 'touch') return
      if (e.target.closest('[data-clip-ui]')) return
      const box = e.target.closest('[data-page]')
      if (!box) { setSel(null); return }
      e.preventDefault()
      const page = +box.dataset.page
      const at = (ev) => {
        const r = box.getBoundingClientRect()
        return { x: clamp01((ev.clientX - r.left) / r.width), y: clamp01((ev.clientY - r.top) / r.height), w: r.width, h: r.height }
      }
      const start = at(e)
      const startX = e.clientX, startY = e.clientY
      let rect = null
      const move = (ev) => {
        if (!rect && Math.hypot(ev.clientX - startX, ev.clientY - startY) < MIN_DRAG) return
        const p = at(ev)
        rect = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) }
        setSel({ page, rect, drawing: true })
      }
      const up = (ev) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        const p = at(ev)
        if (!rect || rect.w * p.w < MIN_SIZE || rect.h * p.h < MIN_SIZE) { setSel(null); return }
        setSel({ page, rect, drawing: false, clip: null })
        makeClip(pdfDoc, { resourceId: docId, page, rect })
          .then(clip => {
            const img = new Image()
            img.src = clip.thumb
            dragImage.current = img
            setSel(s => (s?.rect === rect ? { ...s, clip } : s))
          })
          .catch(() => setSel(s => (s?.rect === rect ? { ...s, error: true } : s)))
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    }
    container.addEventListener('pointerdown', onDown)
    return () => container.removeEventListener('pointerdown', onDown)
  }, [containerRef, enabled, pdfDoc, docId])

  // Escape clears the selection.
  useEffect(() => {
    if (!sel) return
    const onKey = (e) => { if (e.key === 'Escape') setSel(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sel])

  const box = sel && pagesRef.current[sel.page]
  if (!enabled || !box) return null

  const { rect, clip } = sel
  const onDragStart = (e) => {
    if (!clip) { e.preventDefault(); return }
    e.dataTransfer.setData(CLIP_MIME, clip.id)
    e.dataTransfer.effectAllowed = 'copy'
    if (dragImage.current?.complete) e.dataTransfer.setDragImage(dragImage.current, 12, 12)
  }
  const onDragEnd = (e) => { if (e.dataTransfer.dropEffect !== 'none') setSel(null) }

  return createPortal(
    <div
      data-clip-ui
      className={`${styles.selection} ${sel.drawing ? styles.drawing : ''}`}
      style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
      draggable={!!clip}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      aria-label="Selected equation"
    >
      {!sel.drawing && (
        <div className={styles.actions} onPointerDown={e => e.stopPropagation()}>
          {sel.error ? (
            <span className={styles.hint}>Couldn’t capture this area</span>
          ) : (
            <>
              <span className={styles.hint}>{clip ? 'Drag into your note' : 'Capturing…'}</span>
              <button
                className={styles.action}
                disabled={!clip}
                onClick={() => { target.insert(clip); setSel(null) }}
              >Insert</button>
            </>
          )}
          <button className={styles.action} onClick={() => setSel(null)} aria-label="Clear selection">×</button>
        </div>
      )}
    </div>,
    box,
  )
}
