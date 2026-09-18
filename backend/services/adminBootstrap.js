import 'dotenv/config'
import { firebaseAdminAuth, firebaseAdminDb } from '../config/firebaseAdmin.js'
import User from '../models/User.js'

const authDomain = 'auth.student-attendance.app'
const usernamePattern = /^[a-z0-9](?:[a-z0-9._-]{0,28}[a-z0-9])$/

function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function validateUsername(value) {
  const username = normalizeUsername(value)
  if (!usernamePattern.test(username)) {
    throw new Error('ADMIN_USERNAME must use 2-30 lowercase letters, numbers, dots, underscores, or hyphens.')
  }
  return username
}

function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required in backend/.env.`)
  }
  return value
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters long.')
  }
  return password
}

function firebaseEmail(username) {
  return `${username}@${authDomain}`
}

export async function ensureAdminBootstrap() {
  const username = validateUsername(process.env.ADMIN_USERNAME || requiredEnv('ADMIN_USERNAME'))
  const password = validatePassword(process.env.ADMIN_PASSWORD || requiredEnv('ADMIN_PASSWORD'))
  const displayName = (process.env.ADMIN_NAME || requiredEnv('ADMIN_NAME')).trim()

  if (!firebaseAdminAuth || !firebaseAdminDb) {
    throw new Error('Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in backend/.env.')
  }

  const email = firebaseEmail(username)
  const mongoUser = await User.findOne({ username }).lean()
  const usernameMapping = await firebaseAdminDb.collection('usernames').doc(username).get()
  let firebaseUser = null

  try {
    firebaseUser = await firebaseAdminAuth.getUserByEmail(email)
  } catch (error) {
    if (error.code !== 'auth/user-not-found') {
      throw error
    }
  }

  if (mongoUser && usernameMapping.exists && firebaseUser) {
    return {
      uid: mongoUser.firebaseUid || firebaseUser.uid,
      username,
      role: 'ADMIN',
      created: false,
    }
  }

  if (mongoUser || usernameMapping.exists || firebaseUser) {
    const existingUid = mongoUser?.firebaseUid || firebaseUser?.uid || usernameMapping.data()?.uid
    if (existingUid && !mongoUser) {
      const linkedUser = await User.findOne({ firebaseUid: existingUid }).lean()
      if (linkedUser) {
        return { uid: existingUid, username, role: linkedUser.role || 'ADMIN', created: false }
      }
    }
    return { uid: existingUid || null, username, role: 'ADMIN', created: false }
  }

  const createdUser = await firebaseAdminAuth.createUser({
    email,
    password,
    displayName,
  })

  const savedUser = await User.create({
    name: displayName,
    username,
    email,
    firebaseUid: createdUser.uid,
    role: 'ADMIN',
    status: 'ACTIVE',
  })

  const now = new Date()
  const batch = firebaseAdminDb.batch()
  batch.set(firebaseAdminDb.collection('users').doc(createdUser.uid), {
    uid: createdUser.uid,
    username,
    role: 'ADMIN',
    active: true,
    name: displayName,
    email,
    createdAt: now,
    updatedAt: now,
  })
  batch.set(firebaseAdminDb.collection('usernames').doc(username), {
    uid: createdUser.uid,
    username,
    role: 'ADMIN',
    active: true,
    createdAt: now,
    updatedAt: now,
  })
  await batch.commit()

  return {
    uid: createdUser.uid,
    username,
    role: 'ADMIN',
    created: true,
    mongoId: savedUser._id,
  }
}
