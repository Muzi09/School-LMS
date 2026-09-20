import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useFormik } from "formik"
import {
  GraduationCap,
  KeyRound,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Hash,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { generalValidationSchema, quickValidationSchema } from "@/validations"

export function PrincipalLogin() {
  const { login, quickLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [loginMode, setLoginMode] = useState("general") // "general" or "quick"
  const [showPassword, setShowPassword] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSuccessfulAuth = (res) => {
    if (res.user.role === 1 && !res.user.school_setup_completed) {
      navigate("/principal/setup-school", { replace: true })
    } else if (res.user.role === 0) {
      navigate("/admin/dashboard", { replace: true })
    } else if (res.user.role === 2) {
      const from = location.state?.from?.pathname
      const target = from && from !== "/staff" && from !== "/manage-staff" ? from : "/students"
      navigate(target, { replace: true })
    } else {
      const from = location.state?.from?.pathname || "/staff"
      navigate(from, { replace: true })
    }
  }

  // General Login Formik
  const generalFormik = useFormik({
    initialValues: { email: "", password: "" },
    validationSchema: generalValidationSchema,
    onSubmit: async (values) => {
      setServerError(null)
      setIsSubmitting(true)
      try {
        const res = await login(values.email.trim(), values.password)
        handleSuccessfulAuth(res)
      } catch (err) {
        setServerError(err.message || "Invalid email or password.")
      } finally {
        setIsSubmitting(false)
      }
    },
  })

  // Quick Login Formik
  const quickFormik = useFormik({
    initialValues: { email: "", pin: "" },
    validationSchema: quickValidationSchema,
    onSubmit: async (values) => {
      setServerError(null)
      setIsSubmitting(true)
      try {
        const res = await quickLogin(values.email.trim(), values.pin.trim())
        handleSuccessfulAuth(res)
      } catch (err) {
        setServerError(err.message || "Invalid email or PIN.")
      } finally {
        setIsSubmitting(false)
      }
    },
  })

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-8 animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="size-14 mx-auto mb-3 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
            <GraduationCap className="size-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">School Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your school management workspace</p>
        </div>

        {/* Dual Mode Tab Selector */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-muted/50 border border-border mb-6">
          <button
            type="button"
            onClick={() => {
              setLoginMode("general")
              setServerError(null)
            }}
            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              loginMode === "general"
                ? "bg-card text-foreground shadow-xs border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Lock className="size-3.5" />
            <span>General Login</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLoginMode("quick")
              setServerError(null)
            }}
            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              loginMode === "quick"
                ? "bg-card text-foreground shadow-xs border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <KeyRound className="size-3.5" />
            <span>Quick PIN Login</span>
          </button>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div className="mb-6 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2.5">
            <AlertCircle className="size-4.5 shrink-0 mt-0.5" />
            <span className="leading-tight">{serverError}</span>
          </div>
        )}

        {/* GENERAL LOGIN (EMAIL + PASSWORD) */}
        {loginMode === "general" && (
          <form onSubmit={generalFormik.handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="email"
                  name="email"
                  placeholder="principal@school.edu"
                  value={generalFormik.values.email}
                  onChange={generalFormik.handleChange}
                  onBlur={generalFormik.handleBlur}
                  className="pl-9 h-11 text-sm"
                  autoComplete="email"
                />
              </div>
              {generalFormik.touched.email && generalFormik.errors.email && (
                <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                  {generalFormik.errors.email}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="••••••••••••"
                  value={generalFormik.values.password}
                  onChange={generalFormik.handleChange}
                  onBlur={generalFormik.handleBlur}
                  className="pl-9 pr-10 h-11 text-sm"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {generalFormik.touched.password && generalFormik.errors.password && (
                <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                  {generalFormik.errors.password}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all mt-2 cursor-pointer"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign In <ArrowRight className="size-4" />
                </span>
              )}
            </Button>
          </form>
        )}

        {/* QUICK LOGIN (EMAIL + PIN) */}
        {loginMode === "quick" && (
          <form onSubmit={quickFormik.handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                Principal Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="email"
                  name="email"
                  placeholder="principal@school.edu"
                  value={quickFormik.values.email}
                  onChange={quickFormik.handleChange}
                  onBlur={quickFormik.handleBlur}
                  className="pl-9 h-11 text-sm"
                  autoComplete="email"
                />
              </div>
              {quickFormik.touched.email && quickFormik.errors.email && (
                <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                  {quickFormik.errors.email}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                Principal Security PIN
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type={showPin ? "text" : "password"}
                  name="pin"
                  maxLength={10}
                  placeholder="Enter 4 to 10 digit PIN"
                  value={quickFormik.values.pin}
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/\D/g, "")
                    quickFormik.setFieldValue("pin", onlyNums)
                  }}
                  onBlur={quickFormik.handleBlur}
                  className="pl-9 pr-10 h-11 text-sm font-mono tracking-widest"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {quickFormik.touched.pin && quickFormik.errors.pin && (
                <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                  {quickFormik.errors.pin}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 text-sm font-semibold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-md transition-all mt-2 cursor-pointer"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Verifying PIN...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Quick PIN Sign In <ArrowRight className="size-4" />
                </span>
              )}
            </Button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            Platform Admin?{" "}
            <a href="/admin/login" className="text-amber-600 dark:text-amber-400 font-semibold hover:underline">
              Access Admin Portal
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
export default PrincipalLogin
