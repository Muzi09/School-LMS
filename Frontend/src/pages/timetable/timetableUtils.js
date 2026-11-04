/**
 * Timetable Utility Functions & Color Helpers
 */

/**
 * Detects whether the current client device is running macOS.
 */
export function getIsMac() {
  if (typeof window === "undefined") return false
  if (navigator.userAgentData?.platform) {
    return navigator.userAgentData.platform.toLowerCase().includes("mac")
  }
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent || navigator.platform || "")
}

export const DAYS = [
  { key: "MONDAY", label: "Monday", short: "Mon" },
  { key: "TUESDAY", label: "Tuesday", short: "Tue" },
  { key: "WEDNESDAY", label: "Wednesday", short: "Wed" },
  { key: "THURSDAY", label: "Thursday", short: "Thu" },
  { key: "FRIDAY", label: "Friday", short: "Fri" },
  { key: "SATURDAY", label: "Saturday", short: "Sat" },
]

export const getTodayKey = () => {
  const dayIndex = new Date().getDay() // 0 = Sun, 1 = Mon ... 6 = Sat
  if (dayIndex >= 1 && dayIndex <= 6) {
    return DAYS[dayIndex - 1].key
  }
  return "MONDAY"
}

/**
 * Converts "HH:MM" or "HH:MM:SS" string to total minutes from midnight.
 */
export function timeStringToMinutes(timeStr) {
  if (!timeStr) return 0
  const parts = String(timeStr).split(":")
  const hours = parseInt(parts[0], 10) || 0
  const minutes = parseInt(parts[1], 10) || 0
  return hours * 60 + minutes
}

/**
 * Formats total minutes from midnight into 12-hour AM/PM string, e.g. "09:30 AM".
 */
export function minutesToTimeString(minutes) {
  const normalized = Math.max(0, Math.min(1439, minutes))
  let hours = Math.floor(normalized / 60)
  const mins = normalized % 60
  const ampm = hours >= 12 ? "PM" : "AM"
  hours = hours % 12 || 12
  const formattedHours = String(hours).padStart(2, "0")
  const formattedMins = String(mins).padStart(2, "0")
  return `${formattedHours}:${formattedMins} ${ampm}`
}

/**
 * Formats "09:15" into "09:15 AM".
 */
export function formatTime12(timeStr) {
  if (!timeStr) return ""
  return minutesToTimeString(timeStringToMinutes(timeStr))
}

/**
 * Calculates readable duration between two time strings, e.g. "45m" or "1h 15m".
 */
export function calculateDuration(startTime, endTime) {
  const start = timeStringToMinutes(startTime)
  const end = timeStringToMinutes(endTime)
  const diff = Math.max(0, end - start)
  if (diff < 60) return `${diff}m`
  const hours = Math.floor(diff / 60)
  const mins = diff % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

/**
 * Calculate timeline boundaries and markers based on configured school periods.
 */
export function getTimelineBounds(periods = []) {
  if (!periods || periods.length === 0) {
    return {
      startMinutes: 480, // 08:00 AM
      endMinutes: 960, // 04:00 PM
      totalMinutes: 480,
      timeMarkers: [480, 540, 600, 660, 720, 780, 840, 900, 960],
    }
  }

  let minMins = Infinity
  let maxMins = -Infinity

  for (const p of periods) {
    const s = timeStringToMinutes(p.start_time)
    const e = timeStringToMinutes(p.end_time)
    if (s < minMins) minMins = s
    if (e > maxMins) maxMins = e
  }

  if (minMins === Infinity || maxMins === -Infinity || minMins >= maxMins) {
    minMins = 480
    maxMins = 960
  }

  // Round start down to nearest 30 mins or hour, end up to nearest 30 mins or hour
  const startMinutes = Math.floor(minMins / 30) * 30
  const endMinutes = Math.ceil(maxMins / 30) * 30
  const totalMinutes = Math.max(60, endMinutes - startMinutes)

  // Generate 60-minute markers
  const timeMarkers = []
  for (let m = startMinutes; m <= endMinutes; m += 60) {
    timeMarkers.push(m)
  }
  if (timeMarkers[timeMarkers.length - 1] < endMinutes) {
    timeMarkers.push(endMinutes)
  }

  return {
    startMinutes,
    endMinutes,
    totalMinutes,
    timeMarkers,
  }
}

/**
 * Accessible, vibrant color palettes tailored for timetable blocks.
 */
const SUBJECT_PALETTES = [
  {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800/60",
    text: "text-blue-900 dark:text-blue-100",
    accent: "bg-blue-600 dark:bg-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
    hover: "hover:border-blue-400 dark:hover:border-blue-700",
  },
  {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800/60",
    text: "text-emerald-900 dark:text-emerald-100",
    accent: "bg-emerald-600 dark:bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    hover: "hover:border-emerald-400 dark:hover:border-emerald-700",
  },
  {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    border: "border-violet-200 dark:border-violet-800/60",
    text: "text-violet-900 dark:text-violet-100",
    accent: "bg-violet-600 dark:bg-violet-500",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300",
    hover: "hover:border-violet-400 dark:hover:border-violet-700",
  },
  {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800/60",
    text: "text-amber-900 dark:text-amber-100",
    accent: "bg-amber-600 dark:bg-amber-500",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300",
    hover: "hover:border-amber-400 dark:hover:border-amber-700",
  },
  {
    bg: "bg-teal-50 dark:bg-teal-950/40",
    border: "border-teal-200 dark:border-teal-800/60",
    text: "text-teal-900 dark:text-teal-100",
    accent: "bg-teal-600 dark:bg-teal-500",
    badge: "bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300",
    hover: "hover:border-teal-400 dark:hover:border-teal-700",
  },
  {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200 dark:border-rose-800/60",
    text: "text-rose-900 dark:text-rose-100",
    accent: "bg-rose-600 dark:bg-rose-500",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300",
    hover: "hover:border-rose-400 dark:hover:border-rose-700",
  },
  {
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    border: "border-indigo-200 dark:border-indigo-800/60",
    text: "text-indigo-900 dark:text-indigo-100",
    accent: "bg-indigo-600 dark:bg-indigo-500",
    badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300",
    hover: "hover:border-indigo-400 dark:hover:border-indigo-700",
  },
  {
    bg: "bg-cyan-50 dark:bg-cyan-950/40",
    border: "border-cyan-200 dark:border-cyan-800/60",
    text: "text-cyan-900 dark:text-cyan-100",
    accent: "bg-cyan-600 dark:bg-cyan-500",
    badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-300",
    hover: "hover:border-cyan-400 dark:hover:border-cyan-700",
  },
]

export function getSubjectColor(subjectName = "", subjectId = "") {
  const seed = (subjectName || "") + (subjectId || "")
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % SUBJECT_PALETTES.length
  return SUBJECT_PALETTES[index]
}
