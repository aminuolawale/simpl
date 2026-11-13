import { useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './LoginPage.module.css'

const CALLBACK = `${window.location.origin}/auth/callback`

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
      options: { emailRedirectTo: CALLBACK },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSubmitted(true)
    }
  }

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: CALLBACK },
    })
    if (error) setError(error.message)
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
          <>
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

            <div className={styles.orRow}>
              <span className={styles.orLine} />
              <span className={styles.orLabel}>or</span>
              <span className={styles.orLine} />
            </div>

            <button className={styles.google} onClick={handleGoogle}>
              <GoogleIcon />
              Continue with Google
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M47.5 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h13.2c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.3-10.6 7.3-17.4z"/>
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.9-6c-2.1 1.4-4.9 2.3-8 2.3-6.1 0-11.3-4.1-13.2-9.7H2.7v6.2C6.7 42.8 14.8 48 24 48z"/>
      <path fill="#FBBC05" d="M10.8 28.8A14.9 14.9 0 0 1 10.8 19.2v-6.2H2.7A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.7 10.8l8.1-6z"/>
      <path fill="#EA4335" d="M24 9.5c3.4 0 6.5 1.2 8.9 3.5l6.6-6.6C35.9 2.5 30.4 0 24 0 14.8 0 6.7 5.2 2.7 13.2l8.1 6.2C12.7 13.6 17.9 9.5 24 9.5z"/>
    </svg>
  )
}
