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
  Users,
  GraduationCap,
  Calendar,
  CheckSquare,
  BarChart3,
  Search,
  Bell,
  Check,
  TrendingUp,
} from "lucide-react"
import { authService } from "@/api/authService"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { getContrastTextColor, hexToRgb } from "@/lib/themeEngine"

const HOUSE_COLOR_OPTIONS = [
  { label: "Red", value: "#ef4444" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Green", value: "#10b981" },
  { label: "Yellow", value: "#f59e0b" },
  { label: "Purple", value: "#a855f7" },
  { label: "Orange", value: "#f97316" },
]

const THEME_COLOR_PRESETS = [
  { label: "Default Orange", value: "#f97316" },
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

  // Step 1: School Information
  const [schoolName, setSchoolName] = useState("")
  const [schoolCode, setSchoolCode] = useState("")
  const [schoolEmail, setSchoolEmail] = useState("")
  const [schoolPhone, setSchoolPhone] = useState("")

  // Step 2: Address
  const [address, setAddress] = useState("")

  // Step 3 & 4: Classes and Sections
  const [classes, setClasses] = useState([
    { name: "Class 1", order_index: 1, sections: ["A", "B"] },
    { name: "Class 2", order_index: 2, sections: ["A", "B"] },
    { name: "Class 3", order_index: 3, sections: ["A", "B"] },
    { name: "Class 4", order_index: 4, sections: ["A", "B"] },
    { name: "Class 5", order_index: 5, sections: ["A", "B"] },
  ])
  const [newClassName, setNewClassName] = useState("")

  // Step 5: Houses
  const [houses, setHouses] = useState([
    { name: "Red House", color: "#ef4444" },
    { name: "Blue House", color: "#3b82f6" },
    { name: "Green House", color: "#10b981" },
    { name: "Yellow House", color: "#f59e0b" },
  ])
  const [newHouseName, setNewHouseName] = useState("")
  const [newHouseColor, setNewHouseColor] = useState("#ef4444")

  // Step 6: School Theme & Emblem (Optional)
  const [primaryColor, setPrimaryColor] = useState("") // Empty = default theme
  const [emblemPreviewUrl, setEmblemPreviewUrl] = useState("")
  const [emblemUploadedUrl, setEmblemUploadedUrl] = useState("")
  const [isUploadingEmblem, setIsUploadingEmblem] = useState(false)
  const [emblemUploadError, setEmblemUploadError] = useState(null)

  // Step 7: Credentials
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
    // Clear any previous tab session (e.g. Super Admin token) to prevent collision
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

    // Validate size
    if (file.size > 5 * 1024 * 1024) {
      setEmblemUploadError("Image size must be 5 MB or less.")
      return
    }

    // Validate type
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if (!validTypes.includes(file.type)) {
      setEmblemUploadError("Supported image formats: PNG, JPG, JPEG, WEBP.")
      return
    }

    // Instant local preview
    const localUrl = URL.createObjectURL(file)
    setEmblemPreviewUrl(localUrl)

    // Upload to server
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

    if (currentStep === 1) {
      if (!schoolName.trim() || !schoolCode.trim() || !schoolEmail.trim() || !schoolPhone.trim()) {
        setSubmitError("Please fill in all school information fields.")
        return
      }
    }

    if (currentStep === 2) {
      if (!address.trim()) {
        setSubmitError("Please provide the school address.")
        return
      }
    }

    if (currentStep === 3) {
      if (classes.length === 0) {
        setSubmitError("Please configure at least one class for your school.")
        return
      }
    }

    if (currentStep === 4) {
      const hasEmptySections = classes.some((c) => c.sections.length === 0)
      if (hasEmptySections) {
        setSubmitError("Every class must have at least one section configured.")
        return
      }
    }

    // Step 6: School Theme is optional (validates hex format only if provided)
    if (currentStep === 6) {
      if (primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(primaryColor.trim())) {
        setSubmitError("Please enter a valid 6-character HEX color code (e.g. #2563EB) or reset to default.")
        return
      }
    }

    if (currentStep === 7) {
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

  // Complete Setup Submission
  const handleCompleteSetup = async () => {
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      await authService.completeSchoolSetup({
        token,
        school_name: schoolName.trim(),
        school_code: schoolCode.trim().toUpperCase(),
        school_email: schoolEmail.trim().toLowerCase(),
        school_phone: schoolPhone.trim(),
        address: address.trim(),
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
              <span className="text-muted-foreground">School Code:</span>
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

  const steps = [
    { num: 1, label: "School Info", icon: Building2 },
    { num: 2, label: "Address", icon: MapPin },
    { num: 3, label: "Classes", icon: BookOpen },
    { num: 4, label: "Sections", icon: Layers },
    { num: 5, label: "Houses", icon: Shield },
    { num: 6, label: "School Theme", icon: Palette },
    { num: 7, label: "Password & PIN", icon: KeyRound },
    { num: 8, label: "Review", icon: CheckCircle2 },
  ]

  // Derived preview properties
  const activeThemeColor = primaryColor || "#f97316"
  const contrastTextColor = getContrastTextColor(activeThemeColor)
  const rgbObj = hexToRgb(activeThemeColor)
  const rgbString = rgbObj ? `${rgbObj.r}, ${rgbObj.g}, ${rgbObj.b}` : "249, 115, 22"

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col justify-between p-4 md:p-8">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-xs">
          <div>
            <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="size-3.5" /> School Onboarding Wizard
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
              Welcome, {principalInfo?.first_name} {principalInfo?.last_name}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Follow the steps below to initialize your school workspace and credentials.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <Badge variant="outline" className="text-xs px-3 py-1 bg-muted/50 border-border">
              Step {currentStep} of {steps.length}
            </Badge>
          </div>
        </div>

        {/* Stepper Navigation */}
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
                className={`flex flex-col items-center text-center p-2 rounded-xl transition-all cursor-pointer ${
                  isCurrent
                    ? "bg-primary/10 border border-primary/30 text-primary font-bold shadow-xs"
                    : isDone
                    ? "text-foreground hover:bg-muted/40"
                    : "text-muted-foreground/50 cursor-not-allowed opacity-60"
                }`}
              >
                <div
                  className={`size-7 rounded-lg flex items-center justify-center mb-1 text-xs transition-colors ${
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isDone
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="size-3.5" /> : <Icon className="size-3.5" />}
                </div>
                <span className="text-[10px] truncate max-w-full">{step.label}</span>
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

          {/* STEP 1: SCHOOL INFORMATION */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-foreground">Step 1: Basic School Information</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enter the primary identity details of your educational institution.
                </p>
              </div>

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
                  <label className="text-xs font-semibold text-foreground block mb-1">School Code / Identifier</label>
                  <Input
                    type="text"
                    maxLength={50}
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                    className="h-10 text-sm font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Official School Email</label>
                  <Input
                    type="email"
                    value={schoolEmail}
                    onChange={(e) => setSchoolEmail(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Official Phone Number</label>
                  <Input
                    type="tel"
                    maxLength={20}
                    value={schoolPhone}
                    onChange={(e) => setSchoolPhone(e.target.value)}
                    className="h-10 text-sm font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: ADDRESS */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-foreground">Step 2: Campus Location & Address</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Provide the physical address and campus location of the school.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Full Campus Address</label>
                <textarea
                  rows={4}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background p-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 outline-none"
                />
              </div>
            </div>
          )}

          {/* STEP 3: CLASSES */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-foreground">Step 3: Classes / Grades</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
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
                  className="text-xs h-8"
                >
                  Class 1 - 5 (Primary)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPresetClasses(1, 10)}
                  className="text-xs h-8"
                >
                  Class 1 - 10 (Secondary)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPresetClasses(1, 12)}
                  className="text-xs h-8"
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
                <Button type="button" onClick={addClass} className="h-10 gap-1.5">
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
                      className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: SECTIONS */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-foreground">Step 4: Configure Class Sections</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
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

          {/* STEP 5: HOUSES */}
          {currentStep === 5 && (
            <div className="space-y-5">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-foreground">Step 5: School Houses (Optional)</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
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
                <Button type="button" onClick={addHouse} className="h-10 gap-1.5">
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
                      className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 6: SCHOOL THEME & EMBLEM (6x6 top row + 12 bottom row app mockup) */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-foreground">Step 6: School Theme & Emblem (Optional)</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Personalize your school portal with your custom theme color and official emblem/crest.
                </p>
              </div>

              {/* ROW 1: Color Selection (6) & Emblem Selection (6) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 6 Column Left: Theme Color Picker */}
                <div className="p-5 rounded-2xl border border-border bg-card space-y-4 shadow-2xs flex flex-col justify-between">
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                          <Palette className="size-4" />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-foreground block leading-tight">
                            Theme Color
                          </span>
                          <span className="text-[11px] text-muted-foreground">Primary UI Accent</span>
                        </div>
                      </div>
                      {primaryColor && (
                        <button
                          type="button"
                          onClick={() => setPrimaryColor("")}
                          className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <RotateCcw className="size-3" /> Reset
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Pick any HEX color for buttons, active navigation, badges, and accents.
                    </p>

                    {/* Free Color Picker + Hex Input */}
                    <div className="flex items-center gap-3">
                      <div className="relative size-10 shrink-0 rounded-xl overflow-hidden border border-border shadow-xs cursor-pointer">
                        <input
                          type="color"
                          value={primaryColor || "#f97316"}
                          onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
                          className="absolute inset-0 size-full scale-150 cursor-pointer border-0 p-0"
                          title="Click to open color picker"
                        />
                      </div>

                      <div className="flex-1">
                        <Input
                          type="text"
                          maxLength={7}
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
                          className="h-10 text-sm font-mono uppercase tracking-wider"
                        />
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div>
                      <span className="text-[11px] font-semibold text-muted-foreground block mb-2">
                        Quick Color Presets:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
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
                            <span className="size-2 rounded-full" style={{ backgroundColor: preset.value }} />
                            <span>{preset.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6 Column Right: Emblem Upload */}
                <div className="p-5 rounded-2xl border border-border bg-card space-y-4 shadow-2xs flex flex-col justify-between">
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                        <ImageIcon className="size-4" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground block leading-tight">
                          School Emblem / Crest
                        </span>
                        <span className="text-[11px] text-muted-foreground">Header Application Logo</span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Upload school logo (PNG, JPG, WEBP &lt; 5MB). Replaces the default Sparkle icon.
                    </p>

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
                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/20">
                        <div className="flex items-center gap-3">
                          <div className="size-12 rounded-xl border border-border bg-card flex items-center justify-center p-1 overflow-hidden shadow-2xs">
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
                            <div className="text-[11px] text-muted-foreground">Uploaded & Verified</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => emblemInputRef.current?.click()}
                            disabled={isUploadingEmblem}
                            className="text-xs h-8"
                          >
                            Replace
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRemoveEmblem}
                            disabled={isUploadingEmblem}
                            className="text-xs h-8 text-destructive hover:bg-destructive/10"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => emblemInputRef.current?.click()}
                        className="border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/20 transition-all rounded-2xl p-5 text-center cursor-pointer flex flex-col items-center justify-center gap-1.5"
                      >
                        <div className="size-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                          {isUploadingEmblem ? (
                            <Loader2 className="size-4 animate-spin text-primary" />
                          ) : (
                            <Upload className="size-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {isUploadingEmblem ? "Uploading Emblem..." : "Click to select emblem file"}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            PNG (transparent recommended), JPG, WEBP (Max 5 MB)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ROW 2: Live Application Mockup (12) */}
              <div className="w-full space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Sparkles className="size-3.5 text-primary" /> Live Application Mockup Preview
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {primaryColor ? primaryColor : "Default Orange Theme"}
                  </Badge>
                </div>

                {/* macOS Style Mockup Window Container */}
                <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
                  {/* Browser Window Header */}
                  <div className="h-9 px-4 bg-muted/60 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full bg-rose-500/80" />
                      <span className="size-2.5 rounded-full bg-amber-500/80" />
                      <span className="size-2.5 rounded-full bg-emerald-500/80" />
                    </div>

                    <div className="px-4 py-0.5 rounded-md bg-background/80 border border-border/80 text-[11px] text-muted-foreground font-mono truncate max-w-xs flex items-center gap-1.5">
                      <Lock className="size-2.5 text-emerald-500" />
                      <span>portal.school-lms.edu/dashboard</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="size-2 rounded-full" style={{ backgroundColor: activeThemeColor }} />
                      <span className="hidden sm:inline font-mono">{activeThemeColor}</span>
                    </div>
                  </div>

                  {/* Application Shell */}
                  <div className="flex min-h-[300px] sm:min-h-[340px]">
                    {/* Mock Sidebar */}
                    <div className="w-48 sm:w-56 border-r border-border bg-sidebar p-3.5 flex flex-col justify-between shrink-0">
                      <div className="space-y-4">
                        {/* Sidebar Brand Header */}
                        <div className="flex items-center gap-2.5 px-1 py-1">
                          <div
                            className="size-8 rounded-lg flex items-center justify-center text-white shadow-xs overflow-hidden shrink-0"
                            style={{
                              backgroundColor: activeThemeColor,
                              color: contrastTextColor,
                            }}
                          >
                            {emblemPreviewUrl ? (
                              <img
                                src={emblemPreviewUrl}
                                alt="Emblem"
                                className="size-full object-contain p-0.5"
                              />
                            ) : (
                              <Sparkles className="size-4" />
                            )}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-foreground truncate leading-tight">
                              {schoolName || "Apex Academy"}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {schoolCode ? `Code: ${schoolCode}` : "LMS Enterprise"}
                            </p>
                          </div>
                        </div>

                        {/* Sidebar Nav Links */}
                        <div className="space-y-1 pt-1">
                          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-0.5">
                            Academic
                          </div>

                          {/* Active Button with Light Background & Primary Text */}
                          <div
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-xs border transition-all"
                            style={{
                              backgroundColor: `rgba(${rgbString}, 0.15)`,
                              color: activeThemeColor,
                              borderColor: `rgba(${rgbString}, 0.25)`,
                            }}
                          >
                            <GraduationCap className="size-4 shrink-0" style={{ color: activeThemeColor }} />
                            <span>Dashboard</span>
                            <span
                              className="size-1.5 rounded-full ml-auto"
                              style={{ backgroundColor: activeThemeColor }}
                            />
                          </div>

                          {/* Inactive Nav Links */}
                          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:bg-muted/40">
                            <Users className="size-4 text-muted-foreground shrink-0" />
                            <span>Students & Staff</span>
                          </div>

                          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:bg-muted/40">
                            <BookOpen className="size-4 text-muted-foreground shrink-0" />
                            <span>Classes & Courses</span>
                          </div>

                          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:bg-muted/40">
                            <Calendar className="size-4 text-muted-foreground shrink-0" />
                            <span>Timetable</span>
                          </div>
                        </div>
                      </div>

                      {/* Mock User Footer */}
                      <div className="p-2 rounded-xl bg-muted/40 border border-border/80 flex items-center gap-2">
                        <div
                          className="size-6 rounded-md flex items-center justify-center text-[10px] font-bold"
                          style={{
                            backgroundColor: `rgba(${rgbString}, 0.2)`,
                            color: activeThemeColor,
                          }}
                        >
                          {principalInfo?.first_name?.[0] || "P"}
                        </div>
                        <div className="truncate text-[11px] leading-tight">
                          <p className="font-semibold text-foreground truncate">
                            {principalInfo?.first_name || "Principal"} {principalInfo?.last_name || ""}
                          </p>
                          <p className="text-[9px] text-muted-foreground">School Head</p>
                        </div>
                      </div>
                    </div>

                    {/* Mock Main Content Area */}
                    <div className="flex-1 p-4 sm:p-5 bg-muted/15 flex flex-col justify-between space-y-4 overflow-hidden">
                      {/* Top Bar Mock */}
                      <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border px-2.5 py-1.5 rounded-xl flex-1 max-w-xs">
                          <Search className="size-3.5 text-muted-foreground" />
                          <span className="text-[11px]">Search student, staff or class...</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="size-7 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground relative"
                          >
                            <Bell className="size-3.5" />
                            <span
                              className="size-2 rounded-full absolute top-1 right-1"
                              style={{ backgroundColor: activeThemeColor }}
                            />
                          </button>

                          <button
                            type="button"
                            className="h-7 px-3 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                            style={{
                              backgroundColor: activeThemeColor,
                              color: contrastTextColor,
                            }}
                          >
                            <Plus className="size-3" />
                            <span className="hidden sm:inline">New Admission</span>
                          </button>
                        </div>
                      </div>

                      {/* Welcome Banner */}
                      <div
                        className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        style={{
                          background: `linear-gradient(135deg, rgba(${rgbString}, 0.12) 0%, rgba(${rgbString}, 0.03) 100%)`,
                          borderColor: `rgba(${rgbString}, 0.25)`,
                        }}
                      >
                        <div>
                          <h4 className="text-sm font-bold text-foreground">
                            Welcome to {schoolName || "Apex Academy"}
                          </h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Academic Year 2026-2027 • All systems initialized
                          </p>
                        </div>
                        <span
                          className="self-start sm:self-center px-2.5 py-1 rounded-full text-[10px] font-bold border"
                          style={{
                            backgroundColor: `rgba(${rgbString}, 0.15)`,
                            color: activeThemeColor,
                            borderColor: `rgba(${rgbString}, 0.3)`,
                          }}
                        >
                          ● Active School
                        </span>
                      </div>

                      {/* Quick Cards Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl border border-border bg-card space-y-1">
                          <span className="text-[10px] text-muted-foreground block">Total Students</span>
                          <div className="flex items-center justify-between">
                            <span className="text-base font-bold text-foreground">1,248</span>
                            <div
                              className="size-6 rounded-md flex items-center justify-center"
                              style={{
                                backgroundColor: `rgba(${rgbString}, 0.15)`,
                                color: activeThemeColor,
                              }}
                            >
                              <GraduationCap className="size-3.5" />
                            </div>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl border border-border bg-card space-y-1">
                          <span className="text-[10px] text-muted-foreground block">Active Staff</span>
                          <div className="flex items-center justify-between">
                            <span className="text-base font-bold text-foreground">64</span>
                            <div
                              className="size-6 rounded-md flex items-center justify-center"
                              style={{
                                backgroundColor: `rgba(${rgbString}, 0.15)`,
                                color: activeThemeColor,
                              }}
                            >
                              <Users className="size-3.5" />
                            </div>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl border border-border bg-card space-y-1 col-span-2 sm:col-span-1">
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Attendance</span>
                            <span className="font-bold text-foreground">96.4%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden mt-1.5">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: "96.4%",
                                backgroundColor: activeThemeColor,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: CREDENTIALS */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-foreground">Step 7: Create Principal Credentials</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
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

          {/* STEP 8: REVIEW */}
          {currentStep === 8 && (
            <div className="space-y-6">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-foreground">Step 8: Review & Finalize Setup</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Please verify your configured school settings before activation.
                </p>
              </div>

              <div className="space-y-4">
                {/* School Summary Card */}
                <div className="p-4.5 rounded-2xl border border-border bg-card space-y-3">
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                    <Building2 className="size-4 text-primary" />
                    <span>School Details</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block">School Name</span>
                      <strong className="text-foreground">{schoolName}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">School Code</span>
                      <strong className="font-mono text-foreground">{schoolCode}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Email</span>
                      <span className="text-foreground">{schoolEmail}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Phone</span>
                      <span className="font-mono text-foreground">{schoolPhone}</span>
                    </div>
                  </div>
                </div>

                {/* School Customization Review (NEW) */}
                <div className="p-4.5 rounded-2xl border border-border bg-card space-y-3">
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                    <Palette className="size-4 text-primary" />
                    <span>Theme & Emblem Customization</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block mb-1">Theme Color</span>
                      <div className="flex items-center gap-2">
                        {primaryColor ? (
                          <>
                            <span
                              className="size-4 rounded-full border border-border shadow-xs"
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
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                    <BookOpen className="size-4 text-primary" />
                    <span>Classes & Sections ({classes.length} classes)</span>
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
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                    <Shield className="size-4 text-primary" />
                    <span>Houses ({houses.length})</span>
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
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                    <KeyRound className="size-4 text-primary" />
                    <span>Credentials</span>
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
          <div className="flex items-center justify-between pt-6 border-t border-border mt-6">
            {currentStep > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevStep}
                disabled={isSubmitting || isUploadingEmblem}
                className="text-xs h-10 gap-1.5 border-border cursor-pointer"
              >
                <ArrowLeft className="size-3.5" /> Back
              </Button>
            ) : (
              <div />
            )}

            {currentStep < 8 ? (
              <Button
                type="button"
                onClick={handleNextStep}
                disabled={isUploadingEmblem}
                className="text-xs font-semibold h-10 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground px-5 cursor-pointer shadow-xs"
              >
                Next Step <ArrowRight className="size-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleCompleteSetup}
                disabled={isSubmitting}
                className="text-xs font-semibold h-10 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 shadow-md cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Activating School...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" /> Complete School Setup
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
