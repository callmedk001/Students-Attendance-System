import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import mongoose from 'mongoose'
import { app } from '../server.js'
import { isAllowedLoginRole, isAllowedRegistrationRole, normalizeEmail, normalizeUsername } from '../controllers/authController.js'
import { parseDate, validatePeriod, validateStatus } from '../controllers/attendanceController.js'
import { buildDateFilter, buildSessionQuery } from '../controllers/studentController.js'
import { percentage, summaryFromCounts } from '../utils/attendance.js'
import { requireRole } from '../middleware/roleCheck.js'

function responseDouble() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
}

function requestApp(path) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      const request = http.get({ host: '127.0.0.1', port, path }, (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => { body += chunk })
        response.on('end', () => server.close(() => resolve({ statusCode: response.statusCode, body })))
      })
      request.on('error', (error) => server.close(() => reject(error)))
    })
    server.on('error', reject)
  })
}

test('serves lightweight health while MongoDB is disconnected', async () => {
  assert.notEqual(mongoose.connection.readyState, 1)
  const response = await requestApp('/health')
  assert.equal(response.statusCode, 200)
  assert.deepEqual(JSON.parse(response.body), { status: 'ok' })
})

test('reports database readiness in diagnostic health endpoint', async () => {
  assert.notEqual(mongoose.connection.readyState, 1)
  const response = await requestApp('/api/health')
  assert.equal(response.statusCode, 200)
  const payload = JSON.parse(response.body)
  assert.equal(payload.status, 'ok')
  assert.equal(payload.mongodb, false)
})

test('normalizes login identifiers and rejects admin self-registration', () => {
  assert.equal(normalizeUsername('  Teacher.One '), 'teacher.one')
  assert.equal(normalizeEmail('  USER@EXAMPLE.COM '), 'user@example.com')
  assert.equal(isAllowedRegistrationRole('TEACHER'), true)
  assert.equal(isAllowedRegistrationRole('STUDENT'), true)
  assert.equal(isAllowedRegistrationRole('ADMIN'), false)
  assert.equal(isAllowedLoginRole('ADMIN'), true)
  assert.equal(isAllowedLoginRole('TEACHER'), true)
  assert.equal(isAllowedLoginRole('STUDENT'), true)
  assert.equal(isAllowedLoginRole('UNKNOWN'), false)
})

test('validates attendance dates, periods, and statuses', () => {
  assert.equal(parseDate('2026-10-11').toISOString(), '2026-10-11T00:00:00.000Z')
  assert.equal(validatePeriod('8'), 8)
  assert.doesNotThrow(() => validateStatus('PRESENT'))
  assert.doesNotThrow(() => validateStatus('ABSENT'))
  assert.doesNotThrow(() => validateStatus('OD'))
  assert.throws(() => parseDate('2026-02-30'), /Date must be valid/)
  assert.throws(() => validatePeriod(9), /between 1 and 8/)
  assert.throws(() => validateStatus('LATE'), /Status must be/)
})

test('calculates attendance percentage with OD counted as attended', () => {
  assert.equal(percentage(8, 1, 10), 90)
  assert.equal(percentage(5, 2, 10), 70)
  assert.equal(percentage(0, 0, 5), 0)
  assert.equal(percentage(0, 0, 0), 0)
})

test('builds safe attendance summaries for eligible records only', () => {
  assert.deepEqual(summaryFromCounts([
    { _id: 'PRESENT', count: 8 },
    { _id: 'ABSENT', count: 1 },
    { _id: 'OD', count: 1 },
  ]), { total: 10, present: 8, absent: 1, od: 1, percentage: 90 })
  assert.deepEqual(summaryFromCounts([]), { total: 0, present: 0, absent: 0, od: 0, percentage: 0 })
})

test('builds subject, period, date, and status-safe attendance filters', () => {
  const filter = buildDateFilter({ startDate: '2026-10-01', endDate: '2026-10-11' })
  assert.equal(filter.$gte.toISOString(), '2026-10-01T00:00:00.000Z')
  assert.equal(filter.$lt.toISOString(), '2026-10-12T00:00:00.000Z')

  const sessionQuery = buildSessionQuery({
    subjectId: '507f1f77bcf86cd799439011',
    periodNumber: '2',
    startDate: '2026-10-01',
    endDate: '2026-10-11',
  })
  assert.equal(sessionQuery.subjectId, '507f1f77bcf86cd799439011')
  assert.equal(sessionQuery.periodNumber, 2)
  assert.throws(() => buildSessionQuery({ periodNumber: '9' }), /between 1 and 8/)
  assert.throws(() => buildDateFilter({ startDate: '2026-10-11', endDate: '2026-10-01' }), /must not be earlier/)
})

test('enforces teacher and student role authorization', () => {
  const next = () => 'allowed'
  const teacherRequest = { user: { role: 'TEACHER' } }
  const studentRequest = { user: { role: 'STUDENT' } }
  const denied = responseDouble()

  assert.equal(requireRole('TEACHER')(teacherRequest, responseDouble(), next), 'allowed')
  assert.equal(requireRole('STUDENT')(studentRequest, responseDouble(), next), 'allowed')
  requireRole('ADMIN')(teacherRequest, denied, next)
  assert.equal(denied.statusCode, 403)
  assert.equal(denied.body.message, 'You do not have permission to access this resource.')
})
