const attendanceStatuses = ['PRESENT', 'ABSENT', 'OD']

export function percentage(present, od, total) {
  if (!Number.isFinite(total) || total <= 0) return 0
  return Number((((present + od) / total) * 100).toFixed(2))
}

export function summaryFromCounts(counts = []) {
  const summary = { total: 0, present: 0, absent: 0, od: 0 }

  for (const count of counts) {
    const status = String(count._id || '').toUpperCase().toLowerCase()
    if (!Object.prototype.hasOwnProperty.call(summary, status) || status === 'total') continue
    const value = Number(count.count) || 0
    summary[status] += value
    summary.total += value
  }

  return { ...summary, percentage: percentage(summary.present, summary.od, summary.total) }
}

export { attendanceStatuses }
