export default function AttendanceSummary({ students, statuses }) {
  const counts = students.reduce((summary, student) => {
    const status = statuses[student._id]
    if (!status) return summary
    summary[status] += 1
    return summary
  }, { PRESENT: 0, ABSENT: 0, OD: 0 })

  return (
    <div className="summary-grid" aria-label="Attendance summary">
      <div><span>Total Students</span><strong>{students.length}</strong></div>
      <div><span>Present</span><strong>{counts.PRESENT}</strong></div>
      <div><span>Absent</span><strong>{counts.ABSENT}</strong></div>
      <div><span>OD</span><strong>{counts.OD}</strong></div>
    </div>
  )
}
