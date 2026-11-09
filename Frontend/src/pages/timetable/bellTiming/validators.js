/**
 * Bell Timing Validation Rules & Invariant Checks
 * Enforced uniformly on client and server.
 */

import { parseTime, calculateDuration } from "./timeUtils"

export const MIN_PERIOD_DURATION_MINUTES = 15
export const MAX_PERIOD_DURATION_MINUTES = 180
export const MAX_PERIODS_PER_SCHEDULE = 20

export const ALL_WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]

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

  if (start.totalMinutes >= end.totalMinutes) {
    errors.push("End time must be after start time (cannot cross midnight).")
  }

  const duration = end.totalMinutes - start.totalMinutes
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

  // Sort periods by start time for overlap and gap detection
  for (let i = 0; i < periods.length; i++) {
    const current = periods[i]
    const pErrors = validatePeriodTimes(current)
    if (pErrors.length > 0) {
      errors.push(`${current.label || `Period ${i + 1}`}: ${pErrors.join(", ")}`)
    }

    if (i < periods.length - 1) {
      const next = periods[i + 1]
      const curEnd = parseTime(current.end_time)
      const nextStart = parseTime(next.start_time)

      if (curEnd && nextStart) {
        if (curEnd.totalMinutes > nextStart.totalMinutes) {
          errors.push(
            `Period "${current.label || i + 1}" (${current.start_time}-${current.end_time}) overlaps with "${
              next.label || i + 2
            }" (${next.start_time}-${next.end_time}).`
          )
        } else if (nextStart.totalMinutes > curEnd.totalMinutes) {
          const gapMinutes = nextStart.totalMinutes - curEnd.totalMinutes
          gaps.push({
            beforeIndex: i,
            afterIndex: i + 1,
            gapStart: current.end_time,
            gapEnd: next.start_time,
            gapMinutes,
          })
          warnings.push(
            `Gap of ${gapMinutes}m between "${current.label || i + 1}" (${current.end_time}) and "${
              next.label || i + 2
            }" (${next.start_time}).`
          )
        }
      }
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

