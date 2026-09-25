function displayDate(value) {
  return value ? new Date(value).toLocaleDateString() : '-'
}

export default function RegisterAttendanceHistoryTable({ records }) {
  if (!records.length) return <p className="empty-state">No attendance records found.</p>

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr><th>Date</th><th>Register Number</th><th>Status</th></tr></thead>
        <tbody>{records.map((record) => <tr key={`${record.sessionId}-${record.studentId}`}><td>{displayDate(record.date)}</td><td>{record.registerNumber}</td><td><span className={`status-chip status-${record.status.toLowerCase()}`}>{record.status}</span></td></tr>)}</tbody>
      </table>
    </div>
  )
}