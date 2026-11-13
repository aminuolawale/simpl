import { Routes, Route, Navigate } from 'react-router-dom'
import { PdfProvider } from './context/PdfContext'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import CorporaPage from './pages/CorporaPage'
import CorpusPage from './pages/CorpusPage'
import StudyPage from './pages/StudyPage'
import SessionPage from './pages/SessionPage'
import UploadPage from './pages/UploadPage'
import ViewerPage from './pages/ViewerPage'
import LoginPage from './pages/LoginPage'
import CallbackPage from './pages/CallbackPage'

export default function App() {
  return (
    <AuthProvider>
      <PdfProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<CallbackPage />} />
          <Route path="/" element={<ProtectedRoute><CorporaPage /></ProtectedRoute>} />
          <Route path="/corpus/:id" element={<ProtectedRoute><CorpusPage /></ProtectedRoute>} />
          <Route path="/corpus/:id/study/:studyId" element={<ProtectedRoute><StudyPage /></ProtectedRoute>} />
          <Route path="/corpus/:id/study/:studyId/session/:sessionId" element={<ProtectedRoute><SessionPage /></ProtectedRoute>} />
          <Route path="/upload" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
          <Route path="/view" element={<ProtectedRoute><ViewerPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PdfProvider>
    </AuthProvider>
  )
}
