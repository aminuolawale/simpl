import { useState } from 'react'
import { usePdf } from '../context/PdfContext'
import styles from './SessionDock.module.css'

export default function SessionDock({ drawerOpen, onToggleDrawer, startPage, endPage }) {
  const [open, setOpen] = useState(false)
  const { scale, zoomIn, zoomOut } = usePdf()

  const goTo = (page) => {
    const el = document.getElementById(`pdf-page-${page}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const zoomPercent = Math.round(scale * 100)

  return (
    <div
      className={`${styles.dock} ${open ? styles.open : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className={styles.handle} aria-hidden="true" />

      <div className={styles.controls}>
        <button
          className={`${styles.btn} ${drawerOpen ? styles.active : ''}`}
          onClick={onToggleDrawer}
          title="Table of contents"
        >
          Contents
        </button>

        <span className={styles.sep} />

        {startPage && (
          <button className={styles.btn} onClick={() => goTo(startPage)} title={`Jump to p. ${startPage}`}>
            Start
          </button>
        )}
        {endPage && (
          <button className={styles.btn} onClick={() => goTo(endPage)} title={`Jump to p. ${endPage}`}>
            End
          </button>
        )}

        <span className={styles.sep} />

        <div className={styles.zoom}>
          <button className={styles.zoomBtn} onClick={zoomOut} disabled={scale <= 0.4} title="Zoom out">−</button>
          <span className={styles.zoomLabel}>{zoomPercent}%</span>
          <button className={styles.zoomBtn} onClick={zoomIn} disabled={scale >= 3} title="Zoom in">+</button>
        </div>
      </div>
    </div>
  )
}
