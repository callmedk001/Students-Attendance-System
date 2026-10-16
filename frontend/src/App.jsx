import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppNavigation from './components/AppNavigation'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import Login from './pages/Login'

const StudentDashboard = lazy(() => import('./pages/student/Dashboard'))
const TeacherDashboard = lazy(() => import('./pages/teacher/Dashboard'))
const TakeAttendance = lazy(() => import('./pages/teacher/TakeAttendance'))
const AttendanceHistory = lazy(() => import('./pages/teacher/AttendanceHistory'))
const AttendancePercentage = lazy(() => import('./pages/teacher/AttendancePercentage'))
const EditAttendance = lazy(() => import('./pages/teacher/EditAttendance'))
const ViewAttendance = lazy(() => import('./pages/teacher/ViewAttendance'))
const StudentManagement = lazy(() => import('./pages/teacher/StudentManagement'))
const StudentAttendance = lazy(() => import('./pages/student/Attendance'))
const StudentSummary = lazy(() => import('./pages/student/Summary'))
const ManagementPage = lazy(() => import('./pages/ManagementPage'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))

function App() {
  const { user } = useAuth()

  return (
    <>
      {user ? <AppNavigation /> : <header className="app-header public-header"><Link to="/" className="brand"><span className="brand-mark" aria-hidden="true">SA</span><span>Student Attendance</span></Link><span className="phase-label">Secure access</span></header>}
      <Suspense fallback={<main className="route-loading" aria-live="polite">Loading page...</main>}>
        <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute role="ADMIN" />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/departments" element={<ManagementPage resource="departments" />} />
          <Route path="/admin/subjects" element={<ManagementPage resource="subjects" />} />
          <Route path="/admin/teachers" element={<ManagementPage resource="teachers" />} />
          <Route path="/admin/students" element={<ManagementPage resource="students" />} />
        </Route>
        <Route element={<ProtectedRoute role="TEACHER" />}>
          <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
          <Route path="/teacher/take-attendance" element={<TakeAttendance />} />
          <Route path="/teacher/attendance-percentage" element={<AttendancePercentage />} />
          <Route path="/teacher/attendance-history" element={<AttendanceHistory />} />
          <Route path="/teacher/attendance/:id" element={<ViewAttendance />} />
          <Route path="/teacher/attendance/:id/edit" element={<EditAttendance />} />
          <Route path="/teacher/students" element={<StudentManagement />} />
        </Route>
        <Route element={<ProtectedRoute role="STUDENT" />}>
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/student/attendance" element={<StudentAttendance />} />
          <Route path="/student/attendance/summary" element={<StudentSummary />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}

function RootApp() {
  return <AuthProvider><App /></AuthProvider>
}

export default RootApp
