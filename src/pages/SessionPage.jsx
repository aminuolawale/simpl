import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getSignedUrl } from '../lib/storage'
import { setSessionStudy } from '../lib/links'
import { deleteSession } from '../lib/deletion'
import { usePdf } from '../context/PdfContext'
import AppBar from '../components/AppBar'
import TocDrawer from '../components/TocDrawer'
import PageCanvas from '../components/PageCanvas'
import SessionDock from '../components/SessionDock'
import NoteEditor from '../components/NoteEditor'
import ChooseModal from '../components/ChooseModal'
import ConfirmDelete from '../components/ConfirmDelete'
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
  const [studyChoices, setStudyChoices] = useState(null)

  const loadSession = async () => {
    const { data } = await supabase.from('reading_sessions')
      .select('*, resources(name, storage_path, outline), studies(id, name, corpora(id, name))')
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

      const storagePath = sessionData?.resources?.storage_path
      if (storagePath) {
        const url = await getSignedUrl(supabase, storagePath)
        loadPdfFromUrl(url, sessionData.start_page, sessionData.resources.outline)
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
    if (study) navigate(parentUrl)
    else {
      await loadSession()
      setCompleting(false)
    }
  }

  const openStudyChoices = async () => {
    const { data } = await supabase
      .from('studies')
      .select('id, name, corpora(name)')
      .eq('resource_id', session.resource_id)
      .order('created_at', { ascending: false })
    const others = (data ?? []).filter(s => s.id !== study?.id)
    setStudyChoices([
      ...(study ? [{ id: null, label: 'No study', sub: `Remove from “${study.name}” and keep it standalone` }] : []),
      ...others.map(s => ({ id: s.id, label: s.name, sub: s.corpora ? `in ${s.corpora.name}` : 'Standalone study' })),
    ])
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
            <button className={styles.complete} onClick={openStudyChoices} title="Move to a study">
              {study ? `Study: ${study.name}` : 'Add to study'}
            </button>
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
        <div className={styles.notePane}>
          <NoteEditor
            key={sessionId}
            noteId={note?.id ?? null}
            initialContent={note?.content}
            newNote={{ reading_session_id: sessionId, resource_id: session?.resource_id }}
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

      {studyChoices && (
        <ChooseModal
          title={study ? 'Move to another study' : 'Add to a study'}
          emptyText={`No studies read “${session?.resources?.name}”. Create one from the PDF's page first.`}
          items={studyChoices}
          onChoose={async (item) => {
            await setSessionStudy(supabase, sessionId, item.id)
            setStudyChoices(null)
            loadSession()
          }}
          onClose={() => setStudyChoices(null)}
        />
      )}

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
