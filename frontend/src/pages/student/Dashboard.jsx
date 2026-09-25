import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StudentStatsTable from '../../components/student/StudentStatsTable'
import StudentSummaryCards from '../../components/student/StudentSummaryCards'
import StudentAttendanceTable from '../../components/student/StudentAttendanceTable'
import { getMonthlyAttendance, getPeriodAttendance, getStudentAttendance, getStudentAttendanceSummary, getStudentProfile, getSubjectAttendance } from '../../services/studentApi'
import { useAuth } from '../../context/AuthContext'

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const now = new Date()
  const [profile, setProfile] = useState(null)
  const [summary, setSummary] = useState(null)
  const [monthly, setMonthly] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [periods, setPeriods] = useState([])
  const [recentRecords, setRecentRecords] = useState([])
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [loading, setLoading] = useState(true)
  const [monthlyLoading, setMonthlyLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getStudentProfile(), getStudentAttendanceSummary(), getSubjectAttendance(), getPeriodAttendance(), getStudentAttendance()])
      .then(([profileResult, summaryResult, subjectResult, periodResult, attendanceResult]) => { setProfile(profileResult.student); setSummary(summaryResult.summary); setSubjects(subjectResult.subjects); setPeriods(periodResult.periods); setRecentRecords(attendanceResult.records.slice(0, 5)) })
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load student attendance.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setMonthlyLoading(true)
    getMonthlyAttendance(month, year).then((result) => setMonthly(result)).catch(() => { setMonthly(null); setError('Unable to load monthly attendance.') }).finally(() => setMonthlyLoading(false))
  }, [month, year])

  const years = Array.from({ length: 5 }, (_item, index) => now.getFullYear() - index)

  return (
    <main className="workspace-page">
      <div className="page-heading"><div><p className="eyebrow">Student workspace</p><h1>Student Dashboard</h1><p className="intro">Welcome, {profile?.name || user.name}.</p></div><button type="button" className="button-secondary" onClick={logout}>Logout</button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <p className="health-message">Loading attendance dashboard...</p> : <>
        {profile && <section className="profile-strip"><strong>{profile.name}</strong><span>Username: {profile.username}</span><span>Roll Number: {profile.studentId}</span><span>{profile.class?.name || 'Class not assigned'}</span><span>{profile.email}</span></section>}
        <div className="dashboard-actions"><Link to="/student/attendance">My Attendance</Link><Link to="/student/attendance/summary">Full Summary</Link></div>
        <section><h2>Attendance Summary</h2><StudentSummaryCards summary={summary} /></section>
        <section className="workspace-card monthly-panel"><div className="section-heading"><div><h2>Monthly Attendance</h2><p>Choose a month to view its attendance summary.</p></div><div className="month-controls"><label>Month<select value={month} onChange={(event) => setMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_item, index) => <option key={index + 1} value={index + 1}>{new Date(2000, index).toLocaleString('default', { month: 'long' })}</option>)}</select></label><label>Year<select value={year} onChange={(event) => setYear(Number(event.target.value))}>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div></div>{monthlyLoading ? <p className="health-message">Loading monthly attendance...</p> : monthly ? <StudentSummaryCards summary={monthly} /> : <p className="empty-state">No attendance data available for this month.</p>}</section>
        <section className="workspace-card"><div className="section-heading"><div><h2>Subject-wise Attendance</h2></div><Link className="text-link" to="/student/attendance/summary">View summary</Link></div><StudentStatsTable type="subject" items={subjects} /></section>
        <section className="workspace-card"><div className="section-heading"><div><h2>Period-wise Attendance</h2></div><Link className="text-link" to="/student/attendance/summary">View summary</Link></div><StudentStatsTable type="period" items={periods} /></section>
        <section className="workspace-card"><div className="section-heading"><div><h2>Recent Attendance</h2></div><Link className="text-link" to="/student/attendance">View all</Link></div><StudentAttendanceTable records={recentRecords} /></section>
      </>}
    </main>
  )
}
