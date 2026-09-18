import { Router } from 'express'
import { adminManagementAccess } from '../middleware/managementAccess.js'
import { createAssignment, createClass, createDepartment, createStudent, createSubject, createTeacher, createTimetable, deleteAssignment, deleteClass, deleteDepartment, deleteStudent, deleteSubject, deleteTeacher, deleteTimetable, listAssignments, listClasses, listDepartments, listStudents, listSubjects, listTeachers, listTimetables, updateClass, updateDepartment, updateStudent, updateSubject, updateTeacher, updateTimetable } from '../controllers/managementController.js'

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
router.get('/assignments', listAssignments)
router.post('/assignments', createAssignment)
router.delete('/assignments/:id', deleteAssignment)
router.get('/timetables', listTimetables)
router.post('/timetables', createTimetable)
router.put('/timetables/:id', updateTimetable)
router.delete('/timetables/:id', deleteTimetable)

export default router
