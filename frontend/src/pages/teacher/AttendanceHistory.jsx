import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import RegisterAttendanceHistoryTable from '../../components/teacher/RegisterAttendanceHistoryTable'
import { getAttendanceSession } from '../../services/attendanceApi'
import { getAttendanceHistory, getClasses, getSubjectsByClass } from '../../services/teacherApi'

async function recordsForSessions(sessions) {
  const details = await Promise.all(sessions.map((session) => getAttendanceSession(session._id)))
  return details.flatMap((result) => result.data.records.map((record) => ({ sessionId: result.data.session._id, studentId: record.studentId?._id || record.studentId, date: result.data.session.date, rollNumber: record.studentId?.studentId || '-', status: record.status })))
}

export default function AttendanceHistory() {
  const location = useLocation()
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [records, setRecords] = useState([])
  const [filters, setFilters] = useState({ date: '', classId: '', subjectId: '', periodNumber: '', startDate: '', endDate: '' })
  const [message, setMessage] = useState(location.state?.message || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getClasses(), getAttendanceHistory()]).then(async ([classResult, historyResult]) => { setClasses(classResult.data); setRecords(await recordsForSessions(historyResult.data)) }).catch(() => setError('Unable to load attendance history.')).finally(() => setLoading(false))
  }, [])

  async function updateClass(event) {
    const classId = event.target.value
    setFilters((current) => ({ ...current, classId, subjectId: '' }))
    setSubjects([])
    if (!classId) return
    try { const result = await getSubjectsByClass(classId); setSubjects(result.data) } catch (_error) { setError('Unable to load subjects.') }
  }

  function updateFilter(event) { setFilters((current) => ({ ...current, [event.target.name]: event.target.value })) }

  function clearFilters() {
    setFilters({ date: '', classId: '', subjectId: '', periodNumber: '', startDate: '', endDate: '' })
    setSubjects([])
    setMessage('')
    getAttendanceHistory().then((result) => recordsForSessions(result.data)).then(setRecords).catch(() => setError('Unable to load attendance history.'))
  }

  async function filterHistory(event) {
    event.preventDefault()
    setMessage('')
    if (filters.startDate && filters.endDate && filters.endDate < filters.startDate) { setError('End date must not be earlier than start date.'); return }
    try { const result = await getAttendanceHistory(Object.fromEntries(Object.entries(filters).filter(([, value]) => value))); setRecords(await recordsForSessions(result.data)) } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to filter attendance history.') }
  }

  return (
    <main className="workspace-page">
      <div className="page-heading"><div><p className="eyebrow">Teacher workspace</p><h1>Attendance History</h1></div><Link className="text-link" to="/teacher/dashboard">Back to dashboard</Link></div>
      {message && <p className="success-message" role="status">{message}</p>}
      <section className="workspace-card">
        <form className="filter-grid" onSubmit={filterHistory}>
          <label>Date<input name="date" type="date" value={filters.date} onChange={updateFilter} /></label>
          <label>Start Date<input name="startDate" type="date" value={filters.startDate} onChange={updateFilter} /></label>
          <label>End Date<input name="endDate" type="date" value={filters.endDate} onChange={updateFilter} /></label>
          <label>Department & Section<select name="classId" value={filters.classId} onChange={updateClass}><option value="">All department and sections</option>{classes.map((item) => <option key={item._id} value={item._id}>{item.department} {item.section} (Year {item.year})</option>)}</select></label>
          <label>Subject<select name="subjectId" value={filters.subjectId} onChange={updateFilter} disabled={!filters.classId}><option value="">All subjects</option>{subjects.map((item) => <option key={item._id} value={item._id}>{item.subjectCode}</option>)}</select></label>
          <label>Period<input name="periodNumber" type="number" min="1" value={filters.periodNumber} onChange={updateFilter} /></label>
          <div className="filter-actions"><button type="submit">Apply Filters</button><button type="button" className="button-secondary" onClick={clearFilters}>Clear Filters</button></div>
        </form>
        {loading ? <p className="health-message">Loading attendance history...</p> : <RegisterAttendanceHistoryTable records={records} />}
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
    </main>
  )
}
