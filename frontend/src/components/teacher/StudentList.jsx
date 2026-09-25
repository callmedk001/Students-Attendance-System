const statuses = ['PRESENT', 'ABSENT', 'OD']
const statusLabels = { PRESENT: 'Present', ABSENT: 'Absent', OD: 'On Duty' }

export default function StudentList({ students, statusByStudent, onStatusChange }) {
  if (!students.length) return <p className="empty-state">No students are enrolled in this section.</p>

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr><th>S.No</th><th>Roll Number</th><th>Student Name</th><th>Department & Section</th><th>Attendance Status</th></tr>
        </thead>
        <tbody>
          {students.map((student, index) => (
            <tr key={student._id}>
              <td>{index + 1}</td>
              <td>{student.studentId}</td>
              <td>{student.name}</td>
              <td>{student.department} {student.section}</td>
              <td><div className="status-selector" role="group" aria-label={`Attendance status for ${student.name}`}>{statuses.map((status) => <button key={status} type="button" className={`status-option status-${status.toLowerCase()} ${statusByStudent[student._id] === status ? 'selected' : ''}`} aria-pressed={statusByStudent[student._id] === status} onClick={() => onStatusChange(student._id, status)}><strong>{status === 'PRESENT' ? 'P' : status === 'ABSENT' ? 'A' : 'OD'}</strong><span>{statusLabels[status]}</span></button>)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
