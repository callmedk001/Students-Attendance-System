import { Router } from 'express'
import { getCurrentUser, login, logout, register, resolveUsername } from '../controllers/authController.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/roleCheck.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/resolve-username', resolveUsername)
router.get('/me', authenticate, getCurrentUser)
router.post('/logout', authenticate, logout)

// Development-only role checks for validating backend authorization.
router.get('/test-teacher', authenticate, requireRole('TEACHER'), (_request, response) => {
  response.json({ success: true, message: 'Teacher access granted.' })
})

router.get('/test-student', authenticate, requireRole('STUDENT'), (_request, response) => {
  response.json({ success: true, message: 'Student access granted.' })
})

export default router
