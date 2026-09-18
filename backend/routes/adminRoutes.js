import { Router } from 'express'
import { getAdminDashboard } from '../controllers/managementController.js'
import { adminManagementAccess } from '../middleware/managementAccess.js'

const router = Router()
router.use(adminManagementAccess)
router.get('/dashboard', getAdminDashboard)

export default router
