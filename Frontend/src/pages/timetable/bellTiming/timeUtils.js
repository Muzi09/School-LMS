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

  let hours = 0
  let minutes = 0

  if (clean.includes(":")) {
    const parts = clean.split(":")
    if (parts.length !== 2) return null
    hours = parseInt(parts[0], 10)
    minutes = parseInt(parts[1], 10)
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
 */
export function formatMinutes(totalMinutes) {
  const norm = ((totalMinutes % 1440) + 1440) % 1440
  const h = Math.floor(norm / 60)
  const m = norm % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/**
 * Returns total minutes from midnight for a "HH:mm" string.
 */
export function toMinutes(timeStr) {
  const parsed = parseTime(timeStr)
  return parsed ? parsed.totalMinutes : 0
}

/**
 * Formats "HH:mm" to 12-hour display string (e.g. "8:30 AM", "12:00 PM").
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
 */
export function format24h(timeInput) {
  if (typeof timeInput === "number") {
    return formatMinutes(timeInput)
  }
  const parsed = parseTime(timeInput)
  return parsed ? parsed.normalized : timeInput || ""
}

/**
 * Calculates duration in minutes between start and end "HH:mm" strings.
 * Returns negative if end < start.
 */
export function calculateDuration(startTime, endTime) {
  const s = parseTime(startTime)
  const e = parseTime(endTime)
  if (!s || !e) return 0
  return e.totalMinutes - s.totalMinutes
}

/**
 * Adds minutes to a "HH:mm" string, returning "HH:mm".
 */
export function addMinutesToTime(timeStr, minutesToAdd) {
  const parsed = parseTime(timeStr)
  if (!parsed) return timeStr
  const nextMin = parsed.totalMinutes + minutesToAdd
  return formatMinutes(nextMin)
}

/**
 * Formats duration in minutes to human readable string (e.g. "45m", "1h 15m").
 */
export function formatDurationHuman(minutes) {
  if (!minutes || minutes <= 0) return "0m"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

