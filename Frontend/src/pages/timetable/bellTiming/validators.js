/**
 * Bell Timing Validation Rules & Invariant Checks
 * Enforced uniformly on client and server.
 */

import { parseTime, calculateDuration, toMinutes, areTimesEqual } from "./timeUtils"

export const MIN_PERIOD_DURATION_MINUTES = 15
export const MAX_PERIOD_DURATION_MINUTES = 180
export const MAX_PERIODS_PER_SCHEDULE = 20

export const ALL_WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
export const DAY_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]

/**
 * Sorts an array of day strings in sequential weekday order:
 * MONDAY -> TUESDAY -> WEDNESDAY -> THURSDAY -> FRIDAY -> SATURDAY -> SUNDAY
 */
export function sortDays(days = []) {
  if (!Array.isArray(days)) return []
  return [...days].sort((a, b) => {
    const idxA = DAY_ORDER.indexOf(String(a).toUpperCase())
    const idxB = DAY_ORDER.indexOf(String(b).toUpperCase())
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB)
  })
}

/**
 * Returns the index of the earliest day in the schedule according to DAY_ORDER.
 */
export function getScheduleMinDayIndex(schedule) {
  if (!schedule || !schedule.days || !Array.isArray(schedule.days) || schedule.days.length === 0) {
    return 999
  }
  const indices = schedule.days
    .map((d) => DAY_ORDER.indexOf(String(d).toUpperCase()))
    .filter((idx) => idx !== -1)
  return indices.length > 0 ? Math.min(...indices) : 999
}

/**
 * Sorts schedules by the earliest day they contain, following DAY_ORDER.
 */
export function sortSchedules(schedules = []) {
  if (!Array.isArray(schedules)) return []
  return [...schedules].sort((a, b) => {
    const minA = getScheduleMinDayIndex(a)
    const minB = getScheduleMinDayIndex(b)
    if (minA !== minB) return minA - minB
    // If min day is the same, sort by number of days descending
    return (b.days?.length || 0) - (a.days?.length || 0)
  })
}

/**
 * Compares two schedules to check if all period start/end times and break types are identical.
 */
export function areSchedulesTimingEqual(schedA, schedB) {
  if (!schedA || !schedB) return false
  const pA = schedA.periods || []
  const pB = schedB.periods || []
  if (pA.length !== pB.length) return false
  if (pA.length === 0) return true

  const sortedA = [...pA].sort(
    (x, y) => (parseInt(x.period_number, 10) || 0) - (parseInt(y.period_number, 10) || 0)
  )
  const sortedB = [...pB].sort(
    (x, y) => (parseInt(x.period_number, 10) || 0) - (parseInt(y.period_number, 10) || 0)
  )

  for (let i = 0; i < sortedA.length; i++) {
    const itemA = sortedA[i]
    const itemB = sortedB[i]
    if (!itemA || !itemB) return false

    // Compare start time in minutes (pure numbers)
    const startA = toMinutes(itemA.start_time)
    const startB = toMinutes(itemB.start_time)
    if (startA !== startB) return false

    // Compare end time in minutes (pure numbers)
    const endA = toMinutes(itemA.end_time)
    const endB = toMinutes(itemB.end_time)
    if (endA !== endB) return false

    // Compare period type (class vs break) case-insensitively
    const typeA = String(itemA.type || (itemA.is_break ? PERIOD_TYPES.RECESS : PERIOD_TYPES.CLASS)).toUpperCase()
    const typeB = String(itemB.type || (itemB.is_break ? PERIOD_TYPES.RECESS : PERIOD_TYPES.CLASS)).toUpperCase()
    if (typeA !== typeB) return false
  }

  return true
}

/**
 * Scans all setups to find any schedules that have identical bell timings.
 * Returns an array of detected duplicate pairs.
 */
export function findIdenticalSchedulesInSetups(setups = []) {
  const matches = []

  for (const setup of setups) {
    const schedules = setup.schedules || []
    if (schedules.length <= 1) continue

    const visitedSourceIds = new Set()

    for (let i = 0; i < schedules.length; i++) {
      if (visitedSourceIds.has(schedules[i].id)) continue

      for (let j = i + 1; j < schedules.length; j++) {
        if (visitedSourceIds.has(schedules[j].id)) continue

        if (areSchedulesTimingEqual(schedules[i], schedules[j])) {
          // Identify source (separated day) and target (remaining days)
          const [targetSched, sourceSched] =
            schedules[i].days.length >= schedules[j].days.length
              ? [schedules[i], schedules[j]]
              : [schedules[j], schedules[i]]

          matches.push({
            setupId: setup.id,
            setupName: setup.name,
            sourceScheduleId: sourceSched.id,
            sourceDays: sortDays(sourceSched.days),
            targetScheduleId: targetSched.id,
            targetDays: sortDays(targetSched.days),
          })
          visitedSourceIds.add(sourceSched.id)
        }
      }
    }
  }

  return matches
}

export const PERIOD_TYPES = {
  CLASS: "CLASS",
  RECESS: "RECESS",
  ASSEMBLY: "ASSEMBLY",
  ACTIVITY: "ACTIVITY",
  EXTRA_CURRICULAR: "ACTIVITY",
}

export const PERIOD_TYPE_LABELS = {
  [PERIOD_TYPES.CLASS]: "Class",
  [PERIOD_TYPES.RECESS]: "Recess",
  [PERIOD_TYPES.ASSEMBLY]: "Assembly",
  [PERIOD_TYPES.ACTIVITY]: "Extra-curricular",
}

export function formatPeriodShortLabel(period, allPeriods = null) {
  if (!period) return ""
  const pType = period.type || (period.is_break ? PERIOD_TYPES.RECESS : PERIOD_TYPES.CLASS)

  // If already formatted like P1, R1, A1, E2, return as is
  if (typeof period.label === "string" && /^[PRAE]\d+$/i.test(period.label.trim())) {
    return period.label.trim().toUpperCase()
  }

  // Preserve explicit custom labels
  if (period.hasCustomLabel && period.label) {
    return period.label
  }

  if (pType === PERIOD_TYPES.RECESS || period.is_break || /^recess/i.test(period.label)) {
    if (allPeriods && Array.isArray(allPeriods)) {
      const filtered = allPeriods.filter(
        (p) => p.type === PERIOD_TYPES.RECESS || p.is_break || /^recess/i.test(p.label)
      )
      const idx = filtered.findIndex((p) => (period.id && p.id === period.id) || p === period)
      return `R${idx >= 0 ? idx + 1 : 1}`
    }
    const numMatch = period.label?.match(/\d+/)
    return numMatch ? `R${numMatch[0]}` : "R1"
  }

  if (pType === PERIOD_TYPES.ASSEMBLY || /^assembly/i.test(period.label)) {
    if (allPeriods && Array.isArray(allPeriods)) {
      const filtered = allPeriods.filter((p) => p.type === PERIOD_TYPES.ASSEMBLY || /^assembly/i.test(p.label))
      const idx = filtered.findIndex((p) => (period.id && p.id === period.id) || p === period)
      return `A${idx >= 0 ? idx + 1 : 1}`
    }
    const numMatch = period.label?.match(/\d+/)
    return numMatch ? `A${numMatch[0]}` : "A1"
  }

  if (
    pType === PERIOD_TYPES.ACTIVITY ||
    pType === PERIOD_TYPES.EXTRA_CURRICULAR ||
    /^(activity|extra-curricular|extracurricular)/i.test(period.label)
  ) {
    if (allPeriods && Array.isArray(allPeriods)) {
      const filtered = allPeriods.filter(
        (p) =>
          p.type === PERIOD_TYPES.ACTIVITY ||
          p.type === PERIOD_TYPES.EXTRA_CURRICULAR ||
          /^(activity|extra-curricular|extracurricular)/i.test(p.label)
      )
      const idx = filtered.findIndex((p) => (period.id && p.id === period.id) || p === period)
      return `E${idx >= 0 ? idx + 1 : 1}`
    }
    const numMatch = period.label?.match(/\d+/)
    return numMatch ? `E${numMatch[0]}` : "E1"
  }

  if (pType === PERIOD_TYPES.CLASS) {
    if (allPeriods && Array.isArray(allPeriods)) {
      const filtered = allPeriods.filter(
        (p) => (p.type || (p.is_break ? PERIOD_TYPES.RECESS : PERIOD_TYPES.CLASS)) === PERIOD_TYPES.CLASS
      )
      const idx = filtered.findIndex((p) => (period.id && p.id === period.id) || p === period)
      if (idx >= 0) return `P${idx + 1}`
    }
    if (period.period_number != null) {
      return `P${period.period_number}`
    }
    if (typeof period.label === "string") {
      const match = period.label.match(/\d+/)
      if (match) return `P${match[0]}`
      return period.label
    }
    return "P1"
  }

  if (period.period_number != null) {
    return `P${period.period_number}`
  }

  if (typeof period.label === "string") {
    const match = period.label.match(/\d+/)
    if (match) return `P${match[0]}`
    return period.label
  }

  return "P1"
}

/**
 * Formats a period label for display in the Timetable (grid body cells, tooltips, dialogs):
 * Shows full descriptive text for non-class periods:
 * - Recess (or Recess 1, Recess 2 if multiple) instead of R1
 * - Extra-curricular (or Extra-curricular 1, Extra-curricular 2 if multiple) instead of E1
 * - Assembly (or Assembly 1, Assembly 2 if multiple) instead of A1
 * - Teaching periods retain standard P1, P2 or custom labels
 */
/**
 * Checks whether a period is a non-teaching slot (Recess, Break, Assembly, Extra-curricular).
 * Non-teaching slots are never assigned subject teachers and are shown like RECESS in the timetable.
 */
export function isNonTeachingPeriod(period) {
  if (!period) return false
  if (period.is_break) return true
  const rawType = String(period.type || period.period_type || "").toUpperCase()
  if (
    rawType === "RECESS" ||
    rawType === "BREAK" ||
    rawType === "ASSEMBLY" ||
    rawType === "ACTIVITY" ||
    rawType === "EXTRA_CURRICULAR" ||
    rawType === "EXTRA-CURRICULAR" ||
    rawType.includes("RECESS") ||
    rawType.includes("BREAK") ||
    rawType.includes("ASSEMBL") ||
    rawType.includes("ACTIV") ||
    rawType.includes("EXTRA") ||
    rawType.includes("CURRICUL")
  ) {
    return true
  }
  const rawLabel = String(period.label || "").trim()
  if (
    /^(recess|break|assembly|activity|extra-curricular|extracurricular)/i.test(rawLabel) ||
    /^[RAE]\d*$/i.test(rawLabel)
  ) {
    return true
  }
  return false
}

export function getTimetablePeriodLabel(period, allPeriods = null) {
  if (!period) return ""
  const pType = (period.type || period.period_type || (period.is_break ? PERIOD_TYPES.RECESS : PERIOD_TYPES.CLASS)).toUpperCase()
  const rawLabel = typeof period.label === "string" ? period.label.trim() : ""

  const isRecess =
    pType === "RECESS" ||
    pType === "BREAK" ||
    pType.includes("RECESS") ||
    pType.includes("BREAK") ||
    Boolean(period.is_break) ||
    /^recess/i.test(rawLabel) ||
    /^break/i.test(rawLabel) ||
    /^r\d*$/i.test(rawLabel)

  const isActivity =
    pType === "ACTIVITY" ||
    pType === "EXTRA_CURRICULAR" ||
    pType === "EXTRA-CURRICULAR" ||
    pType.includes("ACTIV") ||
    pType.includes("EXTRA") ||
    pType.includes("CURRICUL") ||
    /^(activity|extra-curricular|extracurricular)/i.test(rawLabel) ||
    /^e\d*$/i.test(rawLabel)

  const isAssembly =
    pType === "ASSEMBLY" ||
    pType.includes("ASSEMBL") ||
    /^assembly/i.test(rawLabel) ||
    /^a\d*$/i.test(rawLabel)

  if (isRecess) {
    if (allPeriods && Array.isArray(allPeriods)) {
      const filtered = allPeriods.filter(
        (p) =>
          (p.type || p.period_type || (p.is_break ? "RECESS" : "CLASS")).toUpperCase() === "RECESS" ||
          p.is_break ||
          /^recess/i.test(p.label) ||
          /^r\d*$/i.test(p.label)
      )
      if (filtered.length > 1) {
        const idx = filtered.findIndex((p) => (period.id && p.id === period.id) || p === period)
        return `Recess ${idx >= 0 ? idx + 1 : 1}`
      }
    }
    const numMatch = rawLabel.match(/\d+/)
    return numMatch && numMatch[0] !== "1" ? `Recess ${numMatch[0]}` : "Recess"
  }

  if (isActivity) {
    if (allPeriods && Array.isArray(allPeriods)) {
      const filtered = allPeriods.filter(
        (p) => {
          const t = (p.type || p.period_type || "").toUpperCase()
          return t === "ACTIVITY" ||
            t === "EXTRA_CURRICULAR" ||
            t === "EXTRA-CURRICULAR" ||
            t.includes("ACTIV") ||
            t.includes("EXTRA") ||
            t.includes("CURRICUL") ||
            /^(activity|extra-curricular|extracurricular)/i.test(p.label) ||
            /^e\d*$/i.test(p.label)
        }
      )
      if (filtered.length > 1) {
        const idx = filtered.findIndex((p) => (period.id && p.id === period.id) || p === period)
        return `Extra-curricular ${idx >= 0 ? idx + 1 : 1}`
      }
    }
    const numMatch = rawLabel.match(/\d+/)
    return numMatch && numMatch[0] !== "1" ? `Extra-curricular ${numMatch[0]}` : "Extra-curricular"
  }

  if (isAssembly) {
    if (allPeriods && Array.isArray(allPeriods)) {
      const filtered = allPeriods.filter(
        (p) =>
          (p.type || p.period_type || "").toUpperCase() === "ASSEMBLY" ||
          (p.type || p.period_type || "").toUpperCase().includes("ASSEMBL") ||
          /^assembly/i.test(p.label) ||
          /^a\d*$/i.test(p.label)
      )
      if (filtered.length > 1) {
        const idx = filtered.findIndex((p) => (period.id && p.id === period.id) || p === period)
        return `Assembly ${idx >= 0 ? idx + 1 : 1}`
      }
    }
    const numMatch = rawLabel.match(/\d+/)
    return numMatch && numMatch[0] !== "1" ? `Assembly ${numMatch[0]}` : "Assembly"
  }

  if (period.hasCustomLabel && rawLabel && !/^[PRAE]\d+$/i.test(rawLabel)) {
    return rawLabel
  }

  return formatPeriodShortLabel(period, allPeriods)
}

/**
 * Validates a single period's time constraints.
 */
export function validatePeriodTimes(period) {
  const errors = []
  const start = parseTime(period.start_time)
  const end = parseTime(period.end_time)

  if (!start) {
    errors.push("Invalid start time format.")
    return errors
  }
  if (!end) {
    errors.push("Invalid end time format.")
    return errors
  }

  const startMin = start.totalMinutes
  const endMin = end.totalMinutes

  if (startMin >= endMin) {
    errors.push("End time must be after start time (cannot cross midnight).")
  }

  const duration = endMin - startMin
  if (duration > 0 && duration < MIN_PERIOD_DURATION_MINUTES) {
    errors.push(`Period duration must be at least ${MIN_PERIOD_DURATION_MINUTES} minutes.`)
  }
  if (duration > MAX_PERIOD_DURATION_MINUTES) {
    errors.push(`Period duration cannot exceed ${MAX_PERIOD_DURATION_MINUTES} minutes.`)
  }

  return errors
}

/**
 * Validates a schedule's period sequence:
 * - Checks overlaps (touching edges like 08:30-09:15 and 09:15-10:00 is allowed; any actual overlap > 0 is rejected)
 * - Detects gaps between consecutive periods
 * - Validates max period count
 * - Validates at least 1 Class period
 * - Validates label uniqueness
 */
export function validateSchedule(schedule) {
  const errors = []
  const warnings = []
  const gaps = []

  const periods = schedule.periods || []
  if (periods.length === 0) {
    errors.push("Schedule must have at least one period.")
    return { isValid: false, errors, warnings, gaps }
  }

  if (periods.length > MAX_PERIODS_PER_SCHEDULE) {
    errors.push(`A schedule cannot exceed ${MAX_PERIODS_PER_SCHEDULE} periods.`)
  }

  const hasClassPeriod = periods.some(
    (p) => (p.type || (p.is_break ? PERIOD_TYPES.RECESS : PERIOD_TYPES.CLASS)) === PERIOD_TYPES.CLASS
  )
  if (!hasClassPeriod) {
    errors.push("A schedule needs at least 1 Class period.")
  }

  // Label uniqueness check
  const seenLabels = new Set()
  periods.forEach((p, idx) => {
    const lbl = (p.label || "").trim().toLowerCase()
    if (lbl) {
      if (seenLabels.has(lbl)) {
        errors.push(`Duplicate period label "${p.label}" found in schedule.`)
      }
      seenLabels.add(lbl)
    }
  })

  // 1. Validate individual period time formats & durations
  const validPeriods = []
  for (let i = 0; i < periods.length; i++) {
    const current = periods[i]
    const pErrors = validatePeriodTimes(current)
    if (pErrors.length > 0) {
      errors.push(`${current.label || `Period ${i + 1}`}: ${pErrors.join(", ")}`)
    } else {
      validPeriods.push({
        index: i,
        period: current,
        startM: toMinutes(current.start_time),
        endM: toMinutes(current.end_time),
        label: current.label || String(i + 1),
      })
    }
  }

  // 2. Sweep-Line Algorithm for Interval Overlap Detection (O(N log N + k))
  // Creates boundary events: END events (type: 0) and START events (type: 1).
  // When timestamps tie, END is processed before START so touching boundaries (e.g. 09:15 and 09:15) are valid.
  const sweepEvents = []
  validPeriods.forEach((vp) => {
    sweepEvents.push({ minute: vp.endM, type: 0, item: vp })
    sweepEvents.push({ minute: vp.startM, type: 1, item: vp })
  })

  // Sort events: primary by minute, secondary by type (0 = END before 1 = START)
  sweepEvents.sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute
    return a.type - b.type
  })

  const activeIntervals = new Set()
  const recordedOverlaps = new Set()

  for (const evt of sweepEvents) {
    if (evt.type === 0) {
      // Period interval ended: remove from active sweep
      activeIntervals.delete(evt.item)
    } else {
      // Period interval started: check collisions with all currently active intervals
      for (const active of activeIntervals) {
        // Create an order-independent collision key to prevent duplicate error messages
        const overlapKey =
          active.index < evt.item.index
            ? `${active.index}_${evt.item.index}`
            : `${evt.item.index}_${active.index}`

        if (!recordedOverlaps.has(overlapKey)) {
          recordedOverlaps.add(overlapKey)
          errors.push(
            `Period "${active.label}" (${active.period.start_time}-${active.period.end_time}) overlaps with "${
              evt.item.label
            }" (${evt.item.period.start_time}-${evt.item.period.end_time}).`
          )
        }
      }
      activeIntervals.add(evt.item)
    }
  }

  // 3. Gap Detection between Chronologically Sorted Periods
  const sortedByTime = [...validPeriods].sort((a, b) => a.startM - b.startM || a.endM - b.endM)
  for (let j = 0; j < sortedByTime.length - 1; j++) {
    const curr = sortedByTime[j]
    const next = sortedByTime[j + 1]

    if (next.startM > curr.endM) {
      const gapMinutes = next.startM - curr.endM
      gaps.push({
        beforeIndex: curr.index,
        afterIndex: next.index,
        gapStart: curr.period.end_time,
        gapEnd: next.period.start_time,
        gapMinutes,
      })
      warnings.push(
        `Gap of ${gapMinutes}m between "${curr.label}" (${curr.period.end_time}) and "${
          next.label
        }" (${next.period.start_time}).`
      )
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    gaps,
  }
}

/**
 * Validates setup day invariants:
 * - Every working day configured must belong to exactly one schedule in the setup.
 * - No day orphaned or duplicated.
 */
export function validateSetupDayInvariants(setup, workingDays = ALL_WEEKDAYS) {
  const errors = []
  const schedules = setup.schedules || []

  if (schedules.length === 0) {
    errors.push(`Setup "${setup.name}" has no schedules defined.`)
    return { isValid: false, errors }
  }

  const normalizedWorkingDays = workingDays.map((d) => d.toUpperCase())
  const dayUsageCount = {}
  normalizedWorkingDays.forEach((d) => {
    dayUsageCount[d] = 0
  })

  schedules.forEach((sch, sIdx) => {
    const schDays = sch.days || []
    if (schDays.length === 0) {
      errors.push(`Schedule ${sIdx + 1} in "${setup.name}" has no days assigned.`)
    }
    schDays.forEach((rawDay) => {
      const day = rawDay.toUpperCase()
      if (dayUsageCount[day] !== undefined) {
        dayUsageCount[day] += 1
      }
    })
  })

  normalizedWorkingDays.forEach((day) => {
    const count = dayUsageCount[day]
    if (count === 0) {
      errors.push(`Day "${day}" is not assigned to any schedule in "${setup.name}".`)
    } else if (count > 1) {
      errors.push(`Day "${day}" is duplicated across multiple schedules in "${setup.name}".`)
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validates section assignments across all setups:
 * - Each section must belong to exactly one setup (no orphan sections).
 */
export function validateAssignments(allSections, sectionAssignments, setups) {
  const errors = []
  const setupIds = new Set(setups.map((s) => s.id))

  const orphanSections = []
  allSections.forEach((sec) => {
    const assignedSetupId = sectionAssignments[sec.id]
    if (!assignedSetupId || !setupIds.has(assignedSetupId)) {
      orphanSections.push(sec)
    }
  })

  if (orphanSections.length > 0) {
    errors.push(
      `${orphanSections.length} section(s) do not have a valid bell setup assigned. Every section must have a setup.`
    )
  }

  return {
    isValid: errors.length === 0,
    orphanSections,
    errors,
  }
}

