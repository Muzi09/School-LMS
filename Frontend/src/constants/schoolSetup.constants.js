export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
]

export const THEME_COLOR_PRESETS = [
  { label: "Default", value: "#FFFFFF" },
  { label: "Royal Blue", value: "#2563EB" },
  { label: "Emerald Green", value: "#059669" },
  { label: "Crimson Red", value: "#DC2626" },
  { label: "Amethyst Purple", value: "#7C3AED" },
  { label: "Indigo Slate", value: "#4F46E5" },
  { label: "Teal Cyan", value: "#0D9488" },
  { label: "Amber Gold", value: "#D97706" },
]

export const CURATED_HOUSE_PALETTE = [
  { name: "Red", hex: "#EF4444" },
  { name: "Blue", hex: "#3B82F6" },
  { name: "Green", hex: "#10B981" },
  { name: "Yellow", hex: "#F59E0B" },
  { name: "Orange", hex: "#F97316" },
  { name: "Purple", hex: "#8B5CF6" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Maroon", hex: "#991B1B" },
  { name: "Navy", hex: "#1E3A8A" },
  { name: "Cyan", hex: "#06B6D4" },
  { name: "Slate", hex: "#64748B" },
]

export const INITIAL_DEFAULT_CLASSES = [
  "Nursery",
  "LKG",
  "UKG",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12",
]

export const INITIAL_DEFAULT_SECTIONS = [
  "Section A",
  "Section B",
  "Section C",
]

export const SENIOR_SECONDARY_DEFAULT_SECTIONS = [
  "Science",
  "Commerce",
  "Arts/Humanities",
]

export const STREAM_DEFAULT_SUBJECTS = {
  Science: {
    academic: [
      "English",
      "Physics",
      "Chemistry",
      "Mathematics",
      "Biology",
      "Computer Science/Informatics Practices",
    ],
    nonAcademic: ["Physical Education"],
  },
  Commerce: {
    academic: [
      "English",
      "Accountancy",
      "Business Studies",
      "Economics",
      "Mathematics",
      "Computer Science/Informatics Practices",
    ],
    nonAcademic: ["Physical Education"],
  },
  "Arts/Humanities": {
    academic: [
      "English",
      "History",
      "Political Science",
      "Geography",
      "Economics",
      "Sociology",
    ],
    nonAcademic: ["Physical Education"],
  },
  Arts: {
    academic: [
      "English",
      "History",
      "Political Science",
      "Geography",
      "Economics",
      "Sociology",
    ],
    nonAcademic: ["Physical Education"],
  },
  Humanities: {
    academic: [
      "English",
      "History",
      "Political Science",
      "Geography",
      "Economics",
      "Sociology",
    ],
    nonAcademic: ["Physical Education"],
  },
}

export const isSeniorSecondaryClass = (className) => {
  const trimmed = (className || "").trim().toLowerCase()
  return (
    trimmed === "class 11" ||
    trimmed === "class 12" ||
    trimmed === "11" ||
    trimmed === "12" ||
    trimmed === "grade 11" ||
    trimmed === "grade 12" ||
    /^(class\s*|grade\s*)?(11|12)(th)?$/i.test(trimmed)
  )
}

export const getDefaultSectionsForClass = (className) => {
  if (isSeniorSecondaryClass(className)) {
    return [...SENIOR_SECONDARY_DEFAULT_SECTIONS]
  }
  return [...INITIAL_DEFAULT_SECTIONS]
}

export const getDefaultSubjectsForStreamSection = (sectionName) => {
  const sec = (sectionName || "").trim()
  if (STREAM_DEFAULT_SUBJECTS[sec]) {
    return {
      academic: [...STREAM_DEFAULT_SUBJECTS[sec].academic],
      nonAcademic: [...STREAM_DEFAULT_SUBJECTS[sec].nonAcademic],
    }
  }
  const lower = sec.toLowerCase()
  if (lower.includes("sci")) {
    return {
      academic: [...STREAM_DEFAULT_SUBJECTS.Science.academic],
      nonAcademic: [...STREAM_DEFAULT_SUBJECTS.Science.nonAcademic],
    }
  }
  if (lower.includes("comm")) {
    return {
      academic: [...STREAM_DEFAULT_SUBJECTS.Commerce.academic],
      nonAcademic: [...STREAM_DEFAULT_SUBJECTS.Commerce.nonAcademic],
    }
  }
  if (lower.includes("art") || lower.includes("hum")) {
    return {
      academic: [...STREAM_DEFAULT_SUBJECTS["Arts/Humanities"].academic],
      nonAcademic: [...STREAM_DEFAULT_SUBJECTS["Arts/Humanities"].nonAcademic],
    }
  }
  return {
    academic: [
      "English",
      "Physics",
      "Chemistry",
      "Mathematics",
      "Biology",
      "Computer Science/Informatics Practices",
    ],
    nonAcademic: ["Physical Education"],
  }
}

export const INITIAL_CLASS_SUBJECTS_MAP = {
  "Nursery": {
    academic: ["English", "Hindi", "Mathematics", "General Awareness"],
    nonAcademic: ["Drawing", "Rhymes", "Art & Craft"],
  },
  "LKG": {
    academic: ["English", "Hindi", "Mathematics", "Environmental Studies", "General Awareness"],
    nonAcademic: ["Drawing", "Rhymes", "Art & Craft"],
  },
  "UKG": {
    academic: ["English", "Hindi", "Mathematics", "Environmental Studies", "General Awareness"],
    nonAcademic: ["Drawing", "Rhymes", "Art & Craft"],
  },
  "Class 1": {
    academic: ["English", "Hindi", "Mathematics", "Environmental Studies (EVS)", "General Knowledge", "Computer"],
    nonAcademic: [],
  },
  "Class 2": {
    academic: ["English", "Hindi", "Mathematics", "Environmental Studies (EVS)", "General Knowledge", "Computer"],
    nonAcademic: [],
  },
  "Class 3": {
    academic: ["English", "Hindi", "Mathematics", "Environmental Studies (EVS)", "General Knowledge", "Computer"],
    nonAcademic: [],
  },
  "Class 4": {
    academic: ["English", "Hindi", "Mathematics", "Environmental Studies (EVS)", "General Knowledge", "Computer"],
    nonAcademic: [],
  },
  "Class 5": {
    academic: ["English", "Hindi", "Mathematics", "Environmental Studies (EVS)", "General Knowledge", "Computer"],
    nonAcademic: [],
  },
  "Class 6": {
    academic: ["English", "Hindi", "Mathematics", "Science", "Social Science", "Computer", "Sanskrit/Third Language"],
    nonAcademic: [],
  },
  "Class 7": {
    academic: ["English", "Hindi", "Mathematics", "Science", "Social Science", "Computer", "Sanskrit/Third Language"],
    nonAcademic: [],
  },
  "Class 8": {
    academic: ["English", "Hindi", "Mathematics", "Science", "Social Science", "Computer", "Sanskrit/Third Language"],
    nonAcademic: [],
  },
  "Class 9": {
    academic: ["English", "Hindi", "Mathematics", "Science", "Social Science", "Computer/Information Technology", "Third Language"],
    nonAcademic: [],
  },
  "Class 10": {
    academic: ["English", "Hindi", "Mathematics", "Science", "Social Science", "Computer/Information Technology", "Third Language"],
    nonAcademic: [],
  },
  "Class 11": {
    academic: ["English", "Physics", "Chemistry", "Mathematics", "Biology", "Computer Science/Informatics Practices"],
    nonAcademic: ["Physical Education"],
  },
  "Class 12": {
    academic: ["English", "Physics", "Chemistry", "Mathematics", "Biology", "Computer Science/Informatics Practices"],
    nonAcademic: ["Physical Education"],
  },
}

export const getDefaultSubjectsForClass = (className) => {
  if (INITIAL_CLASS_SUBJECTS_MAP[className]) {
    return {
      academic: [...INITIAL_CLASS_SUBJECTS_MAP[className].academic],
      nonAcademic: [...INITIAL_CLASS_SUBJECTS_MAP[className].nonAcademic],
    }
  }
  return {
    academic: ["English", "Hindi", "Mathematics", "Science", "Social Science"],
    nonAcademic: ["Art & Craft", "Physical Education"],
  }
}

export const getInitialClassSubjectConfig = (
  classList = INITIAL_DEFAULT_CLASSES,
  sectionMap = {}
) => {
  const config = {}
  classList.forEach((cls) => {
    const isSenior = isSeniorSecondaryClass(cls)
    const defaults = getDefaultSubjectsForClass(cls)
    const sections =
      sectionMap[cls] && sectionMap[cls].length > 0
        ? sectionMap[cls]
        : getDefaultSectionsForClass(cls)
    const sectionObj = {}

    if (isSenior) {
      sections.forEach((sec) => {
        const streamDefaults = getDefaultSubjectsForStreamSection(sec)
        sectionObj[sec] = {
          academic: [...streamDefaults.academic],
          nonAcademic: [...streamDefaults.nonAcademic],
        }
      })
      config[cls] = {
        isSameForAllSections: false,
        shared: {
          academic: [...defaults.academic],
          nonAcademic: [...defaults.nonAcademic],
        },
        sections: sectionObj,
      }
    } else {
      sections.forEach((sec) => {
        sectionObj[sec] = {
          academic: [...defaults.academic],
          nonAcademic: [...defaults.nonAcademic],
        }
      })
      config[cls] = {
        isSameForAllSections: true,
        shared: {
          academic: [...defaults.academic],
          nonAcademic: [...defaults.nonAcademic],
        },
        sections: sectionObj,
      }
    }
  })
  return config
}

export const INITIAL_DEFAULT_WINGS = [
  { id: "pre-primary", name: "Pre-Primary", classes: ["Nursery", "LKG", "UKG"] },
  { id: "primary", name: "Primary", classes: ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"] },
  { id: "middle", name: "Middle", classes: ["Class 6", "Class 7", "Class 8"] },
  { id: "secondary", name: "Secondary", classes: ["Class 9", "Class 10"] },
  { id: "senior-secondary", name: "Senior Secondary", classes: ["Class 11", "Class 12"] },
]

export const INITIAL_DEFAULT_HOUSES = [
  { name: "Red House", color: "#EF4444", emblem_url: "" },
  { name: "Blue House", color: "#3B82F6", emblem_url: "" },
  { name: "Green House", color: "#10B981", emblem_url: "" },
  { name: "Yellow House", color: "#F59E0B", emblem_url: "" },
]

export const getInitialWingsForClasses = (classList = INITIAL_DEFAULT_CLASSES) => {
  const wings = [
    { id: "pre-primary", name: "Pre-Primary", classes: [] },
    { id: "primary", name: "Primary", classes: [] },
    { id: "middle", name: "Middle", classes: [] },
    { id: "secondary", name: "Secondary", classes: [] },
    { id: "senior-secondary", name: "Senior Secondary", classes: [] },
  ]

  classList.forEach((c) => {
    const lower = c.toLowerCase().trim()
    if (
      lower.includes("nursery") ||
      lower.includes("lkg") ||
      lower.includes("ukg") ||
      lower.includes("kg") ||
      lower.includes("play") ||
      lower.includes("pre")
    ) {
      wings[0].classes.push(c)
    } else if (
      /^(class\s*|grade\s*)?(1|2|3|4|5)(st|nd|rd|th)?$/i.test(lower) ||
      /^[1-5]$/.test(lower)
    ) {
      wings[1].classes.push(c)
    } else if (
      /^(class\s*|grade\s*)?(6|7|8)(th)?$/i.test(lower) ||
      /^[6-8]$/.test(lower)
    ) {
      wings[2].classes.push(c)
    } else if (
      /^(class\s*|grade\s*)?(9|10)(th)?$/i.test(lower) ||
      /^(9|10)$/.test(lower)
    ) {
      wings[3].classes.push(c)
    } else if (
      /^(class\s*|grade\s*)?(11|12)(th)?$/i.test(lower) ||
      /^(11|12)$/.test(lower)
    ) {
      wings[4].classes.push(c)
    } else {
      wings[1].classes.push(c)
    }
  })

  return wings.filter((w) => w.classes.length > 0)
}
