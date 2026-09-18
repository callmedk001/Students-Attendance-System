import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import { connectDatabase } from './config/database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '.env') })
import './models/User.js'
import './models/Department.js'
import './models/Student.js'
import './models/Teacher.js'
import './models/Class.js'
import './models/Subject.js'
import './models/Timetable.js'
import './models/AttendanceSession.js'
import './models/AttendanceRecord.js'
import './models/TeachingAssignment.js'
import authRoutes from './routes/authRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import attendanceRoutes from './routes/attendanceRoutes.js'
import teacherRoutes from './routes/teacherRoutes.js'
import studentRoutes from './routes/studentRoutes.js'
import managementRoutes from './routes/managementRoutes.js'
import { ensureAdminBootstrap } from './services/adminBootstrap.js'

const app = express()
const port = process.env.PORT || 5000
const host = process.env.HOST || '0.0.0.0'
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    return callback(null, false)
  },
}))
app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    mongodb: mongoose.connection.readyState === 1,
    firebaseAdmin: Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY),
    usernameResolution: true,
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/teacher', teacherRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/student', studentRoutes)
app.use('/api', managementRoutes)

app.use((_request, response) => {
  response.status(404).json({
    success: false,
    message: 'Route not found',
  })
})

app.use((error, _request, response, _next) => {
  if (error.status && error.status < 500) {
    console.error(error.message)
  } else {
    console.error(error)
  }
  response.status(error.status || 500).json({
    success: false,
    message: error.status ? error.message : 'Internal server error',
  })
})

async function startServer() {
  while (true) {
    try {
      await connectDatabase()
      try {
        await ensureAdminBootstrap()
        console.log('Admin bootstrap check complete')
      } catch (error) {
        const message = String(error?.message || '')
        if (message.includes('not configured') || message.includes('invalid FIREBASE_PRIVATE_KEY') || message.includes('private key')) {
          console.warn('Admin bootstrap skipped: Firebase Admin is not configured or its service-account key is invalid in backend/.env.')
        } else {
          throw error
        }
      }

      const server = app.listen(port, host, () => {
        console.log(`Student Attendance API running on ${host}:${port}`)
      })
      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`Port ${port} is already in use.`)
          console.error(`Find the process with: Get-NetTCPConnection -State Listen -LocalPort ${port}`)
          console.error('Stop it only if it belongs to this project: Stop-Process -Id <PID>')
        } else {
          console.error(`Server failed to start: ${error.message}`)
        }
        process.exitCode = 1
      })
      return
    } catch (error) {
      const message = String(error?.message || '')
      const shouldRetry = message.includes('MongoDB Atlas rejected this machine IP address')
        || message.includes('MongoDB network connection failed')

      if (!shouldRetry) {
        console.error(`Server startup aborted: ${message}`)
        process.exitCode = 1
        return
      }

      console.error(`Server startup delayed: ${message}`)
      console.error('Retrying MongoDB connection in 5 seconds...')
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
}

startServer()
