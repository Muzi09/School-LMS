/**
 * Wing Color Theme & Design Tokens
 * Provides distinct, accessible color palettes for school wings with dark mode support.
 */

export const WING_THEMES = [
  {
    key: "pre-primary",
    nameMatch: ["pre-primary", "nursery", "kg", "kindergarten", "early"],
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    cardBorder: "border-purple-200 dark:border-purple-900/50",
    headerBg: "bg-purple-50/60 dark:bg-purple-950/20",
    chip: "bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    chipActive: "bg-purple-600 text-white dark:bg-purple-500",
    dot: "bg-purple-500",
  },
  {
    key: "primary",
    nameMatch: ["primary", "elementary"],
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    cardBorder: "border-blue-200 dark:border-blue-900/50",
    headerBg: "bg-blue-50/60 dark:bg-blue-950/20",
    chip: "bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    chipActive: "bg-blue-600 text-white dark:bg-blue-500",
    dot: "bg-blue-500",
  },
  {
    key: "middle",
    nameMatch: ["middle", "junior"],
    badge: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800",
    cardBorder: "border-teal-200 dark:border-teal-900/50",
    headerBg: "bg-teal-50/60 dark:bg-teal-950/20",
    chip: "bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:hover:bg-teal-900/50 dark:text-teal-300 border-teal-200 dark:border-teal-800",
    chipActive: "bg-teal-600 text-white dark:bg-teal-500",
    dot: "bg-teal-500",
  },
  {
    key: "secondary",
    nameMatch: ["secondary", "high", "senior secondary"],
    badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    cardBorder: "border-indigo-200 dark:border-indigo-900/50",
    headerBg: "bg-indigo-50/60 dark:bg-indigo-950/20",
    chip: "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    chipActive: "bg-indigo-600 text-white dark:bg-indigo-500",
    dot: "bg-indigo-500",
  },
  {
    key: "senior-secondary",
    nameMatch: ["senior secondary", "11", "12", "plus two"],
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    cardBorder: "border-rose-200 dark:border-rose-900/50",
    headerBg: "bg-rose-50/60 dark:bg-rose-950/20",
    chip: "bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    chipActive: "bg-rose-600 text-white dark:bg-rose-500",
    dot: "bg-rose-500",
  },
]

export function getWingTheme(wingName = "", index = 0) {
  const lower = (wingName || "").toLowerCase().trim()
  const matched = WING_THEMES.find((t) => t.nameMatch.some((m) => lower.includes(m)))
  if (matched) return matched
  return WING_THEMES[index % WING_THEMES.length]
}

