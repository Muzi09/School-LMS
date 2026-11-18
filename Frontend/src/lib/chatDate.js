/** @typedef {Date | string | null | undefined} ChatDate */

const locale = () => globalThis.navigator?.language ?? "en-US"

/** @param {ChatDate} value */
function parseDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const text = String(value).trim()
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)
  const date = new Date(text.includes("T") && !hasZone ? text + "Z" : text)
  return Number.isNaN(date.getTime()) ? null : date
}

/** @param {Date} now */
function previousDay(now) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
}

/** @param {number} offset
 * @param {string} language
 */
function relativeDay(offset, language) {
  const label = new Intl.RelativeTimeFormat(language, { numeric: "auto" }).format(offset, "day")
  return label.charAt(0).toLocaleUpperCase(language) + label.slice(1)
}

/** @param {Date} date
 * @param {string} language
 * @param {Intl.DateTimeFormatOptions["hour"]} hour
 */
function displayTime(date, language, hour = "numeric") {
  return new Intl.DateTimeFormat(language, { hour, minute: "2-digit" }).format(date).replace(/\u202f/g, " ")
}

/** @param {ChatDate} value */
export function formatChatTimestamp(value, language = locale(), now = new Date()) {
  const date = parseDate(value)
  if (!date) return ""
  if (date.toDateString() === now.toDateString()) return displayTime(date, language)
  if (date.toDateString() === previousDay(now).toDateString()) return relativeDay(-1, language)
  return new Intl.DateTimeFormat(language, { month: "short", day: "numeric" }).format(date)
}

/** @param {ChatDate} value */
export function formatMessageTime(value, language = locale()) {
  const date = parseDate(value)
  return date ? displayTime(date, language) : ""
}

/** @param {ChatDate} value */
export function getDateDivider(value, language = locale(), now = new Date()) {
  const date = parseDate(value)
  if (!date) return ""
  if (date.toDateString() === now.toDateString()) return relativeDay(0, language)
  if (date.toDateString() === previousDay(now).toDateString()) return relativeDay(-1, language)
  return new Intl.DateTimeFormat(language, { weekday: "short", month: "short", day: "numeric" }).format(date)
}

/** @param {ChatDate} value */
export function formatLastSeen(value, now = new Date(), language = locale()) {
  const date = parseDate(value)
  if (!date) return ""

  const hindi = language.toLowerCase().split("-")[0] === "hi"
  const label = hindi ? "पिछली बार ऑनलाइन" : "Last seen"
  const elapsedMinutes = Math.max(1, Math.floor((now.getTime() - date.getTime()) / 60000))
  const relativeTime = new Intl.RelativeTimeFormat(language, { numeric: "always" })
  if (elapsedMinutes < 60) return `${label} ${relativeTime.format(-elapsedMinutes, "minute")}`

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${label} ${relativeTime.format(-elapsedHours, "hour")}`

  if (date.toDateString() === previousDay(now).toDateString()) {
    const yesterday = relativeTime.resolvedOptions().locale.startsWith("en")
      ? "yesterday"
      : new Intl.RelativeTimeFormat(language, { numeric: "auto" }).format(-1, "day")
    return `${label} ${yesterday} ${displayTime(date, language, "2-digit")}`
  }

  const mondayOffset = (now.getDay() + 6) % 7
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset)
  const on = hindi ? "" : " on"
  if (date >= startOfWeek) {
    return `${label}${on} ${new Intl.DateTimeFormat(language, { weekday: "long" }).format(date)}`
  }

  const dateParts = new Intl.DateTimeFormat(language, { day: "2-digit", month: "short", year: "numeric" })
    .formatToParts(date)
  const labelParts = ["day", "month", "year"].map(type => dateParts.find(part => part.type === type)?.value)
  return `${label}${on} ${labelParts.join(" ")}, ${displayTime(date, language, "2-digit")}`
}
