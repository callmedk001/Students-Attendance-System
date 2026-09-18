import api from './api'

export async function getStudentProfile() {
  const response = await api.get('/student/profile')
  return response.data
}

export async function getStudentAttendance(filters = {}) {
  const response = await api.get('/student/attendance', { params: filters })
  return response.data
}

export async function getStudentAttendanceSummary(filters = {}) {
  const response = await api.get('/student/attendance/summary', { params: filters })
  return response.data
}

export async function getMonthlyAttendance(month, year) {
  const response = await api.get('/student/attendance/monthly', { params: { month, year } })
  return response.data
}

export async function getSubjectAttendance(filters = {}) {
  const response = await api.get('/student/attendance/subjects', { params: filters })
  return response.data
}

export async function getPeriodAttendance(filters = {}) {
  const response = await api.get('/student/attendance/periods', { params: filters })
  return response.data
}
