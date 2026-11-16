import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcProgress } from '../lib/progress'
import { currentUserId } from '../lib/resources'
import { deleteStudy, deleteSession, deleteNote, plural } from '../lib/deletion'
import { notePreview } from '../lib/notes'
import { notifyDataChanged } from '../lib/events'
import AppBar from '../components/AppBar'
import Modal from '../components/Modal'
import ProgressBar from '../components/ProgressBar'
import SessionForm from '../components/SessionForm'
import Section, { Empty } from '../components/Section'
import ConfirmDelete, { RowDeleteButton } from '../components/ConfirmDelete'
import styles from '../styles/page.module.css'

export default function StudyPage() {
  const { studyId } = useParams()
  const navigate = useNavigate()
  const [study, setStudy] = useState(null)
  const [sessions, setSessions] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null) // { name, corpusId, corpora }
  const [pendingDelete, setPendingDelete] = useState(null) // { title, message, run }

  const load = async () => {
    const [{ data: studyData }, { data: sessionData }] = await Promise.all([
      supabase.from('studies')
        .select('id, name, corpus_id, resource_id, corpora(id, name), resources(id, name, outline)')
        .eq('id', studyId)
        .single(),
      supabase.from('reading_sessions').select('*').eq('study_id', studyId).order('created_at'),
    ])
    setStudy(studyData)
    setSessions(sessionData ?? [])

    const sessionIds = (sessionData ?? []).map(s => s.id)
    if (sessionIds.length > 0) {
      const { data: noteData } = await supabase
        .from('notes')
        .select('id, content, reading_session_id')
        .in('reading_session_id', sessionIds)
      setNotes(noteData ?? [])
    } else {
      setNotes([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [studyId])

  const run = async (action) => {
    setError(null)
    try {
      await action()
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const confirm = (title, message, action) =>
    setPendingDelete({
      title,
      message,
      run: async () => {
        await action()
        setPendingDelete(null)
        load()
      },
    })

  const noteFor = (sessionId) => notes.find(n => n.reading_session_id === sessionId)

  const createSession = async (values) => {
    const user_id = await currentUserId(supabase)
    const { error } = await supabase.from('reading_sessions').insert({
      ...values,
      user_id,
      study_id: studyId,
    })
    if (error) throw error
    setCreating(false)
    load()
  }

  const openEdit = async () => {
    const { data } = await supabase.from('corpora').select('id, name').order('name')
    setEditing({ name: study.name, corpusId: study.corpus_id ?? '', corpora: data ?? [] })
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editing.name.trim()) return
    await run(async () => {
      const { error } = await supabase
        .from('studies')
        .update({ name: editing.name.trim(), corpus_id: editing.corpusId || null })
        .eq('id', studyId)
      if (error) throw error
      notifyDataChanged()
    })
    setEditing(null)
  }

  if (loading) return <div className={styles.root}><AppBar /></div>

  const { completed, total } = calcProgress(sessions)

  return (
    <div className={styles.root}>
      <AppBar
        crumbs={[
          ...(study?.corpora ? [{ label: study.corpora.name, to: `/corpus/${study.corpora.id}` }] : []),
          { label: study?.name },
        ]}
        actions={
          <>
            <button className={styles.action} onClick={openEdit}>Edit</button>
            <button
              className={styles.action}
              onClick={() => confirm(
                'Delete study',
                sessions.length
                  ? `“${study?.name}” will be deleted, along with ${plural(sessions.length, 'reading session')} and their notes. The PDF is kept.`
                  : `“${study?.name}” will be deleted. The PDF is kept.`,
                async () => {
                  await deleteStudy(supabase, studyId)
                  navigate(study?.corpora ? `/corpus/${study.corpora.id}` : '/')
                },
              )}
            >
              Delete study
            </button>
          </>
        }
      />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>{study?.name}</h1>
          <p className={styles.subtitle}>
            <Link to={`/resource/${study?.resource_id}`}>{study?.resources?.name}</Link>
            {study?.corpora
              ? <> · in <Link to={`/corpus/${study.corpora.id}`}>{study.corpora.name}</Link></>
              : ' · not in a corpus'}
          </p>
          {total > 0 && <ProgressBar completed={completed} total={total} />}
        </div>
        {error && <p className={styles.error}>{error}</p>}

        <Section
          title="Sessions"
          action={<button className={styles.action} onClick={() => setCreating(true)}>+ New session</button>}
        >
          {sessions.length === 0 ? <Empty>No sessions yet.</Empty> : (
            <ul className={styles.list}>
              {sessions.map(s => (
                <li key={s.id} className={styles.item}>
                  <Link to={`/session/${s.id}`} className={styles.row}>
                    <span className={styles.status}>{s.completed ? '✓' : '○'}</span>
                    <span className={styles.name}>{s.name}</span>
                    <span className={styles.meta}>pp. {s.start_page}–{s.end_page}</span>
                    <span className={styles.arrow}>→</span>
                  </Link>
                  <RowDeleteButton
                    label={`Delete ${s.name}`}
                    onClick={() => confirm(
                      'Delete reading session',
                      noteFor(s.id) ? `“${s.name}” and its note will be deleted.` : `“${s.name}” will be deleted.`,
                      () => deleteSession(supabase, s.id),
                    )}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>

        {notes.some(n => notePreview(n.content)) && (
          <Section title="Notes">
            <ul className={styles.list}>
              {sessions.map(s => {
                const note = noteFor(s.id)
                const preview = notePreview(note?.content)
                if (!preview) return null
                return (
                  <li key={s.id} className={styles.item}>
                    <Link to={`/session/${s.id}`} className={styles.row}>
                      <div className={styles.rowMain}>
                        <span className={styles.sub}>{s.name}</span>
                        <p className={styles.preview}>{preview}</p>
                      </div>
                    </Link>
                    <RowDeleteButton
                      label={`Delete note for ${s.name}`}
                      onClick={() => confirm(
                        'Delete note',
                        `The note for “${s.name}” will be deleted. The session is kept.`,
                        () => deleteNote(supabase, note.id),
                      )}
                    />
                  </li>
                )
              })}
            </ul>
          </Section>
        )}
      </main>

      {creating && (
        <Modal title="New reading session" onClose={() => setCreating(false)}>
          <SessionForm outline={study?.resources?.outline ?? []} onSubmit={createSession} />
        </Modal>
      )}

      {editing && (
        <Modal title="Edit study" onClose={() => setEditing(null)}>
          <form onSubmit={saveEdit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Name</label>
              <input
                className={styles.input}
                value={editing.name}
                onChange={e => setEditing(ed => ({ ...ed, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Corpus</label>
              <select
                className={styles.select}
                value={editing.corpusId}
                onChange={e => setEditing(ed => ({ ...ed, corpusId: e.target.value }))}
              >
                <option value="">None (standalone study)</option>
                {editing.corpora.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button className={styles.submit} type="submit" disabled={!editing.name.trim()}>Save</button>
          </form>
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmDelete
          title={pendingDelete.title}
          message={pendingDelete.message}
          onConfirm={pendingDelete.run}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
