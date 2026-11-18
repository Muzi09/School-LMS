/** @typedef {string | number | null | undefined} TimeInput */

/**
 * Bell Timing - Time Utility Functions
 * Pure, framework-agnostic time calculations and lenient parsing.
 */

/**
 * Normalizes input string to "HH:mm" 24-hour format.
 * Lenient parsing supports:
 * - "9" -> "09:00"
 * - "930" -> "09:30"
 * - "9:30" -> "09:30"
 * - "9:30 am" / "9:30 AM" -> "09:30"
 * - "9:30 pm" / "9:30 PM" -> "21:30"
 * - "12 am" / "12 AM" -> "00:00"
 * - "12 pm" / "12 PM" -> "12:00"
 * - "21:30" -> "21:30"
 * Returns null for invalid strings (e.g. "25:00", "abc", "").
 * @param {string | null | undefined} input
 */
export function parseTime(input) {
  if (!input || typeof input !== "string") return null
  const raw = input.trim().toLowerCase()
  if (!raw) return null

  // Check for AM / PM
  const isPM = raw.includes("pm") || raw.includes("p.m.")
  const isAM = raw.includes("am") || raw.includes("a.m.")
  const clean = raw.replace(/[a-z. ]/g, "")
  if (!clean) return null

  let hours
  let minutes

  if (clean.includes(":")) {
    const parts = clean.split(":")
    if (parts.length < 2 || parts.length > 3) return null
    hours = parseInt(parts[0], 10)
    minutes = parseInt(parts[1], 10)
    if (parts.length === 3) {
      const seconds = parseInt(parts[2], 10)
      if (isNaN(seconds) || seconds < 0 || seconds >= 60) return null
    }
  } else {
    // Digits only
    if (!/^\d+$/.test(clean)) return null
    if (clean.length === 1 || clean.length === 2) {
      hours = parseInt(clean, 10)
      minutes = 0
    } else if (clean.length === 3) {
      hours = parseInt(clean.slice(0, 1), 10)
      minutes = parseInt(clean.slice(1), 10)
    } else if (clean.length === 4) {
      hours = parseInt(clean.slice(0, 2), 10)
      minutes = parseInt(clean.slice(2), 10)
    } else {
      return null
    }
  }

  if (isNaN(hours) || isNaN(minutes)) return null
  if (minutes < 0 || minutes >= 60) return null

  if (isPM) {
    if (hours < 1 || hours > 12) return null
    if (hours !== 12) hours += 12
  } else if (isAM) {
    if (hours < 1 || hours > 12) return null
    if (hours === 12) hours = 0
  } else {
    // 24h format
    if (hours < 0 || hours >= 24) return null
  }

  const normalized = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
  const totalMinutes = hours * 60 + minutes

  return {
    hours,
    minutes,
    totalMinutes,
    normalized,
  }
}

/**
 * Converts total minutes from midnight (0..1439) into "HH:mm" 24h string.
 * @param {number} totalMinutes
 */
export function formatMinutes(totalMinutes) {
  const norm = ((totalMinutes % 1440) + 1440) % 1440
  const h = Math.floor(norm / 60)
  const m = norm % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/**
 * Returns total minutes from midnight for a "HH:mm" string or numeric minutes.
 * Ultra-fast path for standard "HH:mm" strings avoids regex and object allocation.
 * @param {TimeInput} timeInput
 */
export function toMinutes(timeInput) {
  if (typeof timeInput === "number") {
    return isNaN(timeInput) ? 0 : Math.round(timeInput)
  }
  if (!timeInput || typeof timeInput !== "string") return 0

  // Ultra-fast path for standard "HH:mm" or "H:mm"
  const colIdx = timeInput.indexOf(":")
  if (colIdx >= 1 && colIdx <= 2) {
    const h = parseInt(timeInput.slice(0, colIdx), 10)
    const m = parseInt(timeInput.slice(colIdx + 1, colIdx + 3), 10)
    if (!isNaN(h) && !isNaN(m) && h >= 0 && h < 24 && m >= 0 && m < 60 && timeInput.length <= 5) {
      return h * 60 + m
    }
  }

  const parsed = parseTime(timeInput)
  return parsed ? parsed.totalMinutes : 0
}

/**
 * Fast numeric comparison: checks if two times are identical in minutes.
 * @param {TimeInput} timeA
 * @param {TimeInput} timeB
 */
export function areTimesEqual(timeA, timeB) {
  return toMinutes(timeA) === toMinutes(timeB)
}

/**
 * Fast numeric difference: returns (timeB - timeA) in minutes.
 * @param {TimeInput} timeA
 * @param {TimeInput} timeB
 */
export function timeDiffMinutes(timeA, timeB) {
  return toMinutes(timeB) - toMinutes(timeA)
}

/**
 * Checks if interval [startA, endA) overlaps with interval [startB, endB).
 * Intervals touching flush (endA === startB) do NOT overlap.
 * @param {TimeInput} startA
 * @param {TimeInput} endA
 * @param {TimeInput} startB
 * @param {TimeInput} endB
 */
export function doIntervalsOverlap(startA, endA, startB, endB) {
  const sA = toMinutes(startA)
  const eA = toMinutes(endA)
  const sB = toMinutes(startB)
  const eB = toMinutes(endB)
  return Math.max(sA, sB) < Math.min(eA, eB)
}

/**
 * Formats "HH:mm" to 12-hour display string (e.g. "8:30 AM", "12:00 PM").
 * @param {string | null | undefined} timeStr
 */
export function format12h(timeStr) {
  const parsed = parseTime(timeStr)
  if (!parsed) return timeStr || ""
  const { hours, minutes } = parsed
  const ampm = hours >= 12 ? "PM" : "AM"
  const h = hours % 12 || 12
  const m = String(minutes).padStart(2, "0")
  return `${h}:${m} ${ampm}`
}

/**
 * Formats "HH:mm" or minutes to 24-hour display string.
 * @param {TimeInput} timeInput
 */
export function format24h(timeInput) {
  if (typeof timeInput === "number") {
    return formatMinutes(timeInput)
  }
  const parsed = parseTime(timeInput)
  return parsed ? parsed.normalized : timeInput || ""
}

/**
 * Calculates duration in minutes between start and end times.
 * Operates purely on numeric minutes. Returns negative if end < start.
 * @param {TimeInput} startTime
 * @param {TimeInput} endTime
 */
export function calculateDuration(startTime, endTime) {
  return toMinutes(endTime) - toMinutes(startTime)
}

/**
 * Adds minutes to a time input, returning formatted "HH:mm".
 * @param {TimeInput} timeStr
 * @param {number} minutesToAdd
 */
export function addMinutesToTime(timeStr, minutesToAdd) {
  const nextMin = toMinutes(timeStr) + minutesToAdd
  return formatMinutes(nextMin)
}

/**
 * Formats duration in minutes to human readable string (e.g. "45m", "1h 15m").
 * @param {number} minutes
 */
export function formatDurationHuman(minutes) {
  if (!minutes || minutes <= 0) return "0m"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}
