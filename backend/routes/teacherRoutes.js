import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireFirestoreRole, requireRole } from '../middleware/roleCheck.js'
import { createManagedStudent, getAttendanceHistory, getAttendancePercentage, getClasses, getDashboard, getManagedStudents, getProfile, getStudentsByClass, getSubjectsByClass } from '../controllers/teacherController.js'

const router = Router()
const teacherOnly = [authenticate, requireRole('TEACHER')]
const accountManager = [authenticate, requireRole('TEACHER'), requireFirestoreRole('TEACHER')]

router.get('/dashboard', ...teacherOnly, getDashboard)
router.get('/profile', ...teacherOnly, getProfile)
router.get('/classes', ...teacherOnly, getClasses)
router.get('/classes/:classId/students', ...teacherOnly, getStudentsByClass)
router.get('/classes/:classId/subjects', ...teacherOnly, getSubjectsByClass)
router.get('/attendance-history', ...teacherOnly, getAttendanceHistory)
router.get('/attendance-percentage', ...teacherOnly, getAttendancePercentage)
router.get('/students', ...accountManager, getManagedStudents)
router.post('/students', ...accountManager, createManagedStudent)

export default router
