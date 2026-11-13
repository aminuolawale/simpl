import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './AppBar.module.css'

export default function AppBar({ crumbs = [], actions }) {
  return (
    <header className={styles.bar}>
      <nav className={styles.crumbs}>
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
