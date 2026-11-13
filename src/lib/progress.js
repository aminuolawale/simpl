export function calcProgress(sessions) {
  const total = sessions.length
  const completed = sessions.filter(s => s.completed).length
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100)
  return { completed, total, percentage }
}
