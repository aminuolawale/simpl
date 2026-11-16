import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createResource } from '../lib/resources'
import styles from './ResourcePicker.module.css'

// Lists all of the user's resources and lets them pick one (or several, with
// `multiple`). "Upload PDF…" uploads immediately as a standalone resource and
// selects it. `value` is always an array of resource ids.
export default function ResourcePicker({ value, onChange, multiple = false, excludeIds = [] }) {
  const fileRef = useRef(null)
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('resources')
      .select('id, name')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        setResources(data ?? [])
        setLoading(false)
      })
  }, [])

  const toggle = (id) => {
    if (!multiple) return onChange([id])
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id])
  }

  const upload = async (files) => {
    const list = [...(files ?? [])]
    if (list.length === 0) return
    setUploading(true)
    setError(null)
    const created = []
    try {
      for (const file of multiple ? list : list.slice(0, 1)) {
        created.push(await createResource(supabase, file))
      }
    } catch (e) {
      setError(e.message)
    }
    if (created.length) {
      setResources(rs => [...created, ...rs])
      const ids = created.map(r => r.id)
      onChange(multiple ? [...value, ...ids] : ids)
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const visible = resources.filter(r => !excludeIds.includes(r.id))

  return (
    <div className={styles.picker}>
      {loading ? (
        <p className={styles.hint}>Loading resources…</p>
      ) : visible.length > 0 && (
        <div className={styles.list} role="listbox" aria-multiselectable={multiple}>
          {visible.map(r => {
            const selected = value.includes(r.id)
            return (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`${styles.row} ${selected ? styles.selected : ''}`}
                onClick={() => toggle(r.id)}
              >
                <span className={styles.name}>{r.name}</span>
                {selected && <span className={styles.check}>✓</span>}
              </button>
            )
          })}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        multiple={multiple}
        className={styles.hidden}
        onChange={e => upload(e.target.files)}
      />
      <button
        type="button"
        className={styles.uploadBtn}
        onClick={() => fileRef.current.click()}
        disabled={uploading}
      >
        {uploading ? 'Uploading…' : multiple ? 'Upload PDFs…' : 'Upload a new PDF…'}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
