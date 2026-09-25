import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AttendanceSummary from '../../components/teacher/AttendanceSummary'
import StudentList from '../../components/teacher/StudentList'
import { createAttendanceSession, getAttendanceSession, saveAttendanceRecords } from '../../services/attendanceApi'
import { getAttendanceHistory, getClasses, getStudentsByClass, getSubjectsByClass } from '../../services/teacherApi'

const periodOptions = [1, 2, 3, 4, 5, 6, 7, 8]
const today = new Date().toISOString().slice(0, 10)

export default function TakeAttendance() {
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [students, setStudents] = useState([])
  const [statuses, setStatuses] = useState({})
  const [attendanceSessionId, setAttendanceSessionId] = useState('')
  const [search, setSearch] = useState('')
  const [absentRegisterNumbers, setAbsentRegisterNumbers] = useState('')
  const [odRegisterNumbers, setOdRegisterNumbers] = useState('')
  const [form, setForm] = useState({ date: today, classId: '', subjectId: '', periodNumber: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadingSavedAttendance, setLoadingSavedAttendance] = useState(false)
  const [previousSessionId, setPreviousSessionId] = useState('')
  const [carryingPrevious, setCarryingPrevious] = useState(false)

  useEffect(() => {
    getClasses().then((result) => setClasses(result.data)).catch(() => setError('Unable to load sections.')).finally(() => setLoading(false))
  }, [])

  const visibleStudents = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return students
    return students.filter((student) => [student.name, student.studentId, student.rollNumber].some((value) => String(value || '').toLowerCase().includes(query)))
  }, [students, search])

  useEffect(() => {
    if (!form.date || !form.classId || !form.subjectId || !form.periodNumber || !students.length) return
    let cancelled = false
    async function loadSavedAttendance() {
      setLoadingSavedAttendance(true)
      setError('')
      try {
        const history = await getAttendanceHistory({ date: form.date, classId: form.classId, subjectId: form.subjectId, periodNumber: form.periodNumber })
        const existing = history.data[0]
        if (!existing) {
          let previousId = ''
          if (Number(form.periodNumber) > 1) {
            const previousHistory = await getAttendanceHistory({ date: form.date, classId: form.classId, subjectId: form.subjectId, periodNumber: Number(form.periodNumber) - 1 })
            previousId = previousHistory.data[0]?.sessionId || previousHistory.data[0]?._id || ''
          }
          if (!cancelled) { setAttendanceSessionId(''); setPreviousSessionId(previousId); setStatuses({}); setAbsentRegisterNumbers(''); setOdRegisterNumbers('') }
          return
        }
        const sessionResult = await getAttendanceSession(existing.sessionId || existing._id)
        if (!cancelled) {
          setAttendanceSessionId(sessionResult.data.session._id)
          setPreviousSessionId('')
          setStatuses(Object.fromEntries(sessionResult.data.records.map((record) => [record.studentId?._id || record.studentId, record.status])))
          setAbsentRegisterNumbers(sessionResult.data.records.filter((record) => record.status === 'ABSENT').map((record) => record.studentId?.studentId).join(', '))
          setOdRegisterNumbers(sessionResult.data.records.filter((record) => record.status === 'OD').map((record) => record.studentId?.studentId).join(', '))
        }
      } catch (requestError) {
        if (!cancelled) setError(requestError.response?.data?.message || 'Unable to load saved attendance.')
      } finally {
        if (!cancelled) setLoadingSavedAttendance(false)
      }
    }
    loadSavedAttendance()
    return () => { cancelled = true }
  }, [form.date, form.classId, form.subjectId, form.periodNumber, students])

  async function selectSection(event) {
    const classId = event.target.value
    setForm((current) => ({ ...current, classId, subjectId: '' }))
    setSubjects([])
    setStudents([])
    setStatuses({})
    setAbsentRegisterNumbers('')
    setOdRegisterNumbers('')
    setAttendanceSessionId('')
    setPreviousSessionId('')
    if (!classId) return
    setError('')
    try {
      const [subjectResult, studentResult] = await Promise.all([getSubjectsByClass(classId), getStudentsByClass(classId)])
      setSubjects(subjectResult.data)
      setStudents(studentResult.data)
      setStatuses({})
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load section students and subjects.')
    }
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function markAllPresent() {
    setStatuses(Object.fromEntries(students.map((student) => [student._id, 'PRESENT'])))
    setAbsentRegisterNumbers('')
    setOdRegisterNumbers('')
  }

  function parseRegisterNumbers(value) {
    return [...new Set(value.split(/[\s,]+/).map((entry) => entry.trim()).filter(Boolean))]
  }

  function validateRegisterNumbers(registerNumbers, classLabel) {
    const studentNumbers = new Set(students.map((student) => String(student.studentId)))
    return registerNumbers.filter((registerNumber) => !studentNumbers.has(registerNumber)).map((registerNumber) => `Register number ${registerNumber} is not found in ${classLabel}.`)
  }

  async function carryPreviousPresent() {
    if (!previousSessionId) return
    setCarryingPrevious(true)
    setError('')
    try {
      const previousSession = await getAttendanceSession(previousSessionId)
      const previousPresent = new Set(previousSession.data.records.filter((record) => record.status === 'PRESENT').map((record) => record.studentId?._id || record.studentId))
      setStatuses((current) => Object.fromEntries([...Object.entries(current), ...students.filter((student) => previousPresent.has(student._id)).map((student) => [student._id, 'PRESENT'])]))
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to carry previous-period attendance.')
    } finally {
      setCarryingPrevious(false)
    }
  }

  async function saveAttendance(event) {
    event.preventDefault()
    setError('')
    if (!form.date || !form.classId || !form.subjectId || !form.periodNumber) return setError('Complete every attendance session field.')
    if (!students.length) return setError('Select a section with at least one student.')
    const absentNumbers = parseRegisterNumbers(absentRegisterNumbers)
    const odNumbers = parseRegisterNumbers(odRegisterNumbers)
    const overlap = absentNumbers.filter((registerNumber) => odNumbers.includes(registerNumber))
    if (overlap.length) return setError(`Register number ${overlap[0]} cannot be listed as both Absent and OD.`)
    const selectedClass = classes.find((item) => item._id === form.classId)
    const classLabel = selectedClass ? `${selectedClass.department} ${selectedClass.section}` : 'the selected department and section'
    const invalidNumbers = [...validateRegisterNumbers(absentNumbers, classLabel), ...validateRegisterNumbers(odNumbers, classLabel)]
    if (invalidNumbers.length) return setError(invalidNumbers.join(' '))
    const absentSet = new Set(absentNumbers)
    const odSet = new Set(odNumbers)
    const calculatedStatuses = Object.fromEntries(students.map((student) => [student._id, absentSet.has(String(student.studentId)) ? 'ABSENT' : odSet.has(String(student.studentId)) ? 'OD' : 'PRESENT']))
    setStatuses(calculatedStatuses)

    setSaving(true)
    try {
      let sessionId = attendanceSessionId
      if (!sessionId) {
        try {
          const sessionResult = await createAttendanceSession({ ...form, periodNumber: Number(form.periodNumber) })
          sessionId = sessionResult.data._id
        } catch (requestError) {
          if (requestError.response?.status !== 409) throw requestError
          const history = await getAttendanceHistory({ date: form.date, classId: form.classId, subjectId: form.subjectId, periodNumber: form.periodNumber })
          sessionId = history.data[0]?.sessionId || history.data[0]?._id
          if (!sessionId) throw requestError
        }
      }
      await saveAttendanceRecords(sessionId, students.map((student) => ({ studentId: student._id, status: calculatedStatuses[student._id] })))
      navigate('/teacher/attendance-history', { replace: true, state: { message: 'Attendance saved successfully.' } })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save attendance.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="workspace-page">
      <div className="page-heading"><div><p className="eyebrow">Teacher workspace</p><h1>Take Attendance</h1></div><Link className="text-link" to="/teacher/dashboard">Back to dashboard</Link></div>
      {loading ? <p className="health-message">Loading sections...</p> : error && !classes.length ? <section className="workspace-card"><p className="form-error" role="alert">{error}</p><p className="empty-state">No authorized department and section choices are available. Confirm that your teacher account has an active section and subject access.</p></section> : <form onSubmit={saveAttendance} className="workspace-card">
        <div className="form-grid">
          <label>Date<input name="date" type="date" value={form.date} onChange={updateField} /></label>
          <label>Department & Section<select name="classId" value={form.classId} onChange={selectSection}><option value="">Select department and section</option>{classes.map((item) => <option key={item._id} value={item._id}>{item.department} {item.section} (Year {item.year})</option>)}</select></label>
          <label>Subject<select name="subjectId" value={form.subjectId} onChange={updateField} disabled={!form.classId}><option value="">Select subject</option>{subjects.map((item) => <option key={item._id} value={item._id}>{item.subjectName} ({item.subjectCode})</option>)}</select></label>
          <label>Period<select name="periodNumber" value={form.periodNumber} onChange={updateField}><option value="">Select period</option>{periodOptions.map((period) => <option key={period} value={period}>Period {period}</option>)}</select></label>
          <label>Absent Register Numbers<textarea value={absentRegisterNumbers} onChange={(event) => setAbsentRegisterNumbers(event.target.value)} placeholder="101, 105, 112" rows="2" /></label>
          <label>OD Register Numbers<textarea value={odRegisterNumbers} onChange={(event) => setOdRegisterNumbers(event.target.value)} placeholder="108, 115" rows="2" /></label>
        </div>
        <div className="attendance-toolbar"><label className="student-search">Search student<input type="search" placeholder="Search name or register number" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="attendance-actions"><button type="button" className="button-secondary" onClick={markAllPresent} disabled={!students.length}>Mark All Present</button>{previousSessionId && <button type="button" className="button-secondary" onClick={carryPreviousPresent} disabled={carryingPrevious}>{carryingPrevious ? 'Loading previous...' : 'Carry Previous Period Present'}</button>}</div></div>
        <AttendanceSummary students={students} statuses={statuses} />
        {loadingSavedAttendance && <p className="health-message">Loading saved attendance...</p>}
        <StudentList students={visibleStudents} statusByStudent={statuses} onStatusChange={(id, status) => setStatuses((current) => ({ ...current, [id]: status }))} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" disabled={saving || !students.length}>{saving ? 'Saving...' : 'Save Attendance'}</button>
      </form>}
    </main>
  )
}
