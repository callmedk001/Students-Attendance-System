import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { hasFirebaseConfig } from '../lib/firebase'
import PasswordField from '../components/PasswordField'

export default function Login() {
  const { isAuthenticated, login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const firebaseUnavailableMessage = 'Local demo mode: Firebase authentication is unavailable because Firebase configuration is not set. Login is disabled.'

  if (isAuthenticated) {
    const destination = user.role === 'ADMIN' ? '/admin/dashboard' : user.role === 'TEACHER' ? '/teacher/dashboard' : '/student/dashboard'
    return <Navigate to={location.state?.from?.pathname || destination} replace />
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')

    if (!hasFirebaseConfig) {
      setError(firebaseUnavailableMessage)
      return
    }

    if (!form.username || !form.password) {
      setError('Username and password are required.')
      return
    }

    setSubmitting(true)
    try {
      const loggedInUser = await login(form)
      const destination = loggedInUser.role === 'ADMIN' ? '/admin/dashboard' : loggedInUser.role === 'TEACHER' ? '/teacher/dashboard' : '/student/dashboard'
      navigate(destination, { replace: true })
    } catch (requestError) {
      const firebaseMessages = {
        'auth/invalid-credential': 'Invalid username or password.',
        'auth/user-disabled': 'This account is disabled.',
        'auth/network-request-failed': 'Network error. Check your connection and try again.',
        'permission-denied': 'Authentication succeeded, but Firestore profile access is blocked. Deploy the Firestore rules from firestore.rules and retry.',
      }

      const responseMessage = requestError?.response?.data?.message
      const code = requestError?.code
      const message = requestError?.message
      const connectionMessage = code === 'ERR_NETWORK' || !requestError?.response ? 'Unable to connect to the authentication service.' : ''

      setError(
        firebaseMessages[code]
          || responseMessage
          || (code === 'permission-denied' ? 'Authentication succeeded, but Firestore profile access is blocked. Deploy the Firestore rules from firestore.rules and retry.' : '')
          || connectionMessage
          || message
          || 'Unable to log in. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">Secure access</p>
        <h1 id="login-title">Student Attendance System</h1>
        <p className="intro">Sign in to continue to your role workspace.</p>
        {!hasFirebaseConfig && <p className="form-error" role="status">{firebaseUnavailableMessage}</p>}
        <form onSubmit={submit} noValidate>
          <label htmlFor="username">Username</label>
          <input id="username" name="username" type="text" autoComplete="username" placeholder="Enter your username" value={form.username} onChange={updateField} required />
          <label htmlFor="password">Password</label>
          <PasswordField id="password" name="password" value={form.password} placeholder="Enter your password" onChange={updateField} autoComplete="current-password" required />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" disabled={submitting || !hasFirebaseConfig}>{submitting ? 'Signing in...' : 'Login'}</button>
        </form>
      </section>
    </main>
  )
}
