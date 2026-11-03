/**
 * Intelligent search utility for School LMS Timetable.
 * Supports:
 * - Exact and flexible Class + Section queries: "10 B", "10B", "10-B", "Class 10th Section B", "Grade 10 B", "Class X B"
 * - Section-only queries: "B", "Section B", "Sec B" (matches all section B of all classes)
 * - Class-only queries: "10", "10th", "Class 10", "Grade 10", "Class X", "Nursery", "KG" (matches all sections of that class)
 * - General queries: Subject names (e.g. "Math", "Science"), Teacher names (e.g. "Raman"), Wing names (e.g. "Primary")
 */

const ROMAN_MAP = {
  i: "1",
  ii: "2",
  iii: "3",
  iv: "4",
  v: "5",
  vi: "6",
  vii: "7",
  viii: "8",
  ix: "9",
  x: "10",
  xi: "11",
  xii: "12",
}

export function normalizeClass(raw = "") {
  if (!raw) return ""
  let str = String(raw).toLowerCase().trim()
  // Remove common prefixes: "class", "grade", "std", "standard"
  str = str.replace(/\b(class|grade|std|standard)\b/gi, "").trim()
  // Strip ordinal suffixes like 10th, 1st, 2nd, 3rd, 4th -> 10, 1, 2, 3, 4
  str = str.replace(/(\d+)(st|nd|rd|th)\b/gi, "$1").trim()
  // Check Roman numeral
  if (ROMAN_MAP[str]) {
    return ROMAN_MAP[str]
  }
  return str
}

export function normalizeSection(raw = "") {
  if (!raw) return ""
  let str = String(raw).toLowerCase().trim()
  // Remove common prefixes: "section", "sec"
  str = str.replace(/\b(section|sec)\b/gi, "").trim()
  // Remove leading dash/hyphen or colon
  str = str.replace(/^[-:_\s]+/, "").trim()
  return str
}

export function parseTimetableQuery(rawQuery = "") {
  const trimmed = String(rawQuery || "").trim()
  if (!trimmed) return null

  const lower = trimmed.toLowerCase()

  // Clean punctuation like hyphens, slashes, underscores into spaces
  const cleanStr = lower.replace(/[-_–/]/g, " ").replace(/\s+/g, " ").trim()

  // 1. Single letter section: "B", "A", etc.
  if (/^[a-z]$/i.test(cleanStr)) {
    return {
      type: "SECTION_ONLY",
      sectionTarget: normalizeSection(cleanStr),
      raw: trimmed,
    }
  }

  // 2. Explicit "section B", "sec B"
  const onlySectionMatch = cleanStr.match(/^(?:section|sec)\s+([a-z0-9]+)$/i)
  if (onlySectionMatch) {
    return {
      type: "SECTION_ONLY",
      sectionTarget: normalizeSection(onlySectionMatch[1]),
      raw: trimmed,
    }
  }

  // 3. Class only: "10", "10th", "Class 10", "Grade 10", "Class X", "Nursery", "KG"
  const onlyClassMatch = cleanStr.match(
    /^(?:class|grade|std|standard)?\s*([0-9]{1,2}|[ivxlcdm]+|nursery|lkg|ukg|kg|pre-?kg|playgroup|prep)(?:st|nd|rd|th)?$/i
  )
  if (onlyClassMatch) {
    return {
      type: "CLASS_ONLY",
      classTarget: normalizeClass(onlyClassMatch[1]),
      raw: trimmed,
    }
  }

  // 4. Concatenated class + letter section: "10b", "9a", "12c", "10thb"
  const concatMatch = cleanStr.match(
    /^(?:class|grade)?\s*([0-9]{1,2}|[ivxlcdm]+)(?:st|nd|rd|th)?([a-z])$/i
  )
  if (concatMatch) {
    return {
      type: "CLASS_AND_SECTION",
      classTarget: normalizeClass(concatMatch[1]),
      sectionTarget: normalizeSection(concatMatch[2]),
      raw: trimmed,
    }
  }

  // 5. Separated class + section: "10 B", "10-B", "Class 10th Section B", "Grade 10 B", "Nursery B"
  const classAndSecMatch = cleanStr.match(
    /^(?:class|grade|std|standard)?\s*([0-9]{1,2}|[ivxlcdm]+|nursery|lkg|ukg|kg|pre-?kg|playgroup|prep)(?:st|nd|rd|th)?(?:\s+(?:section|sec)|\s*[-_–/]\s*|\s+)\s*([a-z0-9]+)$/i
  )
  if (classAndSecMatch) {
    return {
      type: "CLASS_AND_SECTION",
      classTarget: normalizeClass(classAndSecMatch[1]),
      sectionTarget: normalizeSection(classAndSecMatch[2]),
      raw: trimmed,
    }
  }

  // 6. General Search: Subject, Teacher, Wing, or arbitrary text
  return {
    type: "GENERAL",
    term: lower,
    raw: trimmed,
  }
}

export function sectionMatchesQuery(cls = {}, sec = {}, parsedQuery, wing = {}, secEntries = []) {
  if (!parsedQuery) return true

  const normCls = normalizeClass(cls.name)
  const normSec = normalizeSection(sec.name)

  if (parsedQuery.type === "CLASS_AND_SECTION") {
    // Both class and section must match
    const classMatches =
      normCls === parsedQuery.classTarget ||
      (cls.name && cls.name.toLowerCase().includes(parsedQuery.classTarget))

    const secMatches =
      normSec === parsedQuery.sectionTarget ||
      (sec.name && sec.name.toLowerCase().includes(parsedQuery.sectionTarget))

    return Boolean(classMatches && secMatches)
  }

  if (parsedQuery.type === "SECTION_ONLY") {
    // All sections matching this target section must come in the result
    return (
      normSec === parsedQuery.sectionTarget ||
      (sec.name && sec.name.toLowerCase().trim() === parsedQuery.sectionTarget)
    )
  }

  if (parsedQuery.type === "CLASS_ONLY") {
    // All sections of this class must come in the result
    return (
      normCls === parsedQuery.classTarget ||
      (cls.name && cls.name.toLowerCase().includes(parsedQuery.classTarget))
    )
  }

  if (parsedQuery.type === "GENERAL") {
    const term = parsedQuery.term

    // Match wing name
    if (wing.name && wing.name.toLowerCase().includes(term)) {
      return true
    }

    // Match class or section name directly
    const fullClassSection = `${cls.name || ""} ${sec.name || ""}`.toLowerCase()
    if (fullClassSection.includes(term)) {
      return true
    }

    // Match subject name, subject code, or teacher name in scheduled slots
    return secEntries.some((entry) => {
      const subjectName = (entry.subject?.name || "").toLowerCase()
      const subjectCode = (entry.subject?.code || "").toLowerCase()
      const teacherName = (entry.teacher?.name || "").toLowerCase()
      return subjectName.includes(term) || subjectCode.includes(term) || teacherName.includes(term)
    })
  }

  return false
}

export function cellMatchesHighlight(entry, parsedQuery) {
  if (!parsedQuery || !entry) return { isHighlighted: false, isDimmed: false }

  // If search was specifically for class or section, do not dim slots
  if (
    parsedQuery.type === "CLASS_AND_SECTION" ||
    parsedQuery.type === "CLASS_ONLY" ||
    parsedQuery.type === "SECTION_ONLY"
  ) {
    return { isHighlighted: false, isDimmed: false }
  }

  // If search was general (e.g. subject or teacher)
  if (parsedQuery.type === "GENERAL") {
    const term = parsedQuery.term
    const subName = (entry.subject?.name || "").toLowerCase()
    const subCode = (entry.subject?.code || "").toLowerCase()
    const tName = (entry.teacher?.name || "").toLowerCase()

    if (subName.includes(term) || subCode.includes(term) || tName.includes(term)) {
      return { isHighlighted: true, isDimmed: false }
    } else {
      return { isHighlighted: false, isDimmed: true }
    }
  }

  return { isHighlighted: false, isDimmed: false }
}

// Backward compatibility exports
export const parseSearchTokens = parseTimetableQuery
export const parseSearchQuery = parseTimetableQuery

export function fuzzyMatches(text = "", search = "") {
  if (!search) return true
  if (!text) return false
  return String(text).toLowerCase().includes(String(search).toLowerCase())
}
