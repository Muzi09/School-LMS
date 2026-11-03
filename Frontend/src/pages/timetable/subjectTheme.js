import {
  BookOpen,
  Calculator,
  Compass,
  Dumbbell,
  FlaskConical,
  Globe,
  GraduationCap,
  Laptop,
  Music,
  Palette,
  Sparkles,
  Trophy,
} from "lucide-react"

/**
 * Subject Color Tokens & Theme Definitions
 * Strict light and dark mode variants adhering to WCAG AA contrast.
 * Never relying on color alone: always paired with labels and icons.
 */

export const SUBJECT_PALETTES = {
  blue: {
    key: "blue",
    name: "Blue",
    dot: "bg-blue-600 dark:bg-blue-400",
    chip: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800",
    cellAccent: "bg-blue-600 dark:bg-blue-400",
    cellBg: "bg-blue-50/40 hover:bg-blue-50/70 dark:bg-blue-950/20 dark:hover:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-900/60",
    icon: Calculator,
  },
  emerald: {
    key: "emerald",
    name: "Emerald",
    dot: "bg-emerald-600 dark:bg-emerald-400",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800",
    cellAccent: "bg-emerald-600 dark:bg-emerald-400",
    cellBg: "bg-emerald-50/40 hover:bg-emerald-50/70 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-900/60",
    icon: BookOpen,
  },
  amber: {
    key: "amber",
    name: "Amber",
    dot: "bg-amber-600 dark:bg-amber-400",
    chip: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800",
    cellAccent: "bg-amber-600 dark:bg-amber-400",
    cellBg: "bg-amber-50/40 hover:bg-amber-50/70 dark:bg-amber-950/20 dark:hover:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-900/60",
    icon: FlaskConical,
  },
  violet: {
    key: "violet",
    name: "Violet",
    dot: "bg-violet-600 dark:bg-violet-400",
    chip: "bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-200 dark:border-violet-800",
    cellAccent: "bg-violet-600 dark:bg-violet-400",
    cellBg: "bg-violet-50/40 hover:bg-violet-50/70 dark:bg-violet-950/20 dark:hover:bg-violet-950/40",
    border: "border-violet-200 dark:border-violet-900/60",
    icon: Globe,
  },
  rose: {
    key: "rose",
    name: "Rose",
    dot: "bg-rose-600 dark:bg-rose-400",
    chip: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800",
    cellAccent: "bg-rose-600 dark:bg-rose-400",
    cellBg: "bg-rose-50/40 hover:bg-rose-50/70 dark:bg-rose-950/20 dark:hover:bg-rose-950/40",
    border: "border-rose-200 dark:border-rose-900/60",
    icon: Trophy,
  },
  fuchsia: {
    key: "fuchsia",
    name: "Fuchsia",
    dot: "bg-fuchsia-600 dark:bg-fuchsia-400",
    chip: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-950/60 dark:text-fuchsia-200 dark:border-fuchsia-800",
    cellAccent: "bg-fuchsia-600 dark:bg-fuchsia-400",
    cellBg: "bg-fuchsia-50/40 hover:bg-fuchsia-50/70 dark:bg-fuchsia-950/20 dark:hover:bg-fuchsia-950/40",
    border: "border-fuchsia-200 dark:border-fuchsia-900/60",
    icon: Palette,
  },
  teal: {
    key: "teal",
    name: "Teal",
    dot: "bg-teal-600 dark:bg-teal-400",
    chip: "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-200 dark:border-teal-800",
    cellAccent: "bg-teal-600 dark:bg-teal-400",
    cellBg: "bg-teal-50/40 hover:bg-teal-50/70 dark:bg-teal-950/20 dark:hover:bg-teal-950/40",
    border: "border-teal-200 dark:border-teal-900/60",
    icon: Music,
  },
  sky: {
    key: "sky",
    name: "Sky",
    dot: "bg-sky-600 dark:bg-sky-400",
    chip: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-800",
    cellAccent: "bg-sky-600 dark:bg-sky-400",
    cellBg: "bg-sky-50/40 hover:bg-sky-50/70 dark:bg-sky-950/20 dark:hover:bg-sky-950/40",
    border: "border-sky-200 dark:border-sky-900/60",
    icon: Laptop,
  },
  indigo: {
    key: "indigo",
    name: "Indigo",
    dot: "bg-indigo-600 dark:bg-indigo-400",
    chip: "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-800",
    cellAccent: "bg-indigo-600 dark:bg-indigo-400",
    cellBg: "bg-indigo-50/40 hover:bg-indigo-50/70 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40",
    border: "border-indigo-200 dark:border-indigo-900/60",
    icon: Compass,
  },
  orange: {
    key: "orange",
    name: "Orange",
    dot: "bg-orange-600 dark:bg-orange-400",
    chip: "bg-orange-50 text-orange-900 border-orange-200 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-800",
    cellAccent: "bg-orange-600 dark:bg-orange-400",
    cellBg: "bg-orange-50/40 hover:bg-orange-50/70 dark:bg-orange-950/20 dark:hover:bg-orange-950/40",
    border: "border-orange-200 dark:border-orange-900/60",
    icon: Sparkles,
  },
  neutral: {
    key: "neutral",
    name: "Neutral",
    dot: "bg-muted-foreground/60 dark:bg-muted-foreground/50",
    chip: "bg-muted text-muted-foreground border-border dark:bg-muted/40 dark:text-muted-foreground dark:border-border/60",
    cellAccent: "bg-muted-foreground/40",
    cellBg: "bg-muted/15 dark:bg-muted/10",
    border: "border-border/80 dark:border-border/60",
    icon: GraduationCap,
  },
}

/**
 * Returns deterministic color token palette for any subject by name or category.
 */
export function getSubjectTheme(subjectName = "", category = "") {
  if (!subjectName) return SUBJECT_PALETTES.neutral

  const name = subjectName.toLowerCase()

  if (name.includes("math")) return SUBJECT_PALETTES.blue
  if (name.includes("eng")) return SUBJECT_PALETTES.emerald
  if (name.includes("sci") || name.includes("evs") || name.includes("bio") || name.includes("chem") || name.includes("phy")) {
    return SUBJECT_PALETTES.amber
  }
  if (name.includes("hin") || name.includes("soc") || name.includes("his") || name.includes("geo") || name.includes("civ")) {
    return SUBJECT_PALETTES.violet
  }
  if (name.includes("sport") || name.includes("pe") || name.includes("play") || name.includes("games")) {
    return SUBJECT_PALETTES.rose
  }
  if (name.includes("art") || name.includes("craft") || name.includes("draw")) {
    return SUBJECT_PALETTES.fuchsia
  }
  if (name.includes("music") || name.includes("dance") || name.includes("rhyme")) {
    return SUBJECT_PALETTES.teal
  }
  if (name.includes("comp") || name.includes("it") || name.includes("code")) {
    return SUBJECT_PALETTES.sky
  }
  if (name.includes("eco") || name.includes("comm") || name.includes("acc")) {
    return SUBJECT_PALETTES.indigo
  }

  // Hash code fallback for variety
  const keys = Object.keys(SUBJECT_PALETTES).filter((k) => k !== "neutral")
  let hash = 0
  for (let i = 0; i < subjectName.length; i++) {
    hash = (hash << 5) - hash + subjectName.charCodeAt(i)
    hash |= 0
  }
  const key = keys[Math.abs(hash) % keys.length]
  return SUBJECT_PALETTES[key] || SUBJECT_PALETTES.neutral
}

