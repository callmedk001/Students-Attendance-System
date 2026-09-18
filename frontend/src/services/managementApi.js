import api from './api'

const paths = { departments: 'departments', classes: 'classes', subjects: 'subjects', teachers: 'teachers', students: 'students', assignments: 'assignments', timetables: 'timetables' }

export async function listManaged(resource) { const response = await api.get(`/${paths[resource]}`); return response.data }
export async function createManaged(resource, data) { const response = await api.post(`/${paths[resource]}`, data); return response.data }
export async function updateManaged(resource, id, data) { const response = await api.put(`/${paths[resource]}/${id}`, data); return response.data }
export async function deleteManaged(resource, id) { const response = await api.delete(`/${paths[resource]}/${id}`); return response.data }
