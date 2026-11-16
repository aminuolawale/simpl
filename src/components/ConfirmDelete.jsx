import { useState } from 'react'
import Modal from './Modal'
import styles from './ConfirmDelete.module.css'

// Confirmation dialog for destructive actions.
// `onConfirm` may be async; errors are shown in the dialog.
export default function ConfirmDelete({ title, message, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={busy ? () => {} : onClose}>
      <div className={styles.body}>
        <p className={styles.message}>{message}</p>
        <p className={styles.warning}>This cannot be undone.</p>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.buttons}>
          <button className={styles.cancel} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className={styles.confirm} onClick={confirm} disabled={busy} autoFocus>
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// Small inline action button for list rows (e.g. "Remove", "Delete"). Hidden
// until the row is hovered (always visible on touch devices). Must be a direct
// child of the row's <li>.
export function RowAction({ onClick, label, children }) {
  return (
    <button
      type="button"
      className={styles.rowBtn}
      onClick={e => { e.preventDefault(); e.stopPropagation(); onClick() }}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  )
}

export function RowDeleteButton({ onClick, label }) {
  return <RowAction onClick={onClick} label={label}>Delete</RowAction>
}
