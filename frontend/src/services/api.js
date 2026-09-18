import axios from 'axios'
import { firebaseAuth } from '../lib/firebase'
import { clearToken } from './tokenStorage'

const apiBaseUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '')

if (!apiBaseUrl) {
  throw new Error('VITE_API_URL must be configured for production builds.')
}

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 5000,
})

api.interceptors.request.use(async (config) => {
  const token = await firebaseAuth?.currentUser?.getIdToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      clearToken()
      window.location.assign('/login')
    }
    return Promise.reject(error)
  },
)

export async function getHealthStatus() {
  const response = await api.get('/health')
  return response.data
}

export default api
