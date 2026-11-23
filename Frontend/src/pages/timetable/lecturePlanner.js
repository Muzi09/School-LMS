import { scheduleGroups, periodsOn, setupForSection, isTeachingSlot } from "./sectionSchedule"
import { interval } from "./lessonTime"
import { formatClassSection } from "./timetableUtils"

export function plannerIndex(data) {
  const sections = new Map(), sectionClasses = new Map(), options = [], subjects = new Map(), bells = new Map()
  const rooms = new Map()
  const bySetup = new Map(data.setups.map(s => [s.id, scheduleGroups(s)]))
  for (const wing of data.wings) for (const cls of wing.classes) for (const sec of cls.sections) {
    sections.set(sec.id, formatClassSection(sec, cls.name))
    sectionClasses.set(sec.id, cls.id)
    bells.set(sec.id, bySetup.get(setupForSection(sec, data.setups)?.id) || [])
    for (const stat of sec.subject_stats || []) {
      const subject_id = stat.subject_id
      subjects.set(subject_id, stat.name)
      rooms.set(sec.id + "/" + subject_id, stat)
      if (stat.allocated === false) continue
      options.push({ id: sec.id + "/" + subject_id, class_id: cls.id, subject_id, teacher_id: stat.teacher_id || null,
        section_ids: [sec.id], parallel: Boolean(stat.parallel) })
    }
  }
  const bookings = new Map(), byPlacement = new Map()
  for (const e of data.entries) {
    if (!e.period) continue
    const keys = [e.section_id, e.teacher?.id || e.teacher_user_id].filter(Boolean)
    for (const id of keys) {
      const key = e.day_of_week + id
      if (!bookings.has(key)) bookings.set(key, [])
      bookings.get(key).push(e)
    }
    if (e.placement_id) {
      if (!byPlacement.has(e.placement_id)) byPlacement.set(e.placement_id, [])
      byPlacement.get(e.placement_id).push(e)
    }
  }
  const teachers = new Map(data.eligible_teachers.map(t => [t.id, t]))
  const periods = (sid, day) => periodsOn(bells.get(sid) || [], day).filter(isTeachingSlot)
  return { sections, sectionClasses, options, subjects, teachers, bookings, periods, byPlacement, rooms }
}

export function timesFor(index, options, day) {
  if (!options.length) return []
  return index.periods(options[0].section_ids[0], day).map(interval)
    .filter(time => options.every(row => row.section_ids.every(id => index.periods(id, day).some(p => interval(p) === time))))
}

export function unavailable(index, rows, day, time, ignore) {
  const [start, end] = (time || "").split("–")
  for (const row of rows) {
    const teacher = index.teachers.get(row.teacher_id)
    const shifts = teacher?.working_shifts || []
    if (shifts.length && !shifts.some(s => s.start_time.slice(0,5) <= start && end <= s.end_time.slice(0,5)))
      return teacher.name + " is outside working hours."
    for (const id of row.section_ids) {
      if (!index.periods(id, day).some(p => interval(p) === time)) return index.sections.get(id) + " has different bells."
    }
    for (const id of [...row.section_ids, row.teacher_id].filter(Boolean)) {
      const busy = index.bookings.get(day + id)?.find(e => (!ignore || e.placement_id !== ignore) &&
        e.period.start_time.slice(0,5) < end && start < e.period.end_time.slice(0,5))
      if (busy) return (index.sections.get(id) || teacher?.name) + " has " + busy.subject.name + " at " + interval(busy.period) + "."
    }
  }
  return ""
}

export function placedOptions(entries) {
  const rows = new Map()
  for (const e of entries) {
    if (!rows.has(e.option_id)) rows.set(e.option_id, {id:e.option_id, subject_id:e.subject.id,
      teacher_id:e.teacher?.id || e.teacher_user_id || null, sectionRooms:{}, section_ids:[]})
    const row = rows.get(e.option_id)
    row.sectionRooms[e.section_id] = e.room_number
    row.section_ids.push(e.section_id)
  }
  return [...rows.values()]
}

// Find missing members from the scheduled roster, which may differ from today's template.
export function restoresForCell(index, plan, day, sectionId, teacherId) {
  const byTime = new Map()
  if (!day || (!sectionId && !teacherId)) return byTime
  for (const [id, placement] of Object.entries(plan.placements || {})) {
    if (placement.day !== day) continue
    const expectedOptions = (placement.expected || []).filter(option =>
      (!sectionId || option.section_ids.includes(sectionId)) && (!teacherId || option.teacher_id === teacherId))
    if (!expectedOptions.length) continue
    const group = plan.groups?.[placement.group_id] || plan.archived_groups?.[placement.group_id]
    const entries = index.byPlacement.get(id)
    if (!group || !entries?.length) continue
    const time = interval(entries[0].period)
    if (!entries.every(entry => interval(entry.period) === time)) continue
    const current = placedOptions(entries)
    const byOption = new Map(current.map(row => [row.id, row]))
    for (const expected of expectedOptions) {
      const local = byOption.get(expected.id)
      const option = local || expected
      if (teacherId && teacherId !== option.teacher_id) continue
      const missing = expected.section_ids.filter(s => (!sectionId || sectionId === s) && !local?.section_ids.includes(s))
      if (!missing.length) continue
      const restored = {...option, section_ids:[...(local?.section_ids || []), ...missing]}
      const rows = local ? current.map(r => r === local ? restored : r) : [...current, restored]
      const eligible = missing.every(s => {
        const stat = index.rooms.get(s + "/" + option.subject_id)
        return stat?.parallel && stat.allocated !== false && stat.teacher_id === option.teacher_id
      })
      const reason = eligible ? unavailable(index, rows, day, time, id) : "Check the Parallel setting and teacher allocation in Manage School."
      if (!byTime.has(time)) byTime.set(time, [])
      byTime.get(time).push({id, group, option, missing, rows, reason})
    }
  }
  return byTime
}

// Apply template edits to a weekday while retaining its local exceptions.
export function applyOptionChanges(before, after, current) {
  const result = []
  for (const next of after) {
    const old = before.find(r => r.id === next.id)
    const local = current.find(r => r.id === next.id)
    if (!old) { result.push(next); continue }
    if (!local) continue
    const ids = [...new Set([...local.section_ids.filter(id => !old.section_ids.includes(id) || next.section_ids.includes(id)),
      ...next.section_ids.filter(id => !old.section_ids.includes(id))])]
    if (ids.length) result.push({...local, section_ids:ids,
      teacher_id: old.teacher_id !== next.teacher_id ? next.teacher_id : local.teacher_id,
      subject_id: old.subject_id !== next.subject_id ? next.subject_id : local.subject_id})
  }
  return [...result, ...current.filter(row => !before.some(r => r.id === row.id) && !after.some(r => r.id === row.id))]
}
