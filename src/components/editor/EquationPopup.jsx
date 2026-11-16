import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import katex from 'katex'
import styles from './EditorPopups.module.css'

export function renderLatex(latex) {
  try {
    return { html: katex.renderToString(latex, { throwOnError: true, displayMode: false }) }
  } catch (e) {
    return { error: e.message.replace(/^KaTeX parse error:\s*/, '') }
  }
}

// A popup for typing LaTeX, with a live preview above the input.
// Enter submits (when the LaTeX is valid), Shift+Enter adds a line,
// Escape or clicking outside cancels.
const WIDTH = 480
const GAP = 6
const MARGIN = 8
export default function EquationPopup({ initial = '', rect, editing = false, onSubmit, onCancel }) {
  const [latex, setLatex] = useState(initial)
  const inputRef = useRef(null)
  const rootRef = useRef(null)
  const preview = useMemo(() => (latex.trim() ? renderLatex(latex) : null), [latex])
  // Open below the equation; flip above it if there isn't room below.
  const [above, setAbove] = useState(false)
  useLayoutEffect(() => {
    const height = rootRef.current?.offsetHeight ?? 0
    const roomBelow = window.innerHeight - rect.bottom - GAP - MARGIN
    setAbove(height > roomBelow && rect.top - GAP - MARGIN > roomBelow)
  }, [rect, preview])

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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!preview?.error) onSubmit(latex.trim())
    }
  }

  // Keep the popup inside the viewport.
  const width = Math.min(WIDTH, window.innerWidth - 2 * MARGIN)
  const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - width - MARGIN))
  const vertical = above
    ? { bottom: window.innerHeight - rect.top + GAP }
    : { top: rect.bottom + GAP }

  return (
    <div
      ref={rootRef}
      className={styles.equation}
      style={{ ...vertical, left, width }}
      role="dialog"
      aria-label={editing ? 'Edit equation' : 'Insert equation'}
    >
      <div className={styles.preview} aria-live="polite">
        {!preview ? (
          <span className={styles.previewEmpty}>Preview</span>
        ) : preview.error ? (
          <span className={styles.previewError}>{preview.error}</span>
        ) : (
          <span dangerouslySetInnerHTML={{ __html: preview.html }} />
        )}
      </div>
      <textarea
        ref={inputRef}
        className={styles.equationInput}
        value={latex}
        onChange={e => setLatex(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={'e.g. E = mc^2\n\nShift+Enter for a new line'}
        aria-label="LaTeX"
        rows={6}
        spellCheck={false}
        autoComplete="off"
      />
      <div className={styles.equationHint}>
        {preview?.error ? 'Fix the equation to insert it' :
          editing && !latex.trim() ? 'Enter to remove · Esc to cancel' :
          `Enter to ${editing ? 'update' : 'insert'} · Shift+Enter for a new line · Esc to cancel`}
      </div>
    </div>
  )
}
