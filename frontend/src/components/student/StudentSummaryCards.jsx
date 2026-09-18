export default function StudentSummaryCards({ summary }) {
  if (!summary) return null

  return (
    <div className="summary-grid student-summary-grid">
      <div className="percentage-card"><span>Attendance</span><strong>{summary.percentage.toFixed(2)}%</strong></div>
      <div><span>Total Classes</span><strong>{summary.total}</strong></div>
      <div><span>Present</span><strong>{summary.present}</strong></div>
      <div><span>Absent</span><strong>{summary.absent}</strong></div>
      <div><span>OD</span><strong>{summary.od}</strong></div>
    </div>
  )
}
