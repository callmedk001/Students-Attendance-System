function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '-'
}

function statusClass(status) {
  return `status-chip status-${status.toLowerCase()}`
}

function statusLabel(status) {
  return { PRESENT: 'Present', ABSENT: 'Absent', OD: 'On Duty' }[status] || status
}

export default function StudentAttendanceTable({ records }) {
  if (!records.length) return <p className="empty-state">No attendance records found.</p>

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr><th>Date</th><th>Subject</th><th>Period</th><th>Status</th></tr></thead>
        <tbody>{records.map((record) => <tr key={record._id}><td>{formatDate(record.date)}</td><td>{record.subject?.subjectName || record.subject?.subjectCode || '-'}</td><td>Period {record.periodNumber}</td><td><span className={statusClass(record.status)}>{record.status === 'PRESENT' ? 'P' : record.status === 'ABSENT' ? 'A' : 'OD'} · {statusLabel(record.status)}</span></td></tr>)}</tbody>
      </table>
    </div>
  )
}
