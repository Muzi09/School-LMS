import React, { useState, useEffect, useRef } from "react"
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
} from "lucide-react"
import { authService } from "@/api/authService"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

const INDIAN_STATES = [
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

const HOUSE_COLOR_OPTIONS = [
  { label: "Red", value: "#ef4444" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Green", value: "#10b981" },
  { label: "Yellow", value: "#f59e0b" },
  { label: "Purple", value: "#a855f7" },
  { label: "Orange", value: "#f97316" },
]

const THEME_COLOR_PRESETS = [
  { label: "Default", value: "#ffffff" },
  { label: "Royal Blue", value: "#2563eb" },
  { label: "Emerald Green", value: "#059669" },
  { label: "Crimson Red", value: "#dc2626" },
  { label: "Amethyst Purple", value: "#7c3aed" },
  { label: "Indigo Slate", value: "#4f46e5" },
  { label: "Teal Cyan", value: "#0d9488" },
  { label: "Amber Gold", value: "#d97706" },
]

export function SchoolSetupWizard() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const token = searchParams.get("token") || ""
  const emblemInputRef = useRef(null)

  // Validation / Loading States
  const [isValidating, setIsValidating] = useState(true)
  const [tokenError, setTokenError] = useState(null)
  const [principalInfo, setPrincipalInfo] = useState(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [setupSuccess, setSetupSuccess] = useState(false)
  const [countdown, setCountdown] = useState(7)

  // Step 1: School Identity & Profile
  // Top: Emblem
  const [emblemPreviewUrl, setEmblemPreviewUrl] = useState("")
  const [emblemUploadedUrl, setEmblemUploadedUrl] = useState("")
  const [isUploadingEmblem, setIsUploadingEmblem] = useState(false)
  const [emblemUploadError, setEmblemUploadError] = useState(null)

  // Middle: School Details
  const [schoolName, setSchoolName] = useState("")
  const [schoolCode, setSchoolCode] = useState("") // Affiliation Code (Numeric only)
  const [schoolEmail, setSchoolEmail] = useState("")
  const [schoolPhone, setSchoolPhone] = useState("")

  // Middle: Indian Standard Address Fields
  const [addressStreet, setAddressStreet] = useState("")
  const [addressLandmark, setAddressLandmark] = useState("")
  const [addressCity, setAddressCity] = useState("")
  const [addressState, setAddressState] = useState("Delhi")
  const [addressPincode, setAddressPincode] = useState("")

  // Bottom: Theme Color
  const [primaryColor, setPrimaryColor] = useState("#FFFFFF") // Empty = default theme

  // Step 2: Classes
  const [classes, setClasses] = useState([
    { name: "Class 1", order_index: 1, sections: ["A", "B"] },
    { name: "Class 2", order_index: 2, sections: ["A", "B"] },
    { name: "Class 3", order_index: 3, sections: ["A", "B"] },
    { name: "Class 4", order_index: 4, sections: ["A", "B"] },
    { name: "Class 5", order_index: 5, sections: ["A", "B"] },
  ])
  const [newClassName, setNewClassName] = useState("")

  // Step 3: Sections are managed within classes array

  // Step 4: Houses
  const [houses, setHouses] = useState([
    { name: "Red House", color: "#ef4444" },
    { name: "Blue House", color: "#3b82f6" },
    { name: "Green House", color: "#10b981" },
    { name: "Yellow House", color: "#f59e0b" },
  ])
  const [newHouseName, setNewHouseName] = useState("")
  const [newHouseColor, setNewHouseColor] = useState("#ef4444")

  // Step 5: Credentials
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showPin, setShowPin] = useState(false)

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
    logout()
    navigate("/principal/login", { replace: true })
  }

  // Class Helpers
  const addClass = () => {
    const trimmed = newClassName.trim()
    if (!trimmed) return
    if (classes.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return

    setClasses([
      ...classes,
      { name: trimmed, order_index: classes.length + 1, sections: ["A", "B"] },
    ])
    setNewClassName("")
  }

  const removeClass = (index) => {
    setClasses(classes.filter((_, idx) => idx !== index))
  }

  const applyPresetClasses = (start, end) => {
    const list = []
    for (let i = start; i <= end; i++) {
      list.push({ name: `Class ${i}`, order_index: i, sections: ["A", "B"] })
    }
    setClasses(list)
  }

  // Section Helpers
  const addSectionToClass = (classIndex, sectionName) => {
    const trimmed = sectionName.trim().toUpperCase()
    if (!trimmed) return
    const targetClass = classes[classIndex]
    if (targetClass.sections.includes(trimmed)) return

    const updated = [...classes]
    updated[classIndex] = {
      ...targetClass,
      sections: [...targetClass.sections, trimmed],
    }
    setClasses(updated)
  }

  const removeSectionFromClass = (classIndex, secIndex) => {
    const targetClass = classes[classIndex]
    const updated = [...classes]
    updated[classIndex] = {
      ...targetClass,
      sections: targetClass.sections.filter((_, idx) => idx !== secIndex),
    }
    setClasses(updated)
  }

  // House Helpers
  const addHouse = () => {
    const trimmed = newHouseName.trim()
    if (!trimmed) return
    if (houses.some((h) => h.name.toLowerCase() === trimmed.toLowerCase())) return

    setHouses([...houses, { name: trimmed, color: newHouseColor }])
    setNewHouseName("")
  }

  const removeHouse = (index) => {
    setHouses(houses.filter((_, idx) => idx !== index))
  }

  // Emblem File Handler
  const handleEmblemFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setEmblemUploadError(null)

    if (file.size > 5 * 1024 * 1024) {
      setEmblemUploadError("Image size must be 5 MB or less.")
      return
    }

    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if (!validTypes.includes(file.type)) {
      setEmblemUploadError("Supported image formats: PNG, JPG, JPEG, WEBP.")
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

  // Step Validation & Navigation
  const handleNextStep = () => {
    setSubmitError(null)

    // Step 1: School Identity, Details, Address, Theme
    if (currentStep === 1) {
      if (!schoolName.trim()) {
        setSubmitError("Please enter the School Name.")
        return
      }
      if (!schoolCode.trim()) {
        setSubmitError("Please enter the Affiliation Code (numbers only).")
        return
      }
      if (!addressStreet.trim()) {
        setSubmitError("Please provide the Street / Building / Area address.")
        return
      }
      if (!addressCity.trim()) {
        setSubmitError("Please provide the City / District.")
        return
      }
      if (!addressState.trim()) {
        setSubmitError("Please select the State / Union Territory.")
        return
      }
      if (!addressPincode.trim() || !/^\d{6}$/.test(addressPincode.trim())) {
        setSubmitError("Please enter a valid 6-digit Indian PIN Code.")
        return
      }
      if (primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(primaryColor.trim())) {
        setSubmitError("Please enter a valid 6-character HEX color code (e.g. #2563EB) or reset.")
        return
      }
    }

    // Step 2: Classes
    if (currentStep === 2) {
      if (classes.length === 0) {
        setSubmitError("Please configure at least one class for your school.")
        return
      }
    }

    // Step 3: Sections
    if (currentStep === 3) {
      const hasEmptySections = classes.some((c) => c.sections.length === 0)
      if (hasEmptySections) {
        setSubmitError("Every class must have at least one section configured.")
        return
      }
    }

    // Step 5: Credentials (Password & PIN)
    if (currentStep === 5) {
      if (password.length < 8) {
        setSubmitError("Password must be at least 8 characters.")
        return
      }
      if (password !== confirmPassword) {
        setSubmitError("Password and Confirm Password do not match.")
        return
      }
      if (!/^\d{4,10}$/.test(pin)) {
        setSubmitError("Quick Login PIN must be 4 to 10 numeric digits.")
        return
      }
      if (pin !== confirmPin) {
        setSubmitError("PIN and Confirm PIN do not match.")
        return
      }
    }

    setCurrentStep((prev) => prev + 1)
  }

  const handlePrevStep = () => {
    setSubmitError(null)
    setCurrentStep((prev) => Math.max(1, prev - 1))
  }

  // Combined Address formatted for backend
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

  // Complete Setup Submission
  const handleCompleteSetup = async () => {
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const finalAddress = getFullFormattedAddress()
      await authService.completeSchoolSetup({
        token,
        school_name: schoolName.trim(),
        school_code: schoolCode.trim(),
        school_email: schoolEmail.trim().toLowerCase(),
        school_phone: schoolPhone.trim(),
        address: finalAddress,
        primary_color: primaryColor.trim() ? primaryColor.trim().toUpperCase() : null,
        emblem_url: emblemUploadedUrl || null,
        classes: classes.map((c, i) => ({
          name: c.name.trim(),
          order_index: i + 1,
          sections: c.sections,
        })),
        houses: houses.map((h) => ({
          name: h.name.trim(),
          color: h.color,
        })),
        password,
        confirm_password: confirmPassword,
        pin,
        confirm_pin: confirmPin,
      })

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
              <span className="text-muted-foreground">Theme Color:</span>
              <span className="text-foreground font-mono flex items-center gap-1.5">
                {primaryColor ? (
                  <>
                    <span className="size-3 rounded-full border border-border" style={{ backgroundColor: primaryColor }} />
                    {primaryColor}
                  </>
                ) : (
                  "Default Theme"
                )}
              </span>
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

  // 6 Consolidated Steps
  const steps = [
    { num: 1, label: "School Profile", icon: Building2 },
    { num: 2, label: "Classes", icon: BookOpen },
    { num: 3, label: "Sections", icon: Layers },
    { num: 4, label: "Houses", icon: Shield },
    { num: 5, label: "Password & PIN", icon: KeyRound },
    { num: 6, label: "Review", icon: CheckCircle2 },
  ]

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col justify-between p-4 md:p-8">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-xs">
          <div>
            <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
              School Onboarding Wizard
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
              Welcome, {principalInfo?.first_name} {principalInfo?.last_name}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 leading-relaxed">
              Follow the steps below to initialize your school workspace and credentials.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <Badge variant="outline" className="text-sm px-3.5 py-1 bg-muted/50 border-border font-semibold">
              Step {currentStep} of {steps.length}
            </Badge>
          </div>
        </div>

        {/* Stepper Navigation */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 bg-card p-3.5 rounded-2xl border border-border shadow-xs overflow-x-auto">
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
                className={`flex flex-col items-center text-center p-2.5 rounded-xl transition-all cursor-pointer ${
                  isCurrent
                    ? "bg-primary/10 border-2 border-primary/40 text-primary font-bold shadow-xs scale-102"
                    : isDone
                    ? "text-foreground hover:bg-muted/40"
                    : "text-muted-foreground/50 cursor-not-allowed opacity-60"
                }`}
              >
                <div
                  className={`size-9 sm:size-10 rounded-xl flex items-center justify-center mb-1.5 text-sm transition-colors ${
                    isCurrent
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : isDone
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="size-4.5" /> : <Icon className="size-4.5" />}
                </div>
                <span className="text-xs sm:text-sm font-semibold truncate max-w-full leading-tight">{step.label}</span>
              </button>
            )
          })}
        </div>

        {/* Wizard Main Card */}
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xs">
          {submitError && (
            <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2.5">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{submitError}</span>
            </div>
          )}

          {/* STEP 1: CONSOLIDATED SCHOOL PROFILE (Emblem at top -> School Details -> Address -> Theme at bottom) */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-foreground">Step 1: School Profile & Identity</h2>
                <p className="text-sm sm:text-base text-muted-foreground mt-1 leading-relaxed">
                  Upload your school emblem, enter institution identity &amp; address, and choose your portal theme color.
                </p>
              </div>

              {/* 1. TOP: School Emblem / Logo Upload */}
              <div className="p-4.5 sm:p-5 rounded-2xl border border-border bg-muted/20 space-y-3">
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
                          <CheckCircle2 className="size-3.5 text-emerald-500" /> Emblem Ready
                        </div>
                        <div className="text-[11px] text-muted-foreground">Uploaded &amp; verified for portal header</div>
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
                        {isUploadingEmblem ? "Uploading Emblem..." : "Click to select School Emblem / Crest"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        PNG (transparent recommended), JPG, WEBP (Max 5 MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. MIDDLE: School Information */}
              <div className="space-y-3">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      School Name
                    </label>
                    <Input
                      type="text"
                      maxLength={255}
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Affiliation Code
                    </label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={30}
                      value={schoolCode}
                      onChange={(e) => {
                        const numericOnly = e.target.value.replace(/\D/g, "")
                        setSchoolCode(numericOnly)
                      }}
                      className="h-10 text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Official School Email
                    </label>
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
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Official Phone Number
                    </label>
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

              {/* 3. MIDDLE: Indian Standard Address Fields */}
              <div className="space-y-3 pt-1">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Street / Building / Area
                    </label>
                    <Input
                      type="text"
                      value={addressStreet}
                      onChange={(e) => setAddressStreet(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Landmark (Optional)
                    </label>
                    <Input
                      type="text"
                      value={addressLandmark}
                      onChange={(e) => setAddressLandmark(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      City / District
                    </label>
                    <Input
                      type="text"
                      value={addressCity}
                      onChange={(e) => setAddressCity(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      State / Union Territory
                    </label>
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
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      PIN Code
                    </label>
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

              {/* 4. LAST: Theme Color Selector */}
              <div className="space-y-3 pt-1 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="size-4 text-primary" />
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Portal Theme Color (Optional)
                    </span>
                  </div>
                  {primaryColor && (
                    <button
                      type="button"
                      onClick={() => setPrimaryColor("")}
                      className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="size-3" /> Reset Default
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Color Picker + Input */}
                  <div className="flex items-center gap-3">
                    <div className="relative size-10 shrink-0 rounded-xl overflow-hidden border border-border shadow-xs cursor-pointer">
                      <input
                        type="color"
                        value={primaryColor || "#FFFFFF"}
                        onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
                        className="absolute inset-0 size-full scale-150 cursor-pointer border-0 p-0"
                        title="Click to open color picker"
                      />
                    </div>
                    <Input
                      type="text"
                      maxLength={7}
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
                      className="h-10 w-32 text-sm font-mono uppercase tracking-wider"
                    />
                  </div>

                  {/* Presets Grid */}
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {THEME_COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setPrimaryColor(preset.value.toUpperCase())}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all cursor-pointer ${
                          primaryColor.toUpperCase() === preset.value.toUpperCase()
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

          {/* STEP 2: CLASSES */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-foreground">Step 2: Classes / Grades</h2>
                <p className="text-sm sm:text-base text-muted-foreground mt-1 leading-relaxed">
                  Configure the grade levels offered at your school.
                </p>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground mr-1">Quick Presets:</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPresetClasses(1, 5)}
                  className="text-xs h-8 cursor-pointer"
                >
                  Class 1 - 5 (Primary)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPresetClasses(1, 10)}
                  className="text-xs h-8 cursor-pointer"
                >
                  Class 1 - 10 (Secondary)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPresetClasses(1, 12)}
                  className="text-xs h-8 cursor-pointer"
                >
                  Class 1 - 12 (K-12)
                </Button>
              </div>

              {/* Add Custom Class */}
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addClass())}
                  className="h-10 text-sm flex-1"
                />
                <Button type="button" onClick={addClass} className="h-10 gap-1.5 cursor-pointer">
                  <Plus className="size-4" /> Add Class
                </Button>
              </div>

              {/* Classes List */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                {classes.map((cls, idx) => (
                  <div
                    key={cls.name}
                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30"
                  >
                    <span className="text-xs font-bold text-foreground">{cls.name}</span>
                    <button
                      type="button"
                      onClick={() => removeClass(idx)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: SECTIONS */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-foreground">Step 3: Configure Class Sections</h2>
                <p className="text-sm sm:text-base text-muted-foreground mt-1 leading-relaxed">
                  Assign divisions/sections (e.g. A, B, C) for each configured class.
                </p>
              </div>

              <div className="space-y-3">
                {classes.map((cls, classIdx) => (
                  <div
                    key={cls.name}
                    className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <span className="text-sm font-bold text-foreground">{cls.name}</span>
                      <p className="text-xs text-muted-foreground">
                        Sections: {cls.sections.join(", ") || "None"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {["A", "B", "C", "D", "E"].map((sec) => {
                        const isSelected = cls.sections.includes(sec)
                        return (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                if (cls.sections.length > 1) {
                                  removeSectionFromClass(classIdx, cls.sections.indexOf(sec))
                                }
                              } else {
                                addSectionToClass(classIdx, sec)
                              }
                            }}
                            className={`size-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              isSelected
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "bg-card border border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {sec}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: HOUSES */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-foreground">Step 4: School Houses (Optional)</h2>
                <p className="text-sm sm:text-base text-muted-foreground mt-1 leading-relaxed">
                  Add student houses/groups for extracurricular and sports activities.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="text"
                  value={newHouseName}
                  onChange={(e) => setNewHouseName(e.target.value)}
                  className="h-10 text-sm flex-1"
                />
                <select
                  value={newHouseColor}
                  onChange={(e) => setNewHouseColor(e.target.value)}
                  className="h-10 rounded-xl border border-input bg-card px-3 text-xs text-foreground cursor-pointer"
                >
                  {HOUSE_COLOR_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <Button type="button" onClick={addHouse} className="h-10 gap-1.5 cursor-pointer">
                  <Plus className="size-4" /> Add House
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                {houses.map((h, idx) => (
                  <div
                    key={h.name}
                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: h.color }} />
                      <span className="text-xs font-bold text-foreground truncate">{h.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeHouse(idx)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: CREDENTIALS */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-foreground">Step 5: Create Principal Credentials</h2>
                <p className="text-sm sm:text-base text-muted-foreground mt-1 leading-relaxed">
                  Set up your master password and 4-10 digit quick login PIN.
                </p>
              </div>

              {/* Password Box */}
              <div className="p-4.5 rounded-2xl border border-border bg-card space-y-4">
                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <Lock className="size-4 text-primary" />
                  <span>General Password Setup</span>
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
                  <span>Quick Login PIN Setup (4 to 10 digits)</span>
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

          {/* STEP 6: REVIEW */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-foreground">Step 6: Review &amp; Finalize Setup</h2>
                <p className="text-sm sm:text-base text-muted-foreground mt-1 leading-relaxed">
                  Please verify your configured school settings before activation.
                </p>
              </div>

              <div className="space-y-4">
                {/* School Summary Card */}
                <div className="p-4.5 rounded-2xl border border-border bg-card space-y-3">
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
                  <div className="pt-2 border-t border-border/60 text-xs">
                    <span className="text-muted-foreground block mb-0.5">Campus Address</span>
                    <p className="text-foreground font-medium">{getFullFormattedAddress()}</p>
                  </div>
                </div>

                {/* Theme & Emblem Review */}
                <div className="p-4.5 rounded-2xl border border-border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                      <Palette className="size-4 text-primary" />
                      <span>Theme &amp; Emblem Customization</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Edit3 className="size-3" /> Edit
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block mb-1">Theme Color</span>
                      <div className="flex items-center gap-2">
                        {primaryColor ? (
                          <>
                            <span
                              className="size-3.5 rounded-full border border-border shadow-xs"
                              style={{ backgroundColor: primaryColor }}
                            />
                            <strong className="font-mono text-foreground">{primaryColor}</strong>
                          </>
                        ) : (
                          <span className="text-foreground font-semibold">Default Orange Theme</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-muted-foreground block mb-1">School Emblem</span>
                      {emblemPreviewUrl ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={emblemPreviewUrl}
                            alt="Emblem"
                            className="size-6 object-contain rounded border border-border bg-muted/30 p-0.5"
                          />
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            Custom Emblem Uploaded
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Sparkles className="size-3.5 text-primary" />
                          <span>Default Sparkle Icon</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Academic Configuration */}
                <div className="p-4.5 rounded-2xl border border-border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                      <BookOpen className="size-4 text-primary" />
                      <span>Classes &amp; Sections ({classes.length} classes)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Edit3 className="size-3" /> Edit
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {classes.map((c) => (
                      <Badge key={c.name} variant="outline" className="text-xs py-1">
                        {c.name}: ({c.sections.join(", ")})
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Houses */}
                <div className="p-4.5 rounded-2xl border border-border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                      <Shield className="size-4 text-primary" />
                      <span>Houses ({houses.length})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(4)}
                      className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Edit3 className="size-3" /> Edit
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {houses.map((h) => (
                      <span
                        key={h.name}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border border-border bg-muted/40"
                      >
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: h.color }} />
                        {h.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Credentials */}
                <div className="p-4.5 rounded-2xl border border-border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                      <KeyRound className="size-4 text-primary" />
                      <span>Credentials</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(5)}
                      className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Edit3 className="size-3" /> Edit
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Password:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Configured</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Quick PIN:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Configured</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-border mt-8">
            {currentStep > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevStep}
                disabled={isSubmitting || isUploadingEmblem}
                className="h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base font-semibold rounded-xl gap-2 border-border cursor-pointer hover:bg-muted transition-all"
              >
                <ArrowLeft className="size-4 sm:size-4.5" /> Back
              </Button>
            ) : (
              <div />
            )}

            {currentStep < 6 ? (
              <Button
                type="button"
                onClick={handleNextStep}
                disabled={isUploadingEmblem}
                className="h-11 sm:h-12 px-7 sm:px-9 text-sm sm:text-base font-bold rounded-xl gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer transition-all"
              >
                Next Step <ArrowRight className="size-4 sm:size-4.5" />
              </Button>
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
                    <CheckCircle2 className="size-5" /> Complete School Setup
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
