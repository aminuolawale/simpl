import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { deleteCorpus, deleteStudy, plural } from '../lib/deletion'
import AppBar from '../components/AppBar'
import ProgressBar from '../components/ProgressBar'
import ConfirmDelete, { RowDeleteButton } from '../components/ConfirmDelete'
import { Empty } from '../components/Section'
import styles from '../styles/page.module.css'

const TABS = [
  { key: 'studies', label: 'Studies' },
  { key: 'corpora', label: 'Corpora' },
]

const count = (rel) => rel?.[0]?.count ?? 0

// Home: studies and corpora in two tabs. Everything else (standalone sessions,
// notes, resources) is in the side nav.
export default function HomePage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(t => t.key === params.get('tab')) ? params.get('tab') : 'studies'
  const [studies, setStudies] = useState(null)
  const [corpora, setCorpora] = useState(null)
  const [error, setError] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null) // { title, message, run }

  const load = async () => {
    const [s, c] = await Promise.all([
      supabase.from('studies')
        .select('id, name, corpora(name), resources(name), reading_sessions(id, completed)')
        .order('created_at', { ascending: false }),
      supabase.from('corpora')
        .select('id, name, corpus_resources(count), studies(count)')
        .order('created_at', { ascending: false }),
    ])
    const failed = [s, c].find(r => r.error)
    if (failed) setError(failed.error.message)
    setStudies(s.data ?? [])
    setCorpora(c.data ?? [])
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

  const selectTab = (key) => setParams(key === 'studies' ? {} : { tab: key })

  return (
    <div className={styles.root}>
      <AppBar crumbs={[{ label: 'Home' }]} />
      <main className={styles.main}>
        <div>
          <div className={styles.tabBar}>
            <div className={styles.tabs} role="tablist" aria-label="Home">
              {TABS.map(t => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  id={`tab-${t.key}`}
                  aria-selected={tab === t.key}
                  aria-controls={`panel-${t.key}`}
                  className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
                  onClick={() => selectTab(t.key)}
                >
                  {t.label}
                  {(t.key === 'studies' ? studies : corpora) && (
                    <span className={styles.tabCount}>{(t.key === 'studies' ? studies : corpora).length}</span>
                  )}
                </button>
              ))}
            </div>
            {tab === 'studies'
              ? <Link to="/study/new" className={styles.action}>+ New study</Link>
              : <Link to="/corpus/new" className={styles.action}>+ New corpus</Link>}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'studies' ? (
              studies === null ? <Empty>Loading…</Empty>
              : studies.length === 0 ? <Empty>No studies yet. Create one to start reading.</Empty>
              : (
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
              )
            ) : (
              corpora === null ? <Empty>Loading…</Empty>
              : corpora.length === 0 ? <Empty>No corpora yet. A corpus groups PDFs and studies.</Empty>
              : (
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
              )
            )}
          </div>
        </div>
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
