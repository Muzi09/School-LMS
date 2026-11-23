export const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
export const clock = min => String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0")
export const duration = min => min >= 60 ? Math.floor(min / 60) + "h " + min % 60 + "m" : min + "m"
export const interval = p => p.start_time.slice(0, 5) + "–" + p.end_time.slice(0, 5)

export function workingIntervals(shifts = []) {
  const merged = []
  const ranges = shifts.filter(s => s.start_time && s.end_time).map(s => [minutes(s.start_time), minutes(s.end_time)])
  for (const [start, end] of ranges.sort((a, b) => a[0] - b[0])) {
    if (start >= end) continue
    const last = merged.at(-1)
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }
  return merged
}

export function freeStretches(lessons, shifts) {
  const free = []
  for (const [start, end] of shifts) {
    let cursor = start
    for (const { period } of lessons) {
      const from = Math.max(start, minutes(period.start_time))
      const to = Math.min(end, minutes(period.end_time))
      if (from >= to) continue
      if (from > cursor) free.push([cursor, from])
      cursor = Math.max(cursor, to)
    }
    if (cursor < end) free.push([cursor, end])
  }
  return free
}
