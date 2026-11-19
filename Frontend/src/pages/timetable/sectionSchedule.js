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

export function teacherWeek(allocations, entries, setups) {
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
    else byDay.get(entry.day_of_week).push({ ...entry, period })
  }
  const days = []
  const conflicts = new Set()
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
    days.push({ day, lessons, periods: bells.length === 1 ? bells[0] : null })
  }
  return { days, review, conflicts, minutes, count: days.reduce((n, d) => n + d.lessons.length, 0) }
}
