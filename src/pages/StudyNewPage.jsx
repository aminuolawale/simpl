import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { currentUserId } from '../lib/resources'
import AppBar from '../components/AppBar'
import ResourcePicker from '../components/ResourcePicker'
import styles from '../styles/page.module.css'

// A study belongs to a corpus only if one is chosen here (preselected when
// starting from a corpus page). Picking a resource that sits in some corpus
// does not put the study in that corpus.
export default function StudyNewPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [name, setName] = useState('')
  const [corpusId, setCorpusId] = useState(params.get('corpus') ?? '')
  const [resourceIds, setResourceIds] = useState(params.get('resource') ? [params.get('resource')] : [])
  const [corpora, setCorpora] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.from('corpora').select('id, name').order('name').then(({ data }) => setCorpora(data ?? []))
  }, [])

  const fromCorpus = corpora.find(c => c.id === params.get('corpus'))

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    if (resourceIds.length === 0) { setError('Choose a PDF to study.'); return }
    setError(null)
    setSubmitting(true)
    try {
      const user_id = await currentUserId(supabase)
      const { data: study, error } = await supabase
        .from('studies')
        .insert({ user_id, name: name.trim(), resource_id: resourceIds[0], corpus_id: corpusId || null })
        .select('id')
        .single()
      if (error) throw error
      navigate(`/study/${study.id}`)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.root}>
      <AppBar
        crumbs={[
          ...(fromCorpus ? [{ label: fromCorpus.name, to: `/corpus/${fromCorpus.id}` }] : []),
          { label: 'New study' },
        ]}
      />
      <main className={`${styles.main} ${styles.narrow}`}>
        <form onSubmit={submit} className={`${styles.form} ${styles.formSpacious}`}>
          <div className={styles.field}>
            <label className={styles.label}>Study name</label>
            <input
              className={styles.input}
              placeholder="e.g. Chalmers Reading"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Document</label>
            <ResourcePicker value={resourceIds} onChange={setResourceIds} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Corpus (optional)</label>
            <select className={styles.select} value={corpusId} onChange={e => setCorpusId(e.target.value)}>
              <option value="">None (standalone study)</option>
              {corpora.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.submit} type="submit" disabled={submitting || !name.trim() || resourceIds.length === 0}>
            {submitting ? 'Creating…' : 'Create study'}
          </button>
        </form>
      </main>
    </div>
  )
}
