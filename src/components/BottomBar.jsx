import { usePdf } from '../context/PdfContext'
import styles from './BottomBar.module.css'

export default function BottomBar() {
  const { currentPage, pageCount, scale, zoomIn, zoomOut } = usePdf()

  const goTo = (pageNum) => {
    const el = document.getElementById(`pdf-page-${pageNum}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const prev = () => goTo(Math.max(1, currentPage - 1))
  const next = () => goTo(Math.min(pageCount, currentPage + 1))

  const zoomPercent = Math.round(scale * 100)

  return (
    <footer className={styles.bar}>
      <div className={styles.nav}>
        <button
          className={styles.navBtn}
          onClick={prev}
          disabled={currentPage <= 1}
          title="Previous page"
        >
          <ChevronLeft />
        </button>
        <button
          className={styles.navBtn}
          onClick={next}
          disabled={currentPage >= pageCount}
          title="Next page"
        >
          <ChevronRight />
        </button>
      </div>

      <div className={styles.zoom}>
        <button
          className={styles.zoomBtn}
          onClick={zoomOut}
          disabled={scale <= 0.4}
          title="Zoom out"
        >
          −
        </button>
        <span className={styles.zoomLabel}>{zoomPercent}%</span>
        <button
          className={styles.zoomBtn}
          onClick={zoomIn}
          disabled={scale >= 3}
          title="Zoom in"
        >
          +
        </button>
      </div>
    </footer>
  )
}

function ChevronLeft() {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
      <path d="M6 1L1 6L6 11" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
      <path d="M1 1L6 6L1 11" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
