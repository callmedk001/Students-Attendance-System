import { Router } from 'express'
import { adminManagementAccess } from '../middleware/managementAccess.js'
import { createClass, createDepartment, createStudent, createSubject, createTeacher, deleteClass, deleteDepartment, deleteStudent, deleteSubject, deleteTeacher, listClasses, listDepartments, listStudents, listSubjects, listTeachers, updateClass, updateDepartment, updateStudent, updateSubject, updateTeacher } from '../controllers/managementController.js'

const router = Router()
router.use(adminManagementAccess)

router.get('/departments', listDepartments)
router.post('/departments', createDepartment)
router.put('/departments/:id', updateDepartment)
router.delete('/departments/:id', deleteDepartment)
router.get('/classes', listClasses)
router.post('/classes', createClass)
router.put('/classes/:id', updateClass)
router.delete('/classes/:id', deleteClass)
router.get('/subjects', listSubjects)
router.post('/subjects', createSubject)
router.put('/subjects/:id', updateSubject)
router.delete('/subjects/:id', deleteSubject)
router.get('/teachers', listTeachers)
router.post('/teachers', createTeacher)
router.put('/teachers/:id', updateTeacher)
router.delete('/teachers/:id', deleteTeacher)
router.get('/students', listStudents)
router.post('/students', createStudent)
router.put('/students/:id', updateStudent)
router.delete('/students/:id', deleteStudent)

export default router
