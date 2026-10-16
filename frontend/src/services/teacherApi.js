import api from './api'

export async function getTeacherDashboard() {
  const response = await api.get('/teacher/dashboard')
  return response.data
}

export async function getTeacherProfile() {
  const response = await api.get('/teacher/profile')
  return response.data
}

export async function getClasses() {
  const response = await api.get('/teacher/classes')
  return response.data
}

export async function getStudentsByClass(classId) {
  const response = await api.get(`/teacher/classes/${classId}/students`)
  return response.data
}

export async function getSubjectsByClass(classId) {
  const response = await api.get(`/teacher/classes/${classId}/subjects`)
  return response.data
}

export async function getAttendanceHistory(filters = {}) {
  const response = await api.get('/teacher/attendance-history', { params: filters })
  return response.data
}

export async function getAttendancePercentage(filters = {}) {
  const response = await api.get('/teacher/attendance-percentage', { params: filters })
  return response.data
}

export async function getManagedStudents() {
  const response = await api.get('/teacher/students')
  return response.data
}

export async function createManagedStudent(student) {
  const response = await api.post('/teacher/students', student)
  return response.data
}
