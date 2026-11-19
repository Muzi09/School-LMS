/**
 * Utility for canonical short subject & activity names, and category detection.
 * Provides instant O(1) canonical lookups and deterministic fallbacks.
 */

const CANONICAL_MAP = {
  mathematics: "Maths",
  math: "Maths",
  maths: "Maths",
  science: "Sci",
  "general science": "Sci",
  "social science": "S.S",
  "social studies": "S.S",
  "social studies (sst)": "S.S",
  sst: "S.S",
  "artificial intelligence": "AI",
  ai: "AI",
  "physical education": "P.E.",
  pe: "P.E.",
  "p.e.": "P.E.",
  "computer science": "Comp",
  computer: "Comp",
  computers: "Comp",
  cs: "Comp",
  "information technology": "IT",
  it: "IT",
  english: "Eng",
  "english language": "Eng",
  "english literature": "Eng",
  "environmental studies": "EVS",
  evs: "EVS",
  "general knowledge": "GK",
  gk: "GK",
  "business studies": "B.St",
  bst: "B.St",
  accountancy: "Acc",
  accounts: "Acc",
  economics: "Econ",
  eco: "Econ",
  chemistry: "Chem",
  physics: "Phy",
  biology: "Bio",
  geography: "Geo",
  history: "Hist",
  "political science": "Pol.Sci",
  civics: "Civics",
  sanskrit: "Sansk",
  hindi: "Hindi",
  urdu: "Urdu",
  french: "French",
  german: "German",
  drawing: "Art",
  art: "Art",
  arts: "Art",
  "fine arts": "Art",
  "visual arts": "Art",
  music: "Music",
  dance: "Dance",
  yoga: "Yoga",
  library: "Lib",
  "moral science": "V.Ed",
  "value education": "V.Ed",
  robotics: "Robot",
  swimming: "Swim",
  karate: "Karate",
  drama: "Drama",
  chess: "Chess",
  craft: "Craft",
}

/**
 * Returns a clean, recognizable short subject name (<= 6 chars where possible).
 */
export function getShortSubjectName(name, code = null) {
  if (code && typeof code === "string" && code.trim().length <= 5) {
    return code.trim().toUpperCase()
  }

  if (!name || typeof name !== "string") return "Sub"
  const cleanName = name.trim()
  const lower = cleanName.toLowerCase()

  // 1. Direct canonical dictionary match
  if (CANONICAL_MAP[lower]) {
    return CANONICAL_MAP[lower]
  }

  // 2. Check canonical key inside the phrase (e.g. "Grade 10 Mathematics" -> "Maths")
  for (const [key, val] of Object.entries(CANONICAL_MAP)) {
    if (lower === key || lower.startsWith(key + " ") || lower.endsWith(" " + key)) {
      return val
    }
  }

  // 3. Fallback for custom names
  const words = cleanName
    .split(/\s+/)
    .filter((w) => !["and", "&", "of", "the", "in", "for"].includes(w.toLowerCase()))

  if (words.length >= 3) {
    // Acronym of first letters (e.g. "Robotics and Machine Learning" -> "RML")
    return words.map((w) => w[0].toUpperCase()).join("")
  }

  if (words.length === 2) {
    const w1 = words[0]
    const w2 = words[1]
    if (CANONICAL_MAP[w2.toLowerCase()]) {
      return `${w1.slice(0, 3)}.${CANONICAL_MAP[w2.toLowerCase()]}`
    }
    return `${w1.slice(0, 3)}.${w2.slice(0, 3)}`
  }

  // Single word
  if (cleanName.length > 6) {
    return `${cleanName.slice(0, 4)}.`
  }

  return cleanName
}

/**
 * Determines whether a subject is Academic or Non-Academic (Activity).
 */
export function isAcademicSubject(subject) {
  if (!subject) return true
  if (subject.is_academic !== undefined && subject.is_academic !== null) {
    return Boolean(subject.is_academic)
  }
  const cat = (subject.category || "").toLowerCase()
  if (cat.includes("academic") || cat.includes("core")) return true
  if (
    cat.includes("activity") ||
    cat.includes("extra") ||
    cat.includes("co-curricular") ||
    cat.includes("sports")
  ) {
    return false
  }
  const pType = (subject.period_type || "").toUpperCase()
  if (pType === "ACTIVITY" || pType === "EXTRA_CURRICULAR") return false

  const name = (subject.name || "").toLowerCase()
  if (
    name.includes("physical education") ||
    name.includes("sports") ||
    name.includes("swimming") ||
    name.includes("yoga") ||
    name.includes("dance") ||
    name.includes("music") ||
    name.includes("art") ||
    name.includes("craft") ||
    name.includes("drama")
  ) {
    return false
  }

  return true
}

/**
 * Organizes subject stats into Row 1 and Row 2 groups with "Acad :" and "Non Acad :" headers.
 * When Academic subjects are more, it balances them across rows and shifts Non Acad to follow.
 */
export function buildRowGroups(stats = []) {
  if (!stats || !Array.isArray(stats)) {
    return { row1Groups: [], row2Groups: [] }
  }

  const academic = stats.filter(isAcademicSubject)
  const nonAcademic = stats.filter((s) => !isAcademicSubject(s))

  let row1Groups = []
  let row2Groups = []

  if (nonAcademic.length === 0) {
    // Only Academic subjects exist
    if (academic.length <= 3) {
      row1Groups = [{ label: "Acad :", items: academic, isAcademic: true }]
      row2Groups = []
    } else {
      const mid = Math.ceil(academic.length / 2)
      row1Groups = [{ label: "Acad :", items: academic.slice(0, mid), isAcademic: true }]
      row2Groups = [{ label: "Acad :", items: academic.slice(mid), isAcademic: true }]
    }
  } else if (academic.length === 0) {
    // Only Non-Academic subjects exist
    if (nonAcademic.length <= 3) {
      row1Groups = [{ label: "Non Acad :", items: nonAcademic, isAcademic: false }]
      row2Groups = []
    } else {
      const mid = Math.ceil(nonAcademic.length / 2)
      row1Groups = [{ label: "Non Acad :", items: nonAcademic.slice(0, mid), isAcademic: false }]
      row2Groups = [{ label: "Non Acad :", items: nonAcademic.slice(mid), isAcademic: false }]
    }
  } else if (academic.length > 4 && academic.length > nonAcademic.length) {
    // Acad are significantly more: split Acad across both rows, shift Non Acad to the end of Row 2
    const mid = Math.ceil(academic.length / 2)
    row1Groups = [{ label: "Acad :", items: academic.slice(0, mid), isAcademic: true }]
    row2Groups = [
      { label: "Acad :", items: academic.slice(mid), isAcademic: true },
      { label: "Non Acad :", items: nonAcademic, isAcademic: false },
    ]
  } else {
    // Standard case: Row 1 = Acad, Row 2 = Non Acad
    row1Groups = [{ label: "Acad :", items: academic, isAcademic: true }]
    row2Groups = [{ label: "Non Acad :", items: nonAcademic, isAcademic: false }]
  }

  return { row1Groups, row2Groups }
}

