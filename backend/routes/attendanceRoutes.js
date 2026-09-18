import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/roleCheck.js'
import { createSession, getSession, listSessions, saveRecords, updateRecord, updateSession } from '../controllers/attendanceController.js'

const router = Router()
const teacherOnly = [authenticate, requireRole('TEACHER')]

router.post('/sessions', ...teacherOnly, createSession)
router.get('/sessions', ...teacherOnly, listSessions)
router.get('/sessions/:id', ...teacherOnly, getSession)
router.put('/sessions/:id', ...teacherOnly, updateSession)
router.post('/sessions/:id/records', ...teacherOnly, saveRecords)
router.put('/records/:id', ...teacherOnly, updateRecord)

export default router
