import { Routes, Route, Navigate } from 'react-router-dom'
import { PdfProvider } from './context/PdfContext'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
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
          <Route path="/" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
          <Route path="/view" element={<ProtectedRoute><ViewerPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PdfProvider>
    </AuthProvider>
  )
}
