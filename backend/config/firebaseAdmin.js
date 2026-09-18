import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../.env') })

function getFirebasePrivateKey() {
  const rawKey = process.env.FIREBASE_PRIVATE_KEY
  if (!rawKey) return ''
  return rawKey.replace(/\\n/g, '\n').replace(/\r/g, '')
}

const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
const privateKey = getFirebasePrivateKey()
const hasServiceCredentials = Boolean(projectId && clientEmail && privateKey)

let app = null

if (hasServiceCredentials) {
  try {
    app = getApps().length
      ? getApps()[0]
      : initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      })
    console.log('Firebase Admin initialized successfully')
  } catch (error) {
    console.warn('Firebase Admin not configured')
    console.warn(error.message)
    app = null
  }
} else {
  console.warn('Firebase Admin not configured')
}

export const firebaseAdminAuth = app ? getAuth(app) : null
export const firebaseAdminDb = app ? getFirestore(app) : null
export const firebaseAdminReady = Boolean(firebaseAdminAuth && firebaseAdminDb)