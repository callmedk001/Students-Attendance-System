import { firebaseAdminAuth } from '../config/firebaseAdmin.js'
import { authenticate } from './auth.js'
import { requireRole } from './roleCheck.js'

export function managementAccess(request, response, next) {
  if (!firebaseAdminAuth) {
    return response.status(503).json({ success: false, message: 'Firebase authentication is not configured.' })
  }
  return authenticate(request, response, () => requireRole(['TEACHER', 'ADMIN'])(request, response, next))
}

export function adminManagementAccess(request, response, next) {
  if (!firebaseAdminAuth) {
    return response.status(503).json({ success: false, message: 'Firebase authentication is not configured.' })
  }
  return authenticate(request, response, () => requireRole('ADMIN')(request, response, next))
}
