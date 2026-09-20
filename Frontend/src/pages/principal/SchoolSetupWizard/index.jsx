import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams, useNavigate, Link } from "react-router-dom"
import {
  Building2,
  BookOpen,
  Layers,
  Bookmark,
  Compass,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
} from "lucide-react"
import { authService } from "@/api/authService"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  validateEmblemFile,
  validateSetupWizardStep,
  validateHouseInlineEdit,
} from "@/validations"
import {
  INITIAL_DEFAULT_CLASSES,
  INITIAL_DEFAULT_HOUSES,
  getDefaultSectionsForClass,
  isSeniorSecondaryClass,
  getDefaultSubjectsForStreamSection,
  getDefaultSubjectsForClass,
  getInitialClassSubjectConfig,
  getInitialWingsForClasses,
} from "@/constants"
import { Step1Profile } from "./Step1_Profile"
import { Step2Classes } from "./Step2_Classes"
import { Step3Sections } from "./Step3_Sections"
import { Step4Subjects } from "./Step4_Subjects"
import { Step5Wings } from "./Step5_Wings"
import { Step6Houses } from "./Step6_Houses"
import { Step7Security } from "./Step7_Security"
import { Step8Review } from "./Step8_Review"

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
  useEffect(() => {
    const timer = setTimeout(() => {
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
    }, 800)
    return () => clearTimeout(timer)
  }, [
    draftStorageKey,
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

  const handleProceedToLogin = useCallback(() => {
    if (draftStorageKey) {
      localStorage.removeItem(draftStorageKey)
    }
    logout()
    navigate("/principal/login", { replace: true })
  }, [draftStorageKey, logout, navigate])

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
  }, [setupSuccess, handleProceedToLogin])

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
          ;(secConf.academic || []).forEach((sub) => {
            if (!mergedAcad.includes(sub)) mergedAcad.push(sub)
          })
          ;(secConf.nonAcademic || []).forEach((sub) => {
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
        ;(conf.shared?.academic || []).forEach((sub) => {
          const key = sub.trim().toLowerCase()
          if (!map.has(key)) {
            globalOrder += 1
            map.set(key, { name: sub.trim(), category: "academic", is_academic: true, order_index: globalOrder })
          }
        })
        ;(conf.shared?.nonAcademic || []).forEach((sub) => {
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
          ;(secConf.academic || []).forEach((sub) => {
            const key = sub.trim().toLowerCase()
            if (!map.has(key)) {
              globalOrder += 1
              map.set(key, { name: sub.trim(), category: "academic", is_academic: true, order_index: globalOrder })
            }
          })
          ;(secConf.nonAcademic || []).forEach((sub) => {
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
                className={`flex flex-col items-center text-center p-2 rounded-xl transition-all cursor-pointer ${
                  isCurrent
                    ? "bg-primary/10 border-2 border-primary/50 text-primary font-bold shadow-xs"
                    : isDone
                    ? "text-foreground hover:bg-muted/40"
                    : "text-muted-foreground/60 cursor-not-allowed opacity-75"
                }`}
              >
                <div
                  className={`size-8 sm:size-9 rounded-xl flex items-center justify-center mb-1 text-xs transition-colors ${
                    isCurrent
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
            <Step1Profile
              emblemUploadError={emblemUploadError}
              emblemInputRef={emblemInputRef}
              handleEmblemFileChange={handleEmblemFileChange}
              emblemPreviewUrl={emblemPreviewUrl}
              isUploadingEmblem={isUploadingEmblem}
              handleRemoveEmblem={handleRemoveEmblem}
              schoolName={schoolName}
              setSchoolName={setSchoolName}
              schoolCode={schoolCode}
              setSchoolCode={setSchoolCode}
              schoolEmail={schoolEmail}
              schoolPhone={schoolPhone}
              addressStreet={addressStreet}
              setAddressStreet={setAddressStreet}
              addressLandmark={addressLandmark}
              setAddressLandmark={setAddressLandmark}
              addressCity={addressCity}
              setAddressCity={setAddressCity}
              addressState={addressState}
              setAddressState={setAddressState}
              addressPincode={addressPincode}
              setAddressPincode={setAddressPincode}
              primaryColor={primaryColor}
              setPrimaryColor={setPrimaryColor}
            />
          )}

          {/* ========================================== */}
          {/* STEP 2: CLASSES (SMART DEFAULTS) */}
          {/* ========================================== */}
          {currentStep === 2 && (
            <Step2Classes
              classesList={classesList}
              editingClassIdx={editingClassIdx}
              setEditingClassIdx={setEditingClassIdx}
              editingClassName={editingClassName}
              setEditingClassName={setEditingClassName}
              isAddingClass={isAddingClass}
              setIsAddingClass={setIsAddingClass}
              newClassName={newClassName}
              setNewClassName={setNewClassName}
              newClassPosition={newClassPosition}
              setNewClassPosition={setNewClassPosition}
              targetClassAnchor={targetClassAnchor}
              setTargetClassAnchor={setTargetClassAnchor}
              classDragState={classDragState}
              classesContainerRef={classesContainerRef}
              handleClassDragStart={handleClassDragStart}
              handleSaveEditClass={handleSaveEditClass}
              handleDeleteClass={handleDeleteClass}
              handleResetClassesToDefault={handleResetClassesToDefault}
              handleAddClass={handleAddClass}
            />
          )}

          {/* ========================================== */}
          {/* STEP 3: CLASS SECTIONS */}
          {/* ========================================== */}
          {currentStep === 3 && (
            <Step3Sections
              classesList={classesList}
              classSectionMap={classSectionMap}
              editingSectionState={editingSectionState}
              setEditingSectionState={setEditingSectionState}
              editingSectionNameVal={editingSectionNameVal}
              setEditingSectionNameVal={setEditingSectionNameVal}
              addingSectionForClass={addingSectionForClass}
              setAddingSectionForClass={setAddingSectionForClass}
              newSectionForClassName={newSectionForClassName}
              setNewSectionForClassName={setNewSectionForClassName}
              sectionDragState={sectionDragState}
              handleResetAllClassSections={handleResetAllClassSections}
              handleSectionDragStart={handleSectionDragStart}
              handleStartEditSection={handleStartEditSection}
              handleSaveEditSectionForClass={handleSaveEditSectionForClass}
              handleDeleteSectionFromClass={handleDeleteSectionFromClass}
              handleAddSectionToClass={handleAddSectionToClass}
            />
          )}

          {/* ========================================== */}
          {/* STEP 4: SUBJECTS (CLASS-FIRST REDESIGN) */}
          {/* ========================================== */}
          {currentStep === 4 && (
            <Step4Subjects
              classesList={classesList}
              classSectionMap={classSectionMap}
              classSubjectConfig={classSubjectConfig}
              subjectSearchQuery={subjectSearchQuery}
              setSubjectSearchQuery={setSubjectSearchQuery}
              collapsedClassMap={collapsedClassMap}
              setCollapsedClassMap={setCollapsedClassMap}
              unifyModalState={unifyModalState}
              setUnifyModalState={setUnifyModalState}
              editingSubjectState={editingSubjectState}
              setEditingSubjectState={setEditingSubjectState}
              editingSubjectNameVal={editingSubjectNameVal}
              setEditingSubjectNameVal={setEditingSubjectNameVal}
              addingSubjectInline={addingSubjectInline}
              setAddingSubjectInline={setAddingSubjectInline}
              addingSubjectInputVal={addingSubjectInputVal}
              setAddingSubjectInputVal={setAddingSubjectInputVal}
              addingSubjectCategoryVal={addingSubjectCategoryVal}
              setAddingSubjectCategoryVal={setAddingSubjectCategoryVal}
              copyClassModal={copyClassModal}
              setCopyClassModal={setCopyClassModal}
              subjectFeedbackMessage={subjectFeedbackMessage}
              setSubjectFeedbackMessage={setSubjectFeedbackMessage}
              draggedSubject={draggedSubject}
              setDraggedSubject={setDraggedSubject}
              dragOverCategory={dragOverCategory}
              setDragOverCategory={setDragOverCategory}
              handleToggleClassShared={handleToggleClassShared}
              handleConfirmUnifyShared={handleConfirmUnifyShared}
              handleAddSubjectToClassOrSection={handleAddSubjectToClassOrSection}
              handleStartEditSubject={handleStartEditSubject}
              handleSaveEditSubjectForClassOrSection={handleSaveEditSubjectForClassOrSection}
              handleDeleteSubjectFromClassOrSection={handleDeleteSubjectFromClassOrSection}
              handleMoveSubjectCategory={handleMoveSubjectCategory}
              handleReorderSubjects={handleReorderSubjects}
              handleResetClassSubjectsToDefault={handleResetClassSubjectsToDefault}
              handleCopySubjectsToTarget={handleCopySubjectsToTarget}
              getAllUniqueSubjectsAcrossAllClasses={getAllUniqueSubjectsAcrossAllClasses}
            />
          )}

          {/* ========================================== */}
          {/* STEP 5: ACADEMIC WINGS */}
          {/* ========================================== */}
          {currentStep === 5 && (
            <Step5Wings
              wingsList={wingsList}
              unassignedClasses={unassignedClasses}
              editingWingIdx={editingWingIdx}
              editingWingNameVal={editingWingNameVal}
              setEditingWingNameVal={setEditingWingNameVal}
              isAddingCustomWing={isAddingCustomWing}
              setIsAddingCustomWing={setIsAddingCustomWing}
              newCustomWingName={newCustomWingName}
              setNewCustomWingName={setNewCustomWingName}
              dragOverArea={dragOverArea}
              setDragOverArea={setDragOverArea}
              handleResetWingsToDefault={handleResetWingsToDefault}
              handleAddCustomWing={handleAddCustomWing}
              handleStartEditWing={handleStartEditWing}
              handleSaveEditWing={handleSaveEditWing}
              handleCancelEditWing={handleCancelEditWing}
              handleDeleteWing={handleDeleteWing}
              handleRemoveClassFromWing={handleRemoveClassFromWing}
              handleWingClassDragStart={handleWingClassDragStart}
              handleWingClassDragOver={handleWingClassDragOver}
              handleWingClassDrop={handleWingClassDrop}
              handleWingClassDragEnd={handleWingClassDragEnd}
            />
          )}

          {/* ========================================== */}
          {/* STEP 6: HOUSES (OPTIONAL, MAX 4, EMBLEMS) */}
          {/* ========================================== */}
          {currentStep === 6 && (
            <Step6Houses
              useHouses={useHouses}
              setUseHouses={setUseHouses}
              housesList={housesList}
              editingHouseIdx={editingHouseIdx}
              houseFormName={houseFormName}
              setHouseFormName={setHouseFormName}
              houseFormColor={houseFormColor}
              setHouseFormColor={setHouseFormColor}
              houseFormEmblem={houseFormEmblem}
              setHouseFormEmblem={setHouseFormEmblem}
              isUploadingHouseEmblem={isUploadingHouseEmblem}
              houseEmblemError={houseEmblemError}
              houseEmblemInputRef={houseEmblemInputRef}
              normalizeHexColor={normalizeHexColor}
              isColorUsedByOtherHouse={isColorUsedByOtherHouse}
              handleStartEditHouse={handleStartEditHouse}
              handleSaveHouseInline={handleSaveHouseInline}
              handleCancelHouseEdit={handleCancelHouseEdit}
              handleHouseEmblemUpload={handleHouseEmblemUpload}
              handleNextStep={handleNextStep}
            />
          )}

          {/* ========================================== */}
          {/* STEP 7: PASSWORD & PIN */}
          {/* ========================================== */}
          {currentStep === 7 && (
            <Step7Security
              password={password}
              setPassword={setPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              pin={pin}
              setPin={setPin}
              confirmPin={confirmPin}
              setConfirmPin={setConfirmPin}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              showPin={showPin}
              setShowPin={setShowPin}
            />
          )}

          {/* ========================================== */}
          {/* STEP 8: REVIEW & FINALIZE */}
          {/* ========================================== */}
          {currentStep === 8 && (
            <Step8Review
              schoolName={schoolName}
              schoolCode={schoolCode}
              schoolEmail={schoolEmail}
              schoolPhone={schoolPhone}
              getFullFormattedAddress={getFullFormattedAddress}
              emblemUploadedUrl={emblemUploadedUrl}
              classesList={classesList}
              classSectionMap={classSectionMap}
              getAllUniqueSubjectsAcrossAllClasses={getAllUniqueSubjectsAcrossAllClasses}
              wingsList={wingsList}
              useHouses={useHouses}
              housesList={housesList}
              setCurrentStep={setCurrentStep}
            />
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

export {
  Step1Profile,
  Step2Classes,
  Step3Sections,
  Step4Subjects,
  Step5Wings,
  Step6Houses,
  Step7Security,
  Step8Review,
}

export default SchoolSetupWizard
