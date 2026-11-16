import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getSignedUrl } from '../lib/storage'
import { deleteSession } from '../lib/deletion'
import { usePdf } from '../context/PdfContext'
import AppBar from '../components/AppBar'
import TocDrawer from '../components/TocDrawer'
import PageCanvas from '../components/PageCanvas'
import SessionDock from '../components/SessionDock'
import NoteEditor from '../components/NoteEditor'
import ConfirmDelete from '../components/ConfirmDelete'
import PaneDivider, { useNotePaneWidth } from '../components/PaneDivider'
import styles from '../styles/reader.module.css'

export default function SessionPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { loadPdfFromUrl } = usePdf()
  const [session, setSession] = useState(null)
  const [note, setNote] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [noteWidth, setNoteWidth] = useNotePaneWidth()

  const loadSession = async () => {
    const { data } = await supabase.from('reading_sessions')
      .select('*, studies(id, name, resource_id, resources(name, storage_path, outline), corpora(id, name))')
      .eq('id', sessionId)
      .single()
    setSession(data)
    return data
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const [sessionData, { data: noteData }] = await Promise.all([
        loadSession(),
        supabase.from('notes').select('id, content').eq('reading_session_id', sessionId).maybeSingle(),
      ])
      setNote(noteData)
      setLoading(false) // show UI immediately — PDF loads in background below

      const resource = sessionData?.studies?.resources
      if (resource?.storage_path) {
        loadPdfFromUrl(() => getSignedUrl(supabase, resource.storage_path), sessionData.start_page, resource.outline)
      }
    }
    init()
  }, [sessionId])

  const study = session?.studies
  const corpus = study?.corpora
  const parentUrl = study ? `/study/${study.id}` : '/'

  const markComplete = async () => {
    setCompleting(true)
    await supabase.from('reading_sessions').update({
      completed: true,
      completed_at: new Date().toISOString(),
    }).eq('id', sessionId)
    navigate(parentUrl)
  }

  if (loading) return <div className={styles.root}><AppBar /></div>

  return (
    <div className={styles.root}>
      <AppBar
        crumbs={[
          ...(corpus ? [{ label: corpus.name, to: `/corpus/${corpus.id}` }] : []),
          ...(study ? [{ label: study.name, to: `/study/${study.id}` }] : []),
          { label: session?.name },
        ]}
        actions={
          <>
            {!session?.completed && (
              <button className={styles.complete} onClick={markComplete} disabled={completing}>
                {completing ? 'Saving…' : 'Mark complete'}
              </button>
            )}
            <button className={styles.complete} onClick={() => setConfirmingDelete(true)}>
              Delete session
            </button>
          </>
        }
      />
      <div className={styles.body}>
        <TocDrawer open={drawerOpen} />
        <div className={styles.pdfPane}>
          <PageCanvas />
        </div>
        <PaneDivider width={noteWidth} onChange={setNoteWidth} />
        <div className={styles.notePane} style={noteWidth ? { flex: '0 1 auto', width: noteWidth } : undefined}>
          <NoteEditor
            key={sessionId}
            noteId={note?.id ?? null}
            initialContent={note?.content}
            newNote={{ reading_session_id: sessionId, resource_id: study?.resource_id }}
            deletable
          />
        </div>
      </div>
      <SessionDock
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen(o => !o)}
        startPage={session?.start_page}
        endPage={session?.end_page}
      />

      {confirmingDelete && (
        <ConfirmDelete
          title="Delete reading session"
          message={`“${session?.name}” and its note will be deleted.`}
          onClose={() => setConfirmingDelete(false)}
          onConfirm={async () => {
            await deleteSession(supabase, sessionId)
            navigate(parentUrl)
          }}
        />
      )}
    </div>
  )
}
