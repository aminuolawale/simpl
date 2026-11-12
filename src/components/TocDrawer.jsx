import { usePdf } from '../context/PdfContext'
import styles from './TocDrawer.module.css'

export default function TocDrawer({ open }) {
  const { outline, currentPage } = usePdf()

  const scrollToPage = (pageNumber) => {
    if (!pageNumber) return
    const el = document.getElementById(`pdf-page-${pageNumber}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <aside className={`${styles.drawer} ${open ? styles.open : ''}`}>
      <div className={styles.inner}>
        <p className={styles.heading}>Contents</p>
        <div className={styles.divider} />
        {outline.length === 0 ? (
          <p className={styles.empty}>No outline available</p>
        ) : (
          <TocList items={outline} currentPage={currentPage} onNavigate={scrollToPage} depth={0} />
        )}
      </div>
    </aside>
  )
}

function TocList({ items, currentPage, onNavigate, depth }) {
  return (
    <ul className={styles.list}>
      {items.map((item, i) => (
        <TocItem
          key={i}
          item={item}
          currentPage={currentPage}
          onNavigate={onNavigate}
          depth={depth}
        />
      ))}
    </ul>
  )
}

function TocItem({ item, currentPage, onNavigate, depth }) {
  const active = item.pageNumber === currentPage

  return (
    <li>
      <button
        className={`${styles.item} ${active ? styles.active : ''}`}
        style={{ paddingLeft: `${16 + depth * 14}px` }}
        onClick={() => onNavigate(item.pageNumber)}
        title={item.title}
      >
        <span className={styles.itemText}>{item.title}</span>
        {item.pageNumber && (
          <span className={styles.itemPage}>{item.pageNumber}</span>
        )}
      </button>
      {item.items?.length > 0 && (
        <TocList items={item.items} currentPage={currentPage} onNavigate={onNavigate} depth={depth + 1} />
      )}
    </li>
  )
}
