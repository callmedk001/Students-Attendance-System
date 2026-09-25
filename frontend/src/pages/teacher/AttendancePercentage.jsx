import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAttendanceSession } from '../../services/attendanceApi'
import { getAttendanceHistory, getClasses, getStudentsByClass, getSubjectsByClass } from '../../services/teacherApi'

function percentage(present, od, total) {
  return total ? Number((((present + od) / total) * 100).toFixed(2)) : 0
}

function summarize(records, studentId) {
  const selectedRecords = records.filter((record) => String(record.studentId?._id || record.studentId) === String(studentId))
  const counts = selectedRecords.reduce((result, record) => {
    result[record.status] += 1
    return result
  }, { PRESENT: 0, ABSENT: 0, OD: 0 })
  const total = counts.PRESENT + counts.ABSENT + counts.OD
  return { present: counts.PRESENT, absent: counts.ABSENT, od: counts.OD, total, percentage: percentage(counts.PRESENT, counts.OD, total) }
}

async function recordsForSessions(sessions) {
  const details = await Promise.all(sessions.map((session) => getAttendanceSession(session._id)))
  return details.flatMap((result) => result.data.records.map((record) => ({ ...record, date: result.data.session.date, sessionId: result.data.session._id })))
}

export default function AttendancePercentage() {
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [students, setStudents] = useState([])
  const [filters, setFilters] = useState({ classId: '', subjectId: '', startDate: '', endDate: '' })
  const [studentId, setStudentId] = useState('')
  const [rangeSummary, setRangeSummary] = useState(null)
  const [overallSummary, setOverallSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getClasses().then((result) => setClasses(result.data)).catch(() => setError('Unable to load department and section choices.')).finally(() => setLoading(false))
  }, [])

  async function updateClass(event) {
    const classId = event.target.value
    setFilters((current) => ({ ...current, classId, subjectId: '' }))
    setSubjects([])
    setStudents([])
    setStudentId('')
    setRangeSummary(null)
    setOverallSummary(null)
    if (!classId) return
    try {
      const [subjectResult, studentResult] = await Promise.all([getSubjectsByClass(classId), getStudentsByClass(classId)])
      setSubjects(subjectResult.data)
      setStudents(studentResult.data)
    } catch (_error) { setError('Unable to load the selected department and section.') }
  }

  function updateFilter(event) { setFilters((current) => ({ ...current, [event.target.name]: event.target.value })) }

  async function loadReport(event) {
    event.preventDefault()
    setError('')
    setRangeSummary(null)
    setOverallSummary(null)
    if (!filters.classId || !studentId) return setError('Select a department, section, and student.')
    if ((filters.startDate && !filters.endDate) || (!filters.startDate && filters.endDate)) return setError('Select both start and end dates.')
    if (filters.startDate && filters.endDate && filters.endDate < filters.startDate) return setError('End date must not be earlier than start date.')
    setLoadingReport(true)
    try {
      const baseFilters = { classId: filters.classId, ...(filters.subjectId ? { subjectId: filters.subjectId } : {}) }
      const [overallResult, rangeResult] = await Promise.all([
        getAttendanceHistory(baseFilters),
        getAttendanceHistory(filters.startDate ? { ...baseFilters, startDate: filters.startDate, endDate: filters.endDate } : baseFilters),
      ])
      const [overallRecords, rangeRecords] = await Promise.all([recordsForSessions(overallResult.data), recordsForSessions(rangeResult.data)])
      setOverallSummary(summarize(overallRecords, studentId))
      setRangeSummary(summarize(rangeRecords, studentId))
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to calculate attendance percentage.') } finally { setLoadingReport(false) }
  }

  const selectedStudent = students.find((student) => String(student._id) === String(studentId))
  const selectedClass = classes.find((item) => item._id === filters.classId)
  const selectedSubject = subjects.find((item) => item._id === filters.subjectId)

  return (
    <main className="workspace-page">
      <div className="page-heading"><div><p className="eyebrow">Teacher workspace</p><h1>Attendance Percentage</h1><p className="intro">Review individual student attendance from existing records.</p></div><Link className="text-link" to="/teacher/dashboard">Back to dashboard</Link></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <section className="workspace-card">
        <form className="filter-grid" onSubmit={loadReport}>
          <label>Department & Section<select name="classId" value={filters.classId} onChange={updateClass} required><option value="">Select department and section</option>{classes.map((item) => <option key={item._id} value={item._id}>{item.department} {item.section} (Year {item.year})</option>)}</select></label>
          <label>Subject<select name="subjectId" value={filters.subjectId} onChange={updateFilter} disabled={!filters.classId}><option value="">All subjects</option>{subjects.map((item) => <option key={item._id} value={item._id}>{item.subjectCode} - {item.subjectName}</option>)}</select></label>
          <label>Student<select value={studentId} onChange={(event) => setStudentId(event.target.value)} disabled={!students.length} required><option value="">Select student</option>{students.map((student) => <option key={student._id} value={student._id}>{student.studentId} - {student.name}</option>)}</select></label>
          <label>Start Date<input name="startDate" type="date" value={filters.startDate} onChange={updateFilter} /></label>
          <label>End Date<input name="endDate" type="date" value={filters.endDate} onChange={updateFilter} /></label>
          <div className="filter-actions"><button type="submit" disabled={loadingReport}>{loadingReport ? 'Loading...' : 'View Attendance'}</button></div>
        </form>
      </section>
      {loading ? <p className="health-message">Loading department and section choices...</p> : selectedStudent && rangeSummary && overallSummary && <>
        <section className="workspace-card"><div className="section-heading"><div><h2>{selectedStudent.name}</h2><p>Roll Number: {selectedStudent.studentId} · {selectedClass?.department} {selectedClass?.section}{selectedSubject ? ` · ${selectedSubject.subjectName}` : ''}</p></div></div><div className="summary-grid"><div><span>Present</span><strong>{rangeSummary.present}</strong></div><div><span>OD</span><strong>{rangeSummary.od}</strong></div><div><span>Absent</span><strong>{rangeSummary.absent}</strong></div><div><span>Total</span><strong>{rangeSummary.total}</strong></div><div><span>Attendance Percentage</span><strong>{rangeSummary.percentage}%</strong></div></div></section>
        <section className="workspace-card"><div className="section-heading"><div><h2>Overall Attendance</h2><p>From the beginning of the available attendance records.</p></div></div><div className="summary-grid"><div><span>Present</span><strong>{overallSummary.present}</strong></div><div><span>OD</span><strong>{overallSummary.od}</strong></div><div><span>Absent</span><strong>{overallSummary.absent}</strong></div><div><span>Total</span><strong>{overallSummary.total}</strong></div><div><span>Percentage</span><strong>{overallSummary.percentage}%</strong></div></div></section>
      </>}
    </main>
  )
}