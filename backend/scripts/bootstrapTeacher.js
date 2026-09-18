import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDatabase } from '../config/database.js'
import { firebaseAdminAuth, firebaseAdminDb } from '../config/firebaseAdmin.js'
import User from '../models/User.js'
import Teacher from '../models/Teacher.js'

const authDomain = 'auth.student-attendance.app'
const usernamePattern = /^[a-z0-9](?:[a-z0-9._-]{0,28}[a-z0-9])?$/
const minimumPasswordLength = 8

function requiredEnvironment(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required in backend/.env.`)
  return value
}

function normalizeUsername(value) {
  return value.trim().toLowerCase()
}

function validateUsername(value) {
  const username = normalizeUsername(value)
  if (!usernamePattern.test(username)) {
    throw new Error('BOOTSTRAP_TEACHER_USERNAME must use 2-30 lowercase letters, numbers, dots, underscores, or hyphens.')
  }
  return username
}

function getBootstrapInput() {
  const username = validateUsername(requiredEnvironment('BOOTSTRAP_TEACHER_USERNAME'))
  const password = requiredEnvironment('BOOTSTRAP_TEACHER_PASSWORD')
  if (password.length < minimumPasswordLength) {
    throw new Error(`BOOTSTRAP_TEACHER_PASSWORD must be at least ${minimumPasswordLength} characters.`)
  }

  return {
    username,
    password,
    name: requiredEnvironment('BOOTSTRAP_TEACHER_NAME'),
    department: requiredEnvironment('BOOTSTRAP_TEACHER_DEPARTMENT'),
  }
}

function firebaseEmail(username) {
  return `${username}@${authDomain}`
}

async function getExistingState(username, email) {
  const [mongoUser, mapping] = await Promise.all([
    User.findOne({ username }).select('_id firebaseUid').lean(),
    firebaseAdminDb.collection('usernames').doc(username).get(),
  ])

  let firebaseUser = null
  try {
    firebaseUser = await firebaseAdminAuth.getUserByEmail(email)
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error
  }

  return { mongoUser, mapping, firebaseUser }
}

async function bootstrapTeacher() {
  const input = getBootstrapInput()

  if (!firebaseAdminAuth || !firebaseAdminDb) {
    throw new Error('Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in backend/.env.')
  }

  await connectDatabase()

  const email = firebaseEmail(input.username)
  const existing = await getExistingState(input.username, email)
  if (existing.mongoUser || existing.mapping.exists || existing.firebaseUser) {
    if (existing.mongoUser && existing.mapping.exists && existing.firebaseUser) {
      console.log(`Teacher already exists: username=${input.username} email=${email} role=TEACHER`)
      return
    }
    throw new Error('Bootstrap username is already partially configured. No changes were made; inspect the existing Firebase, Firestore, and MongoDB records before retrying.')
  }

  let firebaseUser
  let mongoUser
  let mongoTeacher
  try {
    firebaseUser = await firebaseAdminAuth.createUser({
      email,
      password: input.password,
      displayName: input.name,
    })

    mongoUser = await User.create({
      name: input.name,
      username: input.username,
      email,
      firebaseUid: firebaseUser.uid,
      role: 'TEACHER',
      status: 'ACTIVE',
    })

    mongoTeacher = await Teacher.create({
      userId: mongoUser._id,
      employeeId: input.username,
      name: input.name,
      department: input.department,
      active: true,
    })

    const now = new Date()
    const batch = firebaseAdminDb.batch()
    batch.set(firebaseAdminDb.collection('users').doc(firebaseUser.uid), {
      uid: firebaseUser.uid,
      username: input.username,
      role: 'TEACHER',
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    batch.set(firebaseAdminDb.collection('teachers').doc(firebaseUser.uid), {
      uid: firebaseUser.uid,
      username: input.username,
      name: input.name,
      department: input.department,
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    batch.set(firebaseAdminDb.collection('usernames').doc(input.username), {
      uid: firebaseUser.uid,
      username: input.username,
      role: 'TEACHER',
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    await batch.commit()

    console.log(`Teacher bootstrapped successfully: username=${input.username} email=${email} role=TEACHER`)
  } catch (error) {
    if (mongoTeacher) await Teacher.deleteOne({ _id: mongoTeacher._id }).catch(() => { })
    if (mongoUser) await User.deleteOne({ _id: mongoUser._id }).catch(() => { })
    if (firebaseUser) await firebaseAdminAuth.deleteUser(firebaseUser.uid).catch(() => { })
    throw error
  }
}

try {
  await bootstrapTeacher()
} catch (error) {
  console.error(`Teacher bootstrap failed: ${error.message}`)
  process.exitCode = 1
} finally {
  await mongoose.disconnect().catch(() => { })
}