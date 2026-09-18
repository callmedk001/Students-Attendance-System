function statusClass(status) {
  return `status-chip status-${status.toLowerCase()}`
}

export default function StudentAttendanceTable({ records }) {
  if (!records.length) return <p className="empty-state">No attendance records found.</p>

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr><th>Roll Number</th><th>Student ID</th><th>Student Name</th><th>Attendance Status</th></tr></thead>
        <tbody>
          {records.map((record) => (
            <tr key={record._id}>
              <td>{record.studentId?.rollNumber || '-'}</td>
              <td>{record.studentId?.studentId || '-'}</td>
              <td>{record.studentId?.name || '-'}</td>
              <td><span className={statusClass(record.status)}>{record.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
