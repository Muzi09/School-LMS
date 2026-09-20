import { PINCODE_REGEX, PIN_REGEX } from "./patterns"

// Constraints
export const MAX_EMBLEM_SIZE_BYTES = 5 * 1024 * 1024
export const VALID_EMBLEM_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"]

/**
 * Validates school emblem upload file size and type
 * @param {File} file
 * @returns {{ isValid: boolean, error: string | null }}
 */
export const validateEmblemFile = (file) => {
  if (!file) {
    return { isValid: false, error: "No file selected." }
  }
  if (file.size > MAX_EMBLEM_SIZE_BYTES) {
    return { isValid: false, error: "Image size must be 5 MB or less." }
  }
  if (!VALID_EMBLEM_TYPES.includes(file.type)) {
    return { isValid: false, error: "Supported image formats: PNG, JPG, JPEG, WEBP." }
  }
  return { isValid: true, error: null }
}

/**
 * Validates Step 1: School Profile
 * @param {Object} data
 * @returns {string | null} Error message or null if valid
 */
export const validateSchoolProfileStep = ({
  schoolName = "",
  schoolCode = "",
  addressStreet = "",
  addressCity = "",
  addressState = "",
  addressPincode = "",
}) => {
  if (!schoolName.trim()) {
    return "Please enter the School Name."
  }
  if (!schoolCode.trim()) {
    return "Please enter the Affiliation Code."
  }
  if (!addressStreet.trim()) {
    return "Please provide the Street / Building / Area address."
  }
  if (!addressCity.trim()) {
    return "Please provide the City / District."
  }
  if (!addressState.trim()) {
    return "Please select the State / Union Territory."
  }
  if (!addressPincode.trim() || !PINCODE_REGEX.test(addressPincode.trim())) {
    return "Please enter a valid 6-digit Indian PIN Code."
  }
  return null
}

/**
 * Validates Step 2: Classes
 * @param {Array<string>} classesList
 * @returns {string | null} Error message or null if valid
 */
export const validateClassesStep = (classesList = []) => {
  if (classesList.length === 0) {
    return "Please configure at least one class for your school."
  }
  return null
}

/**
 * Validates Step 3: Sections
 * @param {Array<string>} classesList
 * @param {Object} classSectionMap
 * @returns {string | null} Error message or null if valid
 */
export const validateSectionsStep = (classesList = [], classSectionMap = {}) => {
  const hasEmptySection = classesList.some(
    (c) => !classSectionMap[c] || classSectionMap[c].length === 0
  )
  if (hasEmptySection) {
    return "Every class must have at least one section assigned."
  }
  return null
}

/**
 * Validates Step 4: Subjects
 * @param {Array<string>} classesList
 * @param {Object} classSubjectConfig
 * @param {Object} classSectionMap
 * @returns {string | null} Error message or null if valid
 */
export const validateSubjectsStep = (
  classesList = [],
  classSubjectConfig = {},
  classSectionMap = {}
) => {
  const unconfiguredClass = classesList.find((cls) => {
    const conf = classSubjectConfig[cls]
    if (!conf) return true
    if (conf.isSameForAllSections) {
      const count =
        (conf.shared?.academic?.length || 0) + (conf.shared?.nonAcademic?.length || 0)
      return count === 0
    } else {
      const sections = classSectionMap[cls] || []
      return sections.some((sec) => {
        const secConf = conf.sections?.[sec]
        if (!secConf) return true
        const count =
          (secConf.academic?.length || 0) + (secConf.nonAcademic?.length || 0)
        return count === 0
      })
    }
  })

  if (unconfiguredClass) {
    return `Please assign at least one subject to ${unconfiguredClass} before proceeding.`
  }
  return null
}

/**
 * Validates Step 5: Wings
 * @param {Array<Object>} wingsList
 * @returns {string | null} Error message or null if valid
 */
export const validateWingsStep = (wingsList = []) => {
  if (wingsList.length === 0) {
    return "Please configure at least one academic wing."
  }
  const emptyWing = wingsList.find((w) => !w.name || !w.name.trim())
  if (emptyWing) {
    return "All wings must have a valid name."
  }
  return null
}

/**
 * Validates Step 6: Houses
 * @param {Array<Object>} housesList
 * @param {boolean} useHouses
 * @param {Function} normalizeHexColor
 * @returns {string | null} Error message or null if valid
 */
export const validateHousesStep = (
  housesList = [],
  useHouses = true,
  normalizeHexColor = (c) => c
) => {
  if (!useHouses) return null

  if (housesList.length > 4) {
    return "Maximum 4 houses allowed."
  }

  const colors = housesList
    .map((h) => (normalizeHexColor ? normalizeHexColor(h.color) : h.color))
    .filter(Boolean)
  const uniqueColors = new Set(colors)
  if (colors.length !== uniqueColors.size) {
    return "Each house must have a unique color."
  }
  return null
}

/**
 * Validates Step 7: Credentials (Password & PIN)
 * @param {Object} credentials
 * @returns {string | null} Error message or null if valid
 */
export const validateCredentialsStep = ({
  password = "",
  confirmPassword = "",
  pin = "",
  confirmPin = "",
}) => {
  if (password.length < 8) {
    return "Password must be at least 8 characters."
  }
  if (password !== confirmPassword) {
    return "Password and Confirm Password do not match."
  }
  if (!PIN_REGEX.test(pin)) {
    return "Quick Login PIN must be 4 to 10 numeric digits."
  }
  if (pin !== confirmPin) {
    return "PIN and Confirm PIN do not match."
  }
  return null
}

/**
 * Validates inline house form editing
 * @param {Object} params
 * @returns {string | null} Error message or null if valid
 */
export const validateHouseInlineEdit = ({
  name = "",
  color = "",
  editingIdx = null,
  isColorUsedByOtherHouse = null,
}) => {
  const trimmed = (name || "").trim()
  if (!trimmed) {
    return "House name is required."
  }
  if (isColorUsedByOtherHouse && isColorUsedByOtherHouse(color, editingIdx)) {
    return "This color is already used by another house. Please select a unique color."
  }
  return null
}

/**
 * Comprehensive step validator for the School Setup Wizard
 * @param {number} step
 * @param {Object} state
 * @returns {string | null} Error message or null if step is valid
 */
export const validateSetupWizardStep = (step, state) => {
  switch (step) {
    case 1:
      return validateSchoolProfileStep({
        schoolName: state.schoolName,
        schoolCode: state.schoolCode,
        addressStreet: state.addressStreet,
        addressCity: state.addressCity,
        addressState: state.addressState,
        addressPincode: state.addressPincode,
      })
    case 2:
      return validateClassesStep(state.classesList)
    case 3:
      return validateSectionsStep(state.classesList, state.classSectionMap)
    case 4:
      return validateSubjectsStep(
        state.classesList,
        state.classSubjectConfig,
        state.classSectionMap
      )
    case 5:
      return validateWingsStep(state.wingsList)
    case 6:
      return validateHousesStep(
        state.housesList,
        state.useHouses,
        state.normalizeHexColor
      )
    case 7:
      return validateCredentialsStep({
        password: state.password,
        confirmPassword: state.confirmPassword,
        pin: state.pin,
        confirmPin: state.confirmPin,
      })
    default:
      return null
  }
}
