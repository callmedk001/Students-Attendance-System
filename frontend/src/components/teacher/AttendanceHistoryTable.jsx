import { Link } from 'react-router-dom'

function displayDate(value) {
  return value ? new Date(value).toLocaleDateString() : '-'
}

export default function AttendanceHistoryTable({ sessions }) {
  if (!sessions.length) return <p className="empty-state">No attendance records found.</p>

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr><th>Date</th><th>Class</th><th>Subject</th><th>Period</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session._id}>
              <td>{displayDate(session.date)}</td>
              <td>{session.classId?.className || '-'}</td>
              <td>{session.subjectId?.subjectCode || session.subjectId?.subjectName || '-'}</td>
              <td>{session.periodNumber}</td>
              <td><span className={`status-chip status-${session.status.toLowerCase()}`}>{session.status}</span></td>
              <td className="table-actions"><Link className="text-link" to={`/teacher/attendance/${session._id}`}>View</Link><Link className="text-link" to={`/teacher/attendance/${session._id}/edit`}>Edit</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
