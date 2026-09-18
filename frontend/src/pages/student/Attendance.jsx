import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StudentAttendanceTable from '../../components/student/StudentAttendanceTable'
import { getStudentAttendance, getSubjectAttendance } from '../../services/studentApi'

export default function StudentAttendance() {
  const [filters, setFilters] = useState({ startDate: '', endDate: '', subjectId: '', periodNumber: '', status: '' })
  const [range, setRange] = useState('all')
  const [subjects, setSubjects] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getSubjectAttendance(), getStudentAttendance()]).then(([subjectResult, attendanceResult]) => { setSubjects(subjectResult.subjects); setRecords(attendanceResult.records) }).catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load attendance.')).finally(() => setLoading(false))
  }, [])

  function updateFilter(event) { setFilters((current) => ({ ...current, [event.target.name]: event.target.value })) }

  function dateRangeForPreset(preset) {
    const end = new Date()
    const start = new Date(end)
    if (preset === 'today') start.setDate(end.getDate())
    if (preset === 'week') start.setDate(end.getDate() - 6)
    if (preset === 'month') start.setDate(1)
    const format = (date) => date.toISOString().slice(0, 10)
    return preset === 'all' ? { startDate: '', endDate: '' } : { startDate: format(start), endDate: format(end) }
  }

  function selectRange(event) {
    const nextRange = event.target.value
    setRange(nextRange)
    setFilters((current) => ({ ...current, ...dateRangeForPreset(nextRange) }))
  }

  function clearFilters() {
    const empty = { startDate: '', endDate: '', subjectId: '', periodNumber: '', status: '' }
    setFilters(empty); setError(''); setLoading(true)
    setRange('all')
    getStudentAttendance().then((result) => setRecords(result.records)).catch(() => setError('Unable to load attendance.')).finally(() => setLoading(false))
  }

  async function applyFilters(event) {
    event.preventDefault(); setError('')
    if (filters.startDate && filters.endDate && filters.endDate < filters.startDate) return setError('End date must not be earlier than start date.')
    setLoading(true)
    try { const result = await getStudentAttendance(Object.fromEntries(Object.entries(filters).filter(([, value]) => value))); setRecords(result.records) } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to filter attendance.') } finally { setLoading(false) }
  }

  return (
    <main className="workspace-page"><div className="page-heading"><div><p className="eyebrow">Student workspace</p><h1>My Attendance</h1><p className="intro">Read-only attendance history for your account.</p></div><Link className="text-link" to="/student/dashboard">Back to dashboard</Link></div><section className="workspace-card"><form className="filter-grid" onSubmit={applyFilters}><label>Date range<select value={range} onChange={selectRange}><option value="all">All dates</option><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="custom">Custom range</option></select></label><label>From Date<input name="startDate" type="date" value={filters.startDate} onChange={(event) => { setRange('custom'); updateFilter(event) }} /></label><label>To Date<input name="endDate" type="date" value={filters.endDate} onChange={(event) => { setRange('custom'); updateFilter(event) }} /></label><label>Subject<select name="subjectId" value={filters.subjectId} onChange={updateFilter}><option value="">All subjects</option>{subjects.map((subject) => <option key={subject.subjectId} value={subject.subjectId}>{subject.subjectName}</option>)}</select></label><label>Period<select name="periodNumber" value={filters.periodNumber} onChange={updateFilter}><option value="">All periods</option>{[1, 2, 3, 4, 5, 6, 7, 8].map((period) => <option key={period} value={period}>Period {period}</option>)}</select></label><label>Status<select name="status" value={filters.status} onChange={updateFilter}><option value="">All statuses</option><option value="PRESENT">P · Present</option><option value="ABSENT">A · Absent</option><option value="OD">OD · On Duty</option></select></label><div className="filter-actions"><button type="submit">Apply Filters</button><button type="button" className="button-secondary" onClick={clearFilters}>Clear Filters</button></div></form>{error && <p className="form-error" role="alert">Unable to load attendance. Please try again.</p>}{loading ? <p className="health-message">Loading attendance...</p> : <StudentAttendanceTable records={records} />}</section></main>
  )
}
