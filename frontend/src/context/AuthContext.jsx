import { createContext, useContext, useEffect, useState } from 'react'
import { firebaseAuth, hasFirebaseConfig } from '../lib/firebase'
import { getUserProfile, observeAuth, signIn, signOutUser } from '../services/firebaseAuth'
import { resolveUsername } from '../services/authApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hasFirebaseConfig || !firebaseAuth) {
      setLoading(false)
      return undefined
    }

    return observeAuth(async (nextFirebaseUser) => {
      setFirebaseUser(nextFirebaseUser)
      if (!nextFirebaseUser) {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        setUser(await getUserProfile(nextFirebaseUser))
      } catch (_error) {
        await signOutUser().catch(() => {})
        setFirebaseUser(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    })
  }, [])

  async function login(credentials) {
    const { email } = await resolveUsername(credentials.username)
    try {
      const nextUser = await signIn({ ...credentials, email })
      setUser(nextUser)
      return nextUser
    } catch (error) {
      await signOutUser().catch(() => {})
      throw error
    }
  }

  async function logout() {
    await signOutUser()
    setFirebaseUser(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, isAuthenticated: Boolean(user && firebaseUser), login, logout }}>
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
