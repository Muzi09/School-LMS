import React, { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useSearchParams, useNavigate, Link } from "react-router-dom"
import {
  Building2,
  MapPin,
  BookOpen,
  Layers,
  Shield,
  Palette,
  Upload,
  Image as ImageIcon,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
  Hash,
  Loader2,
  RotateCcw,
  Check,
  Mail,
  Phone,
  Edit3,
  X,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Copy,
  Grid,
  List as ListIcon,
  CheckSquare,
  Square,
  Bookmark,
  Award,
  Compass,
  Pipette,
  GraduationCap,
  ArrowRightLeft,
  SlidersHorizontal,
  Search,
  Sliders,
  Split,
  Combine,
  HelpCircle,
} from "lucide-react"
import { authService } from "@/api/authService"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  validateEmblemFile,
  validateSetupWizardStep,
  validateHouseInlineEdit,
} from "@/validations"
import {
  INDIAN_STATES,
  THEME_COLOR_PRESETS,
  CURATED_HOUSE_PALETTE,
  INITIAL_DEFAULT_CLASSES,
  INITIAL_DEFAULT_SECTIONS,
  SENIOR_SECONDARY_DEFAULT_SECTIONS,
  STREAM_DEFAULT_SUBJECTS,
  isSeniorSecondaryClass,
  getDefaultSectionsForClass,
  getDefaultSubjectsForStreamSection,
  INITIAL_CLASS_SUBJECTS_MAP,
  getDefaultSubjectsForClass,
  getInitialClassSubjectConfig,
  INITIAL_DEFAULT_WINGS,
  INITIAL_DEFAULT_HOUSES,
  getInitialWingsForClasses,
} from "@/constants"

export function SchoolSetupWizard() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const token = searchParams.get("token") || ""
  const emblemInputRef = useRef(null)
  const houseEmblemInputRef = useRef(null)

  // Validation / Loading States
  const [isValidating, setIsValidating] = useState(true)
  const [tokenError, setTokenError] = useState(null)
  const [principalInfo, setPrincipalInfo] = useState(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [setupSuccess, setSetupSuccess] = useState(false)
  const [countdown, setCountdown] = useState(7)
  const [lastSavedTime, setLastSavedTime] = useState(null)

  // Step 1: School Identity & Profile
  const [emblemPreviewUrl, setEmblemPreviewUrl] = useState("")
  const [emblemUploadedUrl, setEmblemUploadedUrl] = useState("")
  const [isUploadingEmblem, setIsUploadingEmblem] = useState(false)
  const [emblemUploadError, setEmblemUploadError] = useState(null)

  const [schoolName, setSchoolName] = useState("")
  const [schoolCode, setSchoolCode] = useState("")
  const [schoolEmail, setSchoolEmail] = useState("")
  const [schoolPhone, setSchoolPhone] = useState("")

  const [addressStreet, setAddressStreet] = useState("")
  const [addressLandmark, setAddressLandmark] = useState("")
  const [addressCity, setAddressCity] = useState("")
  const [addressState, setAddressState] = useState("Delhi")
  const [addressPincode, setAddressPincode] = useState("")

  const [primaryColor, setPrimaryColor] = useState("#FFFFFF")

  // Step 2: Classes
  const [classesList, setClassesList] = useState(INITIAL_DEFAULT_CLASSES)
  const [editingClassIdx, setEditingClassIdx] = useState(null)
  const [editingClassName, setEditingClassName] = useState("")
  const [isAddingClass, setIsAddingClass] = useState(false)
  const [newClassName, setNewClassName] = useState("")
  const [newClassPosition, setNewClassPosition] = useState("end") // "end", "start", "after", "before"
  const [targetClassAnchor, setTargetClassAnchor] = useState(INITIAL_DEFAULT_CLASSES[0] || "")

  // Live Drag-and-Drop state with real-time physical displacement
  const [classDragState, setClassDragState] = useState({
    isDragging: false,
    dragIndex: null,
    targetIndex: null,
    startY: 0,
    currentY: 0,
    itemHeight: 52,
    cardWidth: 0,
    cardHeight: 0,
    cardLeft: 0,
    cardTop: 0,
  })
  const classDragRef = useRef({
    isDragging: false,
    dragIndex: null,
    targetIndex: null,
    startY: 0,
    currentY: 0,
    itemHeight: 52,
    cardWidth: 0,
    cardHeight: 0,
    cardLeft: 0,
    cardTop: 0,
  })
  const classesContainerRef = useRef(null)

  // Step 3: Sections (Per-Class Management & Horizontal Drag-and-Drop)
  const [classSectionMap, setClassSectionMap] = useState(() => {
    const map = {}
    INITIAL_DEFAULT_CLASSES.forEach((c) => {
      map[c] = getDefaultSectionsForClass(c)
    })
    return map
  })
  const [editingSectionState, setEditingSectionState] = useState(null) // { className, index } | null
  const [editingSectionNameVal, setEditingSectionNameVal] = useState("")
  const [addingSectionForClass, setAddingSectionForClass] = useState(null) // className | null
  const [newSectionForClassName, setNewSectionForClassName] = useState("")

  // Section Drag and Drop State (2D multi-row aware)
  const [sectionDragState, setSectionDragState] = useState({
    isDragging: false,
    className: null,
    dragIndex: null,
    targetIndex: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    slotRects: [],
    cardWidth: 0,
    cardHeight: 0,
    cardLeft: 0,
    cardTop: 0,
  })
  const sectionDragRef = useRef({
    isDragging: false,
    className: null,
    dragIndex: null,
    targetIndex: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    slotRects: [],
    cardWidth: 0,
    cardHeight: 0,
    cardLeft: 0,
    cardTop: 0,
  })

  // Step 4: Subjects
  // Step 4: Class-first Subject Management State
  const [classSubjectConfig, setClassSubjectConfig] = useState(() =>
    getInitialClassSubjectConfig(INITIAL_DEFAULT_CLASSES, {
      ...INITIAL_DEFAULT_CLASSES.reduce((acc, c) => ({ ...acc, [c]: getDefaultSectionsForClass(c) }), {})
    })
  )
  const [subjectSearchQuery, setSubjectSearchQuery] = useState("")
  const [collapsedClassMap, setCollapsedClassMap] = useState({}) // { [className]: boolean }
  const [unifyModalState, setUnifyModalState] = useState(null) // { className, sections, firstSection } | null
  const [editingSubjectState, setEditingSubjectState] = useState(null) // { className, sectionName, category, index } | null
  const [editingSubjectNameVal, setEditingSubjectNameVal] = useState("")
  const [addingSubjectInline, setAddingSubjectInline] = useState(null) // { className, sectionName, category } | null
  const [addingSubjectInputVal, setAddingSubjectInputVal] = useState("")
  const [addingSubjectCategoryVal, setAddingSubjectCategoryVal] = useState("academic")
  const [copyClassModal, setCopyClassModal] = useState(null) // { targetClass, selectedSourceClass } | null
  const [subjectFeedbackMessage, setSubjectFeedbackMessage] = useState(null)

  // Drag and drop active states
  const [draggedSubject, setDraggedSubject] = useState(null) // { className, sectionName, category, index, name }
  const [dragOverCategory, setDragOverCategory] = useState(null) // { className, sectionName, category, index }

  // Step 5: Wings
  const [useWings, setUseWings] = useState(true)
  const [wingsList, setWingsList] = useState(() => getInitialWingsForClasses(INITIAL_DEFAULT_CLASSES))
  const [editingWingIdx, setEditingWingIdx] = useState(null)
  const [editingWingNameVal, setEditingWingNameVal] = useState("")
  const [isAddingCustomWing, setIsAddingCustomWing] = useState(false)
  const [newCustomWingName, setNewCustomWingName] = useState("")
  const [draggedClassData, setDraggedClassData] = useState(null)
  const [dragOverArea, setDragOverArea] = useState(null)

  // Step 6: Houses (Optional, Max 4)
  const [useHouses, setUseHouses] = useState(true)
  const [housesList, setHousesList] = useState(INITIAL_DEFAULT_HOUSES)
  const [editingHouseIdx, setEditingHouseIdx] = useState(null)
  const [houseFormName, setHouseFormName] = useState("")
  const [houseFormColor, setHouseFormColor] = useState("#EF4444")
  const [houseFormEmblem, setHouseFormEmblem] = useState("")
  const [isUploadingHouseEmblem, setIsUploadingHouseEmblem] = useState(false)
  const [houseEmblemError, setHouseEmblemError] = useState(null)
  const [isAddingHouse, setIsAddingHouse] = useState(false)

  // Step 7: Password & PIN
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showPin, setShowPin] = useState(false)

  // Sync wingsList with classesList: prune deleted classes & remove wings that have become empty
  useEffect(() => {
    setWingsList((prev) => {
      const updated = prev.map((w) => ({
        ...w,
        classes: (w.classes || []).filter((c) => classesList.includes(c)),
      }))
      return updated.filter((w) => w.classes.length > 0)
    })
  }, [classesList])

  // Synchronize classSubjectConfig with classesList & classSectionMap
  useEffect(() => {
    setClassSubjectConfig((prev) => {
      const next = { ...prev }
      let changed = false

      // 1. Remove deleted classes
      Object.keys(next).forEach((cls) => {
        if (!classesList.includes(cls)) {
          delete next[cls]
          changed = true
        }
      })

      // 2. Add new classes or sync sections
      classesList.forEach((cls) => {
        const sections = classSectionMap[cls] && classSectionMap[cls].length > 0 ? classSectionMap[cls] : getDefaultSectionsForClass(cls)
        const isSenior = isSeniorSecondaryClass(cls)
        if (!next[cls]) {
          const defaults = getDefaultSubjectsForClass(cls)
          const sectionObj = {}
          if (isSenior) {
            sections.forEach((sec) => {
              const streamDefaults = getDefaultSubjectsForStreamSection(sec)
              sectionObj[sec] = {
                academic: [...streamDefaults.academic],
                nonAcademic: [...streamDefaults.nonAcademic],
              }
            })
            next[cls] = {
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
            next[cls] = {
              isSameForAllSections: true,
              shared: {
                academic: [...defaults.academic],
                nonAcademic: [...defaults.nonAcademic],
              },
              sections: sectionObj,
            }
          }
          changed = true
        } else {
          const existingSecs = next[cls].sections || {}
          let secChanged = false
          const newSecObj = {}
          sections.forEach((sec) => {
            if (existingSecs[sec]) {
              newSecObj[sec] = existingSecs[sec]
            } else {
              const streamDefaults = isSenior ? getDefaultSubjectsForStreamSection(sec) : (next[cls].shared || getDefaultSubjectsForClass(cls))
              newSecObj[sec] = {
                academic: [...(streamDefaults.academic || [])],
                nonAcademic: [...(streamDefaults.nonAcademic || [])],
              }
              secChanged = true
            }
          })
          if (Object.keys(existingSecs).length !== sections.length) {
            secChanged = true
          }
          if (secChanged) {
            next[cls] = {
              ...next[cls],
              sections: newSecObj,
            }
            changed = true
          }
        }
      })

      return changed ? next : prev
    })
  }, [classesList, classSectionMap])

  const unassignedClasses = classesList.filter(
    (c) => !wingsList.some((w) => w.classes && w.classes.includes(c))
  )

  // 1. LocalStorage Draft Key
  const draftStorageKey = token ? `school_lms_onboarding_draft_${token.slice(0, 16)}` : null

  // Restore draft from LocalStorage on mount
  useEffect(() => {
    if (!draftStorageKey) return
    try {
      const saved = localStorage.getItem(draftStorageKey)
      if (saved) {
        const data = JSON.parse(saved)
        if (data.schoolName) setSchoolName(data.schoolName)
        if (data.schoolCode) setSchoolCode(data.schoolCode)
        if (data.addressStreet) setAddressStreet(data.addressStreet)
        if (data.addressLandmark) setAddressLandmark(data.addressLandmark)
        if (data.addressCity) setAddressCity(data.addressCity)
        if (data.addressState) setAddressState(data.addressState)
        if (data.addressPincode) setAddressPincode(data.addressPincode)
        if (data.primaryColor) setPrimaryColor(data.primaryColor)
        if (data.emblemUploadedUrl) {
          setEmblemUploadedUrl(data.emblemUploadedUrl)
          setEmblemPreviewUrl(data.emblemUploadedUrl)
        }
        if (Array.isArray(data.classesList) && data.classesList.length > 0) setClassesList(data.classesList)
        if (data.classSectionMap) setClassSectionMap(data.classSectionMap)
        if (data.classSubjectConfig) {
          setClassSubjectConfig(data.classSubjectConfig)
        } else if (Array.isArray(data.classesList) && data.classesList.length > 0) {
          setClassSubjectConfig(getInitialClassSubjectConfig(data.classesList, data.classSectionMap || {}))
        }
        if (typeof data.useWings === "boolean") setUseWings(data.useWings)
        if (Array.isArray(data.wingsList) && data.wingsList.length > 0) {
          const loadedWings = data.wingsList.map((w, idx) => {
            if (Array.isArray(w.classes)) {
              return { id: w.id || `wing-${idx}`, name: w.name, classes: w.classes }
            }
            return {
              id: `wing-${idx}`,
              name: w.name,
              classes: [],
            }
          })
          setWingsList(loadedWings)
        } else if (Array.isArray(data.classesList) && data.classesList.length > 0) {
          setWingsList(getInitialWingsForClasses(data.classesList))
        }
        if (typeof data.useHouses === "boolean") setUseHouses(data.useHouses)
        if (Array.isArray(data.housesList)) setHousesList(data.housesList)
      }
    } catch (e) {
      console.warn("Failed to load onboarding draft from localStorage:", e)
    }
  }, [draftStorageKey])

  // Save draft to LocalStorage when important fields change
  const saveDraftToStorage = () => {
    if (!draftStorageKey) return
    try {
      const draft = {
        schoolName,
        schoolCode,
        addressStreet,
        addressLandmark,
        addressCity,
        addressState,
        addressPincode,
        primaryColor,
        emblemUploadedUrl,
        classesList,
        classSectionMap,
        classSubjectConfig,
        useWings,
        wingsList,
        useHouses,
        housesList,
      }
      localStorage.setItem(draftStorageKey, JSON.stringify(draft))
      setLastSavedTime(new Date())
    } catch (e) {
      console.warn("Failed to save onboarding draft:", e)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraftToStorage()
    }, 800)
    return () => clearTimeout(timer)
  }, [
    schoolName,
    schoolCode,
    addressStreet,
    addressLandmark,
    addressCity,
    addressState,
    addressPincode,
    primaryColor,
    emblemUploadedUrl,
    classesList,
    classSectionMap,
    classSubjectConfig,
    useWings,
    wingsList,
    useHouses,
    housesList,
  ])

  // Validate Onboarding Token on mount
  useEffect(() => {
    async function validate() {
      if (!token) {
        setTokenError("Missing onboarding token. Please use the setup link received in your invitation email.")
        setIsValidating(false)
        return
      }

      try {
        const res = await authService.validateOnboardingToken(token)
        setPrincipalInfo(res)
        setSchoolEmail(res.email || "")
        setSchoolPhone(res.login_mobile || "")
      } catch (err) {
        setTokenError(err.message || "Invalid or expired onboarding link.")
      } finally {
        setIsValidating(false)
      }
    }

    validate()
  }, [token])

  // 7-second countdown auto-redirect after successful setup
  useEffect(() => {
    if (!setupSuccess) return

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleProceedToLogin()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [setupSuccess])

  const handleProceedToLogin = () => {
    if (draftStorageKey) {
      localStorage.removeItem(draftStorageKey)
    }
    logout()
    navigate("/principal/login", { replace: true })
  }

  // ==========================================
  // STEP 1: School Emblem Upload Handlers
  // ==========================================
  const handleEmblemFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setEmblemUploadError(null)

    const fileValidation = validateEmblemFile(file)
    if (!fileValidation.isValid) {
      setEmblemUploadError(fileValidation.error)
      return
    }

    const localUrl = URL.createObjectURL(file)
    setEmblemPreviewUrl(localUrl)

    setIsUploadingEmblem(true)
    try {
      const res = await authService.uploadSchoolEmblem(token, file)
      setEmblemUploadedUrl(res.emblem_url)
    } catch (err) {
      setEmblemUploadError(err.message || "Failed to upload emblem.")
      setEmblemPreviewUrl("")
      setEmblemUploadedUrl("")
    } finally {
      setIsUploadingEmblem(false)
    }
  }

  const handleRemoveEmblem = () => {
    setEmblemPreviewUrl("")
    setEmblemUploadedUrl("")
    setEmblemUploadError(null)
    if (emblemInputRef.current) {
      emblemInputRef.current.value = ""
    }
  }

  // ==========================================
  // STEP 2: Classes Handlers
  // ==========================================
  const handleAddClass = () => {
    const trimmed = newClassName.trim()
    if (!trimmed) return
    if (classesList.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setSubmitError(`Class "${trimmed}" already exists.`)
      return
    }

    let updated = [...classesList]
    if (newClassPosition === "start") {
      updated.unshift(trimmed)
    } else if (newClassPosition === "after") {
      const idx = updated.indexOf(targetClassAnchor)
      if (idx !== -1) {
        updated.splice(idx + 1, 0, trimmed)
      } else {
        updated.push(trimmed)
      }
    } else if (newClassPosition === "before") {
      const idx = updated.indexOf(targetClassAnchor)
      if (idx !== -1) {
        updated.splice(idx, 0, trimmed)
      } else {
        updated.push(trimmed)
      }
    } else {
      updated.push(trimmed)
    }

    setClassesList(updated)
    // Synchronize section mapping
    const defaultSecs = getDefaultSectionsForClass(trimmed)
    setClassSectionMap((prev) => ({
      ...prev,
      [trimmed]: [...defaultSecs],
    }))
    // Synchronize subject config
    setClassSubjectConfig((prev) => {
      const isSenior = isSeniorSecondaryClass(trimmed)
      const defaults = getDefaultSubjectsForClass(trimmed)
      const secObj = {}
      if (isSenior) {
        defaultSecs.forEach((s) => {
          const streamDefaults = getDefaultSubjectsForStreamSection(s)
          secObj[s] = { academic: [...streamDefaults.academic], nonAcademic: [...streamDefaults.nonAcademic] }
        })
        return {
          ...prev,
          [trimmed]: {
            isSameForAllSections: false,
            shared: { academic: [...defaults.academic], nonAcademic: [...defaults.nonAcademic] },
            sections: secObj,
          },
        }
      } else {
        defaultSecs.forEach((s) => {
          secObj[s] = { academic: [...defaults.academic], nonAcademic: [...defaults.nonAcademic] }
        })
        return {
          ...prev,
          [trimmed]: {
            isSameForAllSections: true,
            shared: { academic: [...defaults.academic], nonAcademic: [...defaults.nonAcademic] },
            sections: secObj,
          },
        }
      }
    })

    setNewClassName("")
    setIsAddingClass(false)
    setSubmitError(null)
  }

  const handleSaveEditClass = (index) => {
    const trimmed = editingClassName.trim()
    if (!trimmed) return
    const oldName = classesList[index]
    if (
      oldName.toLowerCase() !== trimmed.toLowerCase() &&
      classesList.some((c) => c.toLowerCase() === trimmed.toLowerCase())
    ) {
      setSubmitError(`Class "${trimmed}" already exists.`)
      return
    }

    const updated = [...classesList]
    updated[index] = trimmed
    setClassesList(updated)

    // Update section map keys
    if (oldName !== trimmed) {
      setClassSectionMap((prev) => {
        const copy = { ...prev }
        copy[trimmed] = copy[oldName] || getDefaultSectionsForClass(trimmed)
        delete copy[oldName]
        return copy
      })
      // Update subject config keys
      setClassSubjectConfig((prev) => {
        const copy = { ...prev }
        if (copy[oldName]) {
          copy[trimmed] = copy[oldName]
          delete copy[oldName]
        }
        return copy
      })
      // Update wing ranges
      setWingsList((prev) =>
        prev.map((w) => ({
          ...w,
          startClass: w.startClass === oldName ? trimmed : w.startClass,
          endClass: w.endClass === oldName ? trimmed : w.endClass,
        }))
      )
    }

    setEditingClassIdx(null)
    setEditingClassName("")
    setSubmitError(null)
  }

  const handleDeleteClass = (index) => {
    const target = classesList[index]
    if (classesList.length <= 1) {
      setSubmitError("Your school must have at least one class configured.")
      return
    }
    const updated = classesList.filter((_, idx) => idx !== index)
    setClassesList(updated)

    setClassSectionMap((prev) => {
      const copy = { ...prev }
      delete copy[target]
      return copy
    })
    setClassSubjectConfig((prev) => {
      const copy = { ...prev }
      delete copy[target]
      return copy
    })
    setSubmitError(null)
  }

  const handleResetClassesToDefault = () => {
    setClassesList([...INITIAL_DEFAULT_CLASSES])
    setEditingClassIdx(null)
    setEditingClassName("")
    setIsAddingClass(false)
    setNewClassName("")
    setTargetClassAnchor(INITIAL_DEFAULT_CLASSES[0] || "")

    // Reset section mappings for default classes
    const resetSecMap = {}
    INITIAL_DEFAULT_CLASSES.forEach((c) => {
      resetSecMap[c] = getDefaultSectionsForClass(c)
    })
    setClassSectionMap(resetSecMap)

    // Reset subject mappings for default classes
    setClassSubjectConfig(getInitialClassSubjectConfig(INITIAL_DEFAULT_CLASSES, resetSecMap))

    // Reset wing mappings to default classes
    setWingsList(getInitialWingsForClasses(INITIAL_DEFAULT_CLASSES))

    // Cancel any active drag
    const resetDrag = {
      isDragging: false,
      dragIndex: null,
      targetIndex: null,
      startY: 0,
      currentY: 0,
      itemHeight: 52,
      cardWidth: 0,
      cardHeight: 0,
      cardLeft: 0,
      cardTop: 0,
    }
    classDragRef.current = resetDrag
    setClassDragState(resetDrag)
    setSubmitError(null)
  }

  const handleClassDragStart = (e, index) => {
    if (e.button !== 0 && e.pointerType === "mouse") return
    if (editingClassIdx !== null) return

    const container = classesContainerRef.current
    if (!container) return

    const itemElements = Array.from(container.querySelectorAll("[data-class-item='true']"))
    if (itemElements.length === 0 || !itemElements[index]) return

    const targetEl = itemElements[index]
    const targetRect = targetEl.getBoundingClientRect()

    const itemHeight =
      itemElements.length > 1
        ? itemElements[1].getBoundingClientRect().top - itemElements[0].getBoundingClientRect().top
        : targetRect.height + 6

    const startY = e.clientY

    const newState = {
      isDragging: true,
      dragIndex: index,
      targetIndex: index,
      startY,
      currentY: startY,
      itemHeight,
      cardWidth: targetRect.width,
      cardHeight: targetRect.height,
      cardLeft: targetRect.left,
      cardTop: targetRect.top,
    }

    classDragRef.current = newState
    setClassDragState(newState)

    e.preventDefault()
  }

  // Live Drag-and-Drop event listeners for smooth physical sliding displacement
  useEffect(() => {
    if (!classDragState.isDragging) return

    const handlePointerMove = (e) => {
      const drag = classDragRef.current
      if (!drag.isDragging) return

      const currentY = e.clientY
      const container = classesContainerRef.current
      let newTargetIndex = drag.dragIndex

      if (container) {
        const itemElements = Array.from(container.querySelectorAll("[data-class-item='true']"))
        if (itemElements.length > 0) {
          let closestIdx = drag.dragIndex
          let minDistance = Infinity

          for (let i = 0; i < itemElements.length; i++) {
            const r = itemElements[i].getBoundingClientRect()
            const center = r.top + r.height / 2
            const dist = Math.abs(currentY - center)
            if (dist < minDistance) {
              minDistance = dist
              closestIdx = i
            }
          }
          newTargetIndex = closestIdx
        }

        // Auto-scroll window when dragging near viewport edges
        const viewportHeight = window.innerHeight
        const threshold = 100
        const maxScroll = 14
        if (currentY < threshold) {
          window.scrollBy(0, -Math.round(maxScroll * ((threshold - currentY) / threshold)))
        } else if (currentY > viewportHeight - threshold) {
          window.scrollBy(0, Math.round(maxScroll * ((currentY - (viewportHeight - threshold)) / threshold)))
        }
      }

      classDragRef.current.currentY = currentY
      classDragRef.current.targetIndex = newTargetIndex

      setClassDragState((prev) => ({
        ...prev,
        currentY,
        targetIndex: newTargetIndex,
      }))
    }

    const handlePointerUp = () => {
      const { isDragging, dragIndex, targetIndex } = classDragRef.current
      if (isDragging && dragIndex !== null && targetIndex !== null && dragIndex !== targetIndex) {
        setClassesList((prev) => {
          const updated = [...prev]
          const [draggedItem] = updated.splice(dragIndex, 1)
          updated.splice(targetIndex, 0, draggedItem)
          return updated
        })
      }

      const reset = {
        isDragging: false,
        dragIndex: null,
        targetIndex: null,
        startY: 0,
        currentY: 0,
        itemHeight: 52,
        cardWidth: 0,
        cardHeight: 0,
        cardLeft: 0,
        cardTop: 0,
      }
      classDragRef.current = reset
      setClassDragState(reset)
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false })
    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("pointercancel", handlePointerUp)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("pointercancel", handlePointerUp)
    }
  }, [classDragState.isDragging, classesList.length])

  // ==========================================
  // STEP 3: Class Sections Handlers (Per-Class with 2D Multi-Row Drag and Drop)
  // ==========================================
  const handleSectionDragStart = (e, clsName, index) => {
    if (e.button !== 0 && e.pointerType === "mouse") return
    if (editingSectionState?.className === clsName && editingSectionState?.index === index) return

    const classContainer = document.querySelector(`[data-sections-for="${clsName}"]`)
    if (!classContainer) return

    const itemElements = Array.from(classContainer.querySelectorAll("[data-section-item='true']"))
    if (itemElements.length === 0 || !itemElements[index]) return

    const targetEl = itemElements[index]
    const targetRect = targetEl.getBoundingClientRect()
    const slotRects = itemElements.map((el) => {
      const r = el.getBoundingClientRect()
      return { left: r.left, top: r.top, width: r.width, height: r.height }
    })

    const startX = e.clientX
    const startY = e.clientY

    const newState = {
      isDragging: true,
      className: clsName,
      dragIndex: index,
      targetIndex: index,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
      slotRects,
      cardWidth: targetRect.width,
      cardHeight: targetRect.height,
      cardLeft: targetRect.left,
      cardTop: targetRect.top,
    }

    sectionDragRef.current = newState
    setSectionDragState(newState)

    e.preventDefault()
  }

  // 2D Multi-Row Section Drag and Drop event listeners
  useEffect(() => {
    if (!sectionDragState.isDragging) return

    const handlePointerMove = (e) => {
      const drag = sectionDragRef.current
      if (!drag.isDragging) return

      const currentX = e.clientX
      const currentY = e.clientY
      const { slotRects, dragIndex } = drag
      let newTargetIndex = dragIndex

      if (slotRects && slotRects.length > 0) {
        let closestIdx = dragIndex
        let minDistance = Infinity

        for (let i = 0; i < slotRects.length; i++) {
          const r = slotRects[i]
          const centerX = r.left + r.width / 2
          const centerY = r.top + r.height / 2
          const dist = Math.hypot(currentX - centerX, currentY - centerY)
          if (dist < minDistance) {
            minDistance = dist
            closestIdx = i
          }
        }
        newTargetIndex = closestIdx
      }

      sectionDragRef.current.currentX = currentX
      sectionDragRef.current.currentY = currentY
      sectionDragRef.current.targetIndex = newTargetIndex

      setSectionDragState((prev) => ({
        ...prev,
        currentX,
        currentY,
        targetIndex: newTargetIndex,
      }))
    }

    const handlePointerUp = () => {
      const { isDragging, className, dragIndex, targetIndex } = sectionDragRef.current
      if (isDragging && className && dragIndex !== null && targetIndex !== null && dragIndex !== targetIndex) {
        setClassSectionMap((prev) => {
          const currentList = prev[className] || []
          const updated = [...currentList]
          const [draggedItem] = updated.splice(dragIndex, 1)
          updated.splice(targetIndex, 0, draggedItem)
          return {
            ...prev,
            [className]: updated,
          }
        })
      }

      const reset = {
        isDragging: false,
        className: null,
        dragIndex: null,
        targetIndex: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        slotRects: [],
        cardWidth: 0,
        cardHeight: 0,
        cardLeft: 0,
        cardTop: 0,
      }
      sectionDragRef.current = reset
      setSectionDragState(reset)
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false })
    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("pointercancel", handlePointerUp)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("pointercancel", handlePointerUp)
    }
  }, [sectionDragState.isDragging])

  const handleStartEditSection = (clsName, index, currentName) => {
    setEditingSectionState({ className: clsName, index })
    setEditingSectionNameVal(currentName)
    setAddingSectionForClass(null)
  }

  const handleSaveEditSectionForClass = (clsName, index) => {
    const trimmed = editingSectionNameVal.trim()
    if (!trimmed) return
    const currentSections = classSectionMap[clsName] || []
    const oldName = currentSections[index]

    if (
      oldName.toLowerCase() !== trimmed.toLowerCase() &&
      currentSections.some((s) => s.toLowerCase() === trimmed.toLowerCase())
    ) {
      setSubmitError(`Section "${trimmed}" already exists in ${clsName}.`)
      return
    }

    const updated = [...currentSections]
    updated[index] = trimmed
    setClassSectionMap((prev) => ({
      ...prev,
      [clsName]: updated,
    }))

    if (oldName !== trimmed) {
      setClassSubjectConfig((prev) => {
        const clsConf = prev[clsName]
        if (!clsConf || !clsConf.sections || !clsConf.sections[oldName]) return prev
        const secCopy = { ...clsConf.sections }
        secCopy[trimmed] = secCopy[oldName]
        delete secCopy[oldName]
        return {
          ...prev,
          [clsName]: {
            ...clsConf,
            sections: secCopy,
          },
        }
      })
    }

    setEditingSectionState(null)
    setEditingSectionNameVal("")
    setSubmitError(null)
  }

  const handleDeleteSectionFromClass = (clsName, index) => {
    const currentSections = classSectionMap[clsName] || []
    if (currentSections.length <= 1) {
      setSubmitError(`${clsName} must have at least one section configured.`)
      return
    }

    const deletedSec = currentSections[index]
    const updated = currentSections.filter((_, idx) => idx !== index)
    setClassSectionMap((prev) => ({
      ...prev,
      [clsName]: updated,
    }))

    if (deletedSec) {
      setClassSubjectConfig((prev) => {
        const clsConf = prev[clsName]
        if (!clsConf || !clsConf.sections || !clsConf.sections[deletedSec]) return prev
        const secCopy = { ...clsConf.sections }
        delete secCopy[deletedSec]
        return {
          ...prev,
          [clsName]: {
            ...clsConf,
            sections: secCopy,
          },
        }
      })
    }

    setSubmitError(null)
  }

  const handleAddSectionToClass = (clsName) => {
    const trimmed = newSectionForClassName.trim()
    if (!trimmed) return
    const currentSections = classSectionMap[clsName] || []
    if (currentSections.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSubmitError(`Section "${trimmed}" already exists in ${clsName}.`)
      return
    }

    const updated = [...currentSections, trimmed]
    setClassSectionMap((prev) => ({
      ...prev,
      [clsName]: updated,
    }))
    setNewSectionForClassName("")
    setAddingSectionForClass(null)
    setSubmitError(null)
  }

  const handleResetAllClassSections = () => {
    const nextMap = {}
    classesList.forEach((c) => {
      nextMap[c] = getDefaultSectionsForClass(c)
    })
    setClassSectionMap(nextMap)
    setEditingSectionState(null)
    setAddingSectionForClass(null)
    setSubmitError(null)
  }

  // ==========================================
  // STEP 4: Subjects Handlers (Class-First Redesign)
  // ==========================================
  const handleToggleClassShared = (cls) => {
    const currentConf = classSubjectConfig[cls]
    if (!currentConf) return

    if (currentConf.isSameForAllSections) {
      // Switching from Shared -> Section-specific (OFF)
      // Copy current shared subjects into each section
      const sections = classSectionMap[cls] && classSectionMap[cls].length > 0 ? classSectionMap[cls] : getDefaultSectionsForClass(cls)
      const updatedSections = {}
      sections.forEach((sec) => {
        updatedSections[sec] = {
          academic: [...(currentConf.shared?.academic || [])],
          nonAcademic: [...(currentConf.shared?.nonAcademic || [])],
        }
      })
      setClassSubjectConfig((prev) => ({
        ...prev,
        [cls]: {
          ...prev[cls],
          isSameForAllSections: false,
          sections: updatedSections,
        },
      }))
    } else {
      // Switching from Section-specific -> Shared (ON)
      const sections = classSectionMap[cls] && classSectionMap[cls].length > 0 ? classSectionMap[cls] : getDefaultSectionsForClass(cls)
      const firstSec = sections[0]
      let allSame = true
      if (firstSec && sections.length > 1) {
        const refAcad = JSON.stringify(currentConf.sections?.[firstSec]?.academic || [])
        const refNonAcad = JSON.stringify(currentConf.sections?.[firstSec]?.nonAcademic || [])
        for (let i = 1; i < sections.length; i++) {
          const sec = sections[i]
          if (
            JSON.stringify(currentConf.sections?.[sec]?.academic || []) !== refAcad ||
            JSON.stringify(currentConf.sections?.[sec]?.nonAcademic || []) !== refNonAcad
          ) {
            allSame = false
            break
          }
        }
      }

      if (allSame) {
        // Safe to switch immediately
        const sourceSec = currentConf.sections?.[firstSec] || currentConf.shared
        setClassSubjectConfig((prev) => ({
          ...prev,
          [cls]: {
            ...prev[cls],
            isSameForAllSections: true,
            shared: {
              academic: [...(sourceSec?.academic || [])],
              nonAcademic: [...(sourceSec?.nonAcademic || [])],
            },
          },
        }))
      } else {
        // Prompt Unification Confirmation Dialog
        setUnifyModalState({
          className: cls,
          sections,
          firstSection: firstSec || sections[0] || "Section A",
        })
      }
    }
  }

  const handleConfirmUnifyShared = (cls, strategy, selectedSection) => {
    const currentConf = classSubjectConfig[cls]
    if (!currentConf) return

    if (strategy === "use_section") {
      const source = currentConf.sections?.[selectedSection] || currentConf.shared
      const acad = [...(source?.academic || [])]
      const nonAcad = [...(source?.nonAcademic || [])]

      const updatedSections = {}
      const sections = classSectionMap[cls] || []
      sections.forEach((s) => {
        updatedSections[s] = { academic: [...acad], nonAcademic: [...nonAcad] }
      })

      setClassSubjectConfig((prev) => ({
        ...prev,
        [cls]: {
          ...prev[cls],
          isSameForAllSections: true,
          shared: { academic: acad, nonAcademic: nonAcad },
          sections: updatedSections,
        },
      }))
    } else if (strategy === "merge") {
      const sections = classSectionMap[cls] || []
      const mergedAcad = []
      const mergedNonAcad = []

      sections.forEach((s) => {
        const secConf = currentConf.sections?.[s]
        if (secConf) {
          ; (secConf.academic || []).forEach((sub) => {
            if (!mergedAcad.includes(sub)) mergedAcad.push(sub)
          })
            ; (secConf.nonAcademic || []).forEach((sub) => {
              if (!mergedNonAcad.includes(sub) && !mergedAcad.includes(sub)) mergedNonAcad.push(sub)
            })
        }
      })

      const updatedSections = {}
      sections.forEach((s) => {
        updatedSections[s] = { academic: [...mergedAcad], nonAcademic: [...mergedNonAcad] }
      })

      setClassSubjectConfig((prev) => ({
        ...prev,
        [cls]: {
          ...prev[cls],
          isSameForAllSections: true,
          shared: { academic: mergedAcad, nonAcademic: mergedNonAcad },
          sections: updatedSections,
        },
      }))
    }

    setUnifyModalState(null)
    setSubmitError(null)
  }

  const handleAddSubjectToClassOrSection = (cls, secOrNull, category, subjectName) => {
    const trimmed = (subjectName || "").trim()
    if (!trimmed) return

    let hasError = false
    setClassSubjectConfig((prev) => {
      const classConf = prev[cls]
      if (!classConf) return prev

      if (secOrNull === null) {
        // Shared mode
        const existingAcad = classConf.shared?.academic || []
        const existingNonAcad = classConf.shared?.nonAcademic || []
        const allExisting = [...existingAcad, ...existingNonAcad]

        if (allExisting.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
          setSubmitError(`Subject "${trimmed}" is already assigned to ${cls}.`)
          hasError = true
          return prev
        }

        const nextShared = {
          academic: category === "academic" ? [...existingAcad, trimmed] : [...existingAcad],
          nonAcademic: category === "nonAcademic" ? [...existingNonAcad, trimmed] : [...existingNonAcad],
        }

        // Sync to all sections
        const nextSections = {}
        Object.entries(classConf.sections || {}).forEach(([sName, sData]) => {
          nextSections[sName] = {
            academic: category === "academic" ? [...(sData.academic || []), trimmed] : [...(sData.academic || [])],
            nonAcademic: category === "nonAcademic" ? [...(sData.nonAcademic || []), trimmed] : [...(sData.nonAcademic || [])],
          }
        })

        return {
          ...prev,
          [cls]: {
            ...classConf,
            shared: nextShared,
            sections: nextSections,
          },
        }
      } else {
        // Section-specific mode
        const secData = classConf.sections?.[secOrNull] || { academic: [], nonAcademic: [] }
        const existingAcad = secData.academic || []
        const existingNonAcad = secData.nonAcademic || []
        const allExisting = [...existingAcad, ...existingNonAcad]

        if (allExisting.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
          setSubmitError(`Subject "${trimmed}" is already assigned to ${cls} - ${secOrNull}.`)
          hasError = true
          return prev
        }

        const nextSecData = {
          academic: category === "academic" ? [...existingAcad, trimmed] : [...existingAcad],
          nonAcademic: category === "nonAcademic" ? [...existingNonAcad, trimmed] : [...existingNonAcad],
        }

        return {
          ...prev,
          [cls]: {
            ...classConf,
            sections: {
              ...classConf.sections,
              [secOrNull]: nextSecData,
            },
          },
        }
      }
    })

    if (!hasError) {
      setAddingSubjectInline(null)
      setAddingSubjectInputVal("")
      setSubmitError(null)
    }
  }

  const handleStartEditSubject = (cls, secOrNull, category, index, currentName) => {
    setEditingSubjectState({ className: cls, sectionName: secOrNull, category, index })
    setEditingSubjectNameVal(currentName)
    setSubmitError(null)
  }

  const handleSaveEditSubjectForClassOrSection = (cls, secOrNull, category, index, newName) => {
    const trimmed = (newName || "").trim()
    if (!trimmed) return

    setClassSubjectConfig((prev) => {
      const classConf = prev[cls]
      if (!classConf) return prev

      if (secOrNull === null) {
        // Shared mode
        const existing = [...(classConf.shared?.[category] || [])]
        const oldName = existing[index]
        existing[index] = trimmed

        const nextShared = {
          ...classConf.shared,
          [category]: existing,
        }

        // Sync across sections
        const nextSections = {}
        Object.entries(classConf.sections || {}).forEach(([sName, sData]) => {
          const sArr = [...(sData[category] || [])]
          const idx = sArr.indexOf(oldName)
          if (idx !== -1) {
            sArr[idx] = trimmed
          }
          nextSections[sName] = {
            ...sData,
            [category]: sArr,
          }
        })

        return {
          ...prev,
          [cls]: {
            ...classConf,
            shared: nextShared,
            sections: nextSections,
          },
        }
      } else {
        // Section-specific mode
        const secData = classConf.sections?.[secOrNull] || { academic: [], nonAcademic: [] }
        const existing = [...(secData[category] || [])]
        existing[index] = trimmed

        return {
          ...prev,
          [cls]: {
            ...classConf,
            sections: {
              ...classConf.sections,
              [secOrNull]: {
                ...secData,
                [category]: existing,
              },
            },
          },
        }
      }
    })

    setEditingSubjectState(null)
    setEditingSubjectNameVal("")
    setSubmitError(null)
  }

  const handleDeleteSubjectFromClassOrSection = (cls, secOrNull, category, index) => {
    setClassSubjectConfig((prev) => {
      const classConf = prev[cls]
      if (!classConf) return prev

      if (secOrNull === null) {
        // Shared mode
        const existing = [...(classConf.shared?.[category] || [])]
        const oldName = existing[index]
        existing.splice(index, 1)

        const nextShared = {
          ...classConf.shared,
          [category]: existing,
        }

        const nextSections = {}
        Object.entries(classConf.sections || {}).forEach(([sName, sData]) => {
          nextSections[sName] = {
            ...sData,
            [category]: (sData[category] || []).filter((s) => s !== oldName),
          }
        })

        return {
          ...prev,
          [cls]: {
            ...classConf,
            shared: nextShared,
            sections: nextSections,
          },
        }
      } else {
        // Section-specific mode
        const secData = classConf.sections?.[secOrNull] || { academic: [], nonAcademic: [] }
        const existing = [...(secData[category] || [])]
        existing.splice(index, 1)

        return {
          ...prev,
          [cls]: {
            ...classConf,
            sections: {
              ...classConf.sections,
              [secOrNull]: {
                ...secData,
                [category]: existing,
              },
            },
          },
        }
      }
    })
    setSubmitError(null)
  }

  const handleMoveSubjectCategory = (cls, secOrNull, fromCategory, toCategory, index) => {
    setClassSubjectConfig((prev) => {
      const classConf = prev[cls]
      if (!classConf) return prev

      if (secOrNull === null) {
        // Shared mode
        const fromArr = [...(classConf.shared?.[fromCategory] || [])]
        const toArr = [...(classConf.shared?.[toCategory] || [])]
        const [movedItem] = fromArr.splice(index, 1)
        if (movedItem && !toArr.includes(movedItem)) {
          toArr.push(movedItem)
        }

        const nextShared = {
          ...classConf.shared,
          [fromCategory]: fromArr,
          [toCategory]: toArr,
        }

        const nextSections = {}
        Object.entries(classConf.sections || {}).forEach(([sName, sData]) => {
          const sFrom = (sData[fromCategory] || []).filter((s) => s !== movedItem)
          const sTo = [...(sData[toCategory] || [])]
          if (movedItem && !sTo.includes(movedItem)) {
            sTo.push(movedItem)
          }
          nextSections[sName] = {
            ...sData,
            [fromCategory]: sFrom,
            [toCategory]: sTo,
          }
        })

        return {
          ...prev,
          [cls]: {
            ...classConf,
            shared: nextShared,
            sections: nextSections,
          },
        }
      } else {
        // Section-specific mode
        const secData = classConf.sections?.[secOrNull] || { academic: [], nonAcademic: [] }
        const fromArr = [...(secData[fromCategory] || [])]
        const toArr = [...(secData[toCategory] || [])]
        const [movedItem] = fromArr.splice(index, 1)
        if (movedItem && !toArr.includes(movedItem)) {
          toArr.push(movedItem)
        }

        return {
          ...prev,
          [cls]: {
            ...classConf,
            sections: {
              ...classConf.sections,
              [secOrNull]: {
                ...secData,
                [fromCategory]: fromArr,
                [toCategory]: toArr,
              },
            },
          },
        }
      }
    })
  }

  const handleReorderSubjects = (cls, secOrNull, category, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return

    setClassSubjectConfig((prev) => {
      const classConf = prev[cls]
      if (!classConf) return prev

      if (secOrNull === null) {
        const arr = [...(classConf.shared?.[category] || [])]
        const [movedItem] = arr.splice(fromIndex, 1)
        arr.splice(toIndex, 0, movedItem)

        return {
          ...prev,
          [cls]: {
            ...classConf,
            shared: {
              ...classConf.shared,
              [category]: arr,
            },
          },
        }
      } else {
        const secData = classConf.sections?.[secOrNull] || { academic: [], nonAcademic: [] }
        const arr = [...(secData[category] || [])]
        const [movedItem] = arr.splice(fromIndex, 1)
        arr.splice(toIndex, 0, movedItem)

        return {
          ...prev,
          [cls]: {
            ...classConf,
            sections: {
              ...classConf.sections,
              [secOrNull]: {
                ...secData,
                [category]: arr,
              },
            },
          },
        }
      }
    })
  }

  const handleResetClassSubjectsToDefault = (cls) => {
    const isSenior = isSeniorSecondaryClass(cls)
    const defaults = getDefaultSubjectsForClass(cls)
    const sections = classSectionMap[cls] && classSectionMap[cls].length > 0 ? classSectionMap[cls] : getDefaultSectionsForClass(cls)
    const sectionObj = {}

    if (isSenior) {
      sections.forEach((sec) => {
        const streamDefaults = getDefaultSubjectsForStreamSection(sec)
        sectionObj[sec] = {
          academic: [...streamDefaults.academic],
          nonAcademic: [...streamDefaults.nonAcademic],
        }
      })
      setClassSubjectConfig((prev) => ({
        ...prev,
        [cls]: {
          isSameForAllSections: false,
          shared: {
            academic: [...defaults.academic],
            nonAcademic: [...defaults.nonAcademic],
          },
          sections: sectionObj,
        },
      }))
    } else {
      sections.forEach((sec) => {
        sectionObj[sec] = {
          academic: [...defaults.academic],
          nonAcademic: [...defaults.nonAcademic],
        }
      })
      setClassSubjectConfig((prev) => ({
        ...prev,
        [cls]: {
          isSameForAllSections: true,
          shared: {
            academic: [...defaults.academic],
            nonAcademic: [...defaults.nonAcademic],
          },
          sections: sectionObj,
        },
      }))
    }

    setSubjectFeedbackMessage(`Reset ${cls} to default subjects.`)
    setTimeout(() => setSubjectFeedbackMessage(null), 3000)
  }

  const handleCopySubjectsToTarget = (sourceCls, targetCls) => {
    if (!sourceCls || !targetCls) return
    const sourceConf = classSubjectConfig[sourceCls]
    if (!sourceConf) return

    const sourceAcad = [...(sourceConf.shared?.academic || [])]
    const sourceNonAcad = [...(sourceConf.shared?.nonAcademic || [])]

    setClassSubjectConfig((prev) => {
      const targetConf = prev[targetCls]
      const sections =
        classSectionMap[targetCls] && classSectionMap[targetCls].length > 0
          ? classSectionMap[targetCls]
          : getDefaultSectionsForClass(targetCls)
      const sectionObj = {}
      sections.forEach((sec) => {
        sectionObj[sec] = {
          academic: [...sourceAcad],
          nonAcademic: [...sourceNonAcad],
        }
      })

      return {
        ...prev,
        [targetCls]: {
          isSameForAllSections: targetConf ? targetConf.isSameForAllSections : true,
          shared: {
            academic: [...sourceAcad],
            nonAcademic: [...sourceNonAcad],
          },
          sections: sectionObj,
        },
      }
    })

    setSubjectFeedbackMessage(`Copied subjects from ${sourceCls} into ${targetCls}!`)
    setTimeout(() => setSubjectFeedbackMessage(null), 3500)
    setCopyClassModal(null)
  }

  const getAllUniqueSubjectsAcrossAllClasses = () => {
    const map = new Map()
    let globalOrder = 0

    classesList.forEach((cls) => {
      const conf = classSubjectConfig[cls]
      if (!conf) return

      if (conf.isSameForAllSections) {
        ; (conf.shared?.academic || []).forEach((sub) => {
          const key = sub.trim().toLowerCase()
          if (!map.has(key)) {
            globalOrder += 1
            map.set(key, { name: sub.trim(), category: "academic", is_academic: true, order_index: globalOrder })
          }
        })
          ; (conf.shared?.nonAcademic || []).forEach((sub) => {
            const key = sub.trim().toLowerCase()
            if (!map.has(key)) {
              globalOrder += 1
              map.set(key, { name: sub.trim(), category: "non_academic", is_academic: false, order_index: globalOrder })
            }
          })
      } else {
        const sections = classSectionMap[cls] || []
        sections.forEach((sec) => {
          const secConf = conf.sections?.[sec]
          if (!secConf) return
            ; (secConf.academic || []).forEach((sub) => {
              const key = sub.trim().toLowerCase()
              if (!map.has(key)) {
                globalOrder += 1
                map.set(key, { name: sub.trim(), category: "academic", is_academic: true, order_index: globalOrder })
              }
            })
            ; (secConf.nonAcademic || []).forEach((sub) => {
              const key = sub.trim().toLowerCase()
              if (!map.has(key)) {
                globalOrder += 1
                map.set(key, { name: sub.trim(), category: "non_academic", is_academic: false, order_index: globalOrder })
              }
            })
        })
      }
    })

    return Array.from(map.values())
  }

  // ==========================================
  // STEP 5: Wings Handlers
  // ==========================================
  const handleStartEditWing = (index, currentName) => {
    setEditingWingIdx(index)
    setEditingWingNameVal(currentName)
    setSubmitError(null)
  }

  const handleSaveEditWing = (index) => {
    const trimmed = editingWingNameVal.trim()
    if (!trimmed) {
      setSubmitError("Wing name cannot be empty.")
      return
    }

    if (
      wingsList.some(
        (w, i) => i !== index && w.name.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setSubmitError(`Wing "${trimmed}" already exists.`)
      return
    }

    const updated = [...wingsList]
    updated[index] = {
      ...updated[index],
      name: trimmed,
    }
    setWingsList(updated)
    setEditingWingIdx(null)
    setEditingWingNameVal("")
    setSubmitError(null)
  }

  const handleCancelEditWing = () => {
    setEditingWingIdx(null)
    setEditingWingNameVal("")
  }

  const handleDeleteWing = (index) => {
    const updated = wingsList.filter((_, idx) => idx !== index)
    setWingsList(updated)
    if (editingWingIdx === index) {
      setEditingWingIdx(null)
    }
    setSubmitError(null)
  }

  const handleAddCustomWing = () => {
    const trimmed = newCustomWingName.trim()
    if (!trimmed) return
    if (wingsList.some((w) => w.name.toLowerCase() === trimmed.toLowerCase())) {
      setSubmitError(`Wing "${trimmed}" already exists.`)
      return
    }

    setWingsList([
      ...wingsList,
      { id: `wing-${Date.now()}`, name: trimmed, classes: [] },
    ])
    setNewCustomWingName("")
    setIsAddingCustomWing(false)
    setSubmitError(null)
  }

  const handleResetWingsToDefault = () => {
    setWingsList(getInitialWingsForClasses(classesList))
    setEditingWingIdx(null)
    setSubmitError(null)
  }

  const handleRemoveClassFromWing = (wingIdx, className) => {
    const updated = [...wingsList]
    updated[wingIdx] = {
      ...updated[wingIdx],
      classes: (updated[wingIdx].classes || []).filter((c) => c !== className),
    }
    setWingsList(updated)
  }

  const handleAddClassToWing = (targetWingIdx, className) => {
    const updated = wingsList.map((w, idx) => {
      if (idx === targetWingIdx) {
        const existing = (w.classes || []).filter((c) => c !== className)
        return { ...w, classes: [...existing, className] }
      }
      return {
        ...w,
        classes: (w.classes || []).filter((c) => c !== className),
      }
    })
    setWingsList(updated)
  }

  const handleWingClassDragStart = (e, sourceWingIdx, className) => {
    setDraggedClassData({ sourceWingIdx, className })
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ sourceWingIdx, className })
    )
    e.dataTransfer.effectAllowed = "move"
  }

  const handleWingClassDragOver = (e, areaId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (dragOverArea !== areaId) {
      setDragOverArea(areaId)
    }
  }

  const handleWingClassDrop = (e, targetWingIdx) => {
    e.preventDefault()
    setDragOverArea(null)

    let data = draggedClassData
    try {
      const raw = e.dataTransfer.getData("application/json")
      if (raw) {
        data = JSON.parse(raw)
      }
    } catch {
      // fallback to state
    }

    if (!data || !data.className) return
    const { sourceWingIdx, className } = data

    if (targetWingIdx === null) {
      // Dropped onto Unassigned area
      if (sourceWingIdx !== null) {
        handleRemoveClassFromWing(sourceWingIdx, className)
      }
    } else {
      // Dropped onto a specific wing
      handleAddClassToWing(targetWingIdx, className)
    }

    setDraggedClassData(null)
  }

  const handleWingClassDragEnd = () => {
    setDraggedClassData(null)
    setDragOverArea(null)
  }

  // Auto-scroll window when dragging a wing class near viewport edges
  useEffect(() => {
    if (!draggedClassData) return

    let animationFrameId = null
    let currentMouseY = null

    const handleWindowDragOver = (e) => {
      e.preventDefault()
      currentMouseY = e.clientY
    }

    const scrollLoop = () => {
      if (currentMouseY !== null) {
        const threshold = 140
        const maxScrollSpeed = 18
        const viewportHeight = window.innerHeight

        if (currentMouseY < threshold) {
          const intensity = Math.max(0.15, (threshold - currentMouseY) / threshold)
          window.scrollBy(0, -Math.round(maxScrollSpeed * intensity))
        } else if (currentMouseY > viewportHeight - threshold) {
          const intensity = Math.max(0.15, (currentMouseY - (viewportHeight - threshold)) / threshold)
          window.scrollBy(0, Math.round(maxScrollSpeed * intensity))
        }
      }
      animationFrameId = requestAnimationFrame(scrollLoop)
    }

    window.addEventListener("dragover", handleWindowDragOver, { passive: false })
    animationFrameId = requestAnimationFrame(scrollLoop)

    return () => {
      window.removeEventListener("dragover", handleWindowDragOver)
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }
  }, [draggedClassData])

  // ==========================================
  // STEP 6: Houses Handlers
  // ==========================================
  const normalizeHexColor = (color) => {
    if (!color) return ""
    return color.trim().toUpperCase()
  }

  const isColorUsedByOtherHouse = (hex, currentHouseIdx = null) => {
    const target = normalizeHexColor(hex)
    return housesList.some((h, idx) => {
      if (currentHouseIdx !== null && idx === currentHouseIdx) return false
      return normalizeHexColor(h.color) === target
    })
  }

  const handleStartEditHouse = (index) => {
    const house = housesList[index]
    setEditingHouseIdx(index)
    setHouseFormName(house.name)
    setHouseFormColor(house.color || "#EF4444")
    setHouseFormEmblem(house.emblem_url || "")
    setHouseEmblemError(null)
    setSubmitError(null)
  }

  const handleSaveHouseInline = () => {
    if (editingHouseIdx === null) return
    const trimmed = houseFormName.trim()

    const validationError = validateHouseInlineEdit({
      name: trimmed,
      color: houseFormColor,
      editingIdx: editingHouseIdx,
      isColorUsedByOtherHouse,
    })

    if (validationError) {
      setSubmitError(validationError)
      return
    }

    const updated = [...housesList]
    updated[editingHouseIdx] = {
      ...updated[editingHouseIdx],
      name: trimmed,
      color: houseFormColor,
      emblem_url: houseFormEmblem,
      emblem: houseFormEmblem,
    }
    setHousesList(updated)
    setEditingHouseIdx(null)
    setHouseFormName("")
    setHouseFormEmblem("")
    setSubmitError(null)
  }

  const handleCancelHouseEdit = () => {
    setEditingHouseIdx(null)
    setHouseFormName("")
    setHouseFormEmblem("")
    setHouseEmblemError(null)
  }

  const handleHouseEmblemUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setHouseEmblemError(null)
    const fileValidation = validateEmblemFile(file)
    if (!fileValidation.isValid) {
      setHouseEmblemError(fileValidation.error)
      return
    }

    // Instant local preview via FileReader
    const reader = new FileReader()
    reader.onload = (loadEvt) => {
      if (loadEvt.target?.result) {
        setHouseFormEmblem(loadEvt.target.result)
      }
    }
    reader.readAsDataURL(file)

    if (token) {
      setIsUploadingHouseEmblem(true)
      try {
        const res = await authService.uploadSchoolEmblem(token, file)
        if (res?.emblem_url) {
          setHouseFormEmblem(res.emblem_url)
        }
      } catch (err) {
        console.warn("Emblem upload notice:", err)
      } finally {
        setIsUploadingHouseEmblem(false)
      }
    }
  }

  // ==========================================
  // Step Navigation & Validation
  // ==========================================
  const handleNextStep = () => {
    setSubmitError(null)

    const stepError = validateSetupWizardStep(currentStep, {
      schoolName,
      schoolCode,
      addressStreet,
      addressCity,
      addressState,
      addressPincode,
      classesList,
      classSectionMap,
      classSubjectConfig,
      wingsList,
      housesList,
      useHouses,
      normalizeHexColor,
      password,
      confirmPassword,
      pin,
      confirmPin,
    })

    if (stepError) {
      setSubmitError(stepError)
      return
    }

    setCurrentStep((prev) => prev + 1)
  }

  const handlePrevStep = () => {
    setSubmitError(null)
    setCurrentStep((prev) => Math.max(1, prev - 1))
  }

  // Formatted Address for review & backend
  const getFullFormattedAddress = () => {
    const parts = [
      addressStreet.trim(),
      addressLandmark.trim() ? `Near ${addressLandmark.trim()}` : "",
      addressCity.trim(),
      addressState.trim(),
      addressPincode.trim() ? `PIN - ${addressPincode.trim()}` : "",
    ]
    return parts.filter(Boolean).join(", ")
  }

  // ==========================================
  // Complete Setup Submission
  // ==========================================
  const handleCompleteSetup = async () => {
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const finalAddress = getFullFormattedAddress()

      // 1. Classes payload
      const classesPayload = classesList.map((cName, i) => ({
        name: cName.trim(),
        order_index: i + 1,
        sections: classSectionMap[cName] && classSectionMap[cName].length > 0 ? classSectionMap[cName] : ["A"],
      }))

      // 2. Subjects payload
      const allUniqueSubjects = getAllUniqueSubjectsAcrossAllClasses()
      const subjectsPayload = allUniqueSubjects.map((subObj) => {
        const subLower = subObj.name.toLowerCase()
        const assignedClasses = []
        const assignedSections = []

        classesList.forEach((cls) => {
          const conf = classSubjectConfig[cls]
          if (!conf) return

          if (conf.isSameForAllSections) {
            const inAcad = (conf.shared?.academic || []).some((s) => s.toLowerCase() === subLower)
            const inNonAcad = (conf.shared?.nonAcademic || []).some((s) => s.toLowerCase() === subLower)
            if (inAcad || inNonAcad) {
              assignedClasses.push(cls)
            }
          } else {
            const sections = classSectionMap[cls] || []
            sections.forEach((sec) => {
              const secConf = conf.sections?.[sec]
              if (!secConf) return
              const inAcad = (secConf.academic || []).some((s) => s.toLowerCase() === subLower)
              const inNonAcad = (secConf.nonAcademic || []).some((s) => s.toLowerCase() === subLower)
              if (inAcad || inNonAcad) {
                assignedSections.push(`${cls}::${sec}`)
              }
            })
          }
        })

        return {
          name: subObj.name,
          category: subObj.category,
          is_academic: subObj.is_academic,
          order_index: subObj.order_index,
          assigned_classes: assignedClasses,
          assigned_sections: assignedSections,
        }
      })

      // 3. Wings payload
      const wingsPayload = useWings
        ? wingsList
          .filter((w) => w.name && w.name.trim())
          .map((w, i) => ({
            name: w.name.trim(),
            order_index: i + 1,
            classes: (w.classes || []).filter((c) => classesList.includes(c)),
          }))
        : []

      // 4. Houses payload
      const housesPayload = useHouses
        ? housesList.map((h) => ({
          name: h.name.trim(),
          color: h.color ? h.color.trim() : null,
          emblem_url: h.emblem_url || null,
        }))
        : []

      await authService.completeSchoolSetup({
        token,
        school_name: schoolName.trim(),
        school_code: schoolCode.trim(),
        school_email: schoolEmail.trim().toLowerCase(),
        school_phone: schoolPhone.trim(),
        address: finalAddress,
        primary_color: primaryColor.trim() ? primaryColor.trim().toUpperCase() : null,
        emblem_url: emblemUploadedUrl || null,
        classes: classesPayload,
        subjects: subjectsPayload,
        wings: wingsPayload,
        houses: housesPayload,
        password,
        confirm_password: confirmPassword,
        pin,
        confirm_pin: confirmPin,
      })

      if (draftStorageKey) {
        localStorage.removeItem(draftStorageKey)
      }
      setSetupSuccess(true)
    } catch (err) {
      setSubmitError(err.message || "Failed to complete school setup.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Validating onboarding invitation...</p>
        </div>
      </div>
    )
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-8 text-center">
          <div className="size-14 mx-auto mb-4 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
            <AlertCircle className="size-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Invalid Onboarding Link</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{tokenError}</p>
          <div className="mt-6 flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link to="/principal/login">Go to Principal Login</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (setupSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
        <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl p-8 text-center animate-in zoom-in-95 duration-200">
          <div className="size-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-10" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">School Setup Completed!</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Congratulations <strong>{principalInfo?.first_name}</strong>! Your school workspace{" "}
            <strong>{schoolName}</strong> is now configured and active.
          </p>

          <div className="my-6 p-4 rounded-xl bg-muted/30 border border-border text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">School Name:</span>
              <strong className="text-foreground">{schoolName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Affiliation Code:</span>
              <strong className="font-mono text-foreground">{schoolCode}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Classes Configured:</span>
              <strong className="text-foreground">{classesList.length} Classes</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Configured Subjects:</span>
              <strong className="text-foreground">{getAllUniqueSubjectsAcrossAllClasses().length} Subjects</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">General Login:</span>
              <span className="text-foreground">Email + Password</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quick PIN Login:</span>
              <span className="text-foreground">Email + PIN</span>
            </div>
          </div>

          <div className="p-3.5 mb-5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary font-medium flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin shrink-0" />
            <span>
              Redirecting to Principal Login in <strong>{countdown}</strong> seconds...
            </span>
          </div>

          <Button
            onClick={handleProceedToLogin}
            className="w-full h-11 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md cursor-pointer"
          >
            Sign In to School Portal Now <ArrowRight className="size-4 ml-2" />
          </Button>
        </div>
      </div>
    )
  }

  const renderSubjectBucket = ({
    className,
    sectionName,
    category,
    categoryLabel,
    categoryIcon: CatIcon,
    accentColor,
    badgeBg,
    subjects,
    otherCategory,
    otherCategoryLabel,
  }) => {
    const isAdding =
      addingSubjectInline?.className === className &&
      addingSubjectInline?.sectionName === sectionName &&
      addingSubjectInline?.category === category

    const isDragOverThisBucket =
      dragOverCategory?.className === className &&
      dragOverCategory?.sectionName === sectionName &&
      dragOverCategory?.category === category

    return (
      <div
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = "move"
          if (
            dragOverCategory?.className !== className ||
            dragOverCategory?.sectionName !== sectionName ||
            dragOverCategory?.category !== category
          ) {
            setDragOverCategory({ className, sectionName, category })
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            if (
              dragOverCategory?.className === className &&
              dragOverCategory?.sectionName === sectionName &&
              dragOverCategory?.category === category
            ) {
              setDragOverCategory(null)
            }
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragOverCategory(null)
          if (!draggedSubject) return

          if (
            draggedSubject.className === className &&
            draggedSubject.sectionName === sectionName
          ) {
            if (draggedSubject.category === category) {
              handleReorderSubjects(
                className,
                sectionName,
                category,
                draggedSubject.index,
                subjects.length - 1
              )
            } else {
              handleMoveSubjectCategory(
                className,
                sectionName,
                draggedSubject.category,
                category,
                draggedSubject.index
              )
            }
          }
          setDraggedSubject(null)
        }}
        className={`rounded-xl border p-3.5 space-y-3 transition-all duration-200 ${isDragOverThisBucket
          ? "border-primary/60 bg-primary/5 ring-2 ring-primary/20 shadow-xs"
          : "border-border/70 bg-card/60"
          }`}
      >
        {/* Bucket Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CatIcon className={`size-4 ${accentColor}`} />
            <span className="text-xs font-bold text-foreground">{categoryLabel}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeBg}`}>
              {subjects.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setAddingSubjectInline({ className, sectionName, category })
              setAddingSubjectInputVal("")
              setAddingSubjectCategoryVal(category)
            }}
            className="text-[11px] font-semibold text-primary hover:text-primary/80 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="size-3" />
            <span>Add</span>
          </button>
        </div>

        {/* Inline Add Subject Input matching Section tab */}
        {isAdding && (
          <div className="flex items-center justify-between w-full h-9 min-h-9 max-h-9 px-2.5 rounded-xl border border-primary/50 ring-1 ring-primary/30 bg-card shadow-sm animate-in fade-in-50 duration-150 select-none box-border overflow-hidden">
            <input
              type="text"
              placeholder={`Subject name...`}
              value={addingSubjectInputVal}
              onChange={(e) => setAddingSubjectInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAddSubjectToClassOrSection(
                    className,
                    sectionName,
                    category,
                    addingSubjectInputVal
                  )
                } else if (e.key === "Escape") {
                  setAddingSubjectInline(null)
                  setAddingSubjectInputVal("")
                }
              }}
              className="h-6 text-xs font-semibold px-1.5 py-0 flex-1 min-w-0 mr-1 rounded-md border border-primary/40 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary"
              autoFocus
            />
            <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-border/60">
              <button
                type="button"
                onClick={() =>
                  handleAddSubjectToClassOrSection(
                    className,
                    sectionName,
                    category,
                    addingSubjectInputVal
                  )
                }
                className="size-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-colors cursor-pointer"
                title="Save Subject"
                aria-label="Save Subject"
              >
                <Check className="size-3.5 stroke-[2.5]" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingSubjectInline(null)
                  setAddingSubjectInputVal("")
                }}
                className="size-6 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-colors cursor-pointer"
                title="Cancel"
                aria-label="Cancel"
              >
                <X className="size-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}

        {/* Subjects List */}
        {subjects.length > 0 ? (
          <div className="space-y-1.5 min-h-[44px]">
            {subjects.map((sub, idx) => {
              const isEditing =
                editingSubjectState?.className === className &&
                editingSubjectState?.sectionName === sectionName &&
                editingSubjectState?.category === category &&
                editingSubjectState?.index === idx

              if (isEditing) {
                return (
                  <div
                    key={`${sub}-${idx}`}
                    className="group flex items-center justify-between w-full h-9 min-h-9 max-h-9 px-2.5 rounded-xl border border-primary/50 ring-1 ring-primary/30 bg-card text-xs font-semibold text-foreground shadow-sm select-none box-border overflow-hidden"
                  >
                    <input
                      type="text"
                      value={editingSubjectNameVal}
                      onChange={(e) => setEditingSubjectNameVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleSaveEditSubjectForClassOrSection(
                            className,
                            sectionName,
                            category,
                            idx,
                            editingSubjectNameVal
                          )
                        } else if (e.key === "Escape") {
                          setEditingSubjectState(null)
                          setEditingSubjectNameVal("")
                        }
                      }}
                      className="h-6 text-xs font-semibold px-2 py-0 flex-1 min-w-0 mr-1.5 rounded-md border border-primary/40 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary"
                      autoFocus
                    />

                    {/* Right-aligned Save (Green Tick) and Cancel (Red Cross) Icons */}
                    <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-border/60">
                      <button
                        type="button"
                        onClick={() =>
                          handleSaveEditSubjectForClassOrSection(
                            className,
                            sectionName,
                            category,
                            idx,
                            editingSubjectNameVal
                          )
                        }
                        className="size-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-colors cursor-pointer"
                        title="Save"
                        aria-label="Save"
                      >
                        <Check className="size-3.5 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSubjectState(null)
                          setEditingSubjectNameVal("")
                        }}
                        className="size-6 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-colors cursor-pointer"
                        title="Cancel"
                        aria-label="Cancel"
                      >
                        <X className="size-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                )
              }

              const isBeingDragged =
                draggedSubject?.className === className &&
                draggedSubject?.sectionName === sectionName &&
                draggedSubject?.category === category &&
                draggedSubject?.index === idx

              return (
                <div
                  key={`${sub}-${idx}`}
                  draggable
                  onDragStart={(e) => {
                    setDraggedSubject({
                      className,
                      sectionName,
                      category,
                      index: idx,
                      name: sub,
                    })
                    e.dataTransfer.setData(
                      "text/plain",
                      JSON.stringify({
                        className,
                        sectionName,
                        category,
                        index: idx,
                        name: sub,
                      })
                    )
                    e.dataTransfer.effectAllowed = "move"
                  }}
                  onDragEnd={() => {
                    setDraggedSubject(null)
                    setDragOverCategory(null)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    e.dataTransfer.dropEffect = "move"
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!draggedSubject) return

                    if (
                      draggedSubject.className === className &&
                      draggedSubject.sectionName === sectionName
                    ) {
                      if (draggedSubject.category === category) {
                        handleReorderSubjects(
                          className,
                          sectionName,
                          category,
                          draggedSubject.index,
                          idx
                        )
                      } else {
                        handleMoveSubjectCategory(
                          className,
                          sectionName,
                          draggedSubject.category,
                          category,
                          draggedSubject.index
                        )
                      }
                    }
                    setDraggedSubject(null)
                    setDragOverCategory(null)
                  }}
                  className={`group flex items-center justify-between p-2 rounded-xl border text-xs select-none transition-all duration-150 ${isBeingDragged
                    ? "opacity-40 border-dashed border-primary bg-primary/10"
                    : "border-border/70 bg-card hover:border-border hover:shadow-xs hover:bg-muted/30"
                    }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0 pr-1">
                    <span
                      className="text-muted-foreground/50 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing p-0.5 shrink-0"
                      title="Drag to reorder or move to other category"
                    >
                      <GripVertical className="size-3.5" />
                    </span>
                    <span className="font-semibold text-foreground truncate">{sub}</span>
                  </div>

                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 shrink-0 transition-opacity">
                    {/* Move between categories button */}
                    <button
                      type="button"
                      onClick={() =>
                        handleMoveSubjectCategory(
                          className,
                          sectionName,
                          category,
                          otherCategory,
                          idx
                        )
                      }
                      className="size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-primary flex items-center justify-center cursor-pointer transition-colors"
                      title={`Move to ${otherCategoryLabel}`}
                    >
                      <ArrowRightLeft className="size-3" />
                    </button>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => handleStartEditSubject(className, sectionName, category, idx, sub)}
                      className="size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
                      title={`Edit ${sub}`}
                      aria-label={`Edit ${sub}`}
                    >
                      <Edit3 className="size-3" />
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteSubjectFromClassOrSection(
                          className,
                          sectionName,
                          category,
                          idx
                        )
                      }
                      className="size-6 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center cursor-pointer transition-colors"
                      title={`Delete ${sub}`}
                      aria-label={`Delete ${sub}`}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="py-4 px-3 rounded-lg border border-dashed border-border/80 text-center text-muted-foreground/70 text-[11px] flex flex-col items-center justify-center gap-1 min-h-[58px]">
            <span>No {category === "academic" ? "academic" : "non-academic"} subjects assigned</span>
            <span className="text-[10px] text-muted-foreground/50">Drag subjects here or click + Add</span>
          </div>
        )}
      </div>
    )
  }

  // 8 Redesigned Steps
  const steps = [
    { num: 1, label: "School Profile", icon: Building2 },
    { num: 2, label: "Classes", icon: BookOpen },
    { num: 3, label: "Sections", icon: Layers },
    { num: 4, label: "Subjects", icon: Bookmark },
    { num: 5, label: "Wings", icon: Compass },
    { num: 6, label: "Houses", icon: Shield },
    { num: 7, label: "Security", icon: KeyRound },
    { num: 8, label: "Review", icon: CheckCircle2 },
  ]

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col justify-between p-4 md:p-8">
      <div className="max-w-4xl mx-auto w-full space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                School Setup Wizard
              </span>
              {lastSavedTime && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium bg-muted/50 px-2 py-0.5 rounded-md">
                  <Check className="size-3 text-emerald-500" /> Saved
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
              Welcome, {principalInfo?.first_name} {principalInfo?.last_name}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              Smart defaults are ready. Review and customize your school structure in a few clicks.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <Badge variant="outline" className="text-xs sm:text-sm px-3.5 py-2 bg-muted/50 border-border font-semibold">
              Step {currentStep} of {steps.length}
            </Badge>
          </div>
        </div>

        {/* 8-Step Navigation */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 bg-card p-3 rounded-2xl border border-border shadow-xs overflow-x-auto">
          {steps.map((step) => {
            const Icon = step.icon
            const isDone = currentStep > step.num
            const isCurrent = currentStep === step.num

            return (
              <button
                key={step.num}
                type="button"
                onClick={() => {
                  if (step.num < currentStep) {
                    setCurrentStep(step.num)
                  }
                }}
                disabled={step.num > currentStep}
                className={`flex flex-col items-center text-center p-2 rounded-xl transition-all cursor-pointer ${isCurrent
                  ? "bg-primary/10 border-2 border-primary/50 text-primary font-bold shadow-xs"
                  : isDone
                    ? "text-foreground hover:bg-muted/40"
                    : "text-muted-foreground/60 cursor-not-allowed opacity-75"
                  }`}
              >
                <div
                  className={`size-8 sm:size-9 rounded-xl flex items-center justify-center mb-1 text-xs transition-colors ${isCurrent
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : isDone
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold"
                      : "bg-muted text-muted-foreground font-semibold"
                    }`}
                >
                  {isDone ? <Check className="size-4" /> : <span>{step.num}</span>}
                </div>
                <span className="text-[11px] sm:text-xs font-semibold truncate max-w-full leading-tight">
                  {step.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Wizard Main Content Card */}
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-8 shadow-xs">
          {submitError && (
            <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2.5">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{submitError}</span>
            </div>
          )}

          {/* ========================================== */}
          {/* STEP 1: SCHOOL PROFILE & IDENTITY */}
          {/* ========================================== */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-foreground">Step 1: School Profile &amp; Identity</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                  Provide institution details, campus address, and optional emblem and theme color.
                </p>
              </div>

              {/* 1. School Emblem Upload */}
              <div className="p-4.5 rounded-2xl border border-border bg-muted/20 space-y-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="size-4 text-primary" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    School Emblem / Crest (Optional)
                  </span>
                </div>

                {emblemUploadError && (
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span>{emblemUploadError}</span>
                  </div>
                )}

                <input
                  ref={emblemInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  onChange={handleEmblemFileChange}
                  className="hidden"
                />

                {emblemPreviewUrl ? (
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card">
                    <div className="flex items-center gap-3">
                      <div className="size-12 rounded-xl border border-border bg-muted/30 flex items-center justify-center p-1 overflow-hidden shadow-2xs">
                        <img
                          src={emblemPreviewUrl}
                          alt="Emblem Preview"
                          className="size-full object-contain"
                        />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5 text-emerald-500" /> Emblem Uploaded
                        </div>
                        <div className="text-[11px] text-muted-foreground">Ready for portal header &amp; reports</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => emblemInputRef.current?.click()}
                        disabled={isUploadingEmblem}
                        className="text-xs h-8 cursor-pointer"
                      >
                        Replace
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveEmblem}
                        disabled={isUploadingEmblem}
                        className="text-xs h-8 text-destructive hover:bg-destructive/10 cursor-pointer"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => emblemInputRef.current?.click()}
                    className="border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/40 transition-all rounded-xl p-4 text-center cursor-pointer flex flex-col items-center justify-center gap-1.5"
                  >
                    <div className="size-9 rounded-xl bg-card flex items-center justify-center text-muted-foreground shadow-2xs">
                      {isUploadingEmblem ? (
                        <Loader2 className="size-4 animate-spin text-primary" />
                      ) : (
                        <Upload className="size-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {isUploadingEmblem ? "Uploading Emblem..." : "Click to upload School Emblem / Crest"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        PNG (transparent recommended), JPG, WEBP (Max 5 MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. School Details */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">School Name</label>
                    <Input
                      type="text"
                      maxLength={255}
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Affiliation Code</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={7}
                      value={schoolCode}
                      onChange={(e) => {
                        const numericOnly = e.target.value.replace(/\D/g, "").slice(0, 7)
                        setSchoolCode(numericOnly)
                      }}
                      className="h-10 text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Official School Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        type="email"
                        readOnly
                        value={schoolEmail}
                        className="pl-9 h-10 text-sm bg-muted/50 cursor-not-allowed text-foreground border-border select-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Official Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        readOnly
                        value={schoolPhone}
                        className="pl-9 h-10 text-sm font-mono bg-muted/50 cursor-not-allowed text-foreground border-border select-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Address Fields */}
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-foreground block mb-1">Street / Building / Area</label>
                    <Input
                      type="text"
                      value={addressStreet}
                      onChange={(e) => setAddressStreet(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Landmark (Optional)</label>
                    <Input
                      type="text"
                      value={addressLandmark}
                      onChange={(e) => setAddressLandmark(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">City / District</label>
                    <Input
                      type="text"
                      value={addressCity}
                      onChange={(e) => setAddressCity(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">State / Union Territory</label>
                    <select
                      value={addressState}
                      onChange={(e) => setAddressState(e.target.value)}
                      className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground cursor-pointer focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 outline-none"
                    >
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">PIN Code (6 Digits)</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={addressPincode}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 6)
                        setAddressPincode(cleaned)
                      }}
                      className="h-10 text-sm font-mono tracking-wider"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Theme Color */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="size-4 text-primary" />
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Portal Theme Accent (Optional)
                    </span>
                  </div>
                  {primaryColor && (
                    <button
                      type="button"
                      onClick={() => setPrimaryColor("#FFFFFF")}
                      className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="size-3" /> Reset Default
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="relative size-10 shrink-0 rounded-xl overflow-hidden border border-border shadow-xs cursor-pointer">
                      <input
                        type="color"
                        value={primaryColor || "#FFFFFF"}
                        onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
                        className="absolute inset-0 size-full scale-150 cursor-pointer border-0 p-0"
                      />
                    </div>
                    <Input
                      type="text"
                      maxLength={7}
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
                      className="h-10 w-28 text-sm font-mono uppercase tracking-wider"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {THEME_COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setPrimaryColor(preset.value.toUpperCase())}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all cursor-pointer ${primaryColor.toUpperCase() === preset.value.toUpperCase()
                          ? "border-primary bg-primary/10 font-bold text-foreground ring-1 ring-primary/40"
                          : "border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                      >
                        <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: preset.value }} />
                        <span>{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* STEP 2: CLASSES (SMART DEFAULTS) */}
          {/* ========================================== */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Step 2: School Classes</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                    Your school starts with Nursery through Class 12. You can rename, reorder, add, or remove classes.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetClassesToDefault}
                    className="h-8 text-xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground border-border hover:bg-muted/50"
                    title="Reset classes to initial state & default order"
                  >
                    <RotateCcw className="size-3.5" /> Reset to Default
                  </Button>
                  {!isAddingClass && (
                    <Button
                      type="button"
                      onClick={() => {
                        setIsAddingClass(true)
                        setNewClassName("")
                      }}
                      size="sm"
                      className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
                    >
                      <Plus className="size-3.5" /> Add Class
                    </Button>
                  )}
                </div>
              </div>

              {/* Inline Add Class Form - Single-Row Layout (matching Wings) */}
              {isAddingClass && (
                <div className="p-3.5 rounded-2xl border border-primary/40 bg-card shadow-xs flex flex-wrap items-center gap-2 animate-in fade-in-50 duration-150">
                  <Input
                    type="text"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddClass()
                      } else if (e.key === "Escape") {
                        setIsAddingClass(false)
                      }
                    }}
                    className="h-8 text-xs flex-1 min-w-[160px]"
                    autoFocus
                  />

                  <select
                    value={newClassPosition}
                    onChange={(e) => setNewClassPosition(e.target.value)}
                    className="h-8 rounded-lg border border-input bg-card px-2.5 text-xs text-foreground cursor-pointer focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30 outline-none shrink-0"
                  >
                    <option value="end">Insert at End</option>
                    <option value="start">Insert at Beginning</option>
                    <option value="after">Insert After...</option>
                    <option value="before">Insert Before...</option>
                  </select>

                  {["after", "before"].includes(newClassPosition) && (
                    <select
                      value={targetClassAnchor}
                      onChange={(e) => setTargetClassAnchor(e.target.value)}
                      className="h-8 rounded-lg border border-input bg-card px-2.5 text-xs text-foreground cursor-pointer focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30 outline-none shrink-0"
                    >
                      {classesList.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddClass}
                    className="h-8 text-xs font-semibold gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="size-3.5" /> Add
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingClass(false)}
                    className="h-8 text-xs cursor-pointer shrink-0"
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {/* Classes Compact Rows with Smooth Real-time Physical Displacement Drag and Drop */}
              <div
                ref={classesContainerRef}
                className="relative space-y-1.5 p-1 select-none"
              >
                {classesList.map((clsName, idx) => {
                  const isEditing = editingClassIdx === idx
                  const { isDragging, dragIndex, targetIndex, itemHeight } = classDragState
                  const isThisItemDragging = isDragging && dragIndex === idx

                  let translateY = 0
                  if (isDragging && dragIndex !== null && targetIndex !== null) {
                    if (dragIndex < targetIndex) {
                      // Dragging downwards: cards between dragIndex + 1 and targetIndex slide up
                      if (idx > dragIndex && idx <= targetIndex) {
                        translateY = -itemHeight
                      }
                    } else if (dragIndex > targetIndex) {
                      // Dragging upwards: cards between targetIndex and dragIndex - 1 slide down
                      if (idx >= targetIndex && idx < dragIndex) {
                        translateY = itemHeight
                      }
                    }
                  }

                  // When this item is being actively dragged, render an in-place placeholder holding its slot
                  if (isThisItemDragging) {
                    return (
                      <div
                        key={`${clsName}-${idx}`}
                        data-class-item="true"
                        style={{
                          height: classDragState.cardHeight ? `${classDragState.cardHeight}px` : undefined,
                        }}
                        className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-2.5 sm:p-3 text-xs select-none transition-all duration-200"
                      >
                        <div className="flex items-center gap-2.5 opacity-0">
                          <div className="p-1">
                            <GripVertical className="size-4" />
                          </div>
                          <span className="size-6">{idx + 1}</span>
                          <span className="text-sm font-semibold">{clsName}</span>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={`${clsName}-${idx}`}
                      data-class-item="true"
                      style={{
                        transform: translateY ? `translate3d(0, ${translateY}px, 0)` : undefined,
                        transition: "transform 220ms cubic-bezier(0.2, 0, 0, 1)",
                      }}
                      className={`group flex items-center justify-between min-h-[50px] p-2.5 sm:p-3 rounded-xl border bg-card text-xs select-none will-change-transform ${isEditing ? "border-primary/50 ring-1 ring-primary/30" : "border-border hover:bg-muted/20"
                        }`}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-2">
                        {/* Drag Handle with pointer events */}
                        <div
                          onPointerDown={(e) => handleClassDragStart(e, idx)}
                          className={`text-muted-foreground/50 hover:text-foreground active:text-primary p-1 rounded-md hover:bg-muted/50 cursor-grab active:cursor-grabbing touch-none select-none ${isEditing ? "opacity-30 cursor-not-allowed pointer-events-none" : ""
                            }`}
                          title="Drag to reorder"
                        >
                          <GripVertical className="size-4" />
                        </div>

                        <span className="size-6 rounded-md bg-muted/60 text-muted-foreground font-mono flex items-center justify-center text-[11px] font-bold shrink-0">
                          {idx + 1}
                        </span>

                        {isEditing ? (
                          <Input
                            type="text"
                            value={editingClassName}
                            onChange={(e) => setEditingClassName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                handleSaveEditClass(idx)
                              } else if (e.key === "Escape") {
                                setEditingClassIdx(null)
                              }
                            }}
                            className="h-8 text-xs font-semibold flex-1 max-w-sm"
                            autoFocus
                          />
                        ) : (
                          <span className="font-semibold text-foreground text-sm truncate">{clsName}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isEditing ? (
                          <>
                            {/* Save Icon (Green Tick) */}
                            <button
                              type="button"
                              onClick={() => handleSaveEditClass(idx)}
                              className="size-7 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-colors cursor-pointer"
                              title="Save"
                              aria-label="Save"
                            >
                              <Check className="size-4 stroke-[2.5]" />
                            </button>

                            {/* Cancel Icon (Red Cross) */}
                            <button
                              type="button"
                              onClick={() => setEditingClassIdx(null)}
                              className="size-7 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-colors cursor-pointer"
                              title="Cancel"
                              aria-label="Cancel"
                            >
                              <X className="size-4 stroke-[2.5]" />
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Edit Icon Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingClassIdx(idx)
                                setEditingClassName(clsName)
                              }}
                              className="size-7 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center justify-center transition-colors cursor-pointer"
                              title={`Edit ${clsName}`}
                              aria-label={`Edit ${clsName}`}
                            >
                              <Edit3 className="size-3.5" />
                            </button>

                            {/* Delete Icon Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteClass(idx)}
                              className="size-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors cursor-pointer"
                              title={`Delete ${clsName}`}
                              aria-label={`Delete ${clsName}`}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Fixed Portal Drag Overlay to prevent clipping & overflow */}
              {classDragState.isDragging &&
                classDragState.dragIndex !== null &&
                typeof document !== "undefined" &&
                createPortal(
                  <div
                    style={{
                      position: "fixed",
                      top: `${classDragState.cardTop + (classDragState.currentY - classDragState.startY)}px`,
                      left: `${classDragState.cardLeft}px`,
                      width: `${classDragState.cardWidth}px`,
                      height: classDragState.cardHeight ? `${classDragState.cardHeight}px` : undefined,
                      zIndex: 99999,
                      pointerEvents: "none",
                      boxShadow:
                        "0 20px 30px -4px rgba(0, 0, 0, 0.45), 0 8px 16px -4px rgba(0, 0, 0, 0.3)",
                    }}
                    className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl border border-primary ring-2 ring-primary/40 bg-card text-xs select-none shadow-2xl opacity-98"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-2">
                      <div className="text-primary p-1 rounded-md">
                        <GripVertical className="size-4" />
                      </div>
                      <span className="size-6 rounded-md bg-primary/20 text-primary font-mono flex items-center justify-center text-[11px] font-bold shrink-0">
                        {(classDragState.targetIndex ?? classDragState.dragIndex) + 1}
                      </span>
                      <span className="font-semibold text-foreground text-sm truncate">
                        {classesList[classDragState.dragIndex]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 opacity-60">
                      <div className="size-7 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground">
                        <Edit3 className="size-3.5" />
                      </div>
                      <div className="size-7 rounded-lg flex items-center justify-center text-muted-foreground">
                        <Trash2 className="size-3.5" />
                      </div>
                    </div>
                  </div>,
                  document.body
                )}
            </div>
          )}

          {/* ========================================== */}
          {/* STEP 3: CLASS SECTIONS (PER-CLASS WITH HORIZONTAL DRAG & DROP) */}
          {/* ========================================== */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Step 3: Class Sections</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                    Configure and organize sections for each class. Drag horizontally to reorder, edit names inline, delete sections, or add new ones.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetAllClassSections}
                  className="h-8 gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground border-border hover:bg-muted/50 text-xs self-start sm:self-center shrink-0"
                  title="Reset all classes to default sections"
                >
                  <RotateCcw className="size-3.5" /> Reset to Default
                </Button>
              </div>

              {/* Class Sections List */}
              <div className="space-y-4">
                {classesList.map((clsName) => {
                  const sections = classSectionMap[clsName] || []
                  const isAddingHere = addingSectionForClass === clsName

                  return (
                    <div
                      key={clsName}
                      className="p-4 rounded-2xl border border-border bg-card/60 hover:bg-card/90 transition-colors space-y-3 shadow-2xs"
                    >
                      {/* Class Row Header */}
                      <div className="flex items-center justify-between gap-2 min-h-[32px] border-b border-border/50 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-sm">{clsName}</span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                            {sections.length} {sections.length === 1 ? "section" : "sections"}
                          </span>
                        </div>

                        <Button
                          type="button"
                          variant={isAddingHere ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => {
                            if (isAddingHere) {
                              setAddingSectionForClass(null)
                              setNewSectionForClassName("")
                            } else {
                              setAddingSectionForClass(clsName)
                              setNewSectionForClassName("")
                              setEditingSectionState(null)
                            }
                          }}
                          className={`h-7 px-2 text-xs gap-1 cursor-pointer transition-colors ${isAddingHere
                              ? "text-muted-foreground hover:text-foreground"
                              : "text-primary hover:text-primary hover:bg-primary/10"
                            }`}
                        >
                          {isAddingHere ? (
                            <>
                              <X className="size-3.5" /> Cancel Adding
                            </>
                          ) : (
                            <>
                              <Plus className="size-3.5" /> Add Section
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Sections 4-in-a-Row Full-Width Grid */}
                      <div
                        data-sections-for={clsName}
                        className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 auto-rows-[36px] items-stretch gap-2.5 w-full"
                      >
                        {sections.map((sec, secIdx) => {
                          const isThisDragging =
                            sectionDragState.isDragging &&
                            sectionDragState.className === clsName &&
                            sectionDragState.dragIndex === secIdx

                          const isClassDragging =
                            sectionDragState.isDragging && sectionDragState.className === clsName

                          let transformStyle = ""
                          if (isClassDragging && !isThisDragging) {
                            const { dragIndex, targetIndex, slotRects } = sectionDragState
                            if (
                              dragIndex !== null &&
                              targetIndex !== null &&
                              dragIndex !== targetIndex &&
                              slotRects &&
                              slotRects.length > secIdx
                            ) {
                              let destSlot = secIdx
                              if (dragIndex < targetIndex) {
                                if (secIdx > dragIndex && secIdx <= targetIndex) {
                                  destSlot = secIdx - 1
                                }
                              } else if (dragIndex > targetIndex) {
                                if (secIdx >= targetIndex && secIdx < dragIndex) {
                                  destSlot = secIdx + 1
                                }
                              }

                              if (destSlot !== secIdx && slotRects[destSlot] && slotRects[secIdx]) {
                                const origRect = slotRects[secIdx]
                                const destRect = slotRects[destSlot]
                                const dx = destRect.left - origRect.left
                                const dy = destRect.top - origRect.top
                                if (dx !== 0 || dy !== 0) {
                                  transformStyle = `translate3d(${dx}px, ${dy}px, 0)`
                                }
                              }
                            }
                          }

                          const isEditing =
                            editingSectionState?.className === clsName &&
                            editingSectionState?.index === secIdx

                          if (isEditing) {
                            return (
                              <div
                                key={`${sec}-${secIdx}`}
                                data-section-item="true"
                                className="group/sec flex items-center justify-between w-full h-9 min-h-9 max-h-9 px-2.5 rounded-xl border border-primary/50 ring-1 ring-primary/30 bg-card text-xs font-semibold text-foreground shadow-sm select-none box-border overflow-hidden"
                              >
                                <input
                                  type="text"
                                  value={editingSectionNameVal}
                                  onChange={(e) => setEditingSectionNameVal(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault()
                                      handleSaveEditSectionForClass(clsName, secIdx)
                                    } else if (e.key === "Escape") {
                                      setEditingSectionState(null)
                                    }
                                  }}
                                  className="h-6 text-xs font-semibold px-2 py-0 flex-1 min-w-0 mr-1.5 rounded-md border border-primary/40 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary"
                                  autoFocus
                                />

                                {/* Right-aligned Save (Green Tick) and Cancel (Red Cross) Icons */}
                                <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-border/60">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditSectionForClass(clsName, secIdx)}
                                    className="size-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-colors cursor-pointer"
                                    title="Save"
                                    aria-label="Save"
                                  >
                                    <Check className="size-3.5 stroke-[2.5]" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingSectionState(null)}
                                    className="size-6 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-colors cursor-pointer"
                                    title="Cancel"
                                    aria-label="Cancel"
                                  >
                                    <X className="size-3.5 stroke-[2.5]" />
                                  </button>
                                </div>
                              </div>
                            )
                          }

                          return (
                            <div
                              key={`${sec}-${secIdx}`}
                              data-section-item="true"
                              style={{
                                transform: transformStyle || undefined,
                                transition: isThisDragging ? "none" : "transform 180ms cubic-bezier(0.2, 0, 0, 1)",
                                opacity: isThisDragging ? 0 : 1,
                                pointerEvents: isThisDragging ? "none" : "auto",
                              }}
                              className="group/sec flex items-center justify-between w-full h-9 min-h-9 max-h-9 px-2.5 rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-primary/40 text-xs font-semibold text-foreground transition-all duration-150 select-none shadow-2xs box-border overflow-hidden"
                            >
                              {/* Horizontal Drag Handle */}
                              <div
                                onPointerDown={(e) => handleSectionDragStart(e, clsName, secIdx)}
                                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-primary transition-colors p-0.5 rounded touch-none shrink-0"
                                title="Drag to reorder"
                              >
                                <GripVertical className="size-3.5" />
                              </div>

                              {/* Section Name */}
                              <span className="text-xs font-semibold text-foreground truncate flex-1 min-w-0 px-1.5 text-left">
                                {sec}
                              </span>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-border/60">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditSection(clsName, secIdx, sec)}
                                  className="size-6 rounded-md hover:bg-muted hover:text-foreground text-muted-foreground flex items-center justify-center transition-colors cursor-pointer"
                                  title={`Edit ${sec}`}
                                  aria-label={`Edit ${sec}`}
                                >
                                  <Edit3 className="size-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSectionFromClass(clsName, secIdx)}
                                  className="size-6 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground flex items-center justify-center transition-colors cursor-pointer"
                                  title={`Delete ${sec}`}
                                  aria-label={`Delete ${sec}`}
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            </div>
                          )
                        })}

                        {/* Inline Add Section Form for this class */}
                        {isAddingHere && (
                          <div className="flex items-center justify-between w-full h-9 min-h-9 max-h-9 px-2.5 rounded-xl border border-primary/50 ring-1 ring-primary/30 bg-card shadow-sm animate-in fade-in-50 duration-150 select-none box-border overflow-hidden">
                            <input
                              type="text"
                              value={newSectionForClassName}
                              onChange={(e) => setNewSectionForClassName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  handleAddSectionToClass(clsName)
                                } else if (e.key === "Escape") {
                                  setAddingSectionForClass(null)
                                  setNewSectionForClassName("")
                                }
                              }}
                              className="h-6 text-xs font-semibold px-1.5 py-0 flex-1 min-w-0 mr-1 rounded-md border border-primary/40 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary"
                              autoFocus
                            />
                            <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-border/60">
                              <button
                                type="button"
                                onClick={() => handleAddSectionToClass(clsName)}
                                className="size-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-colors cursor-pointer"
                                title="Add Section"
                                aria-label="Add Section"
                              >
                                <Check className="size-3.5 stroke-[2.5]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAddingSectionForClass(null)
                                  setNewSectionForClassName("")
                                }}
                                className="size-6 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-colors cursor-pointer"
                                title="Cancel"
                                aria-label="Cancel"
                              >
                                <X className="size-3.5 stroke-[2.5]" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Fixed Portal Drag Overlay for multi-row section drag */}
              {sectionDragState.isDragging &&
                sectionDragState.className &&
                sectionDragState.dragIndex !== null &&
                typeof document !== "undefined" &&
                createPortal(
                  <div
                    style={{
                      position: "fixed",
                      top: `${sectionDragState.cardTop + (sectionDragState.currentY - sectionDragState.startY)}px`,
                      left: `${sectionDragState.cardLeft + (sectionDragState.currentX - sectionDragState.startX)}px`,
                      width: `${sectionDragState.cardWidth}px`,
                      height: `${sectionDragState.cardHeight || 36}px`,
                      zIndex: 99999,
                      pointerEvents: "none",
                      boxShadow: "0 20px 30px -4px rgba(0, 0, 0, 0.45), 0 8px 16px -4px rgba(0, 0, 0, 0.3)",
                    }}
                    className="flex items-center justify-between h-9 px-2.5 rounded-xl border border-primary ring-2 ring-primary/40 bg-card text-xs font-semibold text-foreground select-none shadow-2xl opacity-98"
                  >
                    <div className="text-primary p-0.5 rounded shrink-0">
                      <GripVertical className="size-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-foreground truncate flex-1 min-w-0 px-1.5 text-left">
                      {classSectionMap[sectionDragState.className]?.[sectionDragState.dragIndex]}
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-border/60 opacity-60">
                      <div className="size-6 rounded-md flex items-center justify-center text-muted-foreground">
                        <Edit3 className="size-3" />
                      </div>
                      <div className="size-6 rounded-md flex items-center justify-center text-muted-foreground">
                        <Trash2 className="size-3" />
                      </div>
                    </div>
                  </div>,
                  document.body
                )}
            </div>
          )}

          {/* ========================================== */}
          {/* STEP 4: SUBJECTS (CLASS-FIRST REDESIGN)    */}
          {/* ========================================== */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {/* Header */}
              <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Step 4: Subject Assignment</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                    Configure and categorize Academic and Non-Academic subjects for every grade level or individual section.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                  <Badge variant="outline" className="text-xs px-2.5 py-1 font-semibold text-primary bg-primary/5 border-primary/20">
                    <GraduationCap className="size-3.5 mr-1" />
                    {getAllUniqueSubjectsAcrossAllClasses().length} Unique Subjects
                  </Badge>
                </div>
              </div>

              {/* Feedback Toast Banner */}
              {subjectFeedbackMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span className="font-semibold">{subjectFeedbackMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubjectFeedbackMessage(null)}
                    className="text-emerald-600/70 hover:text-emerald-600 cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}

              {/* Search & Bulk Collapse Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/20 p-3 rounded-2xl border border-border">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search classes or subjects..."
                    value={subjectSearchQuery}
                    onChange={(e) => setSubjectSearchQuery(e.target.value)}
                    className="h-8.5 pl-8 text-xs bg-card"
                  />
                  {subjectSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setSubjectSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allCollapsed = classesList.every((c) => collapsedClassMap[c] !== false)
                      const next = {}
                      classesList.forEach((c) => {
                        next[c] = !allCollapsed
                      })
                      setCollapsedClassMap(next)
                    }}
                    className="h-8 text-xs cursor-pointer font-medium"
                  >
                    {classesList.every((c) => collapsedClassMap[c] !== false) ? "Expand All" : "Collapse All"}
                  </Button>
                </div>
              </div>

              {/* Class Cards List */}
              <div className="space-y-4">
                {classesList
                  .filter((cls) => {
                    if (!subjectSearchQuery.trim()) return true
                    const q = subjectSearchQuery.toLowerCase().trim()
                    if (cls.toLowerCase().includes(q)) return true
                    const conf = classSubjectConfig[cls]
                    if (!conf) return false
                    const sharedSubs = [...(conf.shared?.academic || []), ...(conf.shared?.nonAcademic || [])]
                    if (sharedSubs.some((s) => s.toLowerCase().includes(q))) return true
                    const secSubs = Object.values(conf.sections || {}).flatMap((s) => [...(s.academic || []), ...(s.nonAcademic || [])])
                    return secSubs.some((s) => s.toLowerCase().includes(q))
                  })
                  .map((cls) => {
                    const conf = classSubjectConfig[cls] || {
                      isSameForAllSections: true,
                      shared: getDefaultSubjectsForClass(cls),
                      sections: {},
                    }
                    const isShared = conf.isSameForAllSections !== false
                    const isCollapsed = collapsedClassMap[cls] !== false // Default: collapsed
                    const configuredSections = classSectionMap[cls] && classSectionMap[cls].length > 0 ? classSectionMap[cls] : getDefaultSectionsForClass(cls)

                    // Counts calculation
                    let totalAcadCount = 0
                    let totalNonAcadCount = 0
                    if (isShared) {
                      totalAcadCount = conf.shared?.academic?.length || 0
                      totalNonAcadCount = conf.shared?.nonAcademic?.length || 0
                    } else {
                      configuredSections.forEach((s) => {
                        const secConf = conf.sections?.[s] || { academic: [], nonAcademic: [] }
                        totalAcadCount += secConf.academic?.length || 0
                        totalNonAcadCount += secConf.nonAcademic?.length || 0
                      })
                    }
                    const totalSubjectsCount = isShared
                      ? totalAcadCount + totalNonAcadCount
                      : configuredSections.reduce((acc, s) => {
                        const secConf = conf.sections?.[s] || { academic: [], nonAcademic: [] }
                        return acc + (secConf.academic?.length || 0) + (secConf.nonAcademic?.length || 0)
                      }, 0)

                    return (
                      <div
                        key={cls}
                        className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden transition-all duration-200"
                      >
                        {/* Class Card Header: Single row layout with aligned actions */}
                        <div className="p-3.5 sm:p-4 bg-card border-b border-border/70 flex items-center justify-between gap-3">
                          {/* Left: Chevron, Icon, Class Title & Badges */}
                          <div
                            className="flex items-center gap-2.5 sm:gap-3 min-w-0 cursor-pointer select-none"
                            onClick={() => setCollapsedClassMap((prev) => ({ ...prev, [cls]: isCollapsed ? false : true }))}
                          >
                            <button
                              type="button"
                              className="size-7 rounded-lg border border-border bg-muted/30 hover:bg-muted text-muted-foreground flex items-center justify-center cursor-pointer transition-colors shrink-0"
                              title={isCollapsed ? "Expand class" : "Collapse class"}
                              onClick={(e) => {
                                e.stopPropagation()
                                setCollapsedClassMap((prev) => ({ ...prev, [cls]: isCollapsed ? false : true }))
                              }}
                            >
                              {isCollapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                            </button>

                            <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                              <BookOpen className="size-4" />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-bold text-foreground truncate">{cls}</h3>
                                <Badge variant="secondary" className="text-[11px] font-semibold shrink-0">
                                  {isShared ? `${totalSubjectsCount} Subjects` : `${configuredSections.length} Sections`}
                                </Badge>
                                {isShared && (
                                  <span className="text-[11px] text-muted-foreground hidden lg:inline-block truncate">
                                    ({totalAcadCount} Academic • {totalNonAcadCount} Non-Academic)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Section Checkbox & Class Actions Next to Each Other in One Row */}
                          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 flex-nowrap" onClick={(e) => e.stopPropagation()}>
                            {/* Same for All Sections Checkbox (No border, clean checkbox) */}
                            <label
                              className="flex items-center gap-2 cursor-pointer select-none group text-xs font-semibold text-foreground hover:text-primary transition-colors shrink-0"
                              title="Toggle between shared subjects for all sections or section-specific subjects"
                            >
                              <input
                                type="checkbox"
                                checked={isShared}
                                onChange={() => handleToggleClassShared(cls)}
                                className="size-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                              />
                              <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors whitespace-nowrap">
                                Same for all sections
                              </span>
                            </label>

                            {/* Class Actions: Copy & Reset right next to checkbox */}
                            <div className="flex items-center gap-1 border-l border-border/70 pl-2 sm:pl-2.5 shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setCopyClassModal({ targetClass: cls, selectedSourceClass: "" })}
                                className="h-8 px-2 sm:px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1"
                                title={`Copy subjects from another class into ${cls}`}
                              >
                                <Copy className="size-3.5 text-primary" />
                                <span className="inline">Copy</span>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResetClassSubjectsToDefault(cls)}
                                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1"
                                title={`Reset ${cls} to default subjects`}
                              >
                                <RotateCcw className="size-3.5" />
                                <span className="hidden sm:inline">Reset</span>
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Class Card Body */}
                        {!isCollapsed && (
                          <div className="p-4 sm:p-5 space-y-4">
                            {/* CASE A: SHARED MODE (One Full-Width Area) */}
                            {isShared && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                                {/* Academic Column */}
                                {renderSubjectBucket({
                                  className: cls,
                                  sectionName: null,
                                  category: "academic",
                                  categoryLabel: "Academic Subjects",
                                  categoryIcon: GraduationCap,
                                  accentColor: "text-blue-600 dark:text-blue-400",
                                  badgeBg: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
                                  subjects: conf.shared?.academic || [],
                                  otherCategory: "nonAcademic",
                                  otherCategoryLabel: "Non-Academic",
                                })}

                                {/* Non-Academic Column */}
                                {renderSubjectBucket({
                                  className: cls,
                                  sectionName: null,
                                  category: "nonAcademic",
                                  categoryLabel: "Non-Academic Subjects",
                                  categoryIcon: Award,
                                  accentColor: "text-amber-600 dark:text-amber-400",
                                  badgeBg: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
                                  subjects: conf.shared?.nonAcademic || [],
                                  otherCategory: "academic",
                                  otherCategoryLabel: "Academic",
                                })}
                              </div>
                            )}

                            {/* CASE B: SECTION-SPECIFIC MODE (Split by Section with Smooth Animation) */}
                            {!isShared && (
                              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Split className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                    <span>
                                      <strong>Section-Specific Mode Active:</strong> Subjects for each section of {cls} are managed independently.
                                    </span>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  {configuredSections.map((sec) => {
                                    const secData = conf.sections?.[sec] || {
                                      academic: [...(conf.shared?.academic || [])],
                                      nonAcademic: [...(conf.shared?.nonAcademic || [])],
                                    }
                                    const secTotal = (secData.academic?.length || 0) + (secData.nonAcademic?.length || 0)

                                    return (
                                      <div
                                        key={sec}
                                        className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3 transition-all duration-200"
                                      >
                                        <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                                          <div className="flex items-center gap-2">
                                            <span className="size-2 rounded-full bg-primary" />
                                            <span className="text-xs font-bold text-foreground">
                                              {cls} – {sec}
                                            </span>
                                            <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                                              {secTotal} Subjects
                                            </Badge>
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                          {/* Section Academic */}
                                          {renderSubjectBucket({
                                            className: cls,
                                            sectionName: sec,
                                            category: "academic",
                                            categoryLabel: "Academic",
                                            categoryIcon: GraduationCap,
                                            accentColor: "text-blue-600 dark:text-blue-400",
                                            badgeBg: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
                                            subjects: secData.academic || [],
                                            otherCategory: "nonAcademic",
                                            otherCategoryLabel: "Non-Academic",
                                          })}

                                          {/* Section Non-Academic */}
                                          {renderSubjectBucket({
                                            className: cls,
                                            sectionName: sec,
                                            category: "nonAcademic",
                                            categoryLabel: "Non-Academic",
                                            categoryIcon: Award,
                                            accentColor: "text-amber-600 dark:text-amber-400",
                                            badgeBg: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
                                            subjects: secData.nonAcademic || [],
                                            otherCategory: "academic",
                                            otherCategoryLabel: "Academic",
                                          })}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>

              {/* UNIFICATION MODAL (when toggling OFF -> ON) */}
              {unifyModalState &&
                createPortal(
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in-50 duration-200">
                    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
                      <div className="flex items-start gap-3">
                        <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                          <Combine className="size-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-foreground">
                            Unify Subjects for {unifyModalState.className}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            Sections currently have different subject assignments. Choose how you would like to synchronize them to a single shared configuration.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleConfirmUnifyShared(
                              unifyModalState.className,
                              "use_section",
                              unifyModalState.firstSection
                            )
                          }
                          className="w-full p-3 rounded-xl border border-border bg-muted/30 hover:bg-primary/5 hover:border-primary/40 text-left transition-all cursor-pointer group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground group-hover:text-primary">
                              Use {unifyModalState.firstSection}&apos;s Subjects
                            </span>
                            <Badge variant="outline" className="text-[10px]">Recommended</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Applies the subject list from {unifyModalState.firstSection} to all sections of {unifyModalState.className}.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleConfirmUnifyShared(unifyModalState.className, "merge")
                          }
                          className="w-full p-3 rounded-xl border border-border bg-muted/30 hover:bg-primary/5 hover:border-primary/40 text-left transition-all cursor-pointer group"
                        >
                          <span className="text-xs font-bold text-foreground group-hover:text-primary block">
                            Merge All Unique Subjects
                          </span>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Combines every unique subject configured across all sections into the shared list.
                          </p>
                        </button>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-border">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setUnifyModalState(null)}
                          className="h-9 text-xs cursor-pointer"
                        >
                          Cancel (Keep Section-Specific)
                        </Button>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}

              {/* COPY CLASS SUBJECTS MODAL (Select class to copy FROM) */}
              {copyClassModal &&
                createPortal(
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in-50 duration-200">
                    <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                            <Copy className="size-4.5" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-foreground">
                              Copy Subjects into {copyClassModal.targetClass}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Select a class below to duplicate its Academic and Non-Academic subjects into <strong>{copyClassModal.targetClass}</strong>.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCopyClassModal(null)}
                          className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded-lg hover:bg-muted"
                        >
                          <X className="size-4" />
                        </button>
                      </div>

                      <div className="space-y-2 pt-1">
                        <label className="text-xs font-semibold text-foreground block">
                          Select Source Class:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[250px] overflow-y-auto p-1">
                          {classesList
                            .filter((c) => c !== copyClassModal.targetClass)
                            .map((c) => {
                              const cConf = classSubjectConfig[c]
                              const acadCount = cConf?.shared?.academic?.length || 0
                              const nonAcadCount = cConf?.shared?.nonAcademic?.length || 0
                              const totalCount = acadCount + nonAcadCount
                              const isSelected = copyClassModal.selectedSourceClass === c

                              return (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() =>
                                    setCopyClassModal((prev) => ({
                                      ...prev,
                                      selectedSourceClass: c,
                                    }))
                                  }
                                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-left cursor-pointer transition-all ${isSelected
                                      ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary/30"
                                      : "bg-muted/20 border-border hover:bg-muted/50 hover:border-border/80"
                                    }`}
                                >
                                  <div
                                    className={`size-4 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 ${isSelected
                                        ? "bg-primary text-primary-foreground"
                                        : "border border-muted-foreground/40"
                                      }`}
                                  >
                                    {isSelected && <div className="size-1.5 rounded-full bg-white" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-foreground truncate">{c}</div>
                                    <div className="text-[11px] text-muted-foreground mt-0.5">
                                      {totalCount} subjects ({acadCount} Acad • {nonAcadCount} Non-Acad)
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                        </div>
                      </div>

                      {copyClassModal.selectedSourceClass && (
                        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-1 animate-in fade-in duration-150">
                          <span className="font-semibold text-foreground">Subjects preview from {copyClassModal.selectedSourceClass}:</span>
                          <div className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                            {[
                              ...(classSubjectConfig[copyClassModal.selectedSourceClass]?.shared?.academic || []),
                              ...(classSubjectConfig[copyClassModal.selectedSourceClass]?.shared?.nonAcademic || [])
                            ].join(", ") || "No subjects configured"}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-3 border-t border-border">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setCopyClassModal(null)}
                          className="h-9 text-xs cursor-pointer"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!copyClassModal.selectedSourceClass}
                          onClick={() =>
                            handleCopySubjectsToTarget(
                              copyClassModal.selectedSourceClass,
                              copyClassModal.targetClass
                            )
                          }
                          className="h-9 text-xs font-bold cursor-pointer gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          <Copy className="size-3.5" />
                          Copy into {copyClassModal.targetClass}
                        </Button>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}
            </div>
          )}

          {/* ========================================== */}
          {/* STEP 5: ACADEMIC WINGS */}
          {/* ========================================== */}
          {currentStep === 5 && (
            <div className="space-y-6">
              {/* Header */}
              <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Step 5: Academic Wings</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                    Organize classes into academic wings. Drag and drop classes between wings or into the unassigned pool.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetWingsToDefault}
                    className="h-8 text-xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground border-border hover:bg-muted/50"
                    title="Reset to default 5 wings mapping"
                  >
                    <RotateCcw className="size-3.5" /> Reset to Default
                  </Button>
                  {!isAddingCustomWing && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setIsAddingCustomWing(true)
                        setNewCustomWingName("")
                      }}
                      className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
                    >
                      <Plus className="size-3.5" /> Add Wing
                    </Button>
                  )}
                </div>
              </div>

              {/* Add Custom Wing Inline Form */}
              {isAddingCustomWing && (
                <div className="p-3.5 rounded-2xl border border-primary/40 bg-card shadow-xs flex items-center gap-2 animate-in fade-in-50 duration-150">
                  <Input
                    type="text"
                    value={newCustomWingName}
                    onChange={(e) => setNewCustomWingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddCustomWing()
                      } else if (e.key === "Escape") {
                        setIsAddingCustomWing(false)
                      }
                    }}
                    className="h-8 text-xs flex-1 min-w-0"
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddCustomWing}
                    className="h-8 text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="size-3.5 mr-1" /> Add
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingCustomWing(false)}
                    className="h-8 text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {/* Unassigned Classes Section (Only shown at top if any class is unassigned) */}
              {unassignedClasses.length > 0 && (
                <div
                  onDragOver={(e) => handleWingClassDragOver(e, "unassigned")}
                  onDragLeave={() => setDragOverArea(null)}
                  onDrop={(e) => handleWingClassDrop(e, null)}
                  className={`p-4 rounded-2xl border transition-all duration-150 space-y-3 ${dragOverArea === "unassigned"
                      ? "border-amber-500/80 bg-amber-500/10 ring-2 ring-amber-500/20"
                      : "border-amber-500/30 bg-amber-500/5 shadow-2xs"
                    }`}
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-amber-500/20">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="size-4 text-amber-500" />
                      <span className="font-bold text-foreground text-sm">Unassigned Classes</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold">
                        {unassignedClasses.length} {unassignedClasses.length === 1 ? "class" : "classes"}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground hidden sm:inline">
                      Drag into any wing below to assign
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {unassignedClasses.map((clsName) => (
                      <div
                        key={clsName}
                        draggable
                        onDragStart={(e) => handleWingClassDragStart(e, null, clsName)}
                        onDragEnd={handleWingClassDragEnd}
                        className="group flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-amber-500/40 bg-card hover:border-amber-500 hover:shadow-xs text-xs font-semibold text-foreground transition-all select-none shadow-2xs cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical className="size-3 text-muted-foreground group-hover:text-amber-500 shrink-0" />
                        <span className="truncate flex-1 min-w-0">{clsName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Wings Cards List */}
              <div className="space-y-3">
                {wingsList.map((wing, wingIdx) => {
                  const isEditingThisWing = editingWingIdx === wingIdx
                  const isDragOver = dragOverArea === `wing-${wingIdx}`
                  const wingClasses = wing.classes || []

                  return (
                    <div
                      key={wing.id || wing.name || wingIdx}
                      onDragOver={(e) => handleWingClassDragOver(e, `wing-${wingIdx}`)}
                      onDragLeave={() => setDragOverArea(null)}
                      onDrop={(e) => handleWingClassDrop(e, wingIdx)}
                      className={`p-4 rounded-2xl border transition-all duration-150 space-y-3 shadow-2xs ${isDragOver
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border bg-card/60 hover:bg-card/90"
                        }`}
                    >
                      {/* Wing Row Header */}
                      <div className="flex items-center justify-between gap-2 min-h-[32px] h-[32px] border-b border-border/50 pb-2.5">
                        {isEditingThisWing ? (
                          <div className="flex items-center justify-between w-full">
                            <Input
                              type="text"
                              value={editingWingNameVal}
                              onChange={(e) => setEditingWingNameVal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  handleSaveEditWing(wingIdx)
                                } else if (e.key === "Escape") {
                                  handleCancelEditWing()
                                }
                              }}
                              className="h-6 text-xs font-semibold px-1.5 py-0 flex-1 min-w-0 mr-1 rounded-md border-primary/40 focus-visible:ring-1 focus-visible:ring-primary/40"
                              autoFocus
                            />
                            <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-border/60">
                              <button
                                type="button"
                                onClick={() => handleSaveEditWing(wingIdx)}
                                className="size-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-colors cursor-pointer"
                                title="Save Wing Name"
                                aria-label="Save Wing Name"
                              >
                                <Check className="size-3.5 stroke-[2.5]" />
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditWing}
                                className="size-6 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-colors cursor-pointer"
                                title="Cancel"
                                aria-label="Cancel"
                              >
                                <X className="size-3.5 stroke-[2.5]" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground text-sm">{wing.name}</span>
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                                {wingClasses.length} {wingClasses.length === 1 ? "class" : "classes"}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEditWing(wingIdx, wing.name)}
                                className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center justify-center transition-colors cursor-pointer"
                                title={`Rename ${wing.name}`}
                                aria-label={`Rename ${wing.name}`}
                              >
                                <Edit3 className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteWing(wingIdx)}
                                className="size-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors cursor-pointer"
                                title={`Delete ${wing.name}`}
                                aria-label={`Delete ${wing.name}`}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Child Classes in Wing */}
                      {wingClasses.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                          {wingClasses.map((clsName) => (
                            <div
                              key={clsName}
                              draggable
                              onDragStart={(e) => handleWingClassDragStart(e, wingIdx, clsName)}
                              onDragEnd={handleWingClassDragEnd}
                              className="group flex items-center justify-between h-8 px-2.5 rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-primary/40 text-xs font-semibold text-foreground transition-all select-none shadow-2xs cursor-grab active:cursor-grabbing"
                            >
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <GripVertical className="size-3 text-muted-foreground group-hover:text-primary shrink-0" />
                                <span className="truncate">{clsName}</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveClassFromWing(wingIdx, clsName)}
                                className="size-5 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-1"
                                title={`Remove ${clsName} from ${wing.name}`}
                                aria-label={`Remove ${clsName}`}
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-12 rounded-xl border border-dashed border-border/80 flex items-center justify-center text-xs text-muted-foreground bg-muted/10">
                          Drag and drop classes here to assign to {wing.name}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* STEP 6: HOUSES (OPTIONAL, MAX 4, EMBLEMS) */}
          {/* ========================================== */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Step 6: School Houses (Optional)</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                    Configure 4 houses for student activities with custom colors and emblems.
                  </p>
                </div>
              </div>

              {!useHouses ? (
                <div className="p-6 rounded-2xl border border-border bg-muted/20 text-center space-y-3">
                  <Shield className="size-10 text-muted-foreground mx-auto" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Does your school use houses?</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Houses are optional and can be configured later anytime in School Settings.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleNextStep()}
                      className="text-xs h-9 cursor-pointer"
                    >
                      Skip for now
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setUseHouses(true)}
                      className="text-xs h-9 font-bold cursor-pointer"
                    >
                      <Plus className="size-4 mr-1" /> Set up Houses
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* House Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                    {housesList.map((h, idx) => {
                      const isEditing = editingHouseIdx === idx

                      if (isEditing) {
                        return (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl border-2 border-primary/40 bg-card/95 shadow-sm space-y-3 animate-in fade-in-50 duration-150"
                          >
                            {/* Row 1: Name input with save / cancel buttons */}
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <Input
                                  type="text"
                                  placeholder="House name"
                                  value={houseFormName}
                                  onChange={(e) => setHouseFormName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveHouseInline()
                                    if (e.key === "Escape") handleCancelHouseEdit()
                                  }}
                                  className="h-8 text-xs font-semibold pr-2"
                                  autoFocus
                                />
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={handleSaveHouseInline}
                                  className="size-7 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/60 flex items-center justify-center transition-colors cursor-pointer"
                                  title="Save Changes"
                                >
                                  <Check className="size-3.5 stroke-[2.5]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelHouseEdit}
                                  className="size-7 rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/60 flex items-center justify-center transition-colors cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="size-3.5 stroke-[2.5]" />
                                </button>
                              </div>
                            </div>

                            {/* Row 2: Color selection - Single row with Curated Colors & Custom Picker */}
                            <div className="space-y-1 pt-0.5">
                              <div className="text-[11px] text-muted-foreground font-medium">
                                <span>Color</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto py-0.5">
                                {CURATED_HOUSE_PALETTE.map((pal) => {
                                  const isSelected = normalizeHexColor(houseFormColor) === pal.hex
                                  const isUsed = isColorUsedByOtherHouse(pal.hex, idx)

                                  return (
                                    <button
                                      key={pal.hex}
                                      type="button"
                                      disabled={isUsed}
                                      onClick={() => setHouseFormColor(pal.hex)}
                                      className={`size-6 rounded-md border flex items-center justify-center relative shrink-0 transition-opacity ${isUsed
                                          ? "opacity-20 cursor-not-allowed border-transparent"
                                          : "cursor-pointer border-black/10 dark:border-white/20 hover:opacity-90"
                                        }`}
                                      style={{ backgroundColor: pal.hex }}
                                      title={isUsed ? `${pal.name} (Used by another house)` : pal.name}
                                    >
                                      {isSelected && <Check className="size-3.5 text-white stroke-[2.5] drop-shadow-xs" />}
                                    </button>
                                  )
                                })}

                                {/* Custom Color Trigger Button in Same Row */}
                                {(() => {
                                  const isCustomActive = !CURATED_HOUSE_PALETTE.some(
                                    (pal) => pal.hex === normalizeHexColor(houseFormColor)
                                  )
                                  return (
                                    <label
                                      className="size-6 rounded-md border border-black/10 dark:border-white/20 relative flex items-center justify-center cursor-pointer shrink-0 transition-opacity hover:opacity-90"
                                      style={{
                                        background: isCustomActive
                                          ? houseFormColor
                                          : "conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)",
                                      }}
                                      title="Custom Color"
                                    >
                                      <input
                                        type="color"
                                        value={houseFormColor}
                                        onChange={(e) => setHouseFormColor(e.target.value.toUpperCase())}
                                        className="absolute inset-0 opacity-0 cursor-pointer size-full"
                                      />
                                      {isCustomActive ? (
                                        <Check className="size-3.5 text-white stroke-[2.5] drop-shadow-xs" />
                                      ) : (
                                        <Pipette className="size-3 text-white drop-shadow-sm" />
                                      )}
                                    </label>
                                  )
                                })()}
                              </div>
                            </div>

                            {/* Row 3: Emblem upload / preview with selected color background */}
                            <div className="pt-0.5">
                              <input
                                ref={houseEmblemInputRef}
                                type="file"
                                accept="image/png, image/jpeg, image/jpg, image/webp"
                                onChange={(e) => {
                                  handleHouseEmblemUpload(e)
                                  e.target.value = ""
                                }}
                                className="hidden"
                              />

                              {houseEmblemError && (
                                <p className="text-[11px] text-destructive mb-1.5">{houseEmblemError}</p>
                              )}

                              {houseFormEmblem ? (
                                <div className="flex items-center justify-between p-2 rounded-xl border border-border bg-muted/20 transition-all">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="size-9 rounded-lg flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
                                      <img
                                        src={houseFormEmblem}
                                        alt="Emblem Preview"
                                        className="size-full object-contain"
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <span className="text-xs text-foreground font-semibold truncate block">
                                        Emblem Attached
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => houseEmblemInputRef.current?.click()}
                                      className="text-[11px] text-primary hover:underline px-1 py-0.5 cursor-pointer font-semibold"
                                    >
                                      Change
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setHouseFormEmblem("")
                                        if (houseEmblemInputRef.current) houseEmblemInputRef.current.value = ""
                                      }}
                                      className="text-[11px] text-destructive hover:underline px-1 py-0.5 cursor-pointer font-semibold"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => houseEmblemInputRef.current?.click()}
                                  disabled={isUploadingHouseEmblem}
                                  className="w-full h-8 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-muted/40 text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {isUploadingHouseEmblem ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <Upload className="size-3.5" />
                                  )}
                                  <span>{isUploadingHouseEmblem ? "Uploading..." : "Upload Emblem (Optional)"}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl border border-border bg-card flex items-center justify-between gap-3 text-xs shadow-2xs hover:border-border/80 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {h.emblem_url || h.emblem ? (
                              <div className="size-11 rounded-lg flex items-center justify-center shrink-0 overflow-hidden p-0.5">
                                <img
                                  src={h.emblem_url || h.emblem}
                                  alt={h.name}
                                  className="size-full object-contain"
                                />
                              </div>
                            ) : (
                              <div
                                className="size-11 rounded-lg border flex items-center justify-center shrink-0 shadow-2xs"
                                style={{
                                  backgroundColor: `${h.color}15`,
                                  borderColor: `${h.color}35`,
                                }}
                              >
                                <Shield className="size-5" style={{ color: h.color }} />
                              </div>
                            )}
                            <div className="min-w-0 flex items-center gap-2">
                              <span
                                className="size-2.5 rounded-full shrink-0 shadow-xs"
                                style={{ backgroundColor: h.color }}
                                title="House Color"
                              />
                              <span className="font-bold text-foreground text-sm truncate">{h.name}</span>
                            </div>
                          </div>

                          <div className="flex items-center shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditHouse(idx)}
                              className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors cursor-pointer"
                              title={`Edit ${h.name}`}
                            >
                              <Edit3 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* STEP 7: PASSWORD & PIN */}
          {/* ========================================== */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-foreground">Step 7: Security Credentials</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                  Configure your master password and 4-10 digit Quick Login PIN for fast terminal access.
                </p>
              </div>

              {/* Password Box */}
              <div className="p-4.5 rounded-2xl border border-border bg-card space-y-4">
                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <Lock className="size-4 text-primary" />
                  <span>Master Password</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Create Password</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-10 h-10 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Confirm Password</label>
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* PIN Box */}
              <div className="p-4.5 rounded-2xl border border-border bg-card space-y-4">
                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <Hash className="size-4 text-primary" />
                  <span>Quick Login PIN (4 to 10 numeric digits)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Create PIN</label>
                    <div className="relative">
                      <Input
                        type={showPin ? "text" : "password"}
                        maxLength={10}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                        className="pr-10 h-10 text-sm font-mono tracking-widest"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Confirm PIN</label>
                    <Input
                      type={showPin ? "text" : "password"}
                      maxLength={10}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                      className="h-10 text-sm font-mono tracking-widest"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* STEP 8: REVIEW & FINALIZE */}
          {/* ========================================== */}
          {currentStep === 8 && (
            <div className="space-y-6">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-foreground">Step 8: Review &amp; Finish Setup</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                  Verify your configured school structure. Click any Edit link to return directly to that step.
                </p>
              </div>

              <div className="space-y-4">
                {/* 1. School Profile */}
                <div className="p-4 rounded-2xl border border-border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                      <Building2 className="size-4 text-primary" />
                      <span>School Profile &amp; Identity</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Edit3 className="size-3" /> Edit
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block">School Name</span>
                      <strong className="text-foreground">{schoolName}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Affiliation Code</span>
                      <strong className="font-mono text-foreground">{schoolCode}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Email</span>
                      <span className="text-foreground truncate block">{schoolEmail}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Phone</span>
                      <span className="font-mono text-foreground">{schoolPhone}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/60 text-xs flex justify-between items-center">
                    <div>
                      <span className="text-muted-foreground block mb-0.5">Address</span>
                      <p className="text-foreground font-medium">{getFullFormattedAddress()}</p>
                    </div>
                    {emblemUploadedUrl && (
                      <img
                        src={emblemUploadedUrl}
                        alt="Emblem"
                        className="size-8 object-contain rounded border border-border bg-muted/20 p-0.5"
                      />
                    )}
                  </div>
                </div>

                {/* 2. Academic Structure */}
                <div className="p-4 rounded-2xl border border-border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                      <BookOpen className="size-4 text-primary" />
                      <span>Academic Structure</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Edit3 className="size-3" /> Edit
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-muted/20 border border-border">
                      <span className="text-muted-foreground block font-medium">Classes Configured</span>
                      <strong className="text-foreground text-sm mt-0.5 block">{classesList.length} Classes</strong>
                      <span className="text-[11px] text-muted-foreground">
                        {classesList[0]} → {classesList[classesList.length - 1]}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-muted/20 border border-border">
                      <span className="text-muted-foreground block font-medium">Sections</span>
                      <strong className="text-foreground text-sm mt-0.5 block">
                        {Array.from(new Set(Object.values(classSectionMap).flat())).join(", ") || [...INITIAL_DEFAULT_SECTIONS, ...SENIOR_SECONDARY_DEFAULT_SECTIONS].join(", ")}
                      </strong>
                      <span className="text-[11px] text-muted-foreground">Applied across classes</span>
                    </div>

                    <div className="p-3 rounded-xl bg-muted/20 border border-border">
                      <span className="text-muted-foreground block font-medium">Subject Library</span>
                      <strong className="text-foreground text-sm mt-0.5 block">{getAllUniqueSubjectsAcrossAllClasses().length} Subjects</strong>
                      <span className="text-[11px] text-muted-foreground">Assigned to grade levels</span>
                    </div>
                  </div>
                </div>

                {/* 3. Wings & Houses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Wings Card */}
                  <div className="p-4 rounded-2xl border border-border bg-card space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                        <Compass className="size-4 text-primary" />
                        <span>Academic Wings</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(5)}
                        className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                      >
                        <Edit3 className="size-3" /> Edit
                      </button>
                    </div>
                    {wingsList.length > 0 ? (
                      <div className="space-y-1.5 text-xs max-h-[160px] overflow-y-auto pr-1">
                        {wingsList.map((w) => (
                          <div key={w.name} className="flex justify-between items-start text-muted-foreground gap-2">
                            <span className="font-semibold text-foreground shrink-0">{w.name}:</span>
                            <span className="text-right">
                              {w.classes && w.classes.length > 0 ? (
                                w.classes.join(", ")
                              ) : (
                                <span className="italic text-muted-foreground">No classes assigned</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No wings configured</p>
                    )}
                  </div>

                  {/* Houses Card */}
                  <div className="p-4 rounded-2xl border border-border bg-card space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                        <Shield className="size-4 text-primary" />
                        <span>School Houses</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(6)}
                        className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                      >
                        <Edit3 className="size-3" /> Edit
                      </button>
                    </div>
                    {useHouses && housesList.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {housesList.map((h) => (
                          <span
                            key={h.name}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border border-border bg-muted/40"
                          >
                            {h.emblem_url || h.emblem ? (
                              <img src={h.emblem_url || h.emblem} alt="" className="size-3.5 object-contain" />
                            ) : (
                              <span className="size-2.5 rounded-full" style={{ backgroundColor: h.color }} />
                            )}
                            {h.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No houses configured (Skipped)</p>
                    )}
                  </div>
                </div>

                {/* 4. Credentials */}
                <div className="p-4 rounded-2xl border border-border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                      <KeyRound className="size-4 text-primary" />
                      <span>Security Credentials</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(7)}
                      className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Edit3 className="size-3" /> Edit
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-emerald-500" />
                      <span className="text-foreground font-medium">Master Password Configured</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-emerald-500" />
                      <span className="text-foreground font-medium">Quick Login PIN Configured</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation CTAs */}
          <div className="flex items-center justify-between pt-6 border-t border-border mt-8">
            {currentStep > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevStep}
                disabled={isSubmitting || isUploadingEmblem}
                className="h-11 px-6 sm:px-8 text-sm font-semibold rounded-xl gap-2 border-border cursor-pointer hover:bg-muted transition-all"
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
            ) : (
              <div />
            )}

            {currentStep < 8 ? (
              <div className="flex items-center gap-2">
                {/* Optional step skip shortcut */}
                {currentStep === 5 && useWings && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setUseWings(false)
                      handleNextStep()
                    }}
                    className="h-11 text-xs text-muted-foreground cursor-pointer"
                  >
                    Skip Wings
                  </Button>
                )}
                {currentStep === 6 && useHouses && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setUseHouses(false)
                      handleNextStep()
                    }}
                    className="h-11 text-xs text-muted-foreground cursor-pointer"
                  >
                    Skip Houses
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={handleNextStep}
                  disabled={isUploadingEmblem}
                  className="h-11 px-7 sm:px-9 text-sm font-bold rounded-xl gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer transition-all"
                >
                  Continue <ArrowRight className="size-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                onClick={handleCompleteSetup}
                disabled={isSubmitting}
                className="h-11 sm:h-12 px-8 sm:px-10 text-sm sm:text-base font-bold rounded-xl gap-2.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer transition-all"
              >
                {isSubmitting ? (
                  <>
                    <span className="size-4.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Activating School...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-5" /> Finish Setup &amp; Activate
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SchoolSetupWizard
