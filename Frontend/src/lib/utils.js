import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
]

/**
 * Format a date string/timestamp into "09 Jan 2026, 12:05 PM" format.
 */
export function formatDateTime(dateInput) {
  if (!dateInput) return "—"
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return String(dateInput)

  const day = String(d.getDate()).padStart(2, "0")
  const month = MONTH_NAMES[d.getMonth()]
  const year = d.getFullYear()

  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  hours = hours % 12
  hours = hours ? hours : 12
  const formattedHours = String(hours).padStart(2, "0")

  return `${day} ${month} ${year}, ${formattedHours}:${minutes} ${ampm}`
}

/**
 * Format a date string/timestamp into "09 Jan 2026" format.
 */
export function formatDate(dateInput) {
  if (!dateInput) return "—"
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return String(dateInput)

  const day = String(d.getDate()).padStart(2, "0")
  const month = MONTH_NAMES[d.getMonth()]
  const year = d.getFullYear()

  return `${day} ${month} ${year}`
}
