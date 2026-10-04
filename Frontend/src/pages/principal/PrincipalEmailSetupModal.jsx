import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useFormik } from "formik"
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  ExternalLink,
} from "lucide-react"
import {
  savePrincipalEmailSetupApi,
  testPrincipalEmailSetupApi,
} from "@/api/principalEmailService"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { ModalHeader } from "@/components/common/ModalHeader"
import { Popover, PopoverDialog } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import * as Yup from "yup"
import { SIMPLE_EMAIL_REGEX } from "@/validations/patterns"

const principalEmailSetupValidationSchema = Yup.object().shape({
  email: Yup.string()
    .trim()
    .matches(SIMPLE_EMAIL_REGEX, "Invalid email format")
    .required("Email address is required"),
  app_password: Yup.string().trim().required("App Password is required"),
})

export function PrincipalEmailSetupModal({ isOpen, onClose, existingConfig = null }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [showInstructions, setShowInstructions] = useState(false)

  const savedPassword = existingConfig?.app_password || existingConfig?.smtp_password || ""
  const isConfigured = Boolean(existingConfig?.is_configured)

  // Test states: 'idle' | 'testing' | 'succeeded' | 'failed'
  const [testState, setTestState] = useState(isConfigured ? "succeeded" : "idle")
  const [testMessage, setTestMessage] = useState(isConfigured ? "Connection verified and active." : "")
  const [isTestedSuccess, setIsTestedSuccess] = useState(isConfigured)

  const defaultUserEmail =
    existingConfig?.from_email || existingConfig?.email || user?.email || ""

  // Automatically derive sender name from School Name and Principal First + Last Name
  const schoolName = user?.school_name?.trim() || ""
  const principalName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join(" ")
  const autoSenderName =
    schoolName && principalName
      ? `${schoolName} - ${principalName}`
      : schoolName || principalName || "School Office"

  const formik = useFormik({
    initialValues: {
      email: defaultUserEmail,
      app_password: savedPassword,
    },
    validationSchema: principalEmailSetupValidationSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      // Guard: App Password must be successfully tested before saving
      if (!isTestedSuccess) {
        toast.warning("Please test and verify the email connection before saving.")
        return
      }

      try {
        const payload = {
          email: values.email.trim().toLowerCase(),
          app_password: values.app_password.trim(),
          from_name: autoSenderName,
          sender_name: autoSenderName,
        }

        await savePrincipalEmailSetupApi(payload)
        await queryClient.invalidateQueries({ queryKey: ["principalEmailSetup"] })
        toast.success("Email setup configuration saved successfully!")
        setTimeout(() => {
          onClose?.()
        }, 1000)
      } catch (err) {
        toast.error(err?.message || "Failed to save Email setup configuration.")
      }
    },
  })

  // Reset form and UI states back to the saved configuration
  const resetToSavedState = () => {
    formik.resetForm({
      values: {
        email: defaultUserEmail,
        app_password: savedPassword,
      },
    })
    setTestState(isConfigured ? "succeeded" : "idle")
    setTestMessage(isConfigured ? "Connection verified and active." : "")
    setIsTestedSuccess(isConfigured)
    setServerError("")
    setSuccessMessage("")
    setShowInstructions(false)
    setShowPassword(false)
  }

  // When modal is closed and then reopened, or when saved configuration updates, reset fields
  useEffect(() => {
    if (isOpen) {
      resetToSavedState()
    }
  }, [isOpen, existingConfig, defaultUserEmail])

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
    if (errors.email || errors.app_password) {
      formik.setTouched({
        email: true,
        app_password: true,
      })
      toast.warning("Please enter your email and app password before testing.")
      return
    }

    setTestState("testing")
    const toastId = toast.loading("Testing email connection...")

    try {
      const payload = {
        email: formik.values.email.trim().toLowerCase(),
        app_password: formik.values.app_password.trim(),
        from_name: autoSenderName,
        sender_name: autoSenderName,
      }

      const res = await testPrincipalEmailSetupApi(payload)
      if (res?.success !== false) {
        setTestState("succeeded")
        setIsTestedSuccess(true)
        toast.success("Email Connection Verified", {
          id: toastId,
          description: res?.message || "Email server connected and authenticated successfully!",
        })
      } else {
        setTestState("failed")
        setIsTestedSuccess(false)
        toast.error("Email Connection Failed", {
          id: toastId,
          description: res?.message || "Please verify credentials.",
        })
      }
    } catch (err) {
      setTestState("failed")
      setIsTestedSuccess(false)
      toast.error("Email Connection Failed", {
        id: toastId,
        description: err?.message || "Failed to connect to email server.",
      })
    }
  }

  const isSaving = formik.isSubmitting
  const isTesting = testState === "testing"

  return (
    <Popover
      placement="bottom end"
      offset={8}
      className="w-[calc(100vw-2rem)] sm:w-[490px] max-h-[85vh] p-0 overflow-hidden"
    >
      <PopoverDialog className="h-full flex flex-col">
        {({ close }) => {
          const handleModalClose = (e) => {
            if (e?.preventDefault) e.preventDefault()
            if (e?.stopPropagation) e.stopPropagation()
            resetToSavedState()
            close?.()
            onClose?.()
          }

          return (
            <>
              {/* Header */}
            <ModalHeader
              icon={Mail}
              iconClassName="bg-primary/10 border-primary/20 text-primary"
              title="School Email Setup"
              description="Configure your outgoing email for sending invitations and login links"
              onClose={handleModalClose}
              className="px-5 py-4 border-b border-border/70 shrink-0"
              titleClassName="text-base font-semibold"
            />

            {/* Form Body */}
            <form onSubmit={formik.handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">

              {/* Sender Email Address */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="email" className="text-xs font-semibold text-foreground block">
                    Sender Email Address
                  </label>
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    readOnly
                    value={formik.values.email}
                    className="pl-9 h-9 text-sm bg-muted/60 text-muted-foreground cursor-not-allowed select-all border-border/80 focus-visible:ring-0"
                  />
                </div>
              </div>

              {/* App Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="app_password" className="text-xs font-semibold text-foreground block">
                    App Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowInstructions(!showInstructions)}
                    className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <HelpCircle className="size-3" />
                    <span>How to generate an App Password?</span>
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="app_password"
                    name="app_password"
                    type={showPassword ? "text" : "password"}
                    placeholder="16-character App Password"
                    value={formik.values.app_password}
                    onChange={(e) => handleFieldChange("app_password", e.target.value)}
                    onBlur={formik.handleBlur}
                    className={cn(
                      "pl-9 pr-9 h-9 text-sm font-mono",
                      formik.touched.app_password && formik.errors.app_password && "border-destructive ring-1 ring-destructive/30"
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
                {formik.touched.app_password && formik.errors.app_password && (
                  <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                    {formik.errors.app_password}
                  </p>
                )}
              </div>

              {/* Hint */}
              <div className="text-xs text-muted-foreground leading-relaxed pt-0.5">
                Enter GOOGLE APP PASSWORD not your standard password. Generate one at{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-primary font-medium hover:underline hover:opacity-85"
                >
                  Google App Passwords
                </a>.
              </div>

              {/* Instruction Accordion */}
              {showInstructions && (
                <div className="p-3.5 rounded-xl bg-muted/60 border border-border text-xs text-muted-foreground space-y-2 animate-in fade-in-0 duration-200">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <span>Instructions for Google / Gmail</span>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 pl-1">
                    <li>Go to your Google Account (<a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">Security Settings <ExternalLink className="size-2.5 inline" /></a>).</li>
                    <li>Ensure <strong>2-Step Verification</strong> is enabled.</li>
                    <li>Search for or select <strong>App passwords</strong>.</li>
                    <li>Name it <strong>School LMS</strong> or anything else and click <strong>Create</strong>.</li>
                    <li>Copy the password and paste it into the field above with <strong>spaces removed</strong>.</li>
                  </ol>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/60 shrink-0">
                <Button
                  type="button"
                  slot="close"
                  variant="outline"
                  onPress={handleModalClose}
                  onClick={handleModalClose}
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
                      disabled={isTesting || isSaving || !formik.values.email || !formik.values.app_password}
                      className={cn(
                        "h-9 px-4 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-all duration-300 shadow-xs",
                        testState === "testing"
                          ? "bg-primary opacity-90 animate-pulse text-primary-foreground"
                          : testState === "failed"
                          ? "bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-500/20"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground"
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
                        className="h-9 px-4 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shadow-md transition-all duration-200 animate-in fade-in-50"
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
          </>
        )
      }}
    </PopoverDialog>
  </Popover>
  )
}

export default PrincipalEmailSetupModal

