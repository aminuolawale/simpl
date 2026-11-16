import { useCallback, useRef, useState } from 'react'
import styles from './PaneDivider.module.css'

const STORAGE_KEY = 'simpl.notePaneWidth'
export const NOTE_MIN = 300
export const PDF_MIN = 280
const KEY_STEP = 24

function readStored() {
  try {
    const n = parseInt(localStorage.getItem(STORAGE_KEY), 10)
    return Number.isFinite(n) && n >= NOTE_MIN ? n : null
  } catch { return null }
}

function store(width) {
  try {
    if (width == null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, String(Math.round(width)))
  } catch {}
}

// Width of the note pane beside the PDF, in px, remembered across pages and
// visits. `null` means the default split from the stylesheet.
export function useNotePaneWidth() {
  const [width, setWidth] = useState(readStored)
  const update = useCallback((w) => { setWidth(w); store(w) }, [])
  return [width, update]
}

// The draggable bar between the PDF pane (before it) and the note pane (after it).
// Drag or use the arrow keys to resize; double-click to reset.
export default function PaneDivider({ width, onChange }) {
  const ref = useRef(null)
  const [dragging, setDragging] = useState(false)

  // Current pane widths, read from the DOM so this works before any width is set.
  const measure = () => {
    const pdf = ref.current?.previousElementSibling
    const note = ref.current?.nextElementSibling
    return { pdf: pdf?.offsetWidth ?? 0, note: note?.offsetWidth ?? 0 }
  }
  const clamp = (w, { pdf, note }) => Math.max(NOTE_MIN, Math.min(w, note + pdf - PDF_MIN))

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    const start = measure()
    const startX = e.clientX
    ref.current.setPointerCapture(e.pointerId)
    setDragging(true)
    const move = (ev) => onChange(clamp(start.note + (startX - ev.clientX), start))
    const up = () => {
      ref.current?.removeEventListener('pointermove', move)
      ref.current?.removeEventListener('pointerup', up)
      ref.current?.removeEventListener('pointercancel', up)
      setDragging(false)
    }
    ref.current.addEventListener('pointermove', move)
    ref.current.addEventListener('pointerup', up)
    ref.current.addEventListener('pointercancel', up)
  }

  const onKeyDown = (e) => {
    const step = e.key === 'ArrowLeft' ? KEY_STEP : e.key === 'ArrowRight' ? -KEY_STEP : 0
    if (!step) return
    e.preventDefault()
    const m = measure()
    onChange(clamp(m.note + step, m))
  }

  const current = width ?? measure().note
  return (
    <div
      ref={ref}
      className={`${styles.divider} ${dragging ? styles.dragging : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panes"
      aria-valuenow={current ? Math.round(current) : undefined}
      aria-valuemin={NOTE_MIN}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onChange(null)}
    >
      {/* While dragging, cover the page so the PDF and editor don't grab the pointer or select text */}
      {dragging && <div className={styles.shield} />}
    </div>
  )
}
