import mongoose from 'mongoose'
import AttendanceSession from '../models/AttendanceSession.js'
import ClassModel from '../models/Class.js'
import Student from '../models/Student.js'
import Subject from '../models/Subject.js'
import Teacher from '../models/Teacher.js'
import User from '../models/User.js'
import { firebaseAdminAuth, firebaseAdminDb } from '../config/firebaseAdmin.js'
import TeacherAccess from '../models/TeacherAccess.js'

const internalAuthDomain = 'auth.student-attendance.app'
const usernamePattern = /^[a-z0-9](?:[a-z0-9._-]{0,28}[a-z0-9])$/
const minimumPasswordLength = 8

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function dateRange(dateValue) {
  if (typeof dateValue !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    throw httpError(400, 'Date must use YYYY-MM-DD format.')
  }
  const start = new Date(`${dateValue}T00:00:00.000Z`)
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== dateValue) {
    throw httpError(400, 'Date must be valid.')
  }
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { $gte: start, $lt: end }
}

async function getTeacherProfile(userId) {
  const teacher = await Teacher.findOne({ userId }).populate('userId', 'name email username firebaseUid role status')
  if (!teacher) {
    throw httpError(404, 'Teacher profile not found.')
  }
  return teacher
}

function publicTeacher(teacher) {
  const email = teacher.userId?.email?.endsWith(`@${internalAuthDomain}`) ? null : teacher.userId?.email
  return {
    _id: teacher._id,
    teacherId: teacher._id,
    employeeId: teacher.employeeId,
    name: teacher.name,
    department: teacher.department,
    designation: teacher.designation,
    user: teacher.userId
      ? { id: teacher.userId._id, name: teacher.userId.name, username: teacher.userId.username, email }
      : undefined,
  }
}

function publicStudent(student) {
  return {
    id: student._id,
    uid: student.userId?.firebaseUid,
    name: student.name,
    username: student.userId?.username,
    registerNumber: student.studentId,
    section: student.section,
    department: student.department,
    year: student.year,
    class: student.classId
      ? { id: student.classId._id, name: student.classId.className, section: student.classId.section }
      : null,
    active: student.userId?.status === 'ACTIVE',
  }
}

function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function internalAuthEmail(username) {
  return `${username}@${internalAuthDomain}`
}

function validateStudentInput(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const username = normalizeUsername(body.username)
  const registerNumber = typeof body.registerNumber === 'string' ? body.registerNumber.trim() : ''
  const section = typeof body.section === 'string' ? body.section.trim().toUpperCase() : ''
  const department = typeof body.department === 'string' ? body.department.trim() : ''
  const year = Number(body.year)
  const password = typeof body.password === 'string' ? body.password : ''
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''

  if (!name) throw httpError(400, 'Name is required.')
  if (!username || !usernamePattern.test(username)) throw httpError(400, 'Username must use 2-30 letters, numbers, dots, underscores, or hyphens.')
  if (!registerNumber) throw httpError(400, 'Roll number is required.')
  if (!section) throw httpError(400, 'Section is required.')
  if (!department) throw httpError(400, 'Department is required.')
  if (!Number.isInteger(year) || year < 1) throw httpError(400, 'Year must be a valid positive number.')
  if (!password) throw httpError(400, 'Password is required.')
  if (password.length < minimumPasswordLength) throw httpError(400, `Password must be at least ${minimumPasswordLength} characters.`)
  if (password !== confirmPassword) throw httpError(400, 'Passwords do not match.')
  return { name, username, registerNumber, section, department, year, password }
}

async function ensureTeacherClassAccess(teacherId, classId, subjectId) {
  if (!mongoose.isValidObjectId(classId)) throw httpError(400, 'Class ID is invalid.')
  if (subjectId && !mongoose.isValidObjectId(subjectId)) throw httpError(400, 'Subject ID is invalid.')
  const [classModel, subject] = await Promise.all([
    ClassModel.findOne({ _id: classId, active: true }),
    subjectId ? Subject.findOne({ _id: subjectId, active: true }) : null,
  ])
  if (!classModel) throw httpError(404, 'Class not found.')
  if (subjectId && !subject) throw httpError(404, 'Subject not found.')
  const accessQuery = { teacherId, classId }
  if (subjectId) accessQuery.subjectId = subjectId
  if (!await TeacherAccess.exists(accessQuery)) throw httpError(403, 'You do not have access to this class and subject.')
  return { classModel, subject }
}

export async function getDashboard(request, response, next) {
  try {
    const teacher = await getTeacherProfile(request.user.userId)
    const today = new Date()
    const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    const tomorrow = new Date(todayStart)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

    const [classCount, subjectCount, todaySessions, recentSessions] = await Promise.all([
      ClassModel.countDocuments({ active: true }),
      Subject.countDocuments({ active: true }),
      AttendanceSession.find({ teacherId: teacher._id, date: { $gte: todayStart, $lt: tomorrow } })
        .populate('classId', 'className department year section semester')
        .populate('subjectId', 'subjectCode subjectName')
        .sort({ date: -1, createdAt: -1 }),
      AttendanceSession.find({ teacherId: teacher._id })
        .populate('classId', 'className department year section semester')
        .populate('subjectId', 'subjectCode subjectName')
        .sort({ date: -1, createdAt: -1 })
        .limit(10),
    ])

    return response.json({
      success: true,
      data: {
        teacher: publicTeacher(teacher),
        totalClasses: classCount,
        totalSubjects: subjectCount,
        todaySessions,
        recentSessions,
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function getProfile(request, response, next) {
  try {
    const teacher = await getTeacherProfile(request.user.userId)
    return response.json({ success: true, teacher: publicTeacher(teacher) })
  } catch (error) {
    return next(error)
  }
}

export async function getClasses(request, response, next) {
  try {
    const teacher = await getTeacherProfile(request.user.userId)
    const classIds = await TeacherAccess.find({ teacherId: teacher._id }).distinct('classId')
    const classes = await ClassModel.find({ _id: { $in: classIds }, active: true })
      .select('_id className department year section semester')
      .sort({ department: 1, year: 1, section: 1 })
    return response.json({ success: true, data: classes })
  } catch (error) {
    return next(error)
  }
}

export async function getStudentsByClass(request, response, next) {
  try {
    const { classId } = request.params
    const teacher = await getTeacherProfile(request.user.userId)
    await ensureTeacherClassAccess(teacher._id, classId)
    const students = await Student.find({ classId })
      .select('_id studentId rollNumber name department year section semester classId')
      .sort({ rollNumber: 1, name: 1 })
    return response.json({ success: true, data: students })
  } catch (error) {
    return next(error)
  }
}

export async function getSubjectsByClass(request, response, next) {
  try {
    const { classId } = request.params
    const teacher = await getTeacherProfile(request.user.userId)
    await ensureTeacherClassAccess(teacher._id, classId)
    const subjectIds = await TeacherAccess.find({ teacherId: teacher._id, classId }).distinct('subjectId')
    const subjects = await Subject.find({ _id: { $in: subjectIds }, classId, active: true })
      .select('_id subjectCode subjectName classId department year')
      .sort({ subjectCode: 1, subjectName: 1 })
    return response.json({ success: true, data: subjects })
  } catch (error) {
    return next(error)
  }
}

export async function getManagedStudents(request, response, next) {
  try {
    const teacher = await getTeacherProfile(request.user.userId)
    const classIds = await TeacherAccess.find({ teacherId: teacher._id }).distinct('classId')
    const students = await Student.find({ active: true, classId: { $in: classIds } })
      .populate('userId', 'firebaseUid username status')
      .populate('classId', 'className section')
      .sort({ name: 1 })
    return response.json({ success: true, data: students.map(publicStudent) })
  } catch (error) {
    return next(error)
  }
}

export async function createManagedStudent(request, response, next) {
  let firebaseUser
  let mongoUser
  let mongoStudent

  try {
    if (!firebaseAdminAuth || !firebaseAdminDb) throw httpError(503, 'Secure Firebase account management is not configured.')
    const input = validateStudentInput(request.body)
    const teacher = await getTeacherProfile(request.user.userId)
    const classModel = await ClassModel.findOne({ department: input.department, section: input.section, year: input.year, active: true })
    if (!classModel) throw httpError(400, 'No active class matches the selected department, section, and year.')
    await ensureTeacherClassAccess(teacher._id, classModel._id)

    const existingUsername = await User.findOne({ username: input.username }).lean()
    if (existingUsername || (await firebaseAdminDb.collection('usernames').doc(input.username).get()).exists) {
      throw httpError(409, 'Username already exists.')
    }
    const existingRegisterNumber = await Student.findOne({ $or: [{ studentId: input.registerNumber }, { rollNumber: input.registerNumber }] }).lean()
    if (existingRegisterNumber) throw httpError(409, 'Roll number already exists.')

    firebaseUser = await firebaseAdminAuth.createUser({
      email: internalAuthEmail(input.username),
      password: input.password,
      displayName: input.name,
    })

    mongoUser = await User.create({
      name: input.name,
      email: internalAuthEmail(input.username),
      username: input.username,
      firebaseUid: firebaseUser.uid,
      role: 'STUDENT',
      status: 'ACTIVE',
    })

    mongoStudent = await Student.create({
      userId: mongoUser._id,
      studentId: input.registerNumber,
      rollNumber: input.registerNumber,
      name: input.name,
      department: input.department,
      year: input.year,
      section: input.section,
      semester: classModel.semester,
      classId: classModel._id,
    })

    const now = new Date()
    const batch = firebaseAdminDb.batch()
    batch.set(firebaseAdminDb.collection('users').doc(firebaseUser.uid), {
      uid: firebaseUser.uid,
      username: input.username,
      role: 'STUDENT',
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    batch.set(firebaseAdminDb.collection('students').doc(firebaseUser.uid), {
      uid: firebaseUser.uid,
      username: input.username,
      name: input.name,
      registerNumber: input.registerNumber,
      classId: classModel._id.toString(),
      department: input.department,
      section: input.section,
      year: input.year,
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    batch.set(firebaseAdminDb.collection('usernames').doc(input.username), {
      uid: firebaseUser.uid,
      username: input.username,
      role: 'STUDENT',
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    batch.set(firebaseAdminDb.collection('classes').doc(classModel._id.toString()), {
      name: classModel.className,
      section: classModel.section,
      active: true,
      updatedAt: now,
    }, { merge: true })
    await batch.commit()

    return response.status(201).json({ success: true, student: publicStudent(await mongoStudent.populate([{ path: 'userId', select: 'firebaseUid username status' }, { path: 'classId', select: 'className section' }])) })
  } catch (error) {
    if (mongoStudent) await Student.deleteOne({ _id: mongoStudent._id }).catch(() => { })
    if (mongoUser) await User.deleteOne({ _id: mongoUser._id }).catch(() => { })
    if (firebaseUser) await firebaseAdminAuth.deleteUser(firebaseUser.uid).catch(() => { })
    if (error.code === 11000) return next(httpError(409, 'Username or roll number already exists.'))
    return next(error)
  }
}

export async function getAttendanceHistory(request, response, next) {
  try {
    const teacher = await getTeacherProfile(request.user.userId)
    const { classId, subjectId, date, startDate, endDate, periodNumber } = request.query
    const query = { teacherId: teacher._id }

    if (classId) {
      if (!mongoose.isValidObjectId(classId)) throw httpError(400, 'Class ID is invalid.')
      query.classId = classId
    }
    if (subjectId) {
      if (!mongoose.isValidObjectId(subjectId)) throw httpError(400, 'Subject ID is invalid.')
      query.subjectId = subjectId
    }
    if (date) query.date = dateRange(date)
    if (startDate || endDate) {
      query.date = {}
      if (startDate) query.date.$gte = dateRange(startDate).$gte
      if (endDate) query.date.$lt = dateRange(endDate).$lt
      if (!query.date.$gte && !query.date.$lt) delete query.date
      if (query.date.$gte && query.date.$lt && query.date.$lt <= query.date.$gte) {
        throw httpError(400, 'End date must not be earlier than start date.')
      }
    }
    if (periodNumber) {
      const period = Number(periodNumber)
      if (!Number.isInteger(period) || period < 1 || period > 8) throw httpError(400, 'Period number must be between 1 and 8.')
      query.periodNumber = period
    }

    const sessions = await AttendanceSession.find(query)
      .populate('classId', 'className department year section semester')
      .populate('subjectId', 'subjectCode subjectName classId')
      .populate('teacherId', 'name employeeId department')
      .sort({ date: -1, createdAt: -1 })

    const data = sessions.map((session) => ({
      ...session.toObject(),
      sessionId: session._id,
    }))
    return response.json({ success: true, data })
  } catch (error) {
    return next(error)
  }
}

export { ensureTeacherClassAccess, getTeacherProfile, httpError }
