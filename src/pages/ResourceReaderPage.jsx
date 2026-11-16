import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getSignedUrl } from '../lib/storage'
import { usePdf } from '../context/PdfContext'
import AppBar from '../components/AppBar'
import TocDrawer from '../components/TocDrawer'
import PageCanvas from '../components/PageCanvas'
import BottomBar from '../components/BottomBar'
import styles from '../styles/reader.module.css'

export default function ResourceReaderPage() {
  const { id } = useParams()
  const { loadPdfFromUrl, currentPage, pageCount } = usePdf()
  const [resource, setResource] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pdfReady, setPdfReady] = useState(false)
  const [error, setError] = useState(null)
  const savedPage = useRef(null)

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      setPdfReady(false)
      setError(null)
      const { data, error } = await supabase.from('resources')
        .select('id, name, storage_path, outline, last_page')
        .eq('id', id)
        .single()
      if (cancelled) return
      if (error || !data) { setError('Could not find this PDF.'); return }
      setResource(data)
      try {
        const url = await getSignedUrl(supabase, data.storage_path)
        if (cancelled) return
        savedPage.current = data.last_page ?? 1
        await loadPdfFromUrl(url, savedPage.current, data.outline)
        if (!cancelled) setPdfReady(true)
      } catch {
        if (!cancelled) setError('Could not load this PDF.')
      }
    }
    init()
    return () => { cancelled = true }
  }, [id, loadPdfFromUrl])

  // Save the current page shortly after the reader settles on it, so the
  // jumps while the PDF first lays out and scrolls aren't recorded.
  const latestPage = useRef(null)
  useEffect(() => {
    if (!pdfReady || !currentPage) return
    latestPage.current = Math.min(currentPage, pageCount || currentPage)
    const t = setTimeout(() => saveLastPage(id, latestPage.current, savedPage), 1000)
    return () => clearTimeout(t)
  }, [id, pdfReady, currentPage, pageCount])

  // Flush the latest page on leaving the reader or closing the tab.
  useEffect(() => {
    const flush = () => saveLastPage(id, latestPage.current, savedPage)
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
      latestPage.current = null
    }
  }, [id])

  return (
    <div className={styles.root}>
      <AppBar
        crumbs={[
          ...(resource ? [{ label: resource.name, to: `/resource/${id}` }] : []),
          { label: 'Read' },
        ]}
      />
      <div className={styles.body}>
        {error ? (
          <p className={styles.message}>{error}</p>
        ) : !pdfReady ? (
          <p className={styles.message}>Loading…</p>
        ) : (
          <>
            <TocDrawer open={drawerOpen} />
            <div className={styles.pdfPane}>
              <PageCanvas />
            </div>
          </>
        )}
      </div>
      <BottomBar drawerOpen={drawerOpen} onToggleDrawer={() => setDrawerOpen(o => !o)} />
    </div>
  )
}

function saveLastPage(resourceId, page, savedPage) {
  if (!page || page === savedPage.current) return
  savedPage.current = page
  supabase.from('resources').update({ last_page: page }).eq('id', resourceId)
    .then(({ error }) => { if (error) savedPage.current = null })
}
