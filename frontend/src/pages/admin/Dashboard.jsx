import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/dashboard')
      .then((response) => setSummary(response.data.data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load admin dashboard.'))
  }, [])

  return (
    <main className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Admin Dashboard</h1>
          <p className="intro">Welcome, {user?.name || 'Administrator'}.</p>
        </div>
        <button type="button" className="button-secondary" onClick={logout}>Logout</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {summary && (
        <>
          <div className="dashboard-actions">
            <Link to="/admin/students">Students</Link>
            <Link to="/admin/teachers">Teachers</Link>
            <Link to="/admin/sections">Sections</Link>
            <Link to="/admin/departments">Departments</Link>
            <Link to="/admin/subjects">Subjects</Link>
            <Link to="/admin/assignments">Assignments</Link>
            <Link to="/admin/timetables">Timetable</Link>
          </div>
          <div className="summary-grid dashboard-summary">
            <div><span>Total Students</span><strong>{summary.totalStudents}</strong></div>
            <div><span>Total Teachers</span><strong>{summary.totalTeachers}</strong></div>
            <div><span>Total Sections</span><strong>{summary.totalClasses}</strong></div>
            <div><span>Total Subjects</span><strong>{summary.totalSubjects}</strong></div>
            <div><span>Total Timetables</span><strong>{summary.totalTimetables}</strong></div>
            <div><span>Active Students</span><strong>{summary.activeStudents}</strong></div>
            <div><span>Active Teachers</span><strong>{summary.activeTeachers}</strong></div>
          </div>
        </>
      )}
    </main>
  )
}
