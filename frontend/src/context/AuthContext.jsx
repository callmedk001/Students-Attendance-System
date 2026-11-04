import { createContext, useContext, useEffect, useState } from 'react'
import { hasFirebaseConfig } from '../lib/firebase'
import { resolveUsername } from '../services/authApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    if (!hasFirebaseConfig) {
      setLoading(false)
      return undefined
    }

    let active = true
    let unsubscribe
    import('../services/firebaseAuth')
      .then(async ({ getUserProfile, observeAuth, signOutUser }) => {
        const stopObserving = await observeAuth(async (nextFirebaseUser) => {
          if (!active) return
          setFirebaseUser(nextFirebaseUser)
          if (!nextFirebaseUser) {
            setUser(null)
            setAuthError('')
            setLoading(false)
            return
          }

          try {
            const nextUser = await getUserProfile(nextFirebaseUser)
            if (active) {
              setUser(nextUser)
              setAuthError('')
            }
          } catch (error) {
            if (active) {
              setAuthError(error?.message || 'Unable to load your account profile.')
              try {
                await signOutUser()
              } catch (signOutError) {
                console.error('Unable to clear the invalid Firebase session.', signOutError)
              }
              setFirebaseUser(null)
              setUser(null)
            }
          } finally {
            if (active) setLoading(false)
          }
        })
        if (active) unsubscribe = stopObserving
        else stopObserving()
      })
      .catch((error) => {
        if (active) {
          setAuthError(error?.message || 'Unable to initialize authentication.')
          setLoading(false)
        }
      })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  async function login(credentials) {
    setAuthError('')
    const { email } = await resolveUsername(credentials.username)
    try {
      const { signIn } = await import('../services/firebaseAuth')
      const nextUser = await signIn({ ...credentials, email })
      setUser(nextUser)
      return nextUser
    } catch (error) {
      try {
        const { signOutUser } = await import('../services/firebaseAuth')
        await signOutUser()
      } catch (signOutError) {
        console.error('Unable to clear the failed Firebase login session.', signOutError)
      }
      setAuthError(error?.message || 'Unable to log in. Please try again.')
      throw error
    }
  }

  async function logout() {
    const { signOutUser } = await import('../services/firebaseAuth')
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
