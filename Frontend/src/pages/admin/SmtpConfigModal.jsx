import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useFormik } from "formik"
import {
  Mail,
  Server,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from "lucide-react"
import { adminService } from "@/api/adminService"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ModalHeader } from "@/components/common/ModalHeader"
import { cn } from "@/lib/utils"
import { smtpConfigValidationSchema } from "@/validations"

export function SmtpConfigModal({ isOpen, onClose, existingConfig = null }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  
  // Test states: 'idle' | 'testing' | 'succeeded' | 'failed'
  const [testState, setTestState] = useState("idle")
  const [testMessage, setTestMessage] = useState("")
  const [isTestedSuccess, setIsTestedSuccess] = useState(false)

  const defaultUserEmail = user?.email || existingConfig?.from_email || existingConfig?.smtp_username || ""
  const userFullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join(" ")
  const defaultSenderName = existingConfig?.from_name || userFullName || "School LMS Platform"

  const formik = useFormik({
    initialValues: {
      smtp_host: existingConfig?.smtp_host || "smtp.gmail.com",
      smtp_port: existingConfig?.smtp_port || 587,
      from_email: defaultUserEmail,
      smtp_password: existingConfig?.smtp_password || "",
      from_name: defaultSenderName,
    },
    validationSchema: smtpConfigValidationSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setServerError("")
      setSuccessMessage("")

      try {
        const payload = {
          smtp_host: values.smtp_host.trim(),
          smtp_port: Number(values.smtp_port),
          from_email: values.from_email.trim().toLowerCase(),
          smtp_username: values.from_email.trim().toLowerCase(),
          smtp_password: values.smtp_password.trim(),
          from_name: values.from_name.trim(),
          security: "TLS",
          is_active: true,
        }

        await adminService.saveSmtpConfig(payload)
        await queryClient.invalidateQueries({ queryKey: ["adminSmtpConfig"] })
        await queryClient.invalidateQueries({ queryKey: ["superAdminSmtpConfig"] })
        setSuccessMessage("SMTP configuration saved successfully!")
        setTimeout(() => {
          onClose()
        }, 1200)
      } catch (err) {
        setServerError(err?.message || "Failed to save SMTP configuration.")
      }
    },
  })

  // Reset tested status whenever user changes any field
  const handleFieldChange = (field, value) => {
    formik.setFieldValue(field, value)
    setIsTestedSuccess(false)
    setTestState("idle")
    setTestMessage("")
    setServerError("")
  }

  const handleTestConnection = async () => {
    // Validate required fields before testing
    const errors = await formik.validateForm()
    if (errors.smtp_host || errors.smtp_port || errors.smtp_password || errors.from_name) {
      formik.setTouched({
        smtp_host: true,
        smtp_port: true,
        smtp_password: true,
        from_name: true,
      })
      return
    }

    setServerError("")
    setSuccessMessage("")
    setTestState("testing")
    setTestMessage("Connecting to SMTP server and validating credentials...")

    try {
      const payload = {
        smtp_host: formik.values.smtp_host.trim(),
        smtp_port: Number(formik.values.smtp_port),
        from_email: formik.values.from_email.trim().toLowerCase(),
        smtp_username: formik.values.from_email.trim().toLowerCase(),
        smtp_password: formik.values.smtp_password ? formik.values.smtp_password.trim() : null,
        security: "TLS",
      }

      const res = await adminService.testSmtpConfig(payload)
      if (res.success) {
        setTestState("succeeded")
        setTestMessage(res.message || "SMTP connection and authentication succeeded!")
        setIsTestedSuccess(true)
      } else {
        setTestState("failed")
        setTestMessage(res.message || "SMTP connection test failed. Please verify credentials.")
        setIsTestedSuccess(false)
      }
    } catch (err) {
      setTestState("failed")
      setTestMessage(err?.message || "Failed to connect to SMTP server.")
      setIsTestedSuccess(false)
    }
  }

  if (!isOpen) return null

  const isSaving = formik.isSubmitting
  const isTesting = testState === "testing"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-xl sm:max-w-2xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <ModalHeader
          icon={Mail}
          iconClassName="bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
          title="SMTP Email Server Config"
          description="Configure your outgoing email settings for sending Principal invitations"
          onClose={onClose}
        />

        {/* Form Body */}
        <form onSubmit={formik.handleSubmit} className="p-6 space-y-4.5 overflow-y-auto flex-1">
          

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2.5 animate-in fade-in-50">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-500" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}

          {serverError && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2.5 animate-in fade-in-50">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed whitespace-pre-line">{serverError}</span>
            </div>
          )}

          {testState !== "idle" && (
            <div
              className={cn(
                "p-3.5 rounded-xl text-xs flex items-start gap-2.5 border transition-all duration-300 animate-in fade-in-50",
                testState === "testing" && "bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300",
                testState === "succeeded" && "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300",
                testState === "failed" && "bg-destructive/10 border-destructive/20 text-destructive"
              )}
            >
              {testState === "testing" ? (
                <Loader2 className="size-4 shrink-0 animate-spin mt-0.5 text-amber-600 dark:text-amber-400" />
              ) : testState === "succeeded" ? (
                <CheckCircle2 className="size-4.5 shrink-0 mt-0.5 text-emerald-500" />
              ) : (
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-destructive" />
              )}
              <div className="space-y-1">
                <p className="font-semibold">
                  {testState === "succeeded"
                    ? "Connection Verified Successfully"
                    : testState === "testing"
                    ? "Testing Connection..."
                    : "Connection Test Failed"}
                </p>
                <p className="leading-relaxed text-[11.5px] whitespace-pre-line">{testMessage}</p>
              </div>
            </div>
          )}

          {/* Row 1: Equal Width Host & Port */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="smtp_host" className="text-xs font-semibold text-foreground block mb-1.5">
                SMTP Host
              </label>
              <div className="relative">
                <Server className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="smtp_host"
                  name="smtp_host"
                  value={formik.values.smtp_host}
                  onChange={(e) => handleFieldChange("smtp_host", e.target.value)}
                  onBlur={formik.handleBlur}
                  className={cn(
                    "pl-9 h-10 text-sm",
                    formik.touched.smtp_host && formik.errors.smtp_host && "border-destructive ring-1 ring-destructive/30"
                  )}
                />
              </div>
              {formik.touched.smtp_host && formik.errors.smtp_host && (
                <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                  {formik.errors.smtp_host}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="smtp_port" className="text-xs font-semibold text-foreground block mb-1.5">
                Port
              </label>
              <Input
                id="smtp_port"
                name="smtp_port"
                type="text"
                inputMode="numeric"
                maxLength={3}
                value={formik.values.smtp_port}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, "").slice(0, 3)
                  handleFieldChange("smtp_port", cleaned)
                }}
                onBlur={formik.handleBlur}
                className={cn(
                  "h-10 text-sm font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                  formik.touched.smtp_port && formik.errors.smtp_port && "border-destructive ring-1 ring-destructive/30"
                )}
              />
              {formik.touched.smtp_port && formik.errors.smtp_port && (
                <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                  {formik.errors.smtp_port}
                </p>
              )}
            </div>
          </div>

          {/* Row 2: Prefilled Read-Only From Email Address */}
          <div>
            <label htmlFor="from_email" className="text-xs font-semibold text-foreground block mb-1.5">
              From Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="from_email"
                name="from_email"
                type="email"
                readOnly
                value={formik.values.from_email}
                className="pl-9 h-10 text-sm bg-muted/50 cursor-not-allowed text-foreground border-border select-all"
              />
            </div>
            {formik.touched.from_email && formik.errors.from_email && (
              <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                {formik.errors.from_email}
              </p>
            )}
          </div>

          {/* Row 3: From Sender Name & Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="from_name" className="text-xs font-semibold text-foreground block mb-1.5">
                From Sender Name
              </label>
              <Input
                id="from_name"
                name="from_name"
                value={formik.values.from_name}
                onChange={(e) => handleFieldChange("from_name", e.target.value)}
                onBlur={formik.handleBlur}
                className={cn(
                  "h-10 text-sm",
                  formik.touched.from_name && formik.errors.from_name && "border-destructive ring-1 ring-destructive/30"
                )}
              />
              {formik.touched.from_name && formik.errors.from_name && (
                <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                  {formik.errors.from_name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="smtp_password" className="text-xs font-semibold text-foreground block mb-1.5">
                SMTP Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="smtp_password"
                  name="smtp_password"
                  type={showPassword ? "text" : "password"}
                  placeholder="App Password"
                  value={formik.values.smtp_password}
                  onChange={(e) => handleFieldChange("smtp_password", e.target.value)}
                  onBlur={formik.handleBlur}
                  className={cn(
                    "pl-9 pr-9 h-10 text-sm",
                    formik.touched.smtp_password && formik.errors.smtp_password && "border-destructive ring-1 ring-destructive/30"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-1"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {formik.touched.smtp_password && formik.errors.smtp_password && (
                <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                  {formik.errors.smtp_password}
                </p>
              )}
            </div>
          </div>

          {/* Hint */}
          <div className="text-xs text-muted-foreground leading-relaxed pt-1">
            Enter GOOGLE APP PASSWORD not your standard password. Generate one at{" "}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
              className="underline text-amber-600 dark:text-amber-400 font-medium hover:text-amber-500"
            >
              Google App Passwords
            </a>.
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving || isTesting}
              className="h-9 px-4 text-xs font-medium rounded-xl border-border inline-flex items-center justify-center whitespace-nowrap cursor-pointer hover:bg-muted"
            >
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              {!isTestedSuccess ? (
                /* Step 1: Test Connection Button */
                <Button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || isSaving || !formik.values.smtp_host || !formik.values.smtp_password}
                  className={cn(
                    "h-9.5 px-5 text-xs font-semibold rounded-xl text-white inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-all duration-300 shadow-xs",
                    testState === "testing"
                      ? "bg-amber-600 opacity-90 animate-pulse"
                      : testState === "failed"
                      ? "bg-rose-600 hover:bg-rose-700 ring-2 ring-rose-500/20"
                      : "bg-amber-600 hover:bg-amber-700"
                  )}
                >
                  {testState === "testing" ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Testing Connection...</span>
                    </>
                  ) : testState === "failed" ? (
                    <>
                      <RefreshCw className="size-3.5" />
                      <span>Retry Connection Test</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" />
                      <span>Test Connection</span>
                    </>
                  )}
                </Button>
              ) : (
                /* Step 2: Save Configuration Button (Only unlocked upon successful test) */
                <div className="flex items-center gap-2 animate-in zoom-in-95 duration-200">
                  

                  <Button
                    type="submit"
                    disabled={isSaving || isTesting}
                    className="h-9.5 px-5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shadow-md transition-all duration-200 animate-in fade-in-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <span>Save Configuration</span>
                        <ArrowRight className="size-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SmtpConfigModal

