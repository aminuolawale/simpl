import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getSignedUrl } from '../lib/storage'
import { usePdf } from '../context/PdfContext'
import AppBar from '../components/AppBar'
import TocDrawer from '../components/TocDrawer'
import PageCanvas from '../components/PageCanvas'
import SessionDock from '../components/SessionDock'
import NoteEditor from '../components/NoteEditor'
import styles from './SessionPage.module.css'

export default function SessionPage() {
  const { id: corpusId, studyId, sessionId } = useParams()
  const navigate = useNavigate()
  const { loadPdfFromUrl } = usePdf()
  const [session, setSession] = useState(null)
  const [study, setStudy] = useState(null)
  const [corpus, setCorpus] = useState(null)
  const [note, setNote] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    const init = async () => {
      const [
        { data: sessionData },
        { data: studyData },
        { data: corpusData },
        { data: noteData },
      ] = await Promise.all([
        supabase.from('reading_sessions')
          .select('*, studies(resource_id, name, resources(storage_path, outline))')
          .eq('id', sessionId)
          .single(),
        supabase.from('studies').select('id, name').eq('id', studyId).single(),
        supabase.from('corpora').select('id, name').eq('id', corpusId).single(),
        supabase.from('notes').select('content').eq('reading_session_id', sessionId).maybeSingle(),
      ])

      setSession(sessionData)
      setStudy(studyData)
      setCorpus(corpusData)
      setNote(noteData)
      setLoading(false) // show UI immediately — PDF loads in background below

      const storagePath = sessionData?.studies?.resources?.storage_path
      if (storagePath) {
        const url = await getSignedUrl(supabase, storagePath)
        loadPdfFromUrl(url, sessionData.start_page, sessionData?.studies?.resources?.outline)
      }
    }
    init()
  }, [sessionId])

  const markComplete = async () => {
    setCompleting(true)
    await supabase.from('reading_sessions').update({
      completed: true,
      completed_at: new Date().toISOString(),
    }).eq('id', sessionId)
    navigate(`/corpus/${corpusId}/study/${studyId}`)
  }

  if (loading) return <div className={styles.root}><AppBar /></div>

  return (
    <div className={styles.root}>
      <AppBar
        crumbs={[
          { label: corpus?.name, to: `/corpus/${corpusId}` },
          { label: study?.name, to: `/corpus/${corpusId}/study/${studyId}` },
          { label: session?.name },
        ]}
        actions={
          !session?.completed && (
            <button className={styles.complete} onClick={markComplete} disabled={completing}>
              {completing ? 'Saving…' : 'Mark complete'}
            </button>
          )
        }
      />
      <div className={styles.body}>
        <TocDrawer open={drawerOpen} />
        <div className={styles.pdfPane}>
          <PageCanvas />
        </div>
        <div className={styles.notePane}>
          <NoteEditor sessionId={sessionId} initialContent={note?.content} />
        </div>
      </div>
      <SessionDock
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen(o => !o)}
        startPage={session?.start_page}
        endPage={session?.end_page}
      />
    </div>
  )
}
