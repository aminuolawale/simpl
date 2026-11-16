import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { linkResources, unlinkResource, setStudyCorpus } from '../lib/links'
import { deleteCorpus, deleteResource, deleteStudy, resourceDeleteMessage, plural } from '../lib/deletion'
import { fmtSize } from '../lib/format'
import AppBar from '../components/AppBar'
import Modal from '../components/Modal'
import ChooseModal from '../components/ChooseModal'
import ProgressBar from '../components/ProgressBar'
import ResourcePicker from '../components/ResourcePicker'
import Section, { Empty } from '../components/Section'
import ConfirmDelete, { RowAction, RowDeleteButton } from '../components/ConfirmDelete'
import styles from '../styles/page.module.css'

export default function CorpusPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [corpus, setCorpus] = useState(null)
  const [resources, setResources] = useState([])
  const [studies, setStudies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)
  const [toAdd, setToAdd] = useState([])
  const [linkCandidates, setLinkCandidates] = useState(null) // studies offered for linking
  const [pendingDelete, setPendingDelete] = useState(null) // { title, message, run }

  const load = async () => {
    const [
      { data: corpusData },
      { data: linkData },
      { data: studyData },
    ] = await Promise.all([
      supabase.from('corpora').select('id, name').eq('id', id).single(),
      supabase.from('corpus_resources')
        .select('added_at, resources(id, name, size_bytes)')
        .eq('corpus_id', id)
        .order('added_at'),
      supabase.from('studies')
        .select('id, name, resources(name), reading_sessions(id, completed)')
        .eq('corpus_id', id)
        .order('created_at'),
    ])
    setCorpus(corpusData)
    setResources((linkData ?? []).map(l => l.resources).filter(Boolean))
    setStudies(studyData ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

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

  const addResources = async () => {
    await run(() => linkResources(supabase, id, toAdd))
    setAdding(false)
    setToAdd([])
  }

  const openLinkStudy = async () => {
    const { data, error } = await supabase
      .from('studies')
      .select('id, name, corpus_id, corpora(name), resources(name)')
      .order('created_at', { ascending: false })
    if (error) { setError(error.message); return }
    setLinkCandidates((data ?? []).filter(s => s.corpus_id !== id))
  }

  if (loading) return <div className={styles.root}><AppBar /></div>

  return (
    <div className={styles.root}>
      <AppBar
        crumbs={[{ label: corpus?.name }]}
        actions={
          <button
            className={styles.action}
            onClick={() => confirm(
              'Delete corpus',
              `“${corpus?.name}” will be deleted. Its ${plural(resources.length, 'PDF')} and ${plural(studies.length, 'study', 'studies')} are kept and stay available on their own.`,
              async () => { await deleteCorpus(supabase, id); navigate('/') },
            )}
          >
            Delete corpus
          </button>
        }
      />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>{corpus?.name}</h1>
        </div>
        {error && <p className={styles.error}>{error}</p>}

        <Section
          title="Resources"
          action={<button className={styles.action} onClick={() => setAdding(true)}>+ Add PDFs</button>}
        >
          {resources.length === 0 ? <Empty>No resources in this corpus yet.</Empty> : (
            <ul className={styles.list}>
              {resources.map(r => (
                <li key={r.id} className={styles.item}>
                  <Link to={`/resource/${r.id}`} className={styles.row}>
                    <span className={styles.name}>{r.name}</span>
                    <span className={styles.meta}>{fmtSize(r.size_bytes)}</span>
                  </Link>
                  <RowAction
                    label={`Remove ${r.name} from this corpus`}
                    onClick={() => run(() => unlinkResource(supabase, id, r.id))}
                  >
                    Remove
                  </RowAction>
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

        <Section
          title="Studies"
          action={
            <>
              <button className={styles.action} onClick={openLinkStudy}>Link existing</button>
              <Link className={styles.action} to={`/study/new?corpus=${id}`}>+ New study</Link>
            </>
          }
        >
          {studies.length === 0 ? <Empty>No studies in this corpus yet.</Empty> : (
            <ul className={styles.list}>
              {studies.map(s => {
                const sessions = s.reading_sessions ?? []
                return (
                  <li key={s.id} className={styles.item}>
                    <Link to={`/study/${s.id}`} className={styles.row}>
                      <div className={styles.rowMain}>
                        <span className={styles.name}>{s.name}</span>
                        <span className={styles.sub}>{s.resources?.name}</span>
                      </div>
                      {sessions.length > 0 && (
                        <ProgressBar completed={sessions.filter(r => r.completed).length} total={sessions.length} />
                      )}
                      <span className={styles.arrow}>→</span>
                    </Link>
                    <RowAction
                      label={`Remove ${s.name} from this corpus`}
                      onClick={() => run(() => setStudyCorpus(supabase, s.id, null))}
                    >
                      Remove
                    </RowAction>
                    <RowDeleteButton
                      label={`Delete ${s.name}`}
                      onClick={() => confirm(
                        'Delete study',
                        sessions.length
                          ? `“${s.name}” will be deleted, along with ${plural(sessions.length, 'reading session')} and their notes. The PDF is kept.`
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
      </main>

      {adding && (
        <Modal title="Add PDFs to corpus" onClose={() => { setAdding(false); setToAdd([]) }}>
          <div className={styles.form}>
            <ResourcePicker
              multiple
              value={toAdd}
              onChange={setToAdd}
              excludeIds={resources.map(r => r.id)}
            />
            <button className={styles.submit} onClick={addResources} disabled={toAdd.length === 0}>
              {toAdd.length ? `Add ${plural(toAdd.length, 'PDF')}` : 'Add'}
            </button>
          </div>
        </Modal>
      )}

      {linkCandidates && (
        <ChooseModal
          title="Link a study to this corpus"
          emptyText="All your studies are already in this corpus."
          items={linkCandidates.map(s => ({
            id: s.id,
            label: s.name,
            sub: [s.resources?.name, s.corpora && `moves from ${s.corpora.name}`].filter(Boolean).join(' · '),
          }))}
          onChoose={async (item) => {
            await setStudyCorpus(supabase, item.id, id)
            setLinkCandidates(null)
            load()
          }}
          onClose={() => setLinkCandidates(null)}
        />
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
