import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './LoginPage.module.css'

// Where the sign-in email's link lands. Supabase puts the session in the
// link: as #access_token=… (the client's default implicit flow, read by the
// client itself when it starts) or as ?code=… (PKCE, exchanged here). Either
// way, wait until the session exists before going in; show why if it fails.
export default function CallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const started = useRef(false) // a code can be exchanged only once (StrictMode runs effects twice)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const finish = async () => {
      const url = new URL(window.location.href)
      const hash = new URLSearchParams(url.hash.slice(1))
      const linkError = url.searchParams.get('error_description') || hash.get('error_description')
      if (linkError) { setError(linkError); return }

      const code = url.searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { setError(error.message); return }
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('This sign-in link is invalid or has expired.'); return }
      navigate('/', { replace: true })
    }

    finish().catch(e => setError(e.message || 'Sign-in failed.'))
  }, [navigate])

  return (
    <div className={styles.root}>
      <div className={styles.inner}>
        <span className={styles.wordmark}>simpl</span>
        <div className={styles.divider} />
        {error ? (
          <div className={styles.check}>
            <p className={styles.checkTitle}>Couldn’t sign you in</p>
            <p className={styles.checkBody}>{error}</p>
            <Link className={styles.retry} to="/login">Send a new link</Link>
          </div>
        ) : (
          <p className={styles.checkBody}>Signing you in…</p>
        )}
      </div>
    </div>
  )
}
