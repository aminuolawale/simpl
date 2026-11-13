import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'
import { supabase } from '../lib/supabase'
import { uploadResource } from '../lib/storage'
import AppBar from '../components/AppBar'
import Modal from '../components/Modal'
import ProgressBar from '../components/ProgressBar'
import styles from './CorpusPage.module.css'

async function extractOutline(file) {
  const ab = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise
  const raw = await pdf.getOutline()
  if (!raw) return []
  const resolved = await Promise.all(raw.map(async function walk(item) {
    let pageNumber = null
    try {
      let dest = item.dest
      if (typeof dest === 'string') dest = await pdf.getDestination(dest)
      if (Array.isArray(dest) && dest[0]) pageNumber = (await pdf.getPageIndex(dest[0])) + 1
    } catch {}
    return { title: item.title, pageNumber, items: await Promise.all((item.items || []).map(walk)) }
  }))
  return resolved
}

export default function CorpusPage() {
  const { id } = useParams()
  const [corpus, setCorpus] = useState(null)
  const [resources, setResources] = useState([])
  const [studies, setStudies] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [creatingStudy, setCreatingStudy] = useState(false)
  const [studyName, setStudyName] = useState('')
  const [studyResourceId, setStudyResourceId] = useState('')
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const load = async () => {
    const [
      { data: corpusData },
      { data: resourceData },
      { data: studyData },
    ] = await Promise.all([
      supabase.from('corpora').select('id, name').eq('id', id).single(),
      supabase.from('resources').select('id, name, size_bytes, created_at').eq('corpus_id', id).order('created_at'),
      supabase.from('studies')
        .select('id, name, resource_id, resources(name), reading_sessions(id, completed)')
        .eq('corpus_id', id)
        .order('created_at'),
    ])
    setCorpus(corpusData)
    setResources(resourceData ?? [])
    setStudies(studyData ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const handlePdfUpload = async (file) => {
    if (!file || file.type !== 'application/pdf') return
    setUploadingPdf(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const [path, outline] = await Promise.all([
        uploadResource(supabase, user.id, id, file),
        extractOutline(file),
      ])
      await supabase.from('resources').insert({
        corpus_id: id,
        name: file.name,
        storage_path: path,
        size_bytes: file.size,
        outline,
      })
      load()
    } catch (e) {
      setError(e.message)
    }
    setUploadingPdf(false)
  }

  const createStudy = async (e) => {
    e.preventDefault()
    if (!studyName.trim() || !studyResourceId) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('studies').insert({
      corpus_id: id,
      resource_id: studyResourceId,
      user_id: user.id,
      name: studyName.trim(),
    })
    if (error) { setError(error.message); return }
    setStudyName('')
    setStudyResourceId('')
    setCreatingStudy(false)
    load()
  }

  const fmtSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading) return <div className={styles.root}><AppBar /></div>

  return (
    <div className={styles.root}>
      <AppBar crumbs={[{ label: corpus?.name }]} />
      <main className={styles.main}>
        {error && <p className={styles.error}>{error}</p>}

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Resources</h2>
            <button
              className={styles.action}
              onClick={() => fileRef.current.click()}
              disabled={uploadingPdf}
            >
              {uploadingPdf ? 'Uploading…' : '+ Add PDF'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className={styles.hidden}
              onChange={e => handlePdfUpload(e.target.files[0])}
            />
          </div>
          {resources.length === 0 ? (
            <p className={styles.empty}>No resources yet.</p>
          ) : (
            <ul className={styles.list}>
              {resources.map(r => (
                <li key={r.id} className={styles.resourceRow}>
                  <span className={styles.resourceName}>{r.name}</span>
                  <span className={styles.meta}>{fmtSize(r.size_bytes)}</span>
                  <span className={styles.meta}>{fmtDate(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Studies</h2>
            {resources.length > 0 && (
              <button className={styles.action} onClick={() => setCreatingStudy(true)}>
                + New study
              </button>
            )}
          </div>
          {studies.length === 0 ? (
            <p className={styles.empty}>No studies yet.</p>
          ) : (
            <ul className={styles.list}>
              {studies.map(s => {
                const sessions = s.reading_sessions ?? []
                const completed = sessions.filter(r => r.completed).length
                return (
                  <li key={s.id}>
                    <Link to={`/corpus/${id}/study/${s.id}`} className={styles.studyRow}>
                      <div className={styles.studyInfo}>
                        <span className={styles.studyName}>{s.name}</span>
                        <span className={styles.studyDoc}>{s.resources?.name}</span>
                      </div>
                      {sessions.length > 0 && (
                        <ProgressBar completed={completed} total={sessions.length} />
                      )}
                      <span className={styles.arrow}>→</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>

      {creatingStudy && (
        <Modal title="New study" onClose={() => { setCreatingStudy(false); setStudyName(''); setStudyResourceId(''); setError(null) }}>
          <form onSubmit={createStudy} className={styles.form}>
            <input
              className={styles.input}
              placeholder="Study name"
              value={studyName}
              onChange={e => setStudyName(e.target.value)}
              autoFocus
            />
            <select
              className={styles.select}
              value={studyResourceId}
              onChange={e => setStudyResourceId(e.target.value)}
              required
            >
              <option value="">Select a document…</option>
              {resources.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.submit} type="submit" disabled={!studyName.trim() || !studyResourceId}>
              Create
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
