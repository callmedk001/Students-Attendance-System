import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StudentStatsTable from '../../components/student/StudentStatsTable'
import StudentSummaryCards from '../../components/student/StudentSummaryCards'
import { getMonthlyAttendance, getPeriodAttendance, getStudentAttendanceSummary, getSubjectAttendance } from '../../services/studentApi'

export default function StudentSummary() {
  const now = new Date()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getStudentAttendanceSummary(), getMonthlyAttendance(now.getMonth() + 1, now.getFullYear()), getSubjectAttendance(), getPeriodAttendance()]).then(([summary, monthly, subjects, periods]) => setData({ summary: summary.summary, monthly, subjects: subjects.subjects, periods: periods.periods })).catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load attendance summary.'))
  }, [])

  return <main className="workspace-page"><div className="page-heading"><div><p className="eyebrow">Student workspace</p><h1>Attendance Summary</h1></div><Link className="text-link" to="/student/dashboard">Back to dashboard</Link></div>{error && <p className="form-error" role="alert">{error}</p>}{!data && !error ? <p className="health-message">Loading attendance summary...</p> : data && <><StudentSummaryCards summary={data.summary} /><section className="workspace-card"><h2>Monthly Attendance</h2><p>{data.monthly.month}/{data.monthly.year}</p><StudentSummaryCards summary={data.monthly} /></section><section className="workspace-card"><h2>Subject-wise Attendance</h2><StudentStatsTable type="subject" items={data.subjects} /></section><section className="workspace-card"><h2>Period-wise Attendance</h2><StudentStatsTable type="period" items={data.periods} /></section></>}</main>
}
