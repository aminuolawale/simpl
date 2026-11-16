import { useEffect, useMemo, useRef, useState } from 'react'
import katex from 'katex'
import styles from './EditorPopups.module.css'

export function renderLatex(latex) {
  try {
    return { html: katex.renderToString(latex, { throwOnError: true, displayMode: false }) }
  } catch (e) {
    return { error: e.message.replace(/^KaTeX parse error:\s*/, '') }
  }
}

// A small popup for typing LaTeX with a live preview.
// Enter submits (when the LaTeX is valid), Escape or clicking outside cancels.
export default function EquationPopup({ initial = '', rect, editing = false, onSubmit, onCancel }) {
  const [latex, setLatex] = useState(initial)
  const inputRef = useRef(null)
  const rootRef = useRef(null)
  const preview = useMemo(() => (latex.trim() ? renderLatex(latex) : null), [latex])

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) onCancel() }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onCancel])

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onCancel() }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!preview?.error) onSubmit(latex.trim())
    }
  }

  // Keep the popup inside the viewport.
  const width = 340
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))

  return (
    <div
      ref={rootRef}
      className={styles.equation}
      style={{ top: rect.bottom + 6, left, width }}
      role="dialog"
      aria-label={editing ? 'Edit equation' : 'Insert equation'}
    >
      <input
        ref={inputRef}
        className={styles.equationInput}
        value={latex}
        onChange={e => setLatex(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="e.g. E = mc^2"
        aria-label="LaTeX"
        spellCheck={false}
        autoComplete="off"
      />
      <div className={styles.preview} aria-live="polite">
        {!preview ? (
          <span className={styles.previewEmpty}>Preview</span>
        ) : preview.error ? (
          <span className={styles.previewError}>{preview.error}</span>
        ) : (
          <span dangerouslySetInnerHTML={{ __html: preview.html }} />
        )}
      </div>
      <div className={styles.equationHint}>
        {preview?.error ? 'Fix the equation to insert it' :
          editing && !latex.trim() ? 'Enter to remove · Esc to cancel' :
          `Enter to ${editing ? 'update' : 'insert'} · Esc to cancel`}
      </div>
    </div>
  )
}
