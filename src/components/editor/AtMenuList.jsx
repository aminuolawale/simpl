import styles from './EditorPopups.module.css'

// The list shown while typing "@…". Keyboard handling lives in NoteEditor;
// this only draws the items and handles the mouse.
export default function AtMenuList({ items, index, rect, onChoose, onHover }) {
  if (!rect || items.length === 0) return null
  return (
    <div
      className={styles.menu}
      style={{ top: rect.bottom + 6, left: rect.left }}
      role="listbox"
      aria-label="Insert"
      onMouseDown={e => e.preventDefault()} // keep the editor focused
    >
      {items.map((item, i) => (
        <button
          key={item.id}
          role="option"
          aria-selected={i === index}
          className={`${styles.item} ${i === index ? styles.selected : ''}`}
          onMouseEnter={() => onHover(i)}
          onClick={() => onChoose(item)}
        >
          <span className={styles.itemLabel}>{item.label}</span>
          {item.hint && <span className={styles.itemHint}>{item.hint}</span>}
        </button>
      ))}
    </div>
  )
}
