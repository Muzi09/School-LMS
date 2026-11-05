/**
 * Wing Color Theme & Design Tokens
 * Provides distinct, accessible color palettes for school wings with dark mode support.
 */

export const WING_THEMES = [
  {
    key: "pre-primary",
    nameMatch: ["pre-primary", "nursery", "kg", "kindergarten", "early"],
    badge: "bg-slate-100 text-slate-800 dark:bg-slate-900/60 dark:text-slate-300 border-slate-200 dark:border-slate-800",
    cardBorder: "border-slate-200 dark:border-slate-800/60",
    headerBg: "bg-slate-50/60 dark:bg-slate-950/20",
    chip: "bg-slate-100/70 hover:bg-slate-200 text-slate-700 dark:bg-slate-900/40 dark:hover:bg-slate-800/50 dark:text-slate-300 border-slate-200 dark:border-slate-800",
    chipActive: "bg-slate-700 text-white dark:bg-slate-600",
    dot: "bg-slate-500",
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
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800",
    cardBorder: "border-sky-200 dark:border-sky-900/50",
    headerBg: "bg-sky-50/60 dark:bg-sky-950/20",
    chip: "bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 dark:text-sky-300 border-sky-200 dark:border-sky-800",
    chipActive: "bg-sky-600 text-white dark:bg-sky-500",
    dot: "bg-sky-500",
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

