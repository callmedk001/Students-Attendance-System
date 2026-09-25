import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import StudentAttendanceTable from '../../components/teacher/StudentAttendanceTable'
import { getAttendanceSession } from '../../services/attendanceApi'

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '-'
}

export default function ViewAttendance() {
  const { id } = useParams()
  const location = useLocation()
  const [session, setSession] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState(location.state?.message || '')

  useEffect(() => {
    getAttendanceSession(id)
      .then((result) => { setSession(result.data.session); setRecords(result.data.records) })
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load attendance session.'))
      .finally(() => setLoading(false))
  }, [id])

  const counts = useMemo(() => records.reduce((summary, record) => {
    summary[record.status] += 1
    return summary
  }, { PRESENT: 0, ABSENT: 0, OD: 0 }), [records])

  if (loading) return <main className="workspace-page"><p className="health-message">Loading attendance session...</p></main>
  if (error) return <main className="workspace-page"><p className="form-error" role="alert">{error}</p><Link className="text-link" to="/teacher/attendance-history">Back to history</Link></main>

  return (
    <main className="workspace-page">
      <div className="page-heading"><div><p className="eyebrow">Teacher workspace</p><h1>View Attendance</h1></div><div className="page-actions"><Link className="button-secondary button-link" to="/teacher/attendance-history">Back to history</Link><Link className="button-link" to={`/teacher/attendance/${id}/edit`}>Edit Attendance</Link></div></div>
      {message && <p className="success-message" role="status">{message}</p>}
      {session && <>
        <section className="workspace-card">
          <h2>Attendance Session Details</h2>
          <dl className="details-grid">
            <div><dt>Date</dt><dd>{formatDate(session.date)}</dd></div>
            <div><dt>Department & Section</dt><dd>{session.classId?.department} {session.classId?.section}</dd></div>
            <div><dt>Subject</dt><dd>{session.subjectId?.subjectCode} - {session.subjectId?.subjectName}</dd></div>
            <div><dt>Period</dt><dd>{session.periodNumber}</dd></div>
            <div><dt>Teacher</dt><dd>{session.teacherId?.name || '-'}</dd></div>
            <div><dt>Session Status</dt><dd><span className="status-chip">{session.status}</span></dd></div>
          </dl>
        </section>
        <section className="workspace-card">
          <div className="section-heading"><div><h2>Student Attendance</h2><p>Read-only attendance records for this session.</p></div></div>
          <div className="summary-grid"><div><span>Total Students</span><strong>{records.length}</strong></div><div><span>Present</span><strong>{counts.PRESENT}</strong></div><div><span>Absent</span><strong>{counts.ABSENT}</strong></div><div><span>OD</span><strong>{counts.OD}</strong></div></div>
          <StudentAttendanceTable records={records} />
        </section>
      </>}
    </main>
  )
}
