import { useState, useEffect } from "react"
import { useSearchParams, useNavigate, Link } from "react-router-dom"
import {
  GraduationCap,
  Lock,
  Hash,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Building2,
  UserCheck,
} from "lucide-react"
import { validateStaffSetupTokenApi, completeStaffSetupApi } from "@/api/staffService"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

export function StaffAccountSetup() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get("token") || ""

  // Validation / Loading States
  const [isValidating, setIsValidating] = useState(true)
  const [tokenError, setTokenError] = useState(null)
  const [staffInfo, setStaffInfo] = useState(null)

  // Form Fields
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")

  // UI States
  const [showPassword, setShowPassword] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [isSuccess, setIsSuccess] = useState(false)

  // Token Validation on Mount
  useEffect(() => {
    if (!token) {
      setTokenError("No setup token provided in the URL. Please verify your invitation link.")
      setIsValidating(false)
      return
    }

    let isMounted = true
    async function validateToken() {
      try {
        setIsValidating(true)
        setTokenError(null)
        const response = await validateStaffSetupTokenApi(token)
        if (isMounted) {
          setStaffInfo(response.data)
        }
      } catch (err) {
        if (isMounted) {
          const detail =
            err.response?.data?.detail ||
            "This setup link is invalid, expired, or has already been used. Please contact your school administrator to request a new setup link."
          setTokenError(detail)
        }
      } finally {
        if (isMounted) {
          setIsValidating(false)
        }
      }
    }

    validateToken()
    return () => {
      isMounted = false
    }
  }, [token])

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)

    // Password validation
    if (!password || password.length < 8) {
      setFormError("Password must be at least 8 characters long.")
      return
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match. Please verify both fields.")
      return
    }

    // PIN validation
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setFormError("Quick Login PIN must be exactly 4 numeric digits.")
      return
    }
    if (pin !== confirmPin) {
      setFormError("PINs do not match. Please verify both fields.")
      return
    }

    try {
      setIsSubmitting(true)
      await completeStaffSetupApi({
        token,
        password,
        pin,
      })
      setIsSuccess(true)
    } catch (err) {
      const detail =
        err.response?.data?.detail ||
        err.message ||
        "Failed to activate account. Please check your credentials and try again."
      setFormError(detail)
    } finally {
      setIsSubmitting(false)
    }
  }

  // -------------------------------------------------------------------------
  // 1. Loading State
  // -------------------------------------------------------------------------
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
        <div className="text-center space-y-4 max-w-sm">
          <div className="size-16 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm animate-pulse">
            <Loader2 className="size-8 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Verifying Invitation...</h2>
          <p className="text-sm text-muted-foreground">
            Please wait while we validate your secure Staff onboarding link.
          </p>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // 2. Token Error State
  // -------------------------------------------------------------------------
  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-8 text-center animate-in fade-in-0 zoom-in-95 duration-200">
          <div className="size-16 mx-auto mb-4 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive shadow-sm">
            <AlertCircle className="size-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Setup Link Invalid</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{tokenError}</p>

          <div className="mt-6 p-3.5 rounded-xl bg-muted/50 border border-border text-xs text-muted-foreground text-left space-y-1.5">
            <p className="font-semibold text-foreground">Possible reasons:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>The setup link has exceeded its 48-hour expiration.</li>
              <li>Your account was already set up and activated.</li>
              <li>A new setup link was recently generated for your account.</li>
            </ul>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <Link to="/login" className="w-full">
              <Button className="w-full h-11 text-sm font-semibold rounded-xl cursor-pointer">
                Go to Login Page
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // 3. Setup Complete (Success) State
  // -------------------------------------------------------------------------
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-8 text-center animate-in fade-in-0 zoom-in-95 duration-200">
          <div className="size-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shadow-sm">
            <CheckCircle2 className="size-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Account Activated!</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Welcome to the school team! Your Master Password and Quick Login PIN have been successfully configured.
          </p>

          <div className="mt-6 p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 text-left text-xs space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
              <ShieldCheck className="size-4" />
              <span>Login Credentials Ready</span>
            </div>
            <p className="text-muted-foreground">
              You can now sign in using your email address with either your password or 4-digit PIN.
            </p>
          </div>

          <div className="mt-6">
            <Button
              onClick={() => navigate("/login")}
              className="w-full h-11 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Proceed to Login</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // 4. Main Account Setup Form
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl p-6 sm:p-8 animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="size-14 mx-auto mb-3 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
            <GraduationCap className="size-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Set Up Your Staff Account</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Create your master password and 4-digit Quick Login PIN to activate access.
          </p>
        </div>

        {/* Staff & School Identity Banner */}
        {staffInfo && (
          <div className="mb-6 p-3.5 rounded-xl bg-muted/50 border border-border/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="size-9 rounded-lg bg-primary/15 flex items-center justify-center text-primary shrink-0">
                <Building2 className="size-4.5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-foreground truncate">
                  {staffInfo.school_name || "School LMS"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {staffInfo.first_name} {staffInfo.last_name} ({staffInfo.email})
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase font-bold shrink-0 bg-background">
              Staff Member
            </Badge>
          </div>
        )}

        {/* Form Error Alert */}
        {formError && (
          <div className="mb-5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs sm:text-sm flex items-start gap-2.5">
            <AlertCircle className="size-4.5 shrink-0 mt-0.5" />
            <span className="leading-tight">{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Master Password */}
          <div className="p-4 rounded-2xl border border-border bg-card/60 space-y-3.5">
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-foreground">
              <Lock className="size-4 text-primary" />
              <span>Create Master Password</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Used for standard login across all browsers and devices (minimum 8 characters).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-[11px] font-semibold text-foreground block mb-1">
                  Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="pr-9 h-10 text-sm rounded-xl"
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
                <label className="text-[11px] font-semibold text-foreground block mb-1">
                  Confirm Password
                </label>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="h-10 text-sm rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Quick Login PIN */}
          <div className="p-4 rounded-2xl border border-border bg-card/60 space-y-3.5">
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-foreground">
              <Hash className="size-4 text-primary" />
              <span>Create Quick Login PIN (4 digits)</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Used for rapid terminal sign-in via Email + PIN without typing your full password.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-[11px] font-semibold text-foreground block mb-1">
                  4-Digit PIN
                </label>
                <div className="relative">
                  <Input
                    type={showPin ? "text" : "password"}
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                    className="pr-9 h-10 text-sm font-mono tracking-widest text-center rounded-xl"
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
                <label className="text-[11px] font-semibold text-foreground block mb-1">
                  Confirm PIN
                </label>
                <Input
                  type={showPin ? "text" : "password"}
                  maxLength={4}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  className="h-10 text-sm font-mono tracking-widest text-center rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span>Activating Account...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span>Complete Setup & Activate Account</span>
                <ArrowRight className="size-4" />
              </span>
            )}
          </Button>
        </form>

        <p className="text-center text-[11px] text-muted-foreground mt-5">
          Already activated your account?{" "}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Sign In here
          </Link>
        </p>
      </div>
    </div>
  )
}
export default StaffAccountSetup
