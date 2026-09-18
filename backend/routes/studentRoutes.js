import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/roleCheck.js'
import { getAttendance, getMonthly, getPeriods, getProfile, getSubjects, getSummary } from '../controllers/studentController.js'

const router = Router()
const studentOnly = [authenticate, requireRole('STUDENT')]

router.get('/profile', ...studentOnly, getProfile)
router.get('/attendance/summary', ...studentOnly, getSummary)
router.get('/attendance/monthly', ...studentOnly, getMonthly)
router.get('/attendance/subjects', ...studentOnly, getSubjects)
router.get('/attendance/periods', ...studentOnly, getPeriods)
router.get('/attendance', ...studentOnly, getAttendance)

export default router
