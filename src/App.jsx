import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { PdfProvider } from './context/PdfContext'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import CorpusNewPage from './pages/CorpusNewPage'
import CorpusPage from './pages/CorpusPage'
import ResourcePage from './pages/ResourcePage'
import StudyNewPage from './pages/StudyNewPage'
import StudyPage from './pages/StudyPage'
import SessionNewPage from './pages/SessionNewPage'
import SessionPage from './pages/SessionPage'
import NotePage from './pages/NotePage'
import UploadPage from './pages/UploadPage'
import ViewerPage from './pages/ViewerPage'
import LoginPage from './pages/LoginPage'
import CallbackPage from './pages/CallbackPage'

const protect = (page) => <ProtectedRoute>{page}</ProtectedRoute>

// Old nested URLs (/corpus/:id/study/:studyId[/session/:sessionId]) → flat ones.
function LegacyStudyRedirect() {
  const { studyId } = useParams()
  return <Navigate to={`/study/${studyId}`} replace />
}
function LegacySessionRedirect() {
  const { sessionId } = useParams()
  return <Navigate to={`/session/${sessionId}`} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <PdfProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<CallbackPage />} />
          <Route path="/" element={protect(<HomePage />)} />
          <Route path="/corpus/new" element={protect(<CorpusNewPage />)} />
          <Route path="/corpus/:id" element={protect(<CorpusPage />)} />
          <Route path="/resource/:id" element={protect(<ResourcePage />)} />
          <Route path="/study/new" element={protect(<StudyNewPage />)} />
          <Route path="/study/:studyId" element={protect(<StudyPage />)} />
          <Route path="/session/new" element={protect(<SessionNewPage />)} />
          <Route path="/session/:sessionId" element={protect(<SessionPage />)} />
          <Route path="/note/:noteId" element={protect(<NotePage />)} />
          <Route path="/corpus/:id/study/:studyId" element={<LegacyStudyRedirect />} />
          <Route path="/corpus/:id/study/:studyId/session/:sessionId" element={<LegacySessionRedirect />} />
          <Route path="/upload" element={protect(<UploadPage />)} />
          <Route path="/view" element={protect(<ViewerPage />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PdfProvider>
    </AuthProvider>
  )
}
