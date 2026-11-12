import { usePdf } from '../context/PdfContext'
import { supabase } from '../lib/supabase'
import styles from './TopBar.module.css'

export default function TopBar({ drawerOpen, onToggleDrawer, onClose }) {
  const { currentPage, pageCount, fileName } = usePdf()

  const signOut = () => supabase.auth.signOut()

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <button className={styles.icon} onClick={onToggleDrawer} title="Table of contents">
          <HamburgerIcon open={drawerOpen} />
        </button>
        <span className={styles.wordmark}>simpl</span>
      </div>

      <div className={styles.center}>
        <span className={styles.filename}>{fileName}</span>
      </div>

      <div className={styles.right}>
        {pageCount > 0 && (
          <span className={styles.pageCount}>
            {currentPage} <span className={styles.separator}>/</span> {pageCount}
          </span>
        )}
        <button className={styles.icon} onClick={onClose} title="Close">
          <CloseIcon />
        </button>
        <button className={styles.signOut} onClick={signOut} title="Sign out">
          Sign out
        </button>
      </div>
    </header>
  )
}

function HamburgerIcon({ open }) {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="1" x2="16" y2="1" stroke="currentColor" strokeWidth="1" />
      <line
        x1="0" y1="6" x2={open ? "10" : "16"} y2="6"
        stroke="currentColor" strokeWidth="1"
        style={{ transition: 'x2 0.2s' }}
      />
      <line x1="0" y1="11" x2="16" y2="11" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1" />
      <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}
