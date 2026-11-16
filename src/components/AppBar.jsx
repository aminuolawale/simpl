import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useShell } from './AppShell'
import styles from './AppBar.module.css'

export default function AppBar({ crumbs = [], actions }) {
  // Beside the side nav (which shows the wordmark), the bar starts with the crumbs.
  const shell = useShell()
  return (
    <header className={`${styles.bar} ${shell ? styles.inShell : ''}`}>
      <nav className={styles.crumbs}>
        {shell && (
          <button className={styles.menu} onClick={shell.openNav} aria-label="Open navigation">Menu</button>
        )}
        <Link to="/" className={styles.wordmark}>simpl</Link>
        {crumbs.map((c, i) => (
          <span key={i} className={styles.crumbGroup}>
            <span className={styles.sep}>/</span>
            {c.to
              ? <Link to={c.to} className={styles.crumb}>{c.label}</Link>
              : <span className={styles.crumbCurrent}>{c.label}</span>
            }
          </span>
        ))}
      </nav>
      <div className={styles.right}>
        {actions}
        <button
          className={styles.signOut}
          onClick={() => supabase.auth.signOut()}
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
