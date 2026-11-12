import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePdf } from '../context/PdfContext'
import TopBar from '../components/TopBar'
import TocDrawer from '../components/TocDrawer'
import PageCanvas from '../components/PageCanvas'
import BottomBar from '../components/BottomBar'
import styles from './ViewerPage.module.css'

export default function ViewerPage() {
  const { pdfDoc } = usePdf()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (!pdfDoc) {
    navigate('/', { replace: true })
    return null
  }

  return (
    <div className={styles.root}>
      <TopBar
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen(o => !o)}
        onClose={() => navigate('/', { replace: true })}
      />
      <div className={styles.body}>
        <TocDrawer open={drawerOpen} />
        <PageCanvas />
      </div>
      <BottomBar />
    </div>
  )
}
