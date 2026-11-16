import { useState } from 'react'
import { flattenOutline, sectionsAfter, isValidRange, sectionPage } from '../lib/sections'
import styles from '../styles/page.module.css'

const EMPTY = { name: '', startSection: '', endSection: '', startPage: '', endPage: '' }

// Reading-range form, by section (from the resource's outline) or by page.
// Calls `onSubmit` with the reading_sessions columns it covers; `onSubmit` may
// be async and throw to show an error.
export default function SessionForm({ outline, onSubmit, submitLabel = 'Create', disabled = false }) {
  const [form, setForm] = useState(EMPTY)
  const [usePageNumbers, setUsePageNumbers] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const flat = flattenOutline(outline)
  const byPage = usePageNumbers || flat.length === 0
  const endSections = form.startSection ? sectionsAfter(outline, form.startSection) : flat
  const set = (patch) => setForm(f => ({ ...f, ...patch }))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)

    let startPage, endPage, startSection = null, endSection = null
    if (byPage) {
      startPage = parseInt(form.startPage)
      endPage = parseInt(form.endPage)
      if (!startPage || !endPage || endPage <= startPage) {
        setError('End page must be greater than start page.')
        return
      }
    } else {
      if (!isValidRange(outline, form.startSection, form.endSection)) {
        setError('End section must come after start section.')
        return
      }
      startSection = form.startSection
      endSection = form.endSection
      startPage = sectionPage(outline, startSection) ?? 1
      endPage = sectionPage(outline, endSection) ?? startPage + 1
    }

    setBusy(true)
    try {
      await onSubmit({
        name: form.name.trim() || `${startSection ?? `p.${startPage}`} → ${endSection ?? `p.${endPage}`}`,
        start_section: startSection,
        end_section: endSection,
        start_page: startPage,
        end_page: endPage,
      })
      setForm(EMPTY)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className={styles.form}>
      <input
        className={styles.input}
        placeholder="Session name (optional)"
        value={form.name}
        onChange={e => set({ name: e.target.value })}
        autoFocus
      />
      {flat.length > 0 && (
        <button type="button" className={styles.toggle} onClick={() => setUsePageNumbers(p => !p)}>
          {usePageNumbers ? 'Use sections instead' : 'Use page numbers instead'}
        </button>
      )}
      {byPage ? (
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>From page</label>
            <input className={styles.input} type="number" min="1" value={form.startPage} onChange={e => set({ startPage: e.target.value })} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>To page</label>
            <input className={styles.input} type="number" min="1" value={form.endPage} onChange={e => set({ endPage: e.target.value })} />
          </div>
        </div>
      ) : (
        <>
          <div className={styles.field}>
            <label className={styles.label}>From</label>
            <select className={styles.select} value={form.startSection} onChange={e => set({ startSection: e.target.value, endSection: '' })}>
              <option value="">Select section…</option>
              {flat.map((s, i) => <option key={i} value={s.title}>{s.title}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>To</label>
            <select className={styles.select} value={form.endSection} onChange={e => set({ endSection: e.target.value })} disabled={!form.startSection}>
              <option value="">Select section…</option>
              {endSections.map((s, i) => <option key={i} value={s.title}>{s.title}</option>)}
            </select>
          </div>
        </>
      )}
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.submit} type="submit" disabled={busy || disabled}>
        {busy ? 'Creating…' : submitLabel}
      </button>
    </form>
  )
}
