import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AttendanceSummary from '../../components/teacher/AttendanceSummary'
import StudentList from '../../components/teacher/StudentList'
import { getAttendanceSession, saveAttendanceRecords, updateAttendanceSession } from '../../services/attendanceApi'
import { getClasses, getStudentsByClass, getSubjectsByClass } from '../../services/teacherApi'

const periods = [1, 2, 3, 4, 5, 6, 7, 8]

export default function EditAttendance() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [students, setStudents] = useState([])
  const [statuses, setStatuses] = useState({})
  const [form, setForm] = useState({ date: '', classId: '', subjectId: '', periodNumber: '', status: 'COMPLETED' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [sessionResult, classResult] = await Promise.all([getAttendanceSession(id), getClasses()])
        const { session, records } = sessionResult.data
        const classId = session.classId._id
        const [subjectResult, studentResult] = await Promise.all([getSubjectsByClass(classId), getStudentsByClass(classId)])
        setClasses(classResult.data); setSubjects(subjectResult.data); setStudents(studentResult.data)
        setForm({ date: session.date.slice(0, 10), classId, subjectId: session.subjectId._id, periodNumber: String(session.periodNumber), status: session.status })
        setStatuses(Object.fromEntries(records.map((record) => [record.studentId?._id || record.studentId, record.status])))
      } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load attendance session.') } finally { setLoading(false) }
    }
    load()
  }, [id])

  async function changeClass(event) {
    const classId = event.target.value
    setForm((current) => ({ ...current, classId, subjectId: '' })); setSubjects([]); setStudents([]); setStatuses({})
    if (!classId) return
    try { const [subjectResult, studentResult] = await Promise.all([getSubjectsByClass(classId), getStudentsByClass(classId)]); setSubjects(subjectResult.data); setStudents(studentResult.data); setStatuses(Object.fromEntries(studentResult.data.map((student) => [student._id, 'PRESENT']))) } catch (_error) { setError('Unable to load the selected class.') }
  }

  function updateField(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })) }

  async function saveChanges(event) {
    event.preventDefault(); setError('')
    if (!form.date || !form.classId || !form.subjectId || !form.periodNumber) return setError('Complete every attendance session field.')
    if (students.some((student) => !statuses[student._id])) return setError('Please mark attendance for all students.')
    setSaving(true)
    try { await updateAttendanceSession(id, { ...form, periodNumber: Number(form.periodNumber) }); await saveAttendanceRecords(id, students.map((student) => ({ studentId: student._id, status: statuses[student._id] || 'PRESENT' }))); navigate(`/teacher/attendance/${id}`, { replace: true, state: { message: 'Attendance updated successfully.' } }) } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to save attendance changes.') } finally { setSaving(false) }
  }

  if (loading) return <main className="workspace-page"><p className="health-message">Loading attendance session...</p></main>

  return (
    <main className="workspace-page">
      <div className="page-heading"><div><p className="eyebrow">Teacher workspace</p><h1>Edit Attendance</h1></div><Link className="text-link" to="/teacher/attendance-history">Back to history</Link></div>
      <form className="workspace-card" onSubmit={saveChanges}>
        <div className="form-grid">
          <label>Date<input name="date" type="date" value={form.date} onChange={updateField} /></label>
          <label>Class<select name="classId" value={form.classId} onChange={changeClass}>{classes.map((item) => <option key={item._id} value={item._id}>{item.className} - {item.section}</option>)}</select></label>
          <label>Subject<select name="subjectId" value={form.subjectId} onChange={updateField}><option value="">Select subject</option>{subjects.map((item) => <option key={item._id} value={item._id}>{item.subjectCode} - {item.subjectName}</option>)}</select></label>
          <label>Period<select name="periodNumber" value={form.periodNumber} onChange={updateField}>{periods.map((period) => <option key={period} value={period}>Period {period}</option>)}</select></label>
        </div>
        <div className="section-heading"><div><h2>Student Attendance</h2><p>Update individual statuses as needed.</p></div></div>
        <AttendanceSummary students={students} statuses={statuses} />
        <StudentList students={students} statusByStudent={statuses} onStatusChange={(studentId, status) => setStatuses((current) => ({ ...current, [studentId]: status }))} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><Link className="button-secondary button-link" to={`/teacher/attendance/${id}`}>Cancel</Link><button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button></div>
      </form>
    </main>
  )
}
