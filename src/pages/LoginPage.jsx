import { useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSubmitted(true)
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.inner}>
        <span className={styles.wordmark}>simpl</span>
        <div className={styles.divider} />

        {submitted ? (
          <div className={styles.check}>
            <p className={styles.checkTitle}>Check your inbox</p>
            <p className={styles.checkBody}>
              We sent a link to <em>{email}</em>.<br />
              Click it to sign in.
            </p>
            <button className={styles.retry} onClick={() => { setSubmitted(false); setEmail('') }}>
              Use a different email
            </button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <p className={styles.prompt}>Sign in to continue</p>
            <input
              className={styles.input}
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            <button className={styles.submit} type="submit" disabled={loading || !email}>
              {loading ? 'Sending…' : 'Send link'}
            </button>
            {error && <p className={styles.error}>{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
