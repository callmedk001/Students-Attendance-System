import User from '../models/User.js'
import { firebaseAdminAuth } from '../config/firebaseAdmin.js'

const allowedRoles = new Set(['ADMIN', 'TEACHER', 'STUDENT'])

export async function authenticate(request, response, next) {
  const authorization = request.headers.authorization
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : null

  if (!token) {
    return response.status(401).json({ success: false, message: 'Authentication required.' })
  }

  try {
    if (!firebaseAdminAuth) {
      return response.status(503).json({ success: false, message: 'Firebase authentication is not configured.' })
    }

    const payload = await firebaseAdminAuth.verifyIdToken(token)
    const username = payload.email?.endsWith('@auth.student-attendance.app')
      ? payload.email.slice(0, -'@auth.student-attendance.app'.length)
      : null
    const user = await User.findOne({
      $or: [
        { firebaseUid: payload.uid },
        ...(username ? [{ username: username.toLowerCase() }] : []),
        ...(payload.email ? [{ email: payload.email.toLowerCase() }] : []),
      ],
    })
    if (!user || user.status !== 'ACTIVE' || !allowedRoles.has(user.role)) {
      return response.status(401).json({ success: false, message: 'Firebase account is not linked to an active application profile.' })
    }
    request.user = { userId: user._id.toString(), role: user.role, firebaseUid: payload.uid }
    return next()
  } catch (_firebaseError) {
    return response.status(401).json({ success: false, message: 'Invalid or expired authentication token.' })
  }
}
