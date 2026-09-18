import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ role }) {
  const { loading, isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return <main className="setup-page"><p className="health-message">Checking authentication...</p></main>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (role && user.role !== role) {
    const destination = user.role === 'ADMIN' ? '/admin/dashboard' : user.role === 'TEACHER' ? '/teacher/dashboard' : '/student/dashboard'
    return <Navigate to={destination} replace />
  }

  return <Outlet />
}
