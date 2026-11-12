import { Routes, Route, Navigate } from 'react-router-dom'
import { PdfProvider } from './context/PdfContext'
import UploadPage from './pages/UploadPage'
import ViewerPage from './pages/ViewerPage'

export default function App() {
  return (
    <PdfProvider>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/view" element={<ViewerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PdfProvider>
  )
}
