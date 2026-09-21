export function formatChatTimestamp(dateString) {
  if (!dateString) return ""
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ""
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday"
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function formatMessageTime(dateString) {
  if (!dateString) return ""
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export function getDateDivider(dateString) {
  if (!dateString) return ""
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ""
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return "Today"
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday"
  }
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function parseDate(dateString) {
  if (!dateString) return null
  if (dateString instanceof Date) return isNaN(dateString.getTime()) ? null : dateString
  let str = String(dateString).trim()
  if (str.includes("T") && !str.endsWith("Z") && !/[+-]\d{2}:?\d{2}$/.test(str)) {
    str += "Z"
  }
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

export function formatLastSeen(dateString, now = new Date()) {
  const date = parseDate(dateString)
  if (!date) return ""

  const diffMs = Math.max(0, now.getTime() - date.getTime())
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  // 1. Less than 1 hour: Last seen X minutes ago
  if (diffMinutes < 60) {
    const mins = Math.max(1, diffMinutes)
    return `Last seen ${mins} minute${mins === 1 ? "" : "s"} ago`
  }

  // 2. 1 to 23 hours: Last seen X hour(s) ago
  if (diffHours < 24) {
    return `Last seen ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`
  }

  // Helper: check if same calendar day as yesterday
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()

  // 3. Previous calendar day: Last seen yesterday 02:24 PM
  if (isYesterday) {
    const timeStr = date
      .toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
      .replace(/\u202f/g, " ")
    return `Last seen yesterday ${timeStr}`
  }

  // 4. Within the current week: Last seen on Tuesday
  const dayOfWeek = (now.getDay() + 6) % 7 // Monday = 0, ..., Sunday = 6
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0, 0)

  if (date >= startOfWeek) {
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" })
    return `Last seen on ${weekday}`
  }

  // 5. Older than the current week: Last seen on 02 Aug 2023, 05:23 PM
  const day = String(date.getDate()).padStart(2, "0")
  const month = date.toLocaleDateString("en-US", { month: "short" })
  const year = date.getFullYear()
  const timeStr = date
    .toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\u202f/g, " ")

  return `Last seen on ${day} ${month} ${year}, ${timeStr}`
}
