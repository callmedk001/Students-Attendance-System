import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const adminLinks = [
  { to: '/admin/dashboard', label: 'Admin Dashboard', end: true },
  { to: '/admin/departments', label: 'Departments' },
  { to: '/admin/students', label: 'Students' },
  { to: '/admin/teachers', label: 'Teachers' },
  { to: '/admin/subjects', label: 'Subjects' },
]

const teacherLinks = [
  { to: '/teacher/dashboard', label: 'Dashboard', end: true },
  { to: '/teacher/take-attendance', label: 'Take Attendance' },
  { to: '/teacher/attendance-percentage', label: 'Attendance Percentage' },
  { to: '/teacher/attendance-history', label: 'Attendance History' },
  { to: '/teacher/students', label: 'Students' },
]

const studentLinks = [
  { to: '/student/dashboard', label: 'Dashboard', end: true },
  { to: '/student/attendance', label: 'My Attendance' },
  { to: '/student/attendance/summary', label: 'Summary' },
]

export default function AppNavigation() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const links = user?.role === 'ADMIN' ? adminLinks : user?.role === 'TEACHER' ? teacherLinks : studentLinks

  if (!user) return null

  async function handleLogout() {
    setMenuOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="app-header authenticated-header">
      <NavLink to="/" className="brand" aria-label="Student Attendance home">
        <span className="brand-mark" aria-hidden="true">SA</span>
        <span>Student Attendance</span>
      </NavLink>
      <button className="mobile-menu-button" type="button" aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen((open) => !open)}>
        <span aria-hidden="true">{menuOpen ? 'Close' : 'Menu'}</span>
      </button>
      <nav id="primary-navigation" className={`primary-navigation ${menuOpen ? 'is-open' : ''}`} aria-label={`${user.role.toLowerCase()} navigation`}>
        <div className="nav-links">
          {links.map((link) => <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMenuOpen(false)}>{link.label}</NavLink>)}
        </div>
        <div className="user-menu">
          <div className="user-summary"><span className="user-avatar" aria-hidden="true">{user.name?.charAt(0).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.role}</small></span></div>
          <button type="button" className="logout-button" onClick={handleLogout}>Logout</button>
        </div>
      </nav>
      <span className="phase-label">{user.role === 'ADMIN' ? 'Admin' : location.pathname.startsWith('/teacher') ? 'Teacher' : 'Student'}</span>
    </header>
  )
}
