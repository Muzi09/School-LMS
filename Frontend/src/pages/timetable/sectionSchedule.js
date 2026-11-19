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
