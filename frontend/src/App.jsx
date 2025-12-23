import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import CustomerDashboard from './pages/CustomerDashboard'
import UserDashboard from './pages/UserDashboard'
import ProjectDetail from './pages/ProjectDetail'
import NewProject from './pages/NewProject'
import Users from './pages/Users'

function ProtectedRoute({ children, allowedRoles }) {
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

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    const redirectMap = {
      admin: '/admin',
      customer: '/customer',
      user: '/dashboard'
    }
    return <Navigate to={redirectMap[user.role] || '/login'} replace />
  }

  return children
}

export default function App() {
  const { user } = useAuth()

  const getDefaultRoute = () => {
    if (!user) return '/login'
    const routeMap = {
      admin: '/admin',
      customer: '/customer',
      user: '/dashboard'
    }
    return routeMap[user.role] || '/login'
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={getDefaultRoute()} replace /> : <Login />} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/admin/new-project" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <NewProject />
        </ProtectedRoute>
      } />
      
      <Route path="/admin/users" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Users />
        </ProtectedRoute>
      } />
      
      {/* Customer Routes */}
      <Route path="/customer" element={
        <ProtectedRoute allowedRoles={['customer']}>
          <CustomerDashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/customer/new-project" element={
        <ProtectedRoute allowedRoles={['customer']}>
          <NewProject />
        </ProtectedRoute>
      } />
      
      <Route path="/customer/users" element={
        <ProtectedRoute allowedRoles={['customer']}>
          <Users />
        </ProtectedRoute>
      } />
      
      {/* User (Supplier) Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={['user']}>
          <UserDashboard />
        </ProtectedRoute>
      } />
      
      {/* Shared Routes */}
      <Route path="/project/:id" element={
        <ProtectedRoute>
          <ProjectDetail />
        </ProtectedRoute>
      } />
      
      <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
      <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
    </Routes>
  )
}

