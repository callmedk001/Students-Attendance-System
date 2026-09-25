import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createManagedStudent, getClasses, getManagedStudents } from '../../services/teacherApi'
import PasswordField from '../../components/PasswordField'

const emptyForm = { name: '', username: '', registerNumber: '', classId: '', password: '', confirmPassword: '' }

export default function StudentManagement() {
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([getManagedStudents(), getClasses()])
      .then(([studentResult, classResult]) => { setStudents(studentResult.data); setClasses(classResult.data) })
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load student accounts.'))
      .finally(() => setLoading(false))
  }, [])

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return students
    return students.filter((student) => [student.name, student.username, student.registerNumber, student.section, student.department, String(student.year || '')].some((value) => value.toLowerCase().includes(term)))
  }, [search, students])

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function closeForm() {
    setForm(emptyForm)
    setShowForm(false)
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)
    try {
      const result = await createManagedStudent(form)
      setStudents((current) => [...current, result.student].sort((left, right) => left.name.localeCompare(right.name)))
      setMessage('Student created successfully.')
      closeForm()
    } catch (requestError) {
      setForm((current) => ({ ...current, password: '', confirmPassword: '' }))
      setError(requestError.response?.data?.message || 'Student account could not be created.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="workspace-page">
      <div className="page-heading">
        <div><p className="eyebrow">Teacher workspace</p><h1>Student Management</h1><p className="intro">Manage student accounts for your authorized classes.</p></div>
        <Link className="text-link" to="/teacher/dashboard">Back to dashboard</Link>
      </div>
      {message && <p className="success-message" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <section className="workspace-card">
        <div className="section-heading"><div><h2>Students</h2><p>{students.length} account{students.length === 1 ? '' : 's'} in your authorized classes.</p></div><button type="button" className="compact-button" onClick={() => { setShowForm(true); setError(''); setMessage('') }}>Add Student</button></div>
        <label>Search students<input type="search" placeholder="Name, username, register number, or section" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        {loading ? <p className="health-message">Loading student accounts...</p> : filteredStudents.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Username</th><th>Register Number</th><th>Department & Section</th><th>Year</th></tr></thead><tbody>{filteredStudents.map((student) => <tr key={student.id}><td>{student.name}</td><td>{student.username}</td><td>{student.registerNumber}</td><td>{student.department && student.section ? `${student.department} ${student.section}` : '-'}</td><td>{student.year || '-'}</td></tr>)}</tbody></table></div> : <p className="empty-state">No students match this search.</p>}
      </section>
      {showForm && <section className="workspace-card"><div className="section-heading"><div><h2>Add Student</h2><p>The student will receive a Firebase Authentication account and remain separate from your session.</p></div><button type="button" className="button-secondary compact-button" onClick={closeForm}>Cancel</button></div><form onSubmit={submit}><div className="form-grid"><label>Student name<input name="name" value={form.name} onChange={updateField} autoComplete="name" required /></label><label>Register number<input name="registerNumber" value={form.registerNumber} onChange={updateField} required /></label><label>Username<input name="username" value={form.username} onChange={updateField} autoComplete="off" required /></label><label>Department & Section<select name="classId" value={form.classId} onChange={updateField} required><option value="">Select department and section</option>{classes.map((item) => <option key={item._id} value={item._id}>{item.department} {item.section} (Year {item.year})</option>)}</select></label><label>Password<PasswordField name="password" value={form.password} onChange={updateField} required /></label><label>Confirm password<PasswordField name="confirmPassword" value={form.confirmPassword} onChange={updateField} required /></label></div><div className="form-actions"><button type="submit" className="compact-button" disabled={saving}>{saving ? 'Creating...' : 'Create Student'}</button></div></form></section>}
    </main>
  )
}
