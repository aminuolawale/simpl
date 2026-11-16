import { useState } from 'react'
import Modal from './Modal'
import styles from './ChooseModal.module.css'

// A modal listing options to pick one from, e.g. "Add to corpus" or "Attach to
// session". `items` are { id, label, sub? }. `onChoose` may be async; errors are
// shown in the modal.
export default function ChooseModal({ title, items, emptyText = 'Nothing to choose from.', onChoose, onClose }) {
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const choose = async (item) => {
    setBusyId(item.id)
    setError(null)
    try {
      await onChoose(item)
    } catch (e) {
      setError(e.message)
      setBusyId(null)
    }
  }

  return (
    <Modal title={title} onClose={busyId ? () => {} : onClose}>
      {items.length === 0 ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        <ul className={styles.list}>
          {items.map(item => (
            <li key={item.id ?? 'none'}>
              <button
                type="button"
                className={styles.row}
                onClick={() => choose(item)}
                disabled={busyId !== null}
              >
                <span className={styles.label}>{item.label}</span>
                {item.sub && <span className={styles.sub}>{item.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </Modal>
  )
}
