import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AppBar from '../components/AppBar'
import Modal from '../components/Modal'
import styles from './CorporaPage.module.css'

export default function CorporaPage() {
  const [corpora, setCorpora] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState(null)

  const load = async () => {
    const { data, error } = await supabase
      .from('corpora')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
    if (!error) setCorpora(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('corpora').insert({ name: name.trim(), user_id: user.id })
    if (error) { setError(error.message); return }
    setName('')
    setCreating(false)
    load()
  }

  return (
    <div className={styles.root}>
      <AppBar
        actions={
          <button className={styles.action} onClick={() => setCreating(true)}>
            + New corpus
          </button>
        }
      />
      <main className={styles.main}>
        {loading ? (
          <p className={styles.empty}>Loading…</p>
        ) : corpora.length === 0 ? (
          <p className={styles.empty}>No corpora yet. Create one to get started.</p>
        ) : (
          <ul className={styles.list}>
            {corpora.map(c => (
              <li key={c.id}>
                <Link to={`/corpus/${c.id}`} className={styles.row}>
                  <span className={styles.corpusName}>{c.name}</span>
                  <span className={styles.arrow}>→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      {creating && (
        <Modal title="New corpus" onClose={() => { setCreating(false); setName(''); setError(null) }}>
          <form onSubmit={create} className={styles.form}>
            <input
              className={styles.input}
              placeholder="Corpus name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.submit} type="submit" disabled={!name.trim()}>
              Create
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
