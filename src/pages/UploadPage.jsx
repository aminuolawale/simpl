import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePdf } from '../context/PdfContext'
import styles from './UploadPage.module.css'

export default function UploadPage() {
  const { loadPdf } = usePdf()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleFile = useCallback(async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setError('Please select a PDF file.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await loadPdf(file)
      navigate('/view')
    } catch {
      setError('Could not read this PDF.')
      setLoading(false)
    }
  }, [loadPdf, navigate])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }, [handleFile])

  const onDragOver = useCallback((e) => { e.preventDefault(); setDragging(true) }, [])
  const onDragLeave = useCallback(() => setDragging(false), [])

  return (
    <div
      className={`${styles.root} ${dragging ? styles.dragging : ''}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className={styles.hiddenInput}
        onChange={(e) => handleFile(e.target.files[0])}
      />

      <div className={styles.inner}>
        <span className={styles.wordmark}>simpl</span>
        <div className={styles.divider} />

        {loading ? (
          <p className={styles.hint}>Loading…</p>
        ) : (
          <>
            <p className={styles.prompt}>Drop a PDF to begin reading</p>
            <button className={styles.browse} onClick={() => inputRef.current.click()}>
              or browse
            </button>
            {error && <p className={styles.error}>{error}</p>}
          </>
        )}
      </div>

      {dragging && <div className={styles.dropRect} />}
    </div>
  )
}
