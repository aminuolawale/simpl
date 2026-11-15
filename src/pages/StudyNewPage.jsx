import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { uploadResource } from '../lib/storage'
import { extractOutline } from '../lib/pdf'
import AppBar from '../components/AppBar'
import styles from './StudyNewPage.module.css'

export default function StudyNewPage() {
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const [name, setName] = useState('')
  const [mode, setMode] = useState('existing') // 'existing' | 'upload'
  const [resources, setResources] = useState([]) // { id, name, corpus_id, corpusName }
  const [corpora, setCorpora] = useState([])
  const [selectedResourceId, setSelectedResourceId] = useState('')
  const [file, setFile] = useState(null)
  const [uploadCorpusId, setUploadCorpusId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      const [{ data: resourceData }, { data: corporaData }] = await Promise.all([
        supabase
          .from('resources')
          .select('id, name, corpus_id, corpora(name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('corpora')
          .select('id, name')
          .order('name'),
      ])
      setResources(
        (resourceData ?? []).map(r => ({
          id: r.id,
          name: r.name,
          corpus_id: r.corpus_id,
          corpusName: r.corpora?.name ?? '',
        }))
      )
      setCorpora(corporaData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // Group resources by corpus for the picker
  const grouped = resources.reduce((acc, r) => {
    if (!acc[r.corpus_id]) acc[r.corpus_id] = { name: r.corpusName, items: [] }
    acc[r.corpus_id].items.push(r)
    return acc
  }, {})

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      let corpusId, resourceId

      if (mode === 'existing') {
        if (!selectedResourceId) { setError('Select a document.'); setSubmitting(false); return }
        const resource = resources.find(r => r.id === selectedResourceId)
        corpusId = resource.corpus_id
        resourceId = selectedResourceId
      } else {
        if (!file) { setError('Choose a PDF to upload.'); setSubmitting(false); return }
        if (!uploadCorpusId) { setError('Choose a corpus for this document.'); setSubmitting(false); return }
        corpusId = uploadCorpusId
        const [path, outline] = await Promise.all([
          uploadResource(supabase, user.id, corpusId, file),
          extractOutline(file),
        ])
        const { data: newResource, error: resourceError } = await supabase
          .from('resources')
          .insert({ corpus_id: corpusId, name: file.name, storage_path: path, size_bytes: file.size, outline })
          .select('id')
          .single()
        if (resourceError) throw resourceError
        resourceId = newResource.id
      }

      const { data: study, error: studyError } = await supabase
        .from('studies')
        .insert({ corpus_id: corpusId, resource_id: resourceId, user_id: user.id, name: name.trim() })
        .select('id')
        .single()
      if (studyError) throw studyError

      navigate(`/corpus/${corpusId}/study/${study.id}`)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.root}>
      <AppBar crumbs={[{ label: 'New study' }]} />
      <main className={styles.main}>
        <form onSubmit={handleSubmit} className={styles.form}>
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
            <div className={styles.modeRow}>
              <button
                type="button"
                className={`${styles.modeBtn} ${mode === 'existing' ? styles.modeActive : ''}`}
                onClick={() => setMode('existing')}
              >
                Choose existing
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${mode === 'upload' ? styles.modeActive : ''}`}
                onClick={() => setMode('upload')}
              >
                Upload new PDF
              </button>
            </div>
          </div>

          {mode === 'existing' && (
            <div className={styles.field}>
              {loading ? (
                <p className={styles.hint}>Loading resources…</p>
              ) : resources.length === 0 ? (
                <p className={styles.hint}>No resources yet. Upload a PDF first.</p>
              ) : (
                <div className={styles.resourceList}>
                  {Object.entries(grouped).map(([corpusId, group]) => (
                    <div key={corpusId} className={styles.group}>
                      <p className={styles.groupLabel}>{group.name}</p>
                      {group.items.map(r => (
                        <button
                          key={r.id}
                          type="button"
                          className={`${styles.resourceRow} ${selectedResourceId === r.id ? styles.resourceSelected : ''}`}
                          onClick={() => setSelectedResourceId(r.id)}
                        >
                          <span className={styles.resourceName}>{r.name}</span>
                          {selectedResourceId === r.id && <span className={styles.check}>✓</span>}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'upload' && (
            <div className={styles.field}>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className={styles.hidden}
                onChange={e => setFile(e.target.files[0] ?? null)}
              />
              <button
                type="button"
                className={styles.fileBtn}
                onClick={() => fileRef.current.click()}
              >
                {file ? file.name : 'Browse PDF…'}
              </button>

              <label className={`${styles.label} ${styles.labelSpaced}`}>Corpus</label>
              {corpora.length === 0 ? (
                <p className={styles.hint}>Create a corpus first.</p>
              ) : (
                <select
                  className={styles.select}
                  value={uploadCorpusId}
                  onChange={e => setUploadCorpusId(e.target.value)}
                >
                  <option value="">Select corpus…</option>
                  {corpora.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <button
            className={styles.submit}
            type="submit"
            disabled={submitting || !name.trim()}
          >
            {submitting ? 'Creating…' : 'Create study'}
          </button>
        </form>
      </main>
    </div>
  )
}
