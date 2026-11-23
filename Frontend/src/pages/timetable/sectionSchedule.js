import { freeStretches, interval, minutes as timeMinutes, workingIntervals } from "./lessonTime"
import { formatClassSection } from "./timetableUtils"
import { DAY_ORDER, isNonTeachingPeriod } from "./bellTiming/validators"

function list(value) {
  if (Array.isArray(value)) return value
  if (typeof value === "string") {
    try { return list(JSON.parse(value)) } catch { return [] }
  }
  return []
}

export function setupForSection(section, setups) {
  if (!section) return null
  if (section.setup_id) return setups.find(s => String(s.id) === String(section.setup_id))
  return setups.find(s => s.assigned_section_ids?.some(id => String(id) === String(section.id))) ||
    setups.find(s => s.is_default)
}

export function scheduleGroups(setup) {
  if (!setup) return []
  const schedules = list(setup.schedules || setup.schedules_json)
  const days = list(setup.applicable_days).map(d => d.toUpperCase())
  const groups = []
  for (const day of DAY_ORDER) {
    if (days.length && !days.includes(day)) continue
    const matches = schedules.filter(s => s.days?.some(d => d.toUpperCase() === day))
    const schedule = matches.length === 1 ? matches[0] :
      !schedules.length && days.includes(day) ? { id: "regular", periods: setup.periods } : null
    if (!schedule) continue
    const last = groups.at(-1)
    if (last?.scheduleId === schedule.id) {
      last.days.push(day)
    } else {
      groups.push({
        id: setup.id + "_" + day, scheduleId: schedule.id, days: [day],
        periods: [...(schedule.periods || [])].sort((a, b) => a.start_time.localeCompare(b.start_time)),
        isAmber: day === "SATURDAY" || schedule.days?.length === 1,
      })
    }
  }
  return groups
}

export function periodsOn(groups, day) {
  return groups.find(g => g.days.includes(day))?.periods || []
}

export function lessonPeriod(entry, groups) {
  const id = entry.period_id || entry.period?.id
  return periodsOn(groups, entry.day_of_week).find(p => String(p.id) === String(id))
}

export function isTeachingSlot(p) {
  return !isNonTeachingPeriod(p)
}

// Bell schedules can share a grid even when one has extra periods before or
// after the other. Each distinct time interval must have its own column.
function sharedPeriodHeaders(bells) {
  if (!bells.length) return null
  const byInterval = new Map()
  for (const periods of bells) {
    for (const period of periods) {
      const key = interval(period)
      const match = byInterval.get(key)
      if (match) {
        if (isTeachingSlot(match.period) !== isTeachingSlot(period)) return null
        match.labels.add("P" + period.period_number)
      } else {
        byInterval.set(key, { period, labels: new Set(["P" + period.period_number]) })
      }
    }
  }
  const columns = [...byInterval.values()].sort((a, b) => a.period.start_time.localeCompare(b.period.start_time))
  for (let i = 1; i < columns.length; i++) {
    if (columns[i].period.start_time < columns[i - 1].period.end_time) return null
  }
  return columns.map(({ period, labels }) => labels.size > 1 && isTeachingSlot(period)
    ? { ...period, label: [...labels].join(" / ") }
    : period)
}

export function teacherWeek(allocations, entries, setups, shifts = []) {
  const hours = workingIntervals(shifts)
  const joined = new Map()
  const sections = new Map(allocations.map(a => [String(a.section.id), a.section]))
  const groupsBySection = new Map()
  const schedules = new Map()
  for (const [id, section] of sections) {
    const setup = setupForSection(section, setups)
    if (setup && !schedules.has(setup.id)) schedules.set(setup.id, scheduleGroups(setup))
    groupsBySection.set(id, schedules.get(setup?.id) || [])
  }
  const review = []
  const byDay = new Map(DAY_ORDER.map(day => [day, []]))
  for (const entry of entries) {
    const period = lessonPeriod(entry, groupsBySection.get(String(entry.section_id)) || [])
    if (!period || !isTeachingSlot(period)) review.push(entry)
    else {
      const key = entry.placement_id && [entry.day_of_week, entry.placement_id, interval(period)].join("/")
      const lesson = key && joined.get(key)
      if (lesson) {
        lesson.sectionLabel += " + " + formatClassSection(entry.section)
        lesson.sectionRooms.push({section: formatClassSection(entry.section), room: entry.room_number})
        lesson.subjectSections.push([entry.subject?.name, formatClassSection(entry.section)])
        const label = "P" + period.period_number
        if (!lesson.periodLabels.split(" / ").includes(label)) lesson.periodLabels += " / " + label
      } else {
        const item = { ...entry, period, sectionLabel: formatClassSection(entry.section), periodLabels: "P" + period.period_number }
        if (key) {
          item.sectionRooms = [{section: item.sectionLabel, room: entry.room_number}]
          item.subjectSections = [[entry.subject?.name, item.sectionLabel]]
          joined.set(key, item)
        }
        byDay.get(entry.day_of_week).push(item)
      }
    }
  }
  const days = []
  for (const lesson of joined.values()) {
    const subjects = [...new Set(lesson.subjectSections.map(([subject]) => subject))]
    if (subjects.length > 1) {
      lesson.subjectLabel = subjects.join(" / ")
      lesson.sectionLabel = lesson.subjectSections.map(([subject, section]) => section + " · " + subject).join(" + ")
    }
  }
  const conflicts = new Set()
  const headersBySchedule = new Map()
  let minutes = 0
  const minute = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))
  for (const [day, lessons] of byDay) {
    const bells = [...schedules.values()].map(groups => periodsOn(groups, day)).filter(periods => periods.length)
    if (!bells.length && !lessons.length) continue
    lessons.sort((a, b) => a.period.start_time.localeCompare(b.period.start_time))
    for (let i = 0; i < lessons.length; i++) {
      const current = lessons[i]
      minutes += minute(current.period.end_time) - minute(current.period.start_time)
      for (const next of lessons.slice(i + 1)) {
        if (next.period.start_time >= current.period.end_time) break
        conflicts.add(current.id)
        conflicts.add(next.id)
      }
    }
    const proposedHeaders = sharedPeriodHeaders(bells)
    let headers = null
    if (proposedHeaders) {
      const key = proposedHeaders.map(p => [p.id, interval(p), p.label].join(":")).join("/")
      headers = headersBySchedule.get(key)
      if (!headers) {
        headers = proposedHeaders
        headersBySchedule.set(key, headers)
      }
    }
    const free = freeStretches(lessons, hours)
    const teachingMinutes = lessons.reduce((n,e) => n + minute(e.period.end_time) - minute(e.period.start_time), 0)
    days.push({ day, lessons, free, teachingMinutes, periods: headers, bells: bells.flat() })
  }
  const capacity = days.length && days.every(d => d.periods) ? days.reduce((total, d) =>
    total + d.periods.filter(p => isTeachingSlot(p) && (!hours.length || hours.some(([start,end]) =>
      start <= timeMinutes(p.start_time) && timeMinutes(p.end_time) <= end))).length, 0) : null
  return { days, review, conflicts, minutes, hours, capacity, count: days.reduce((n, d) => n + d.lessons.length, 0) }
}
