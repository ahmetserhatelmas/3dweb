import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import UserDashboard from './pages/UserDashboard'
import ProjectDetail from './pages/ProjectDetail'
import NewProject from './pages/NewProject'
import Users from './pages/Users'

function ProtectedRoute({ children, allowedRole }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Yükleniyor...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
  }

  return children
}

export default function App() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace /> : <Login />} />
      
      <Route path="/admin" element={
        <ProtectedRoute allowedRole="admin">
          <AdminDashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/admin/new-project" element={
        <ProtectedRoute allowedRole="admin">
          <NewProject />
        </ProtectedRoute>
      } />
      
      <Route path="/admin/users" element={
        <ProtectedRoute allowedRole="admin">
          <Users />
        </ProtectedRoute>
      } />
      
      <Route path="/dashboard" element={
        <ProtectedRoute allowedRole="user">
          <UserDashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/project/:id" element={
        <ProtectedRoute>
          <ProjectDetail />
        </ProtectedRoute>
      } />
      
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

