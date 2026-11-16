import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { PdfProvider } from './context/PdfContext'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/AppShell'
import HomePage from './pages/HomePage'
import CorpusNewPage from './pages/CorpusNewPage'
import CorpusPage from './pages/CorpusPage'
import ResourcePage from './pages/ResourcePage'
import ResourceReaderPage from './pages/ResourceReaderPage'
import StudyNewPage from './pages/StudyNewPage'
import StudyPage from './pages/StudyPage'
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
          <Route element={protect(<AppShell />)}>
            <Route path="/" element={<HomePage />} />
            <Route path="/corpus/new" element={<CorpusNewPage />} />
            <Route path="/corpus/:id" element={<CorpusPage />} />
            <Route path="/resource/:id" element={<ResourcePage />} />
            <Route path="/study/new" element={<StudyNewPage />} />
            <Route path="/study/:studyId" element={<StudyPage />} />
          </Route>
          {/* Reader pages: full width, no side nav */}
          <Route path="/resource/:id/read" element={protect(<ResourceReaderPage />)} />
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
