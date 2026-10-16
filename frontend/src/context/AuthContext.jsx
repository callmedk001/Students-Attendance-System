import { createContext, useContext, useEffect, useState } from 'react'
import { firebaseAuth, hasFirebaseConfig } from '../lib/firebase'
import { getUserProfile, observeAuth, signIn, signOutUser } from '../services/firebaseAuth'
import { resolveUsername } from '../services/authApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    if (!hasFirebaseConfig || !firebaseAuth) {
      setLoading(false)
      return undefined
    }

    return observeAuth(async (nextFirebaseUser) => {
      setFirebaseUser(nextFirebaseUser)
      if (!nextFirebaseUser) {
        setUser(null)
        setAuthError('')
        setLoading(false)
        return
      }

      try {
        setUser(await getUserProfile(nextFirebaseUser))
        setAuthError('')
      } catch (error) {
        setAuthError(error?.message || 'Unable to load your account profile.')
        try {
          await signOutUser()
        } catch (signOutError) {
          console.error('Unable to clear the invalid Firebase session.', signOutError)
        }
        setFirebaseUser(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    })
  }, [])

  async function login(credentials) {
    setAuthError('')
    const { email } = await resolveUsername(credentials.username)
    try {
      const nextUser = await signIn({ ...credentials, email })
      setUser(nextUser)
      return nextUser
    } catch (error) {
      try {
        await signOutUser()
      } catch (signOutError) {
        console.error('Unable to clear the failed Firebase login session.', signOutError)
      }
      setAuthError(error?.message || 'Unable to log in. Please try again.')
      throw error
    }
  }

  async function logout() {
    await signOutUser()
    setFirebaseUser(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, authError, isAuthenticated: Boolean(user && firebaseUser), login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
