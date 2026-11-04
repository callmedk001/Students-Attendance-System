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
  const mongoUserByUsername = await User.findOne({ username }).lean()
  const usernameMapping = await firebaseAdminDb.collection('usernames').doc(username).get()
  const mapping = usernameMapping.exists ? usernameMapping.data() : null
  let firebaseUser = null

  try {
    firebaseUser = await firebaseAdminAuth.getUserByEmail(email)
  } catch (error) {
    if (error.code !== 'auth/user-not-found') {
      throw error
    }
  }

  const existingUids = new Set([
    mongoUserByUsername?.firebaseUid,
    mapping?.uid,
    firebaseUser?.uid,
  ].filter(Boolean))
  if (existingUids.size > 1) {
    throw new Error('Admin account records do not agree on the Firebase UID; manual reconciliation is required.')
  }

  let createdFirebaseUser = false
  let uid = [...existingUids][0]
  if (uid && !firebaseUser) {
    try {
      firebaseUser = await firebaseAdminAuth.getUser(uid)
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        throw new Error('Admin account records reference a missing Firebase user; manual reconciliation is required.')
      }
      throw error
    }
  }

  if (!uid) {
    firebaseUser = await firebaseAdminAuth.createUser({ email, password, displayName })
    uid = firebaseUser.uid
    createdFirebaseUser = true
  }

  if (firebaseUser.email?.trim().toLowerCase() !== email || firebaseUser.disabled) {
    throw new Error('Admin Firebase account email or status does not match the configured admin; manual reconciliation is required.')
  }

  const mongoUserByUid = await User.findOne({ firebaseUid: uid }).lean()
  if (mongoUserByUsername && mongoUserByUid
    && mongoUserByUsername._id.toString() !== mongoUserByUid._id.toString()) {
    throw new Error('Admin username and Firebase UID belong to different MongoDB users; manual reconciliation is required.')
  }

  const mongoUser = mongoUserByUsername || mongoUserByUid
  if (mongoUser) {
    if ((mongoUser.username && mongoUser.username !== username)
      || mongoUser.email?.trim().toLowerCase() !== email
      || (mongoUser.firebaseUid && mongoUser.firebaseUid !== uid)
      || mongoUser.role !== 'ADMIN'
      || mongoUser.status !== 'ACTIVE') {
      throw new Error('Existing MongoDB admin profile conflicts with the configured account; manual reconciliation is required.')
    }

    if (!mongoUser.firebaseUid || !mongoUser.username) {
      await User.updateOne(
        { _id: mongoUser._id },
        { $set: { firebaseUid: uid, username } },
      )
    }
  } else {
    await User.create({
      name: displayName,
      username,
      email,
      firebaseUid: uid,
      role: 'ADMIN',
      status: 'ACTIVE',
    })
  }

  const userProfileRef = firebaseAdminDb.collection('users').doc(uid)
  const userProfileSnapshot = await userProfileRef.get()
  const userProfile = userProfileSnapshot.exists ? userProfileSnapshot.data() : null
  if (userProfile && (
    (userProfile.uid && userProfile.uid !== uid)
    || (userProfile.username && userProfile.username !== username)
    || (userProfile.role && userProfile.role !== 'ADMIN')
    || userProfile.active === false
  )) {
    throw new Error('Existing Firestore admin profile conflicts with the configured account; manual reconciliation is required.')
  }
  if (mapping && (
    (mapping.uid && mapping.uid !== uid)
    || (mapping.username && mapping.username !== username)
    || (mapping.role && mapping.role !== 'ADMIN')
    || mapping.active === false
  )) {
    throw new Error('Existing Firestore username mapping conflicts with the configured admin; manual reconciliation is required.')
  }

  const now = new Date()
  const batch = firebaseAdminDb.batch()
  batch.set(userProfileRef, {
    uid,
    username,
    role: 'ADMIN',
    active: true,
    name: userProfile?.name || displayName,
    email,
    createdAt: userProfile?.createdAt || now,
    updatedAt: now,
  }, { merge: true })
  batch.set(firebaseAdminDb.collection('usernames').doc(username), {
    uid,
    username,
    role: 'ADMIN',
    active: true,
    createdAt: mapping?.createdAt || now,
    updatedAt: now,
  }, { merge: true })
  await batch.commit()

  return {
    uid,
    username,
    role: 'ADMIN',
    created: createdFirebaseUser,
  }
}
