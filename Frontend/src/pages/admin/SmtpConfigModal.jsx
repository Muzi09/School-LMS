import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useFormik } from "formik"
import {
  Mail,
  Server,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from "lucide-react"
import { adminService } from "@/api/adminService"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { ModalHeader } from "@/components/common/ModalHeader"
import { cn } from "@/lib/utils"
import { smtpConfigValidationSchema } from "@/validations"

export function SmtpConfigModal({ isOpen, onClose, existingConfig = null }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  
  // Test states: 'idle' | 'testing' | 'succeeded' | 'failed'
  const [testState, setTestState] = useState("idle")
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
        toast.success("SMTP configuration saved successfully!")
        setTimeout(() => {
          onClose()
        }, 1000)
      } catch (err) {
        toast.error(err?.message || "Failed to save SMTP configuration.")
      }
    },
  })

  // Reset tested status whenever user changes any field
  const handleFieldChange = (field, value) => {
    formik.setFieldValue(field, value)
    setIsTestedSuccess(false)
    setTestState("idle")
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
      toast.warning("Please fill all required SMTP fields before testing.")
      return
    }

    setTestState("testing")
    const toastId = toast.loading("Testing SMTP connection...")

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
        setIsTestedSuccess(true)
        toast.success("SMTP Connection Verified", {
          id: toastId,
          description: res.message || "Connection and authentication succeeded!",
        })
      } else {
        setTestState("failed")
        setIsTestedSuccess(false)
        toast.error("SMTP Connection Failed", {
          id: toastId,
          description: res.message || "Please verify credentials.",
        })
      }
    } catch (err) {
      setTestState("failed")
      setIsTestedSuccess(false)
      toast.error("SMTP Connection Failed", {
        id: toastId,
        description: err?.message || "Failed to connect to SMTP server.",
      })
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
        <form onSubmit={formik.handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">

          {/* Row 1: Equal Width Host & Port */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="smtp_host" className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">
                SMTP Host
              </label>
              <div className="relative">
                <Server className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="smtp_host"
                  name="smtp_host"
                  value={formik.values.smtp_host}
                  onChange={(e) => handleFieldChange("smtp_host", e.target.value)}
                  onBlur={formik.handleBlur}
                  className={cn(
                    "pl-11 pr-3.5 h-10 text-sm rounded-xl",
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
              <label htmlFor="smtp_port" className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">
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
                  "h-10 text-sm font-mono rounded-xl px-3.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
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
            <label htmlFor="from_email" className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">
              From Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="from_email"
                name="from_email"
                type="email"
                readOnly
                value={formik.values.from_email}
                className="pl-11 pr-3.5 h-10 text-sm rounded-xl bg-muted/50 cursor-not-allowed text-foreground border-border select-all"
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
              <label htmlFor="from_name" className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">
                From Sender Name
              </label>
              <Input
                id="from_name"
                name="from_name"
                value={formik.values.from_name}
                onChange={(e) => handleFieldChange("from_name", e.target.value)}
                onBlur={formik.handleBlur}
                className={cn(
                  "h-10 text-sm rounded-xl px-3.5",
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
              <label htmlFor="smtp_password" className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">
                SMTP Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="smtp_password"
                  name="smtp_password"
                  type={showPassword ? "text" : "password"}
                  placeholder="App Password"
                  value={formik.values.smtp_password}
                  onChange={(e) => handleFieldChange("smtp_password", e.target.value)}
                  onBlur={formik.handleBlur}
                  className={cn(
                    "pl-11 pr-10 h-10 text-sm rounded-xl font-mono",
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
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-border/80">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving || isTesting}
              className="h-10 px-5 text-sm font-medium rounded-xl cursor-pointer"
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
                    "h-10 px-5 text-sm font-semibold rounded-xl text-white inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-all duration-300 shadow-sm",
                    testState === "testing"
                      ? "bg-amber-600 opacity-90 animate-pulse"
                      : testState === "failed"
                      ? "bg-rose-600 hover:bg-rose-700 ring-2 ring-rose-500/20"
                      : "bg-amber-600 hover:bg-amber-700"
                  )}
                >
                  {testState === "testing" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Testing Connection...</span>
                    </>
                  ) : testState === "failed" ? (
                    <>
                      <RefreshCw className="size-4" />
                      <span>Retry Connection Test</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
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
                    className="h-10 px-6 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shadow-sm transition-all duration-200 animate-in fade-in-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <span>Save Configuration</span>
                        <ArrowRight className="size-4" />
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

