import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { onDataChanged } from '../lib/events'
import { createResource } from '../lib/resources'
import { createNote, noteTitle } from '../lib/notes'
import styles from './SideNav.module.css'

const COLLAPSED_KEY = 'simpl.sidenav.collapsed'

function readCollapsed() {
  try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY)) ?? {} } catch { return {} }
}
function writeCollapsed(value) {
  try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(value)) } catch {}
}

// Lists every entity the user has, grouped by kind. Sessions and notes show
// only standalone ones; the rest live on their study's page.
export default function SideNav({ open = false, onClose }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const fileRef = useRef(null)
  const [data, setData] = useState(null)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [busy, setBusy] = useState(null) // 'note' | 'upload'
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const [corpora, studies, sessions, notes, resources] = await Promise.all([
      supabase.from('corpora').select('id, name').order('name'),
      supabase.from('studies').select('id, name').order('name'),
      supabase.from('reading_sessions').select('id, name, completed').is('study_id', null).order('created_at', { ascending: false }),
      supabase.from('notes').select('id, title').is('reading_session_id', null).order('updated_at', { ascending: false }),
      supabase.from('resources').select('id, name').order('name'),
    ])
    setData({
      corpora: corpora.data ?? [],
      studies: studies.data ?? [],
      sessions: sessions.data ?? [],
      notes: notes.data ?? [],
      resources: resources.data ?? [],
    })
  }, [])

  // Refresh on navigation (covers creates that redirect) and on explicit changes.
  useEffect(() => { load() }, [load, pathname])
  useEffect(() => onDataChanged(load), [load])

  const toggle = (key) => setCollapsed(c => {
    const next = { ...c, [key]: !c[key] }
    writeCollapsed(next)
    return next
  })

  const run = async (kind, action) => {
    setBusy(kind)
    setError(null)
    try { await action() } catch (e) { setError(e.message) }
    setBusy(null)
  }

  const newNote = () => run('note', async () => navigate(`/note/${await createNote(supabase)}`))

  const upload = (file) => run('upload', async () => {
    const resource = await createResource(supabase, file)
    navigate(`/resource/${resource.id}`)
  }).finally(() => { if (fileRef.current) fileRef.current.value = '' })

  const groups = [
    { key: 'corpora', title: 'Corpora', items: data?.corpora, to: c => `/corpus/${c.id}`, label: c => c.name,
      add: { label: 'New corpus', onClick: () => navigate('/corpus/new') } },
    { key: 'studies', title: 'Studies', items: data?.studies, to: s => `/study/${s.id}`, label: s => s.name,
      add: { label: 'New study', onClick: () => navigate('/study/new') } },
    { key: 'sessions', title: 'Reading sessions', items: data?.sessions, to: s => `/session/${s.id}`,
      label: s => `${s.completed ? '✓ ' : ''}${s.name}`,
      add: { label: 'New reading session', onClick: () => navigate('/session/new') } },
    { key: 'notes', title: 'Notes', items: data?.notes, to: n => `/note/${n.id}`, label: noteTitle,
      add: { label: 'New note', onClick: newNote, busy: busy === 'note' } },
    { key: 'resources', title: 'Resources', items: data?.resources, to: r => `/resource/${r.id}`, label: r => r.name,
      add: { label: 'Upload PDF', onClick: () => fileRef.current.click(), busy: busy === 'upload' } },
  ]

  return (
    <>
    {open && <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />}
    <nav className={`${styles.nav} ${open ? styles.open : ''}`} aria-label="Library">
      <div className={styles.header}>
        <NavLink to="/" end className={styles.wordmark}>simpl</NavLink>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close navigation">✕</button>
      </div>
      <div className={styles.scroll}>
        {error && <p className={styles.error}>{error}</p>}
        {groups.map(g => {
          const open = !collapsed[g.key]
          return (
            <section key={g.key} className={styles.group}>
              <div className={styles.groupHeader}>
                <button
                  type="button"
                  className={styles.groupToggle}
                  onClick={() => toggle(g.key)}
                  aria-expanded={open}
                >
                  <span className={`${styles.caret} ${open ? styles.caretOpen : ''}`} aria-hidden="true">›</span>
                  <span className={styles.groupTitle}>{g.title}</span>
                  {g.items && <span className={styles.count}>{g.items.length}</span>}
                </button>
                <button
                  type="button"
                  className={styles.add}
                  onClick={g.add.onClick}
                  disabled={g.add.busy}
                  title={g.add.label}
                  aria-label={g.add.label}
                >
                  {g.add.busy ? '…' : '+'}
                </button>
              </div>
              {open && g.items && (
                g.items.length === 0 ? (
                  <p className={styles.empty}>None yet</p>
                ) : (
                  <ul className={styles.list}>
                    {g.items.map(item => (
                      <li key={item.id}>
                        <NavLink
                          to={g.to(item)}
                          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
                          title={g.label(item)}
                        >
                          {g.label(item)}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </section>
          )
        })}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className={styles.hidden}
        onChange={e => upload(e.target.files[0])}
      />
    </nav>
    </>
  )
}
