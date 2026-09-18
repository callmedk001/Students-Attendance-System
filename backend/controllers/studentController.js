import mongoose from 'mongoose'
import AttendanceRecord from '../models/AttendanceRecord.js'
import AttendanceSession from '../models/AttendanceSession.js'
import Student from '../models/Student.js'
import Subject from '../models/Subject.js'

const statuses = ['PRESENT', 'ABSENT', 'OD']
const internalAuthDomain = 'auth.student-attendance.app'

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function parseDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw httpError(400, `${label} must use YYYY-MM-DD format.`)
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw httpError(400, `${label} must be valid.`)
  return date
}

function percentage(present, od, total) {
  return total ? Number((((present + od) / total) * 100).toFixed(2)) : 0
}

function summaryFromCounts(counts) {
  const summary = { total: 0, present: 0, absent: 0, od: 0 }
  for (const count of counts) {
    summary[count._id.toLowerCase()] = count.count
    summary.total += count.count
  }
  return { ...summary, percentage: percentage(summary.present, summary.od, summary.total) }
}

async function getStudentProfile(userId) {
  const student = await Student.findOne({ userId }).populate('userId', 'name email username role status').populate('classId', 'className department year section semester')
  if (!student) throw httpError(404, 'Student profile not found.')
  return student
}

function buildDateFilter(filters) {
  const { startDate, endDate, month, year } = filters
  let start
  let end

  if (month !== undefined || year !== undefined) {
    const monthNumber = Number(month)
    const yearNumber = Number(year)
    if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12 || !Number.isInteger(yearNumber) || yearNumber < 2000) {
      throw httpError(400, 'Month and year must be valid.')
    }
    start = new Date(Date.UTC(yearNumber, monthNumber - 1, 1))
    end = new Date(Date.UTC(yearNumber, monthNumber, 1))
  }

  if (startDate) start = parseDate(startDate, 'Start date')
  if (endDate) {
    end = parseDate(endDate, 'End date')
    end.setUTCDate(end.getUTCDate() + 1)
  }
  if (start && end && end <= start) throw httpError(400, 'End date must not be earlier than start date.')
  return start || end ? { $gte: start || new Date(0), $lt: end || new Date('2999-12-31T00:00:00.000Z') } : null
}

function buildSessionQuery(filters) {
  const query = {}
  const date = buildDateFilter(filters)
  if (date) query.date = date
  if (filters.subjectId) {
    if (!mongoose.isValidObjectId(filters.subjectId)) throw httpError(400, 'Subject ID is invalid.')
    query.subjectId = filters.subjectId
  }
  if (filters.periodNumber) {
    const period = Number(filters.periodNumber)
    if (!Number.isInteger(period) || period < 1 || period > 8) throw httpError(400, 'Period number must be between 1 and 8.')
    query.periodNumber = period
  }
  return query
}

async function scopedRecordQuery(studentId, filters = {}) {
  const sessionQuery = buildSessionQuery(filters)
  const query = { studentId }
  if (Object.keys(sessionQuery).length) {
    const sessionIds = await AttendanceSession.find(sessionQuery).distinct('_id')
    query.sessionId = { $in: sessionIds }
  }
  if (filters.status) {
    if (!statuses.includes(filters.status)) throw httpError(400, 'Status must be PRESENT, ABSENT, or OD.')
    query.status = filters.status
  }
  return query
}

function publicProfile(student) {
  const email = student.userId?.email?.endsWith(`@${internalAuthDomain}`) ? null : student.userId?.email
  return {
    id: student._id,
    name: student.name,
    username: student.userId?.username,
    studentId: student.studentId,
    rollNumber: student.rollNumber,
    department: student.department,
    year: student.year,
    section: student.section,
    semester: student.semester,
    email,
    class: student.classId ? { id: student.classId._id, name: student.classId.className, section: student.classId.section } : null,
  }
}

function formatRecord(record) {
  const session = record.sessionId
  if (!session) return null
  return {
    _id: record._id,
    date: session.date,
    class: session.classId,
    subject: session.subjectId,
    periodNumber: session.periodNumber,
    status: record.status,
    markedAt: record.markedAt,
    updatedAt: record.updatedAt,
  }
}

async function aggregateSummary(recordQuery) {
  const counts = await AttendanceRecord.aggregate([
    { $match: recordQuery },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ])
  return summaryFromCounts(counts)
}

async function aggregateBy(studentId, filters, groupField) {
  const sessionQuery = buildSessionQuery(filters)
  const sessionMatch = Object.entries(sessionQuery).map(([key, value]) => [`session.${key}`, value])
  const pipeline = [
    { $match: { studentId } },
    { $lookup: { from: 'attendancesessions', localField: 'sessionId', foreignField: '_id', as: 'session' } },
    { $unwind: '$session' },
  ]
  if (sessionMatch.length) pipeline.push({ $match: Object.fromEntries(sessionMatch) })
  pipeline.push(
    { $group: { _id: `$session.${groupField}`, total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] } }, absent: { $sum: { $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0] } }, od: { $sum: { $cond: [{ $eq: ['$status', 'OD'] }, 1, 0] } } } },
    { $sort: { _id: 1 } },
  )
  return AttendanceRecord.aggregate(pipeline)
}

export async function getProfile(request, response, next) {
  try {
    const student = await getStudentProfile(request.user.userId)
    return response.json({ success: true, student: publicProfile(student) })
  } catch (error) { return next(error) }
}

export async function getAttendance(request, response, next) {
  try {
    const student = await getStudentProfile(request.user.userId)
    const query = await scopedRecordQuery(student._id, request.query)
    const records = await AttendanceRecord.find(query).populate({ path: 'sessionId', populate: [{ path: 'classId', select: 'className department year section semester' }, { path: 'subjectId', select: 'subjectCode subjectName' }] }).sort({ markedAt: -1 })
    return response.json({ success: true, records: records.map(formatRecord).filter(Boolean) })
  } catch (error) { return next(error) }
}

export async function getSummary(request, response, next) {
  try {
    const student = await getStudentProfile(request.user.userId)
    const query = await scopedRecordQuery(student._id, request.query)
    return response.json({ success: true, summary: await aggregateSummary(query) })
  } catch (error) { return next(error) }
}

export async function getMonthly(request, response, next) {
  try {
    const now = new Date()
    const month = request.query.month ? Number(request.query.month) : now.getUTCMonth() + 1
    const year = request.query.year ? Number(request.query.year) : now.getUTCFullYear()
    const student = await getStudentProfile(request.user.userId)
    const summary = await aggregateSummary(await scopedRecordQuery(student._id, { month, year }))
    return response.json({ success: true, month, year, ...summary })
  } catch (error) { return next(error) }
}

export async function getSubjects(request, response, next) {
  try {
    const student = await getStudentProfile(request.user.userId)
    const groups = await aggregateBy(student._id, request.query, 'subjectId')
    const subjectIds = groups.map((group) => group._id)
    const subjects = await Subject.find({ _id: { $in: subjectIds } }).select('subjectCode subjectName')
    const subjectMap = new Map(subjects.map((subject) => [subject._id.toString(), subject]))
    return response.json({ success: true, subjects: groups.map((group) => ({ subjectId: group._id, subjectName: subjectMap.get(group._id.toString())?.subjectName || subjectMap.get(group._id.toString())?.subjectCode || 'Unknown subject', total: group.total, present: group.present, absent: group.absent, od: group.od, percentage: percentage(group.present, group.od, group.total) })) })
  } catch (error) { return next(error) }
}

export async function getPeriods(request, response, next) {
  try {
    const student = await getStudentProfile(request.user.userId)
    const groups = await aggregateBy(student._id, request.query, 'periodNumber')
    return response.json({ success: true, periods: groups.map((group) => ({ periodNumber: group._id, total: group.total, present: group.present, absent: group.absent, od: group.od, percentage: percentage(group.present, group.od, group.total) })) })
  } catch (error) { return next(error) }
}
