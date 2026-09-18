import mongoose from 'mongoose'
import AttendanceRecord from '../models/AttendanceRecord.js'
import AttendanceSession from '../models/AttendanceSession.js'
import ClassModel from '../models/Class.js'
import Student from '../models/Student.js'
import Subject from '../models/Subject.js'
import Teacher from '../models/Teacher.js'
import { ensureTeacherClassAccess, getTeacherProfile, httpError } from './teacherController.js'

const statuses = ['PRESENT', 'ABSENT', 'OD']
const sessionStatuses = ['ACTIVE', 'COMPLETED', 'CANCELLED']

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw httpError(400, 'Date must use YYYY-MM-DD format.')
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw httpError(400, 'Date must be valid.')
  return date
}

function validatePeriod(value) {
  const period = Number(value)
  if (!Number.isInteger(period) || period < 1 || period > 8) {
    throw httpError(400, 'Period number must be between 1 and 8.')
  }
  return period
}

function validateStatus(status) {
  if (!statuses.includes(status)) throw httpError(400, 'Status must be PRESENT, ABSENT, or OD.')
}

function validateId(value, label) {
  if (!mongoose.isValidObjectId(value)) throw httpError(400, `${label} is invalid.`)
}

async function getOwnedSession(sessionId, teacherId) {
  validateId(sessionId, 'Attendance session ID')
  const session = await AttendanceSession.findOne({ _id: sessionId, teacherId })
  if (!session) throw httpError(404, 'Attendance session not found.')
  return session
}

async function validateClassAndSubject(classId, subjectId) {
  validateId(classId, 'Class ID')
  validateId(subjectId, 'Subject ID')
  const [classDocument, subject] = await Promise.all([
    ClassModel.findById(classId),
    Subject.findById(subjectId),
  ])
  if (!classDocument) throw httpError(404, 'Class not found.')
  if (!subject) throw httpError(404, 'Subject not found.')
}

function sessionResponse(session, records) {
  return { session, records }
}

export async function createSession(request, response, next) {
  try {
    const teacher = await getTeacherProfile(request.user.userId)
    const { date, classId, subjectId, periodNumber } = request.body
    if (!date || !classId || !subjectId || periodNumber === undefined) {
      throw httpError(400, 'Date, class, subject, and period are required.')
    }

    await ensureTeacherClassAccess(teacher._id, classId, subjectId)
    await validateClassAndSubject(classId, subjectId)
    const normalizedDate = parseDate(date)
    const period = validatePeriod(periodNumber)

    const session = await AttendanceSession.create({
      date: normalizedDate,
      classId,
      subjectId,
      periodNumber: period,
      teacherId: teacher._id,
      status: 'ACTIVE',
    })

    return response.status(201).json({ success: true, data: session, message: 'Attendance session created.' })
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({ success: false, message: 'Attendance session already exists for this date, class, subject and period.' })
    }
    return next(error)
  }
}

export async function listSessions(request, response, next) {
  try {
    const teacher = await getTeacherProfile(request.user.userId)
    const sessions = await AttendanceSession.find({ teacherId: teacher._id })
      .populate('classId', 'className department year section semester')
      .populate('subjectId', 'subjectCode subjectName')
      .sort({ date: -1, createdAt: -1 })
    return response.json({ success: true, data: sessions })
  } catch (error) {
    return next(error)
  }
}

export async function getSession(request, response, next) {
  try {
    const teacher = await getTeacherProfile(request.user.userId)
    const session = await getOwnedSession(request.params.id, teacher._id)
    const [sessionDetails, records] = await Promise.all([
      AttendanceSession.findById(session._id)
        .populate('classId', 'className department year section semester')
        .populate('subjectId', 'subjectCode subjectName classId')
        .populate('teacherId', 'name employeeId department'),
      AttendanceRecord.find({ sessionId: session._id })
        .populate('studentId', 'studentId rollNumber name department year section semester classId')
        .sort({ 'studentId.rollNumber': 1 }),
    ])
    return response.json({ success: true, data: sessionResponse(sessionDetails, records) })
  } catch (error) {
    return next(error)
  }
}

export async function saveRecords(request, response, next) {
  try {
    const teacher = await getTeacherProfile(request.user.userId)
    const session = await getOwnedSession(request.params.id, teacher._id)
    const submittedRecords = request.body.records
    if (!Array.isArray(submittedRecords) || submittedRecords.length === 0) {
      throw httpError(400, 'At least one attendance record is required.')
    }

    const duplicateIds = new Set()
    const studentIds = submittedRecords.map((record) => {
      if (!record || typeof record !== 'object') {
        throw httpError(400, 'Each attendance record must be an object.')
      }
      validateId(record.studentId, 'Student ID')
      validateStatus(record.status)
      if (duplicateIds.has(record.studentId)) throw httpError(400, 'Duplicate student attendance records are not allowed.')
      duplicateIds.add(record.studentId)
      return record.studentId
    })

    const students = await Student.find({ classId: session.classId, _id: { $in: studentIds } }).select('_id')
    if (students.length !== submittedRecords.length) {
      throw httpError(422, 'Every student must belong to the attendance session class.')
    }

    const operations = submittedRecords.map(({ studentId, status }) => ({
      updateOne: {
        filter: { sessionId: session._id, studentId },
        update: { $set: { status, updatedAt: new Date() }, $setOnInsert: { markedAt: new Date() } },
        upsert: true,
      },
    }))
    await AttendanceRecord.bulkWrite(operations)
    session.status = 'COMPLETED'
    await session.save()

    const records = await AttendanceRecord.find({ sessionId: session._id })
      .populate('studentId', 'studentId rollNumber name department year section semester classId')
      .sort({ 'studentId.rollNumber': 1 })
    return response.json({ success: true, message: 'Attendance saved successfully.', data: { session, records } })
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ success: false, message: 'Attendance record already exists for this student and session.' })
    return next(error)
  }
}

export async function updateSession(request, response, next) {
  try {
    const teacher = await getTeacherProfile(request.user.userId)
    const session = await getOwnedSession(request.params.id, teacher._id)
    const updates = {}
    const body = request.body

    if (body.date !== undefined) updates.date = parseDate(body.date)
    if (body.classId !== undefined) updates.classId = body.classId
    if (body.subjectId !== undefined) updates.subjectId = body.subjectId
    if (body.periodNumber !== undefined) updates.periodNumber = validatePeriod(body.periodNumber)
    if (body.status !== undefined) {
      if (!sessionStatuses.includes(body.status)) throw httpError(400, 'Session status is invalid.')
      updates.status = body.status
    }

    const classId = updates.classId || session.classId
    const subjectId = updates.subjectId || session.subjectId
    await ensureTeacherClassAccess(teacher._id, classId, subjectId)
    await validateClassAndSubject(classId, subjectId)
    const classChanged = updates.classId && updates.classId.toString() !== session.classId.toString()
    Object.assign(session, updates)
    await session.save()
    if (classChanged) await AttendanceRecord.deleteMany({ sessionId: session._id })

    return response.json({ success: true, message: 'Attendance session updated.', data: session })
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ success: false, message: 'Attendance session already exists for this date, class, subject and period.' })
    return next(error)
  }
}

export async function updateRecord(request, response, next) {
  try {
    const teacher = await getTeacherProfile(request.user.userId)
    validateStatus(request.body.status)
    const record = await AttendanceRecord.findById(request.params.id).populate('sessionId')
    if (!record || !record.sessionId || record.sessionId.teacherId.toString() !== teacher._id.toString()) {
      throw httpError(404, 'Attendance record not found.')
    }
    const student = await Student.findOne({ _id: record.studentId, classId: record.sessionId.classId })
    if (!student) throw httpError(422, 'Student does not belong to the attendance session class.')
    record.status = request.body.status
    record.updatedAt = new Date()
    await record.save()
    await record.populate('studentId', 'studentId rollNumber name department year section semester classId')
    return response.json({ success: true, message: 'Attendance record updated.', data: record })
  } catch (error) {
    return next(error)
  }
}

export { statuses }
