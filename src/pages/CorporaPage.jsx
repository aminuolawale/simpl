import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AppBar from '../components/AppBar'
import Modal from '../components/Modal'
import ConfirmDelete, { RowDeleteButton } from '../components/ConfirmDelete'
import { deleteCorpus, plural } from '../lib/deletion'
import styles from './CorporaPage.module.css'

export default function CorporaPage() {
  const navigate = useNavigate()
  const [corpora, setCorpora] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(null) // corpus pending deletion

  const load = async () => {
    const { data, error } = await supabase
      .from('corpora')
      .select('id, name, created_at, resources(count), studies(count)')
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
          <div className={styles.actions}>
            <button className={styles.action} onClick={() => navigate('/study/new')}>
              + New study
            </button>
            <button className={styles.action} onClick={() => setCreating(true)}>
              + New corpus
            </button>
          </div>
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
              <li key={c.id} className={styles.item}>
                <Link to={`/corpus/${c.id}`} className={styles.row}>
                  <span className={styles.corpusName}>{c.name}</span>
                  <span className={styles.arrow}>→</span>
                </Link>
                <RowDeleteButton label={`Delete ${c.name}`} onClick={() => setDeleting(c)} />
              </li>
            ))}
          </ul>
        )}
      </main>

      {deleting && (
        <ConfirmDelete
          title="Delete corpus"
          message={corpusDeleteMessage(deleting)}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteCorpus(supabase, deleting.id)
            setDeleting(null)
            load()
          }}
        />
      )}

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

function corpusDeleteMessage(c) {
  const resources = c.resources?.[0]?.count ?? 0
  const studies = c.studies?.[0]?.count ?? 0
  const parts = []
  if (resources) parts.push(plural(resources, 'PDF'))
  if (studies) parts.push(`${plural(studies, 'study', 'studies')} with their sessions and notes`)
  return parts.length
    ? `“${c.name}” and everything in it will be deleted: ${parts.join(' and ')}.`
    : `“${c.name}” will be deleted.`
}
