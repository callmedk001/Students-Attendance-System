import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppNavigation from './components/AppNavigation'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import Login from './pages/Login'
import StudentDashboard from './pages/student/Dashboard'
import TeacherDashboard from './pages/teacher/Dashboard'
import TakeAttendance from './pages/teacher/TakeAttendance'
import AttendanceHistory from './pages/teacher/AttendanceHistory'
import AttendancePercentage from './pages/teacher/AttendancePercentage'
import EditAttendance from './pages/teacher/EditAttendance'
import ViewAttendance from './pages/teacher/ViewAttendance'
import StudentManagement from './pages/teacher/StudentManagement'
import StudentAttendance from './pages/student/Attendance'
import StudentSummary from './pages/student/Summary'
import ManagementPage from './pages/ManagementPage'
import AdminDashboard from './pages/admin/Dashboard'

function App() {
  const { user } = useAuth()

  return (
    <>
      {user ? <AppNavigation /> : <header className="app-header public-header"><Link to="/" className="brand"><span className="brand-mark" aria-hidden="true">SA</span><span>Student Attendance</span></Link><span className="phase-label">Secure access</span></header>}
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
    </>
  )
}

function RootApp() {
  return <AuthProvider><App /></AuthProvider>
}

export default RootApp
