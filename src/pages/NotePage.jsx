import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { attachNote, setNoteResource } from '../lib/links'
import { deleteNote } from '../lib/deletion'
import { noteTitle } from '../lib/notes'
import { notifyDataChanged } from '../lib/events'
import { usePdf } from '../context/PdfContext'
import AppBar from '../components/AppBar'
import Modal from '../components/Modal'
import ChooseModal from '../components/ChooseModal'
import ConfirmDelete from '../components/ConfirmDelete'
import ResourcePicker from '../components/ResourcePicker'
import TocDrawer from '../components/TocDrawer'
import PageCanvas from '../components/PageCanvas'
import SessionDock from '../components/SessionDock'
import NoteEditor from '../components/NoteEditor'
import PaneDivider, { useNotePaneWidth } from '../components/PaneDivider'
import reader from '../styles/reader.module.css'
import styles from './NotePage.module.css'

const TITLE_SAVE_DELAY = 600

// A standalone note, optionally shown beside a PDF. Notes attached to a session
// live on the session page, so this page redirects there for them.
export default function NotePage() {
  const { noteId } = useParams()
  const navigate = useNavigate()
  const { openResourcePdf } = usePdf()
  const [note, setNote] = useState(null)
  const [noteWidth, setNoteWidth] = useNotePaneWidth()
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [choosingPdf, setChoosingPdf] = useState(false)
  const [sessionChoices, setSessionChoices] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const titleTimer = useRef(null)

  const load = async () => {
    const { data, error } = await supabase
      .from('notes')
      .select('id, title, content, reading_session_id, resource_id, resources(id, name, storage_path, outline)')
      .eq('id', noteId)
      .single()
    if (error) setError(error.message)
    setNote(data)
    setLoading(false)
    return data
  }

  useEffect(() => {
    load().then(data => setTitle(data?.title ?? ''))
  }, [noteId])

  // Load the linked PDF whenever it changes.
  const storagePath = note?.resources?.storage_path
  useEffect(() => {
    if (!storagePath) return
    openResourcePdf({ id: note.resources.id, path: storagePath, outline: note.resources.outline })
  }, [storagePath])

  const saveTitle = async (value) => {
    clearTimeout(titleTimer.current)
    titleTimer.current = null
    const { error } = await supabase.from('notes').update({ title: value.trim() || null }).eq('id', noteId)
    if (error) setError(error.message)
    else notifyDataChanged()
  }

  const onTitleChange = (value) => {
    setTitle(value)
    clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(() => saveTitle(value), TITLE_SAVE_DELAY)
  }

  // Flush a pending title save when leaving the page.
  const titleRef = useRef(title)
  titleRef.current = title
  useEffect(() => () => { if (titleTimer.current) saveTitle(titleRef.current) }, [])

  const chooseResource = async (resourceId) => {
    setError(null)
    try {
      await setNoteResource(supabase, noteId, resourceId)
      setChoosingPdf(false)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const openSessionChoices = async () => {
    let query = supabase
      .from('reading_sessions')
      .select('id, name, studies!inner(name, resource_id, resources(name)), notes(id)')
      .order('created_at', { ascending: false })
    if (note.resource_id) query = query.eq('studies.resource_id', note.resource_id)
    const { data, error } = await query
    if (error) { setError(error.message); return }
    const hasNote = (s) => Array.isArray(s.notes) ? s.notes.length > 0 : !!s.notes
    setSessionChoices(
      (data ?? []).filter(s => !hasNote(s)).map(s => ({
        id: s.id,
        label: s.name,
        sub: [`in ${s.studies.name}`, s.studies.resources?.name].filter(Boolean).join(' · '),
        resourceId: s.studies.resource_id,
      }))
    )
  }

  const attach = async (item) => {
    if (titleTimer.current) await saveTitle(title)
    if (!note.resource_id) await setNoteResource(supabase, noteId, item.resourceId)
    await attachNote(supabase, noteId, item.id)
    navigate(`/session/${item.id}`)
  }

  if (loading) return <div className={reader.root}><AppBar /></div>
  if (!note) return <div className={reader.root}><AppBar /><p className={styles.error}>{error ?? 'Note not found.'}</p></div>
  if (note.reading_session_id) return <Navigate to={`/session/${note.reading_session_id}`} replace />

  const editor = (
    <div className={styles.notePane}>
      <input
        className={styles.title}
        placeholder="Untitled note"
        value={title}
        onChange={e => onTitleChange(e.target.value)}
        onBlur={() => titleTimer.current && saveTitle(title)}
      />
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.editor}>
        <NoteEditor key={noteId} noteId={noteId} initialContent={note.content} />
      </div>
    </div>
  )

  return (
    <div className={reader.root}>
      <AppBar
        crumbs={[{ label: noteTitle({ title }) }]}
        actions={
          <>
            <button className={reader.complete} onClick={() => setChoosingPdf(true)}>
              {note.resources ? `PDF: ${note.resources.name}` : 'Link a PDF'}
            </button>
            <button className={reader.complete} onClick={openSessionChoices}>Attach to session</button>
            <button className={reader.complete} onClick={() => setConfirmingDelete(true)}>Delete note</button>
          </>
        }
      />

      {note.resources ? (
        <>
          <div className={reader.body}>
            <TocDrawer open={drawerOpen} />
            <div className={reader.pdfPane}>
              <PageCanvas />
            </div>
            <PaneDivider width={noteWidth} onChange={setNoteWidth} />
            <div className={reader.notePane} style={noteWidth ? { flex: '0 1 auto', width: noteWidth } : undefined}>{editor}</div>
          </div>
          <SessionDock drawerOpen={drawerOpen} onToggleDrawer={() => setDrawerOpen(o => !o)} />
        </>
      ) : (
        <div className={styles.solo}>{editor}</div>
      )}

      {choosingPdf && (
        <Modal title="Link a PDF to this note" onClose={() => setChoosingPdf(false)}>
          <div className={styles.modalBody}>
            <ResourcePicker
              value={note.resource_id ? [note.resource_id] : []}
              onChange={ids => chooseResource(ids[0])}
            />
            {note.resource_id && (
              <button className={styles.unlink} onClick={() => chooseResource(null)}>
                Remove the PDF from this note
              </button>
            )}
          </div>
        </Modal>
      )}

      {sessionChoices && (
        <ChooseModal
          title="Attach to a reading session"
          emptyText={note.resources
            ? `No sessions on “${note.resources.name}” are free. A session can have only one note.`
            : 'No sessions are free. A session can have only one note.'}
          items={sessionChoices}
          onChoose={attach}
          onClose={() => setSessionChoices(null)}
        />
      )}

      {confirmingDelete && (
        <ConfirmDelete
          title="Delete note"
          message={`“${noteTitle({ title })}” will be deleted.`}
          onClose={() => setConfirmingDelete(false)}
          onConfirm={async () => {
            clearTimeout(titleTimer.current)
            titleTimer.current = null
            await deleteNote(supabase, noteId)
            navigate('/')
          }}
        />
      )}
    </div>
  )
}
