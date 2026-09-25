import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getAttendanceSession } from '../../services/attendanceApi'
import { getAttendanceHistory, getClasses, getStudentsByClass, getSubjectsByClass } from '../../services/teacherApi'

function datesBetween(startDate, endDate) {
  const dates = []
  const cursor = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

function displayDate(value) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString()
}

async function getSubjectsForClasses(classes) {
  const results = await Promise.all(classes.map((item) => getSubjectsByClass(item._id)))
  return [...new Map(results.flatMap((result) => result.data).map((subject) => [subject._id, subject])).values()]
}

async function buildMatrix(sessions, dates) {
  const details = await Promise.all(sessions.map((session) => getAttendanceSession(session._id)))
  const classIds = [...new Set(sessions.map((session) => String(session.classId?._id || session.classId)))]
  const classStudents = await Promise.all(classIds.map((classId) => getStudentsByClass(classId)))
  const students = [...new Map(classStudents.flatMap((result) => result.data).map((student) => [student._id, student])).values()]
  const cells = new Map()

  details.forEach((result) => {
    const session = result.data.session
    const date = new Date(session.date).toISOString().slice(0, 10)
    const period = Number(session.periodNumber)
    if (period < 1 || period > 8 || !dates.includes(date)) return
    result.data.records.forEach((record) => {
      const studentId = String(record.studentId?._id || record.studentId)
      const key = `${studentId}|${date}`
      const current = cells.get(key) || []
      current.push({ period, status: record.status })
      cells.set(key, current)
    })
  })

  return students.map((student) => ({
    id: student._id,
    rollNumber: student.studentId,
    cells: dates.reduce((result, date) => {
      result[date] = (cells.get(`${student._id}|${date}`) || []).sort((left, right) => left.period - right.period)
      return result
    }, {}),
  }))
}

export default function AttendanceHistory() {
  const location = useLocation()
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [rows, setRows] = useState([])
  const [dates, setDates] = useState([])
  const [filters, setFilters] = useState({ startDate: '', endDate: '', subjectId: '' })
  const [message, setMessage] = useState(location.state?.message || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingTable, setLoadingTable] = useState(false)

  useEffect(() => {
    getClasses().then(async (result) => { setClasses(result.data); setSubjects(await getSubjectsForClasses(result.data)) }).catch(() => setError('Unable to load attendance history.')).finally(() => setLoading(false))
  }, [])

  function updateFilter(event) { setFilters((current) => ({ ...current, [event.target.name]: event.target.value })) }

  function clearFilters() {
    setFilters({ startDate: '', endDate: '', subjectId: '' })
    setRows([])
    setDates([])
    setMessage('')
  }

  async function filterHistory(event) {
    event.preventDefault()
    setMessage('')
    if (!filters.startDate || !filters.endDate) { setError('Select both start and end dates.'); return }
    if (filters.endDate < filters.startDate) { setError('End date must not be earlier than start date.'); return }
    setLoadingTable(true)
    try {
      const nextDates = datesBetween(filters.startDate, filters.endDate)
      const query = { startDate: filters.startDate, endDate: filters.endDate, ...(filters.subjectId ? { subjectId: filters.subjectId } : {}) }
      const result = await getAttendanceHistory(query)
      setDates(nextDates)
      setRows(await buildMatrix(result.data, nextDates))
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to filter attendance history.') } finally { setLoadingTable(false) }
  }

  return (
    <main className="workspace-page">
      <div className="page-heading"><div><p className="eyebrow">Teacher workspace</p><h1>Attendance History</h1></div><Link className="text-link" to="/teacher/dashboard">Back to dashboard</Link></div>
      {message && <p className="success-message" role="status">{message}</p>}
      <section className="workspace-card">
        <form className="filter-grid" onSubmit={filterHistory}>
          <label>Start Date<input name="startDate" type="date" value={filters.startDate} onChange={updateFilter} /></label>
          <label>End Date<input name="endDate" type="date" value={filters.endDate} onChange={updateFilter} /></label>
          <label>Subject<select name="subjectId" value={filters.subjectId} onChange={updateFilter}><option value="">All Subjects</option>{subjects.map((item) => <option key={item._id} value={item._id}>{item.subjectName}</option>)}</select></label>
          <div className="filter-actions"><button type="submit">Apply Filters</button><button type="button" className="button-secondary" onClick={clearFilters}>Clear Filters</button></div>
        </form>
        {loading || loadingTable ? <p className="health-message">Loading attendance history...</p> : rows.length && dates.length ? <div className="table-wrap"><table className="data-table attendance-history-matrix"><thead><tr><th>Roll Number</th>{dates.map((date) => <th key={date}>{displayDate(date)}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}><th scope="row">{row.rollNumber}</th>{dates.map((date) => <td key={date}>{row.cells[date].length ? row.cells[date].map((cell) => `${cell.period}:${cell.status === 'PRESENT' ? 'P' : cell.status === 'ABSENT' ? 'A' : 'OD'}`).join(' · ') : '-'}</td>)}</tr>)}</tbody></table></div> : <p className="empty-state">Select a date range to view attendance history.</p>}
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
    </main>
  )
}
