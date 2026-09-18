import api from './api'

export async function createAttendanceSession(data) {
  const response = await api.post('/attendance/sessions', data)
  return response.data
}

export async function getAttendanceSessions() {
  const response = await api.get('/attendance/sessions')
  return response.data
}

export async function getAttendanceSession(id) {
  const response = await api.get(`/attendance/sessions/${id}`)
  return response.data
}

export async function updateAttendanceSession(id, data) {
  const response = await api.put(`/attendance/sessions/${id}`, data)
  return response.data
}

export async function saveAttendanceRecords(sessionId, records) {
  const response = await api.post(`/attendance/sessions/${sessionId}/records`, { records })
  return response.data
}

export async function updateAttendanceRecord(recordId, data) {
  const response = await api.put(`/attendance/records/${recordId}`, data)
  return response.data
}
