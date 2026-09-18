import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { firebaseAuth, firestore, requireFirebase } from '../lib/firebase'

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
  const { firebaseAuth: auth } = requireFirebase()
  const identifier = credentials.email || usernameToAuthIdentifier(credentials.username)
  const result = await signInWithEmailAndPassword(auth, identifier, credentials.password)
  return getUserProfile(result.user)
}

export function observeAuth(callback) {
  requireFirebase()
  return onAuthStateChanged(firebaseAuth, callback)
}

export async function signOutUser() {
  const { firebaseAuth: auth } = requireFirebase()
  await signOut(auth)
}

export async function getUserProfile(firebaseUser) {
  if (!firestore || !firebaseUser) throw new Error('Authenticated Firebase user is unavailable.')

  try {
    const snapshot = await getDoc(doc(firestore, 'users', firebaseUser.uid))
    if (!snapshot.exists()) throw new Error('Your account profile has not been configured yet.')

    const profile = snapshot.data()
    if (profile.uid !== firebaseUser.uid) throw new Error('Your account profile is invalid.')
    if (!allowedRoles.has(profile.role)) throw new Error('Your account has an unauthorized role.')
    if (profile.active === false) throw new Error('Your account is unavailable.')
    const profileUsername = validateUsername(profile.username)
    if (firebaseUser.email !== usernameToAuthIdentifier(profileUsername)) throw new Error('Your username profile does not match your authentication account.')

    return {
      id: firebaseUser.uid,
      uid: firebaseUser.uid,
      name: profile.name || firebaseUser.displayName || profileUsername,
      username: profileUsername,
      role: profile.role,
      status: 'ACTIVE',
    }
  } catch (error) {
    if (error?.code === 'permission-denied') {
      const permissionError = new Error('Authentication succeeded, but Firestore profile access is blocked. Deploy the Firestore rules from firestore.rules and retry.')
      permissionError.code = 'permission-denied'
      throw permissionError
    }
    throw error
  }
}