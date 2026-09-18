import mongoose from 'mongoose'
import ClassModel from '../models/Class.js'
import Department from '../models/Department.js'
import Subject from '../models/Subject.js'
import Teacher from '../models/Teacher.js'
import Student from '../models/Student.js'
import User from '../models/User.js'
import Timetable from '../models/Timetable.js'
import TeachingAssignment from '../models/TeachingAssignment.js'
import { firebaseAdminAuth, firebaseAdminDb } from '../config/firebaseAdmin.js'

const authDomain = 'auth.student-attendance.app'
const usernamePattern = /^[a-z0-9](?:[a-z0-9._-]{0,28}[a-z0-9])?$/
const minimumPasswordLength = 8

function error(status, message) { const result = new Error(message); result.status = status; return result }
function required(value, label) { const result = typeof value === 'string' ? value.trim() : ''; if (!result) throw error(400, `${label} is required.`); return result }
function positive(value, label) { const result = Number(value); if (!Number.isInteger(result) || result < 1) throw error(400, `${label} must be a valid positive number.`); return result }
function id(value, label) { if (!mongoose.isValidObjectId(value)) throw error(400, `${label} is invalid.`); return value }
function bool(value) { return value === undefined ? true : Boolean(value) }
function username(value) { const result = typeof value === 'string' ? value.trim().toLowerCase() : ''; if (!usernamePattern.test(result)) throw error(400, 'Username must use 2-30 safe characters.'); return result }
function password(value, confirmation) { if (typeof value !== 'string' || value.length < minimumPasswordLength) throw error(400, `Password must be at least ${minimumPasswordLength} characters.`); if (value !== confirmation) throw error(400, 'Passwords do not match.'); return value }
function firebaseReady() { if (!firebaseAdminAuth || !firebaseAdminDb) throw error(503, 'Secure Firebase account management is not configured.') }
function authEmail(userName) { return `${userName}@${authDomain}` }
async function find(Model, value, label) { const result = await Model.findById(id(value, label)); if (!result) throw error(404, `${label} not found.`); return result }
function departmentDto(item) { return { id: item._id, name: item.name, code: item.code, active: item.active } }
function classDto(item) { return { id: item._id, name: item.className, section: item.section, department: item.department, year: item.year, active: item.active } }
function subjectDto(item) { return { id: item._id, name: item.subjectName, code: item.subjectCode, department: item.department, section: item.classId?.section || item.section, year: item.year, classId: item.classId?._id || item.classId, active: item.active } }
function teacherDto(item) { return { id: item._id, name: item.name, username: item.userId?.username, department: item.department, active: item.active && item.userId?.status !== 'INACTIVE' } }
function studentDto(item) { return { id: item._id, name: item.name, registerNumber: item.studentId, username: item.userId?.username, classId: item.classId?._id || item.classId, className: item.classId?.className, classSection: item.classId?.section, section: item.section, department: item.department, year: item.year, active: item.active && item.userId?.status !== 'INACTIVE' } }
function assignmentDto(item) { return { id: item._id, teacherId: item.teacherId?._id || item.teacherId, teacher: item.teacherId?.name, classId: item.classId?._id || item.classId, className: item.classId?.className, classSection: item.classId?.section, subjectId: item.subjectId?._id || item.subjectId, subject: item.subjectId?.subjectCode || item.subjectId?.subjectName } }
function timetableDto(item) { return { id: item._id, day: item.day, classId: item.classId?._id || item.classId, className: item.classId?.className, section: item.classId?.section, period: item.period, subjectId: item.subjectId?._id || item.subjectId, subject: item.subjectId?.subjectName || item.subjectId?.subjectCode, teacherId: item.teacherId?._id || item.teacherId, teacher: item.teacherId?.name, active: item.active } }
function wrap(handler) { return async (request, response, next) => { try { await handler(request, response) } catch (caught) { next(caught) } } }

export const getAdminDashboard = wrap(async (_request, response) => {
  const [totalStudents, totalTeachers, totalClasses, totalSubjects, totalDepartments, totalTimetables, activeStudents, activeTeachers] = await Promise.all([
    Student.countDocuments(),
    Teacher.countDocuments(),
    ClassModel.countDocuments(),
    Subject.countDocuments(),
    Department.countDocuments(),
    Timetable.countDocuments(),
    Student.countDocuments({ active: true }),
    Teacher.countDocuments({ active: true }),
  ])

  response.json({
    success: true,
    data: {
      totalStudents,
      totalTeachers,
      totalClasses,
      totalSubjects,
      totalDepartments,
      totalTimetables,
      activeStudents,
      activeTeachers,
    },
  })
})

export const listDepartments = wrap(async (_request, response) => response.json({ success: true, data: (await Department.find().sort({ name: 1 })).map(departmentDto) }))
export const createDepartment = wrap(async (request, response) => {
  const name = required(request.body.name, 'Department name').trim()
  const code = required(request.body.code || request.body.name, 'Department code').trim().toUpperCase()
  if (await Department.exists({ name })) throw error(409, 'Department already exists.')
  const item = await Department.create({ name, code, active: bool(request.body.active) })
  response.status(201).json({ success: true, data: departmentDto(item) })
})
export const updateDepartment = wrap(async (request, response) => {
  const item = await find(Department, request.params.id, 'Department')
  const name = required(request.body.name ?? item.name, 'Department name').trim()
  const code = required(request.body.code ?? item.code ?? name, 'Department code').trim().toUpperCase()
  if (await Department.exists({ _id: { $ne: item._id }, name })) throw error(409, 'Department already exists.')
  Object.assign(item, { name, code, active: bool(request.body.active) })
  await item.save()
  response.json({ success: true, data: departmentDto(item) })
})
export const deleteDepartment = wrap(async (request, response) => {
  const item = await find(Department, request.params.id, 'Department')
  item.active = false
  await item.save()
  response.json({ success: true, data: departmentDto(item) })
})

export const listClasses = wrap(async (_request, response) => response.json({ success: true, data: (await ClassModel.find().sort({ department: 1, year: 1, section: 1 })).map(classDto) }))
export const createClass = wrap(async (request, response) => {
  const department = required(request.body.department, 'Department'); const className = required(request.body.name || request.body.className, 'Class name'); const section = required(request.body.section, 'Section'); const year = positive(request.body.year, 'Year')
  if (await ClassModel.exists({ department, year, section })) throw error(409, 'Class and section combination already exists.')
  const item = await ClassModel.create({ className, department, year, section, semester: 1, active: bool(request.body.active) }); response.status(201).json({ success: true, data: classDto(item) })
})
export const updateClass = wrap(async (request, response) => {
  const item = await find(ClassModel, request.params.id, 'Class'); const department = required(request.body.department ?? item.department, 'Department'); const section = required(request.body.section ?? item.section, 'Section'); const year = positive(request.body.year ?? item.year, 'Year')
  if (await ClassModel.exists({ _id: { $ne: item._id }, department, year, section })) throw error(409, 'Class and section combination already exists.')
  Object.assign(item, { className: required(request.body.name ?? request.body.className ?? item.className, 'Class name'), department, section, year, active: bool(request.body.active) }); await item.save(); response.json({ success: true, data: classDto(item) })
})
export const deleteClass = wrap(async (request, response) => { const item = await find(ClassModel, request.params.id, 'Class'); item.active = false; await item.save(); response.json({ success: true, data: classDto(item) }) })

export const listSubjects = wrap(async (_request, response) => response.json({ success: true, data: (await Subject.find().populate('classId', 'section').sort({ subjectCode: 1 })).map(subjectDto) }))
export const createSubject = wrap(async (request, response) => {
  const subjectCode = required(request.body.code || request.body.subjectCode, 'Subject code').toUpperCase(); const subjectName = required(request.body.name || request.body.subjectName, 'Subject name'); const department = required(request.body.department, 'Department'); const section = required(request.body.section, 'Section').toUpperCase(); const year = positive(request.body.year, 'Year')
  if (await Subject.exists({ subjectCode })) throw error(409, 'Subject code already exists.')
  const classModel = await ClassModel.findOne({ department, section, year, active: true }); if (!classModel) throw error(400, 'No active class matches the selected department, section, and year.')
  const item = await Subject.create({ subjectCode, subjectName, department, year, classId: classModel._id, active: bool(request.body.active) }); await item.populate('classId', 'section'); response.status(201).json({ success: true, data: subjectDto(item) })
})
export const updateSubject = wrap(async (request, response) => {
  const item = await find(Subject, request.params.id, 'Subject'); const subjectCode = required(request.body.code ?? request.body.subjectCode ?? item.subjectCode, 'Subject code').toUpperCase(); const department = required(request.body.department ?? item.department, 'Department'); const section = required(request.body.section ?? item.classId?.section ?? item.section, 'Section').toUpperCase(); const year = positive(request.body.year ?? item.year, 'Year')
  if (await Subject.exists({ _id: { $ne: item._id }, subjectCode })) throw error(409, 'Subject code already exists.')
  const classModel = await ClassModel.findOne({ department, section, year, active: true }); if (!classModel) throw error(400, 'No active class matches the selected department, section, and year.')
  Object.assign(item, { subjectCode, subjectName: required(request.body.name ?? request.body.subjectName ?? item.subjectName, 'Subject name'), department, year, classId: classModel._id, active: bool(request.body.active) }); await item.save(); await item.populate('classId', 'section'); response.json({ success: true, data: subjectDto(item) })
})
export const deleteSubject = wrap(async (request, response) => { const item = await find(Subject, request.params.id, 'Subject'); item.active = false; await item.save(); response.json({ success: true, data: subjectDto(item) }) })

export const listTeachers = wrap(async (_request, response) => response.json({ success: true, data: (await Teacher.find().populate('userId', 'username status').sort({ name: 1 })).map(teacherDto) }))
export const createTeacher = wrap(async (request, response) => {
  firebaseReady()
  const name = required(request.body.name, 'Teacher name'); const userName = username(request.body.username); const department = required(request.body.department, 'Department'); const userPassword = password(request.body.password, request.body.confirmPassword)
  if (await User.exists({ username: userName }) || (await firebaseAdminDb.collection('usernames').doc(userName).get()).exists) throw error(409, 'Username already exists.')
  let firebaseUser; let user; let item
  try {
    firebaseUser = await firebaseAdminAuth.createUser({ email: authEmail(userName), password: userPassword, displayName: name })
    user = await User.create({ name, username: userName, email: authEmail(userName), firebaseUid: firebaseUser.uid, role: 'TEACHER', status: 'ACTIVE' })
    item = await Teacher.create({ userId: user._id, employeeId: userName, name, department, active: true })
    const now = new Date(); const batch = firebaseAdminDb.batch()
    batch.set(firebaseAdminDb.collection('users').doc(firebaseUser.uid), { uid: firebaseUser.uid, username: userName, role: 'TEACHER', active: true, createdAt: now, updatedAt: now })
    batch.set(firebaseAdminDb.collection('teachers').doc(firebaseUser.uid), { uid: firebaseUser.uid, username: userName, name, department, active: true, createdAt: now, updatedAt: now })
    batch.set(firebaseAdminDb.collection('usernames').doc(userName), { uid: firebaseUser.uid, username: userName, role: 'TEACHER', active: true, createdAt: now, updatedAt: now })
    await batch.commit(); await item.populate('userId', 'username status'); response.status(201).json({ success: true, data: teacherDto(item) })
  } catch (caught) {
    if (item) await Teacher.deleteOne({ _id: item._id }).catch(() => { })
    if (user) await User.deleteOne({ _id: user._id }).catch(() => { })
    if (firebaseUser) await firebaseAdminAuth.deleteUser(firebaseUser.uid).catch(() => { })
    throw caught
  }
})
export const updateTeacher = wrap(async (request, response) => {
  const item = await find(Teacher, request.params.id, 'Teacher'); const user = await find(User, item.userId, 'Teacher account'); const isActive = bool(request.body.active); item.name = required(request.body.name ?? item.name, 'Teacher name'); item.department = required(request.body.department ?? item.department, 'Department'); item.active = isActive; user.name = item.name; user.status = isActive ? 'ACTIVE' : 'INACTIVE'; await Promise.all([item.save(), user.save()]); await item.populate('userId', 'username status'); response.json({ success: true, data: teacherDto(item) })
})
export const deleteTeacher = wrap(async (request, response) => { const item = await find(Teacher, request.params.id, 'Teacher'); item.active = false; await item.save(); await User.updateOne({ _id: item.userId }, { status: 'INACTIVE' }); response.json({ success: true }) })

export const listStudents = wrap(async (_request, response) => response.json({ success: true, data: (await Student.find().populate('userId', 'username status').populate('classId', 'className section').sort({ name: 1 })).map(studentDto) }))
export const createStudent = wrap(async (request, response) => {
  firebaseReady()
  const name = required(request.body.name, 'Student name'); const registerNumber = required(request.body.registerNumber, 'Register number'); const userName = username(request.body.username); const userPassword = password(request.body.password, request.body.confirmPassword); const department = required(request.body.department, 'Department'); const section = required(request.body.section, 'Section').toUpperCase(); const year = positive(request.body.year, 'Year'); const classModel = await ClassModel.findOne({ department, section, year, active: true }); if (!classModel) throw error(400, 'No active class matches the selected department, section, and year.')
  if (await User.exists({ username: userName })) throw error(409, 'Username already exists.'); if (await Student.exists({ studentId: registerNumber })) throw error(409, 'Register number already exists.')
  let firebaseUser; let user; let item
  try {
    firebaseUser = await firebaseAdminAuth.createUser({ email: authEmail(userName), password: userPassword, displayName: name })
    user = await User.create({ name, username: userName, email: authEmail(userName), firebaseUid: firebaseUser.uid, role: 'STUDENT', status: 'ACTIVE' })
    item = await Student.create({ userId: user._id, studentId: registerNumber, rollNumber: registerNumber, name, department, year, section, semester: classModel.semester, classId: classModel._id, active: true })
    const now = new Date(); const batch = firebaseAdminDb.batch()
    batch.set(firebaseAdminDb.collection('users').doc(firebaseUser.uid), { uid: firebaseUser.uid, username: userName, role: 'STUDENT', active: true, createdAt: now, updatedAt: now })
    batch.set(firebaseAdminDb.collection('students').doc(firebaseUser.uid), { uid: firebaseUser.uid, username: userName, name, registerNumber, classId: classModel._id.toString(), section, department, year, active: true, createdAt: now, updatedAt: now })
    batch.set(firebaseAdminDb.collection('usernames').doc(userName), { uid: firebaseUser.uid, username: userName, role: 'STUDENT', active: true, createdAt: now, updatedAt: now })
    await batch.commit(); await item.populate('userId', 'username status'); response.status(201).json({ success: true, data: studentDto(item) })
  } catch (caught) {
    if (item) await Student.deleteOne({ _id: item._id }).catch(() => { })
    if (user) await User.deleteOne({ _id: user._id }).catch(() => { })
    if (firebaseUser) await firebaseAdminAuth.deleteUser(firebaseUser.uid).catch(() => { })
    throw caught
  }
})
export const updateStudent = wrap(async (request, response) => {
  const item = await find(Student, request.params.id, 'Student'); const user = await find(User, item.userId, 'Student account'); const department = required(request.body.department ?? item.department, 'Department'); const section = required(request.body.section ?? item.section, 'Section').toUpperCase(); const year = positive(request.body.year ?? item.year, 'Year'); const classModel = request.body.classId ? await find(ClassModel, request.body.classId, 'Class') : await ClassModel.findOne({ department, section, year, active: true }); if (!classModel) throw error(400, 'No active class matches the selected department, section, and year.'); const registerNumber = required(request.body.registerNumber ?? item.studentId, 'Register number'); const isActive = bool(request.body.active)
  if (await Student.exists({ _id: { $ne: item._id }, studentId: registerNumber })) throw error(409, 'Register number already exists.')
  Object.assign(item, { name: required(request.body.name ?? item.name, 'Student name'), studentId: registerNumber, rollNumber: registerNumber, department, year, section, semester: classModel.semester, classId: classModel._id, active: isActive }); user.name = item.name; user.status = isActive ? 'ACTIVE' : 'INACTIVE'; await Promise.all([item.save(), user.save()]); await item.populate('userId', 'username status'); response.json({ success: true, data: studentDto(item) })
})
export const deleteStudent = wrap(async (request, response) => { const item = await find(Student, request.params.id, 'Student'); item.active = false; await item.save(); await User.updateOne({ _id: item.userId }, { status: 'INACTIVE' }); response.json({ success: true }) })

export const listAssignments = wrap(async (_request, response) => response.json({ success: true, data: await TeachingAssignment.find().populate('teacherId', 'name employeeId').populate('classId', 'className section department year').populate('subjectId', 'subjectCode subjectName').sort({ createdAt: -1 }).then((items) => items.map(assignmentDto)) }))
export const createAssignment = wrap(async (request, response) => {
  const teacherId = id(request.body.teacherId, 'Teacher')
  const classId = id(request.body.classId, 'Class')
  const subjectId = id(request.body.subjectId, 'Subject')
  const [teacher, classModel, subject] = await Promise.all([find(Teacher, teacherId, 'Teacher'), find(ClassModel, classId, 'Class'), find(Subject, subjectId, 'Subject')])
  if (subject.classId && subject.classId.toString() !== classId) throw error(422, 'Subject does not belong to the selected class.')
  const item = await TeachingAssignment.create({ teacherId, classId, subjectId })
  await item.populate([{ path: 'teacherId', select: 'name employeeId' }, { path: 'classId', select: 'className section department year' }, { path: 'subjectId', select: 'subjectCode subjectName' }])
  response.status(201).json({ success: true, data: assignmentDto(item) })
})
export const deleteAssignment = wrap(async (request, response) => { await TeachingAssignment.findByIdAndDelete(id(request.params.id, 'Assignment')); response.json({ success: true }) })

export const listTimetables = wrap(async (_request, response) => response.json({ success: true, data: (await Timetable.find().populate('classId', 'className section department year').populate('subjectId', 'subjectCode subjectName').populate('teacherId', 'name employeeId').sort({ day: 1, period: 1 })).map(timetableDto) }))
export const createTimetable = wrap(async (request, response) => {
  const day = required(request.body.day, 'Day'); const classId = id(request.body.classId, 'Class'); const period = positive(request.body.period, 'Period'); const subjectId = id(request.body.subjectId, 'Subject'); const teacherId = id(request.body.teacherId, 'Teacher')
  if (period > 8) throw error(400, 'Period must be between 1 and 8.')
  const [classModel, subject, teacher] = await Promise.all([find(ClassModel, classId, 'Class'), find(Subject, subjectId, 'Subject'), find(Teacher, teacherId, 'Teacher')])
  if (await Timetable.exists({ classId, day, period })) throw error(409, 'Class already has a subject assigned for this period.')
  const item = await Timetable.create({ day, classId, period, subjectId, teacherId, active: bool(request.body.active) })
  await item.populate([{ path: 'classId', select: 'className section department year' }, { path: 'subjectId', select: 'subjectCode subjectName' }, { path: 'teacherId', select: 'name employeeId' }])
  response.status(201).json({ success: true, data: timetableDto(item) })
})
export const updateTimetable = wrap(async (request, response) => {
  const item = await find(Timetable, request.params.id, 'Timetable')
  const day = required(request.body.day ?? item.day, 'Day'); const classId = id(request.body.classId ?? item.classId, 'Class'); const period = positive(request.body.period ?? item.period, 'Period'); const subjectId = id(request.body.subjectId ?? item.subjectId, 'Subject'); const teacherId = id(request.body.teacherId ?? item.teacherId, 'Teacher')
  if (period > 8) throw error(400, 'Period must be between 1 and 8.')
  if (await Timetable.exists({ _id: { $ne: item._id }, classId, day, period })) throw error(409, 'Class already has a subject assigned for this period.')
  Object.assign(item, { day, classId, period, subjectId, teacherId, active: bool(request.body.active) })
  await item.save(); await item.populate([{ path: 'classId', select: 'className section department year' }, { path: 'subjectId', select: 'subjectCode subjectName' }, { path: 'teacherId', select: 'name employeeId' }])
  response.json({ success: true, data: timetableDto(item) })
})
export const deleteTimetable = wrap(async (request, response) => {
  const item = await find(Timetable, request.params.id, 'Timetable')
  item.active = false
  await item.save()
  response.json({ success: true, data: timetableDto(item) })
})

