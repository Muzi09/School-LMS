import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useFormik } from "formik"
import {
  GraduationCap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { generalValidationSchema } from "@/validations"

export function PrincipalLogin() {
  const { login, quickLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
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

  const formik = useFormik({
    initialValues: { email: "", password: "" },
    validationSchema: generalValidationSchema,
    onSubmit: async (values) => {
      setServerError(null)
      setIsSubmitting(true)
      const emailClean = values.email.trim()
      const passwordSecret = values.password.trim()

      try {
        let res
        try {
          res = await login(emailClean, passwordSecret)
        } catch (loginErr) {
          // If the secret could be a quick PIN (4-10 digits), try quickLogin as fallback
          if (/^\d{4,10}$/.test(passwordSecret)) {
            try {
              res = await quickLogin(emailClean, passwordSecret)
            } catch {
              throw loginErr
            }
          } else {
            throw loginErr
          }
        }
        handleSuccessfulAuth(res)
      } catch (err) {
        setServerError(err.message || "Invalid email or password.")
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

        {/* Server Error Alert */}
        {serverError && (
          <div className="mb-6 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2.5">
            <AlertCircle className="size-4.5 shrink-0 mt-0.5" />
            <span className="leading-tight">{serverError}</span>
          </div>
        )}

        {/* Unified Login Form (Email + Password or PIN) */}
        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="email"
                name="email"
                placeholder="name@school.edu"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="pl-9 h-11 text-sm"
                autoComplete="email"
              />
            </div>
            {formik.touched.email && formik.errors.email && (
              <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                {formik.errors.email}
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
                placeholder="Enter password or PIN"
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
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
            {formik.touched.password && formik.errors.password && (
              <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                {formik.errors.password}
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
      </div>
    </div>
  )
}

// Backward compatibility alias
export const SchoolLogin = PrincipalLogin
export default PrincipalLogin
