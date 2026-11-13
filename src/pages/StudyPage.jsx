import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcProgress } from '../lib/progress'
import { flattenOutline, sectionsAfter, isValidRange, sectionPage } from '../lib/sections'
import AppBar from '../components/AppBar'
import Modal from '../components/Modal'
import ProgressBar from '../components/ProgressBar'
import styles from './StudyPage.module.css'

export default function StudyPage() {
  const { id: corpusId, studyId } = useParams()
  const [study, setStudy] = useState(null)
  const [corpus, setCorpus] = useState(null)
  const [sessions, setSessions] = useState([])
  const [notes, setNotes] = useState([])
  const [outline, setOutline] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', startSection: '', endSection: '', startPage: '', endPage: '' })
  const [usePageNumbers, setUsePageNumbers] = useState(false)
  const [error, setError] = useState(null)

  const load = async () => {
    const [
      { data: studyData },
      { data: corpusData },
      { data: sessionData },
    ] = await Promise.all([
      supabase.from('studies').select('id, name, resource_id, resources(name, outline)').eq('id', studyId).single(),
      supabase.from('corpora').select('id, name').eq('id', corpusId).single(),
      supabase.from('reading_sessions').select('*').eq('study_id', studyId).order('created_at'),
    ])

    setStudy(studyData)
    setCorpus(corpusData)
    setSessions(sessionData ?? [])
    setOutline(studyData?.resources?.outline ?? [])

    // Load notes only if there are sessions
    const sessionIds = (sessionData ?? []).map(s => s.id)
    if (sessionIds.length > 0) {
      const { data: noteData } = await supabase
        .from('notes')
        .select('content, reading_session_id, updated_at')
        .in('reading_session_id', sessionIds)
      setNotes(noteData ?? [])
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [studyId])

  const flat = flattenOutline(outline)
  const endSections = form.startSection ? sectionsAfter(outline, form.startSection) : flat

  const createSession = async (e) => {
    e.preventDefault()
    setError(null)

    let startPage, endPage, startSection, endSection

    if (usePageNumbers || flat.length === 0) {
      startPage = parseInt(form.startPage)
      endPage = parseInt(form.endPage)
      if (!startPage || !endPage || endPage <= startPage) {
        setError('End page must be greater than start page.')
        return
      }
    } else {
      if (!isValidRange(outline, form.startSection, form.endSection)) {
        setError('End section must come after start section.')
        return
      }
      startSection = form.startSection
      endSection = form.endSection
      startPage = sectionPage(outline, startSection) ?? 1
      endPage = sectionPage(outline, endSection) ?? startPage + 1
    }

    const { error } = await supabase.from('reading_sessions').insert({
      study_id: studyId,
      name: form.name.trim() || `${startSection ?? `p.${startPage}`} → ${endSection ?? `p.${endPage}`}`,
      start_section: startSection ?? null,
      end_section: endSection ?? null,
      start_page: startPage,
      end_page: endPage,
    })
    if (error) { setError(error.message); return }
    setForm({ name: '', startSection: '', endSection: '', startPage: '', endPage: '' })
    setCreating(false)
    load()
  }

  const noteFor = (sessionId) => notes.find(n => n.reading_session_id === sessionId)

  const previewText = (content) => {
    if (!content?.content) return ''
    const texts = []
    const walk = (nodes) => {
      for (const n of nodes ?? []) {
        if (n.text) texts.push(n.text)
        if (n.content) walk(n.content)
      }
    }
    walk(content.content)
    const full = texts.join(' ')
    return full.length > 120 ? full.slice(0, 120) + '…' : full
  }

  if (loading) return <div className={styles.root}><AppBar /></div>

  const { completed, total } = calcProgress(sessions)

  return (
    <div className={styles.root}>
      <AppBar
        crumbs={[
          { label: corpus?.name, to: `/corpus/${corpusId}` },
          { label: study?.name },
        ]}
      />
      <main className={styles.main}>
        <div className={styles.studyHeader}>
          <h1 className={styles.studyTitle}>{study?.name}</h1>
          <p className={styles.docName}>{study?.resources?.name}</p>
          {total > 0 && <ProgressBar completed={completed} total={total} />}
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Sessions</h2>
            <button className={styles.action} onClick={() => setCreating(true)}>
              + New session
            </button>
          </div>
          {sessions.length === 0 ? (
            <p className={styles.empty}>No sessions yet.</p>
          ) : (
            <ul className={styles.list}>
              {sessions.map(s => (
                <li key={s.id}>
                  <Link to={`/corpus/${corpusId}/study/${studyId}/session/${s.id}`} className={styles.sessionRow}>
                    <span className={styles.status}>{s.completed ? '✓' : '○'}</span>
                    <span className={styles.sessionName}>{s.name}</span>
                    <span className={styles.pages}>pp. {s.start_page}–{s.end_page}</span>
                    <span className={styles.arrow}>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {notes.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Notes</h2>
            </div>
            <ul className={styles.list}>
              {sessions.filter(s => noteFor(s.id)).map(s => {
                const note = noteFor(s.id)
                const preview = previewText(note.content)
                if (!preview) return null
                return (
                  <li key={s.id}>
                    <Link to={`/corpus/${corpusId}/study/${studyId}/session/${s.id}`} className={styles.noteRow}>
                      <span className={styles.noteSession}>{s.name}</span>
                      <p className={styles.notePreview}>{preview}</p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </main>

      {creating && (
        <Modal
          title="New reading session"
          onClose={() => { setCreating(false); setForm({ name: '', startSection: '', endSection: '', startPage: '', endPage: '' }); setError(null) }}
        >
          <form onSubmit={createSession} className={styles.form}>
            <input
              className={styles.input}
              placeholder="Session name (optional)"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus
            />
            {flat.length > 0 && (
              <button type="button" className={styles.toggle} onClick={() => setUsePageNumbers(p => !p)}>
                {usePageNumbers ? 'Use sections instead' : 'Use page numbers instead'}
              </button>
            )}
            {(usePageNumbers || flat.length === 0) ? (
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>From page</label>
                  <input className={styles.input} type="number" min="1" value={form.startPage} onChange={e => setForm(f => ({ ...f, startPage: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>To page</label>
                  <input className={styles.input} type="number" min="1" value={form.endPage} onChange={e => setForm(f => ({ ...f, endPage: e.target.value }))} />
                </div>
              </div>
            ) : (
              <>
                <div className={styles.field}>
                  <label className={styles.label}>From</label>
                  <select className={styles.select} value={form.startSection} onChange={e => setForm(f => ({ ...f, startSection: e.target.value, endSection: '' }))}>
                    <option value="">Select section…</option>
                    {flat.map((s, i) => <option key={i} value={s.title}>{s.title}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>To</label>
                  <select className={styles.select} value={form.endSection} onChange={e => setForm(f => ({ ...f, endSection: e.target.value }))} disabled={!form.startSection}>
                    <option value="">Select section…</option>
                    {endSections.map((s, i) => <option key={i} value={s.title}>{s.title}</option>)}
                  </select>
                </div>
              </>
            )}
            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.submit} type="submit">Create</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
