import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { createResource, currentUserId } from '../lib/resources'
import {
  deleteCorpus, deleteResource, deleteStudy, deleteSession, deleteNote,
  resourceDeleteMessage, plural,
} from '../lib/deletion'
import { notePreview, noteTitle } from '../lib/notes'
import AppBar from '../components/AppBar'
import ProgressBar from '../components/ProgressBar'
import ConfirmDelete, { RowDeleteButton } from '../components/ConfirmDelete'
import Section, { Empty } from '../components/Section'
import { fmtSize } from '../lib/format'
import styles from '../styles/page.module.css'

const count = (rel) => rel?.[0]?.count ?? 0

export default function HomePage() {
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const [data, setData] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null) // { title, message, run }

  const load = async () => {
    const [corpora, studies, sessions, notes, resources] = await Promise.all([
      supabase.from('corpora')
        .select('id, name, corpus_resources(count), studies(count)')
        .order('created_at', { ascending: false }),
      supabase.from('studies')
        .select('id, name, corpora(name), resources(name), reading_sessions(id, completed)')
        .order('created_at', { ascending: false }),
      supabase.from('reading_sessions')
        .select('id, name, start_page, end_page, completed, resources(name)')
        .is('study_id', null)
        .order('created_at', { ascending: false }),
      supabase.from('notes')
        .select('id, title, content, resources(name)')
        .is('reading_session_id', null)
        .order('updated_at', { ascending: false }),
      supabase.from('resources')
        .select('id, name, size_bytes, corpus_resources(count)')
        .order('created_at', { ascending: false }),
    ])
    const failed = [corpora, studies, sessions, notes, resources].find(r => r.error)
    if (failed) setError(failed.error.message)
    setData({
      corpora: corpora.data ?? [],
      studies: studies.data ?? [],
      sessions: sessions.data ?? [],
      notes: notes.data ?? [],
      resources: resources.data ?? [],
    })
  }

  useEffect(() => { load() }, [])

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

  const upload = async (file) => {
    setUploading(true)
    setError(null)
    try {
      await createResource(supabase, file)
      await load()
    } catch (e) {
      setError(e.message)
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const newNote = async () => {
    setError(null)
    const user_id = await currentUserId(supabase)
    const { data: note, error } = await supabase.from('notes').insert({ user_id }).select('id').single()
    if (error) { setError(error.message); return }
    navigate(`/note/${note.id}`)
  }

  if (!data) return <div className={styles.root}><AppBar /></div>

  const { corpora, studies, sessions, notes, resources } = data

  return (
    <div className={styles.root}>
      <AppBar />
      <main className={styles.main}>
        {error && <p className={styles.error}>{error}</p>}

        <Section title="Corpora" action={<Link to="/corpus/new" className={styles.action}>+ New corpus</Link>}>
          {corpora.length === 0 ? <Empty>No corpora yet.</Empty> : (
            <ul className={styles.list}>
              {corpora.map(c => (
                <li key={c.id} className={styles.item}>
                  <Link to={`/corpus/${c.id}`} className={styles.row}>
                    <div className={styles.rowMain}>
                      <span className={styles.name}>{c.name}</span>
                      <span className={styles.sub}>
                        {plural(count(c.corpus_resources), 'PDF')} · {plural(count(c.studies), 'study', 'studies')}
                      </span>
                    </div>
                    <span className={styles.arrow}>→</span>
                  </Link>
                  <RowDeleteButton
                    label={`Delete ${c.name}`}
                    onClick={() => confirm(
                      'Delete corpus',
                      `“${c.name}” will be deleted. Its PDFs and studies are kept and stay available on their own.`,
                      () => deleteCorpus(supabase, c.id),
                    )}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Studies" action={<Link to="/study/new" className={styles.action}>+ New study</Link>}>
          {studies.length === 0 ? <Empty>No studies yet.</Empty> : (
            <ul className={styles.list}>
              {studies.map(s => {
                const sess = s.reading_sessions ?? []
                return (
                  <li key={s.id} className={styles.item}>
                    <Link to={`/study/${s.id}`} className={styles.row}>
                      <div className={styles.rowMain}>
                        <span className={styles.name}>{s.name}</span>
                        <span className={styles.sub}>
                          {s.resources?.name}{s.corpora ? ` · in ${s.corpora.name}` : ''}
                        </span>
                      </div>
                      {sess.length > 0 && (
                        <ProgressBar completed={sess.filter(r => r.completed).length} total={sess.length} />
                      )}
                      <span className={styles.arrow}>→</span>
                    </Link>
                    <RowDeleteButton
                      label={`Delete ${s.name}`}
                      onClick={() => confirm(
                        'Delete study',
                        sess.length
                          ? `“${s.name}” will be deleted, along with ${plural(sess.length, 'reading session')} and their notes. The PDF is kept.`
                          : `“${s.name}” will be deleted. The PDF is kept.`,
                        () => deleteStudy(supabase, s.id),
                      )}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        <Section title="Reading sessions" action={<Link to="/session/new" className={styles.action}>+ New session</Link>}>
          {sessions.length === 0 ? <Empty>No standalone sessions. Sessions inside a study are listed on the study.</Empty> : (
            <ul className={styles.list}>
              {sessions.map(s => (
                <li key={s.id} className={styles.item}>
                  <Link to={`/session/${s.id}`} className={styles.row}>
                    <span className={styles.status}>{s.completed ? '✓' : '○'}</span>
                    <div className={styles.rowMain}>
                      <span className={styles.name}>{s.name}</span>
                      <span className={styles.sub}>{s.resources?.name}</span>
                    </div>
                    <span className={styles.meta}>pp. {s.start_page}–{s.end_page}</span>
                    <span className={styles.arrow}>→</span>
                  </Link>
                  <RowDeleteButton
                    label={`Delete ${s.name}`}
                    onClick={() => confirm(
                      'Delete reading session',
                      `“${s.name}” and its note will be deleted.`,
                      () => deleteSession(supabase, s.id),
                    )}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Notes" action={<button className={styles.action} onClick={newNote}>+ New note</button>}>
          {notes.length === 0 ? <Empty>No standalone notes. Session notes are listed on their study.</Empty> : (
            <ul className={styles.list}>
              {notes.map(n => (
                <li key={n.id} className={styles.item}>
                  <Link to={`/note/${n.id}`} className={styles.row}>
                    <div className={styles.rowMain}>
                      <span className={styles.name}>{noteTitle(n)}</span>
                      {n.resources && <span className={styles.sub}>{n.resources.name}</span>}
                      {notePreview(n.content) && <p className={styles.preview}>{notePreview(n.content)}</p>}
                    </div>
                    <span className={styles.arrow}>→</span>
                  </Link>
                  <RowDeleteButton
                    label={`Delete ${noteTitle(n)}`}
                    onClick={() => confirm(
                      'Delete note',
                      `“${noteTitle(n)}” will be deleted.`,
                      () => deleteNote(supabase, n.id),
                    )}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Resources"
          action={
            <>
              <button className={styles.action} onClick={() => fileRef.current.click()} disabled={uploading}>
                {uploading ? 'Uploading…' : '+ Upload PDF'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className={styles.hidden}
                onChange={e => upload(e.target.files[0])}
              />
            </>
          }
        >
          {resources.length === 0 ? <Empty>No resources yet.</Empty> : (
            <ul className={styles.list}>
              {resources.map(r => (
                <li key={r.id} className={styles.item}>
                  <Link to={`/resource/${r.id}`} className={styles.row}>
                    <div className={styles.rowMain}>
                      <span className={styles.name}>{r.name}</span>
                      <span className={styles.sub}>
                        {count(r.corpus_resources) ? `In ${plural(count(r.corpus_resources), 'corpus', 'corpora')}` : 'Not in any corpus'}
                      </span>
                    </div>
                    <span className={styles.meta}>{fmtSize(r.size_bytes)}</span>
                    <span className={styles.arrow}>→</span>
                  </Link>
                  <RowDeleteButton
                    label={`Delete ${r.name}`}
                    onClick={async () => confirm(
                      'Delete PDF',
                      await resourceDeleteMessage(supabase, r),
                      () => deleteResource(supabase, r.id),
                    )}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </main>

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
