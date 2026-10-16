import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTeacherDashboard } from '../../services/teacherApi'
import { useAuth } from '../../context/AuthContext'

export default function TeacherDashboard() {
  const { user, logout } = useAuth()
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getTeacherDashboard().then((result) => setDashboard(result.data)).catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load teacher dashboard.'))
  }, [])

  return (
    <main className="workspace-page">
      <div className="page-heading"><div><p className="eyebrow">Teacher workspace</p><h1>Teacher Dashboard</h1><p className="intro">Welcome, {dashboard?.teacher?.name || user.name}.</p></div><button type="button" className="button-secondary" onClick={logout}>Logout</button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {dashboard && <>
        <div className="dashboard-actions"><Link to="/teacher/take-attendance">Take Attendance</Link><Link to="/teacher/attendance-percentage">Attendance Percentage</Link><Link to="/teacher/attendance-history">Attendance History</Link><Link to="/teacher/students">Students</Link></div>
        <div className="summary-grid dashboard-summary"><div><span>Total Classes</span><strong>{dashboard.totalClasses}</strong></div><div><span>Total Subjects</span><strong>{dashboard.totalSubjects}</strong></div><div><span>Today's Sessions</span><strong>{dashboard.todaySessions.length}</strong></div><div><span>Recent Sessions</span><strong>{dashboard.recentSessions.length}</strong></div></div>
        <section className="workspace-card"><div className="section-heading"><div><h2>Today's Attendance</h2><p>Sessions created by you today.</p></div></div>{dashboard.todaySessions.length ? <ul className="session-list">{dashboard.todaySessions.map((session) => <li key={session._id}><strong>{session.classId?.className}</strong><span>{session.subjectId?.subjectCode} · Period {session.periodNumber} · {session.status}</span></li>)}</ul> : <p className="empty-state">No attendance sessions today.</p>}</section>
        <section className="workspace-card"><div className="section-heading"><div><h2>Recent Sessions</h2><p>Your latest attendance sessions.</p></div></div>{dashboard.recentSessions.length ? <ul className="session-list">{dashboard.recentSessions.map((session) => <li key={session._id}><strong>{session.classId?.className}</strong><span>{new Date(session.date).toLocaleDateString()} · {session.subjectId?.subjectCode} · Period {session.periodNumber}</span></li>)}</ul> : <p className="empty-state">No recent attendance sessions.</p>}</section>
      </>}
    </main>
  )
}
