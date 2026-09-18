import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PasswordField from '../components/PasswordField'
import { createManaged, deleteManaged, listManaged, updateManaged } from '../services/managementApi'

const resourceConfig = {
  departments: { title: 'Departments', singular: 'Department', fields: [['name', 'Name'], ['code', 'Code']], formFields: [['name', 'Department name'], ['code', 'Department code']] },
  classes: { title: 'Sections', singular: 'Section', classManagement: true, fields: [['department', 'Department'], ['section', 'Section'], ['year', 'Year', 'number']] },
  subjects: { title: 'Subjects', singular: 'Subject', fields: [['name', 'Subject name'], ['code', 'Subject code'], ['department', 'Department'], ['section', 'Section'], ['year', 'Year', 'number']], formFields: [['name', 'Subject name'], ['code', 'Subject code'], ['department', 'Department'], ['section', 'Section', 'section'], ['year', 'Year', 'number']] },
  teachers: { title: 'Teachers', singular: 'Teacher', fields: [['name', 'Teacher name'], ['username', 'Username'], ['department', 'Department']], formFields: [['name', 'Teacher name'], ['username', 'Username'], ['department', 'Department'], ['password', 'Password', 'password'], ['confirmPassword', 'Confirm password', 'password']] },
  students: { title: 'Students', singular: 'Student', fields: [['name', 'Student name'], ['registerNumber', 'Register number'], ['username', 'Username'], ['section', 'Section'], ['department', 'Department'], ['year', 'Year', 'number']], formFields: [['name', 'Student name'], ['registerNumber', 'Register number'], ['username', 'Username'], ['section', 'Section', 'section'], ['department', 'Department'], ['year', 'Year', 'number'], ['password', 'Password', 'password'], ['confirmPassword', 'Confirm password', 'password']] },
  assignments: { title: 'Assignments', singular: 'Assignment', fields: [['teacherId', 'Teacher', 'teacher'], ['classId', 'Section', 'class'], ['subjectId', 'Subject', 'subject']] },
  timetables: { title: 'Timetable', singular: 'Timetable', fields: [['day', 'Day'], ['classId', 'Section', 'class'], ['period', 'Period', 'number'], ['subjectId', 'Subject', 'subject'], ['teacherId', 'Teacher', 'teacher']] },
}

const blank = (resource) => ({ ...Object.fromEntries((resourceConfig[resource].formFields || resourceConfig[resource].fields).map(([name]) => [name, ''])), active: true })

export default function ManagementPage({ resource: resourceProp }) {
  const { user } = useAuth()
  const { resource: routeResource } = useParams()
  const resource = resourceProp || routeResource || 'classes'
  const config = resourceConfig[resource] || resourceConfig.classes
  const [items, setItems] = useState([])
  const [options, setOptions] = useState({ classes: [], subjects: [], teachers: [] })
  const [form, setForm] = useState(blank(resource))
  const [editingId, setEditingId] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ classId: '', department: '', year: '' })
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadData() {
    const resources = resource === 'students' || resource === 'subjects' ? [resource, 'classes']
      : resource === 'assignments' ? ['assignments', 'teachers', 'classes', 'subjects']
      : resource === 'timetables' ? ['timetables', 'classes', 'subjects', 'teachers']
      : resource === 'departments' ? ['departments']
      : [resource]
    const results = await Promise.all(resources.map((item) => listManaged(item)))
    const nextOptions = {}
    resources.slice(1).forEach((item, index) => { nextOptions[item] = results[index + 1].data })
    setItems(results[0].data)
    setOptions((current) => ({ ...current, ...nextOptions }))
  }

  useEffect(() => {
    setLoading(true)
    loadData()
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load management data.'))
      .finally(() => setLoading(false))
  }, [resource])

  const visibleItems = useMemo(() => items.filter((item) => {
    const values = Object.values(item).filter((value) => typeof value === 'string').join(' ').toLowerCase()
    return (!search || values.includes(search.toLowerCase())) && (!filters.classId || item.classId === filters.classId) && (!filters.department || item.department === filters.department) && (!filters.year || String(item.year) === filters.year)
  }), [items, search, filters])

  function updateField(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })) }
  function startEdit(item) { const next = blank(resource); config.fields.forEach(([name]) => { next[name] = item[name] || '' }); next.active = item.active !== false; setForm(next); setEditingId(item.id); setShowForm(true); setError(''); setMessage('') }
  function cancelEdit() { setForm(blank(resource)); setEditingId(''); setShowForm(false) }
  function optionLabel(field, option) { if (field === 'classId') return `${option.name} - ${option.section}`; if (field === 'subjectId') return `${option.code} - ${option.name}`; return `${option.name} (${option.username})` }
  function fieldOptions(type) { return type === 'class' ? options.classes : type === 'subject' ? options.subjects : type === 'teacher' ? options.teachers : ['A', 'B', 'C', 'D'].map((section) => ({ id: section, name: section })) }
  function displayValue(item, name) {
    if (name === 'classId') return item.className ? `${item.className} - ${item.classSection}` : item.classId
    if (name === 'teacherId') return item.teacher || item.teacherId
    if (name === 'subjectId') return item.subject || item.subjectId
    if (name === 'section') return item.section
    return item[name]
  }

  function classYear(year) { return year === 1 ? '1st Year' : year === 2 ? '2nd Year' : year === 3 ? '3rd Year' : `${year}th Year` }

  async function submit(event) {
    event.preventDefault(); setError(''); setMessage('')
    try {
      const payload = config.classManagement ? { ...form, name: `${form.department} - ${form.section}` } : form
      await (editingId ? updateManaged(resource, editingId, payload) : createManaged(resource, payload))
      await loadData()
      setMessage(`${config.singular} ${editingId ? 'updated' : 'created'} successfully.`); cancelEdit()
    } catch (requestError) { setError(requestError.response?.data?.message || `${config.singular} could not be saved.`) }
  }

  async function removeItem(item) {
    if (!window.confirm(`Delete this ${config.singular.toLowerCase()}?`)) return
    try { await deleteManaged(resource, item.id); setItems((current) => current.filter((entry) => entry.id !== item.id)); setMessage(`${config.singular} deleted.`) } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to delete item.') }
  }

  return <main className="workspace-page">
    <div className="page-heading"><div><p className="eyebrow">College data management</p><h1>{config.title}</h1><p className="intro">Manage real college records for attendance and access.</p></div><Link className="text-link" to={user?.role === 'ADMIN' ? '/admin/dashboard' : '/teacher/dashboard'}>Back to dashboard</Link></div>
    {message && <p className="success-message" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    <section className={`workspace-card${config.classManagement ? ' class-management' : ''}`}><div className="section-heading"><div><h2>{config.title} list</h2><p>Use IDs internally; labels are for display only.</p></div><button type="button" className="compact-button" onClick={() => { setForm(blank(resource)); setEditingId(''); setShowForm(true); setError('') }}>Add {config.singular}</button></div>
      <div className="filter-grid"><label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${config.title.toLowerCase()}`} /></label>{resource === 'students' && <><label>Filter section<select value={filters.classId} onChange={(event) => setFilters((current) => ({ ...current, classId: event.target.value }))}><option value="">All sections</option>{options.classes.map((item) => <option key={item.id} value={item.id}>{item.section} ({item.department}, Year {item.year})</option>)}</select></label><label>Department<input value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))} /></label><label>Year<input type="number" value={filters.year} onChange={(event) => setFilters((current) => ({ ...current, year: event.target.value }))} /></label></>}</div>
      {loading ? <p className="health-message">Loading {config.title.toLowerCase()}...</p> : <div className="table-wrap"><table className="data-table"><thead><tr>{config.fields.map(([name, label]) => <th key={name}>{label}</th>)}<th>Actions</th></tr></thead><tbody>{visibleItems.map((item) => <tr key={item.id}>{config.classManagement ? <><td>{item.department}</td><td>{item.section}</td><td>{classYear(item.year)}</td></> : config.fields.map(([name]) => <td key={name}>{displayValue(item, name)}</td>)}<td className="table-actions"><button type="button" className="button-secondary compact-button" onClick={() => startEdit(item)}>Edit</button><button type="button" className="button-secondary compact-button" onClick={() => removeItem(item)}>Delete</button></td></tr>)}</tbody></table>{!visibleItems.length && <p className="empty-state">No matching records.</p>}</div>}
    </section>
    {showForm && <section className={`workspace-card${config.classManagement ? ' class-management' : ''}`}><div className="section-heading"><div><h2>{editingId ? 'Edit' : 'Add'} {config.singular}</h2></div><button type="button" className="button-secondary compact-button" onClick={cancelEdit}>Cancel</button></div><form onSubmit={submit}><div className="form-grid">{(config.formFields || config.fields).map(([name, label, type]) => <label key={name}>{label}{type === 'class' || type === 'subject' || type === 'teacher' || type === 'section' ? <select name={name} value={form[name]} onChange={updateField} required><option value="">Select {label.toLowerCase()}</option>{fieldOptions(type).map((item) => <option key={item.id} value={item.id}>{type === 'section' ? item.name : optionLabel(name, item)}</option>)}</select> : type === 'password' ? <PasswordField name={name} value={form[name]} onChange={updateField} required={!editingId} /> : <input name={name} type={type || 'text'} value={form[name]} onChange={updateField} required={!editingId || !['password', 'confirmPassword'].includes(name)} autoComplete={type === 'password' ? 'new-password' : undefined} />} </label>)}</div><div className="form-actions"><button type="submit" className="compact-button">{editingId ? 'Update' : 'Create'} {config.singular}</button></div></form></section>}
  </main>
}
