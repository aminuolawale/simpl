import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { currentUserId } from '../lib/resources'
import { linkResources } from '../lib/links'
import AppBar from '../components/AppBar'
import ResourcePicker from '../components/ResourcePicker'
import styles from '../styles/page.module.css'

export default function CorpusNewPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [resourceIds, setResourceIds] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const user_id = await currentUserId(supabase)
      const { data: corpus, error } = await supabase
        .from('corpora')
        .insert({ name: name.trim(), user_id })
        .select('id')
        .single()
      if (error) throw error
      await linkResources(supabase, corpus.id, resourceIds)
      navigate(`/corpus/${corpus.id}`)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.root}>
      <AppBar crumbs={[{ label: 'New corpus' }]} />
      <main className={`${styles.main} ${styles.narrow}`}>
        <form onSubmit={submit} className={`${styles.form} ${styles.formSpacious}`}>
          <div className={styles.field}>
            <label className={styles.label}>Corpus name</label>
            <input
              className={styles.input}
              placeholder="e.g. Philosophy of mind"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Resources (optional)</label>
            <ResourcePicker multiple value={resourceIds} onChange={setResourceIds} />
          </div>

          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.submit} type="submit" disabled={submitting || !name.trim()}>
            {submitting ? 'Creating…' : resourceIds.length
              ? `Create with ${resourceIds.length} PDF${resourceIds.length === 1 ? '' : 's'}`
              : 'Create corpus'}
          </button>
        </form>
      </main>
    </div>
  )
}
