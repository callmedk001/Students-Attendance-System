import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { firebaseAdminAuth, firebaseAdminDb } from '../config/firebaseAdmin.js'

const allowedRoles = ['ADMIN', 'TEACHER', 'STUDENT']
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const passwordMinimumLength = 8
const internalAuthDomain = 'auth.student-attendance.app'
const usernamePattern = /^[a-z0-9](?:[a-z0-9._-]{0,28}[a-z0-9])$/

function publicEmail(email) {
  const normalizedEmail = normalizeEmail(email)
  return normalizedEmail.endsWith(`@${internalAuthDomain}`) ? null : email
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: publicEmail(user.email),
    role: user.role,
    status: user.status,
  }
}

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.')
  }

  return jwt.sign(
    { userId: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' },
  )
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function normalizeUsername(username) {
  return typeof username === 'string' ? username.trim().toLowerCase() : ''
}

export async function resolveUsername(request, response, next) {
  try {
    if (!firebaseAdminAuth || !firebaseAdminDb) {
      return response.status(503).json({
        success: false,
        message: 'Firebase Admin SDK is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in backend/.env.',
      })
    }

    const username = normalizeUsername(request.body?.username)
    if (!username || !usernamePattern.test(username)) {
      return response.status(400).json({ success: false, message: 'Username is invalid.' })
    }

    const mappingSnapshot = await firebaseAdminDb.collection('usernames').doc(username).get()
    if (!mappingSnapshot.exists) {
      return response.status(401).json({ success: false, message: 'Invalid username or password.' })
    }

    const mapping = mappingSnapshot.data()
    if (mapping.active !== true) {
      return response.status(401).json({ success: false, message: 'This account is inactive.' })
    }

    const { uid, role } = mapping
    if (!uid || !allowedRoles.includes(role)) {
      return response.status(401).json({ success: false, message: 'Invalid username or password.' })
    }

    const firebaseUser = await firebaseAdminAuth.getUser(uid)
    if (firebaseUser.disabled || !firebaseUser.email) {
      return response.status(401).json({ success: false, message: 'This account is disabled.' })
    }

    return response.json({
      success: true,
      uid,
      username,
      role,
      active: mapping.active === true,
      email: firebaseUser.email,
    })
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return response.status(401).json({ success: false, message: 'Invalid username or password.' })
    }
    return next(error)
  }
}

export async function register(request, response, next) {
  try {
    const { name, password, role } = request.body
    const email = normalizeEmail(request.body.email)

    if (!name?.trim() || !email || !password || !role) {
      return response.status(400).json({ success: false, message: 'Name, email, password, and role are required.' })
    }

    if (!emailPattern.test(email)) {
      return response.status(400).json({ success: false, message: 'Please provide a valid email address.' })
    }

    if (password.length < passwordMinimumLength) {
      return response.status(400).json({ success: false, message: `Password must be at least ${passwordMinimumLength} characters.` })
    }

    if (!allowedRoles.includes(role)) {
      return response.status(400).json({ success: false, message: 'Role must be TEACHER or STUDENT.' })
    }

    const existingUser = await User.findOne({ email }).lean()
    if (existingUser) {
      return response.status(409).json({ success: false, message: 'An account with this email already exists.' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({
      name: name.trim(),
      email,
      passwordHash,
      role,
      status: 'ACTIVE',
    })

    return response.status(201).json({ success: true, user: publicUser(user) })
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({ success: false, message: 'An account with this email already exists.' })
    }
    return next(error)
  }
}

export async function login(request, response, next) {
  try {
    const email = normalizeEmail(request.body.email)
    const { password } = request.body

    if (!email || !password) {
      return response.status(400).json({ success: false, message: 'Email and password are required.' })
    }

    if (!emailPattern.test(email)) {
      return response.status(400).json({ success: false, message: 'Please provide a valid email address.' })
    }

    const user = await User.findOne({ email })
    if (!user) {
      return response.status(401).json({ success: false, message: 'Invalid email or password.' })
    }

    if (user.status !== 'ACTIVE') {
      return response.status(401).json({ success: false, message: 'This account is inactive.' })
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash)
    if (!passwordMatches) {
      return response.status(401).json({ success: false, message: 'Invalid email or password.' })
    }

    return response.json({ success: true, token: createToken(user), user: publicUser(user) })
  } catch (error) {
    return next(error)
  }
}

export async function getCurrentUser(request, response, next) {
  try {
    const user = await User.findById(request.user.userId).select('-passwordHash')
    if (!user || user.status !== 'ACTIVE') {
      return response.status(401).json({ success: false, message: 'User is no longer available.' })
    }

    return response.json({ success: true, user: publicUser(user) })
  } catch (error) {
    return next(error)
  }
}

export function logout(_request, response) {
  return response.json({ success: true, message: 'Logged out successfully.' })
}

export { publicUser }
