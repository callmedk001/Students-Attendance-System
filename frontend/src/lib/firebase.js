import { getApp, getApps, initializeApp } from 'firebase/app'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const requiredFirebaseKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId']
export const hasFirebaseConfig = requiredFirebaseKeys.every((key) => Boolean(firebaseConfig[key]))

const app = hasFirebaseConfig
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null

let authPromise

export function getFirebaseAuth() {
  if (!app) return Promise.resolve(null)
  authPromise ||= import('firebase/auth').then(({ getAuth }) => getAuth(app))
  return authPromise
}

export async function requireFirebase() {
  const firebaseAuth = await getFirebaseAuth()
  if (!firebaseAuth) {
    throw new Error('Firebase Authentication is not configured. Add the VITE_FIREBASE_* values to frontend/.env.')
  }
  return { firebaseAuth }
}