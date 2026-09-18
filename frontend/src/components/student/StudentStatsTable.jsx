export default function StudentStatsTable({ type, items }) {
  if (!items.length) return <p className="empty-state">{type === 'subject' ? 'No subject attendance available.' : 'No period attendance available.'}</p>

  return (
    <div className="table-wrap">
      <table className="data-table"><thead><tr>{type === 'subject' ? <th>Subject</th> : <th>Period</th>}<th>Total</th><th>Present</th><th>Absent</th><th>OD</th><th>Percentage</th></tr></thead><tbody>{items.map((item) => <tr key={type === 'subject' ? item.subjectId : item.periodNumber}><td>{type === 'subject' ? item.subjectName : `Period ${item.periodNumber}`}</td><td>{item.total}</td><td>{item.present}</td><td>{item.absent}</td><td>{item.od}</td><td>{item.percentage.toFixed(2)}%</td></tr>)}</tbody></table>
    </div>
  )
}
