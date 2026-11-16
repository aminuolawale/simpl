import styles from '../styles/page.module.css'

// A titled page section with optional header actions.
export default function Section({ title, action, children }) {
  return (
    <section>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {action && <div className={styles.actions}>{action}</div>}
      </div>
      {children}
    </section>
  )
}

export function Empty({ children }) {
  return <p className={styles.empty}>{children}</p>
}
