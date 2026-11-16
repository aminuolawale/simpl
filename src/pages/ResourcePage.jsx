import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { linkResource, unlinkResource } from '../lib/links'
import { deleteResource, resourceDeleteMessage, plural } from '../lib/deletion'
import { fmtSize, fmtDate } from '../lib/format'
import AppBar from '../components/AppBar'
import ChooseModal from '../components/ChooseModal'
import Section, { Empty } from '../components/Section'
import ConfirmDelete, { RowAction } from '../components/ConfirmDelete'
import styles from '../styles/page.module.css'

export default function ResourcePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [resource, setResource] = useState(null)
  const [corpora, setCorpora] = useState([])
  const [studies, setStudies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [corpusCandidates, setCorpusCandidates] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  const load = async () => {
    const [
      { data: resourceData },
      { data: linkData },
      { data: studyData },
    ] = await Promise.all([
      supabase.from('resources').select('id, name, size_bytes, created_at, last_page').eq('id', id).single(),
      supabase.from('corpus_resources').select('corpora(id, name)').eq('resource_id', id),
      supabase.from('studies')
        .select('id, name, corpora(name), reading_sessions(id, completed)')
        .eq('resource_id', id)
        .order('created_at'),
    ])
    setResource(resourceData)
    setCorpora((linkData ?? []).map(l => l.corpora).filter(Boolean))
    setStudies(studyData ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const unlink = async (corpusId) => {
    setError(null)
    try {
      await unlinkResource(supabase, corpusId, id)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const openAddToCorpus = async () => {
    const { data, error } = await supabase.from('corpora').select('id, name').order('name')
    if (error) { setError(error.message); return }
    const linked = new Set(corpora.map(c => c.id))
    setCorpusCandidates((data ?? []).filter(c => !linked.has(c.id)))
  }

  const askDelete = async () => {
    setPendingDelete({ message: await resourceDeleteMessage(supabase, resource) })
  }

  if (loading) return <div className={styles.root}><AppBar /></div>

  return (
    <div className={styles.root}>
      <AppBar
        crumbs={[{ label: resource?.name }]}
        actions={
          <>
            <Link to={`/resource/${id}/read`} className={styles.action}>
              {resource?.last_page > 1 ? `Continue from p. ${resource.last_page}` : 'Open PDF'}
            </Link>
            <button className={styles.action} onClick={askDelete}>Delete PDF</button>
          </>
        }
      />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>{resource?.name}</h1>
          <p className={styles.subtitle}>
            {[fmtSize(resource?.size_bytes), resource?.created_at && `added ${fmtDate(resource.created_at)}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        {error && <p className={styles.error}>{error}</p>}

        <Section
          title="Corpora"
          action={<button className={styles.action} onClick={openAddToCorpus}>+ Add to corpus</button>}
        >
          {corpora.length === 0 ? <Empty>Not in any corpus.</Empty> : (
            <ul className={styles.list}>
              {corpora.map(c => (
                <li key={c.id} className={styles.item}>
                  <Link to={`/corpus/${c.id}`} className={styles.row}>
                    <span className={styles.name}>{c.name}</span>
                    <span className={styles.arrow}>→</span>
                  </Link>
                  <RowAction label={`Remove from ${c.name}`} onClick={() => unlink(c.id)}>Remove</RowAction>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Studies">
          {studies.length === 0 ? <Empty>No studies read this PDF.</Empty> : (
            <ul className={styles.list}>
              {studies.map(s => (
                <li key={s.id} className={styles.item}>
                  <Link to={`/study/${s.id}`} className={styles.row}>
                    <div className={styles.rowMain}>
                      <span className={styles.name}>{s.name}</span>
                      <span className={styles.sub}>
                        {[
                          s.corpora && `in ${s.corpora.name}`,
                          plural(s.reading_sessions?.length ?? 0, 'reading session'),
                        ].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <span className={styles.arrow}>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

      </main>

      {corpusCandidates && (
        <ChooseModal
          title="Add to corpus"
          emptyText="It's already in all your corpora."
          items={corpusCandidates.map(c => ({ id: c.id, label: c.name }))}
          onChoose={async (item) => {
            await linkResource(supabase, item.id, id)
            setCorpusCandidates(null)
            load()
          }}
          onClose={() => setCorpusCandidates(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmDelete
          title="Delete PDF"
          message={pendingDelete.message}
          onConfirm={async () => {
            await deleteResource(supabase, id)
            navigate('/')
          }}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
