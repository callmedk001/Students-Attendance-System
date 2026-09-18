import { firebaseAdminDb } from '../config/firebaseAdmin.js'

export function requireRole(role) {
  const allowedRoles = Array.isArray(role) ? role : [role]
  return (request, response, next) => {
    if (!request.user?.role || !allowedRoles.includes(request.user.role)) {
      return response.status(403).json({ success: false, message: 'You do not have permission to access this resource.' })
    }

    return next()
  }
}

export function requireFirestoreRole(role) {
  return async (request, response, next) => {
    if (!firebaseAdminDb || !request.user?.firebaseUid) {
      return response.status(503).json({ success: false, message: 'Secure Firebase account management is not configured.' })
    }

    try {
      const snapshot = await firebaseAdminDb.collection('users').doc(request.user.firebaseUid).get()
      const profile = snapshot.exists ? snapshot.data() : null
      if (!profile || profile.uid !== request.user.firebaseUid || profile.role !== role || profile.active !== true) {
        return response.status(403).json({ success: false, message: 'You are not authorized to perform this action.' })
      }
      return next()
    } catch (_error) {
      return response.status(503).json({ success: false, message: 'Secure account authorization is unavailable.' })
    }
  }
}
