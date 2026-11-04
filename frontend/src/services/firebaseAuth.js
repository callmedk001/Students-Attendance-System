import { getFirebaseAuth, requireFirebase } from '../lib/firebase'
import api from './api'

const allowedRoles = new Set(['ADMIN', 'TEACHER', 'STUDENT'])
const usernamePattern = /^[a-z0-9](?:[a-z0-9._-]{0,28}[a-z0-9])$/
const authIdentifierDomain = 'auth.student-attendance.app'

export function normalizeUsername(username) {
  return typeof username === 'string' ? username.trim().toLowerCase() : ''
}

export function validateUsername(username) {
  const normalizedUsername = normalizeUsername(username)
  if (!normalizedUsername) throw new Error('Username is required.')
  if (!usernamePattern.test(normalizedUsername)) {
    throw new Error('Username must use 2-30 letters, numbers, dots, underscores, or hyphens.')
  }
  return normalizedUsername
}

export function usernameToAuthIdentifier(username) {
  return `${validateUsername(username)}@${authIdentifierDomain}`
}

export async function signIn(credentials) {
  const { firebaseAuth: auth } = await requireFirebase()
  const { signInWithEmailAndPassword } = await import('firebase/auth')
  const identifier = credentials.email || usernameToAuthIdentifier(credentials.username)
  const result = await signInWithEmailAndPassword(auth, identifier, credentials.password)
  return getUserProfile(result.user)
}

export async function observeAuth(callback) {
  const { firebaseAuth: auth } = await requireFirebase()
  const { onAuthStateChanged } = await import('firebase/auth')
  return onAuthStateChanged(auth, callback)
}

export async function signOutUser() {
  const { firebaseAuth: auth } = await requireFirebase()
  const { signOut } = await import('firebase/auth')
  await signOut(auth)
}

export async function getUserProfile(firebaseUser) {
  if (!firebaseUser || !await getFirebaseAuth()) throw new Error('Authenticated Firebase user is unavailable.')

  const response = await api.get('/auth/me')
  const profile = response.data.user
  const profileUsername = validateUsername(profile.username)
  if (!allowedRoles.has(profile.role)) throw new Error('Your account has an unauthorized role.')
  if (profile.status !== 'ACTIVE') throw new Error('Your account is unavailable.')
  if (firebaseUser.email !== usernameToAuthIdentifier(profileUsername)) throw new Error('Your username profile does not match your authentication account.')

  return {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    name: profile.name || firebaseUser.displayName || profileUsername,
    username: profileUsername,
    role: profile.role,
    status: profile.status,
  }
}