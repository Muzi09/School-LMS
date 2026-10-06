import React, { useState, useEffect } from "react"
import { useFormik } from "formik"
import { useQuery } from "@tanstack/react-query"
import {
  Layers,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  User,
  ShieldAlert,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { useCreateStaff, useUpdateStaff } from "@/hooks/useStaff"
import { getPrincipalEmailSetupApi } from "@/api/principalEmailService"
import { generateStaffIdApi } from "@/api/staffService"
import { getStaffValidationSchema } from "@/validations"
import { ModalHeader } from "@/components/common/ModalHeader"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { Combobox } from "@/components/ui/combobox"
import { cn } from "@/lib/utils"

export function StaffFormModal({ isOpen, onClose, staff = null }) {
  const isEdit = Boolean(staff && staff.id)

  const createStaffMutation = useCreateStaff()
  const updateStaffMutation = useUpdateStaff()
  const [serverError, setServerError] = useState("")

  // Post-creation manual setup link states
  const [createdSetupUrl, setCreatedSetupUrl] = useState("")
  const [createdStaffName, setCreatedStaffName] = useState("")
  const [isCopied, setIsCopied] = useState(false)

  // Query Principal Email Setup configuration
  const { data: emailSetupData } = useQuery({
    queryKey: ["principalEmailSetup"],
    queryFn: async () => {
      const res = await getPrincipalEmailSetupApi()
      return res?.data ?? res
    },
    staleTime: 30000,
    enabled: isOpen,
  })

  const isEmailConfigured = Boolean(emailSetupData?.is_configured)

  const validationSchema = React.useMemo(() => getStaffValidationSchema(isEdit), [isEdit])

  const initialValues = React.useMemo(() => {
    const profile = staff?.staff_profile || {}
    return {
      first_name: staff?.first_name || "",
      last_name: staff?.last_name || "",
      login_mobile: staff?.login_mobile || "",
      email: staff?.email || "",
      roll_no: profile.roll_no || "",
      gender: profile.gender ?? 1,
      date_of_birth: profile.date_of_birth || "",
    }
  }, [staff])

  const formik = useFormik({
    initialValues,
    validationSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setServerError("")

      try {
        if (isEdit) {
          const updatePayload = {
            first_name: values.first_name.trim(),
            last_name: values.last_name.trim(),
            login_mobile: values.login_mobile.trim(),
            email: values.email.trim(),
            profile: {
              roll_no: values.roll_no.trim(),
              gender: Number(values.gender),
              date_of_birth: values.date_of_birth,
            },
          }
          await updateStaffMutation.mutateAsync({ staffId: staff.id, data: updatePayload })
          handleClose()
        } else {
          const payload = {
            first_name: values.first_name.trim(),
            last_name: values.last_name.trim(),
            login_mobile: values.login_mobile.trim(),
            email: values.email.trim(),
            profile: {
              roll_no: values.roll_no.trim(),
              gender: Number(values.gender),
              date_of_birth: values.date_of_birth,
            },
          }

          const res = await createStaffMutation.mutateAsync(payload)
          const data = res?.data || res

          // If setup link is available and email wasn't sent or not configured, show copy link screen
          if (data?.setup_url && (!data.email_sent || !isEmailConfigured)) {
            setCreatedSetupUrl(data.setup_url)
            setCreatedStaffName(`${values.first_name} ${values.last_name}`.trim())
          } else {
            handleClose()
          }
        }
      } catch (err) {
        toast.error(err.message || "An error occurred while saving staff.")
      }
    },
  })

  const handleCopySetupLink = () => {
    if (createdSetupUrl) {
      navigator.clipboard.writeText(createdSetupUrl)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  const handleClose = () => {
    setServerError("")
    setCreatedSetupUrl("")
    setCreatedStaffName("")
    setIsCopied(false)
    createStaffMutation.reset?.()
    updateStaffMutation.reset?.()
    formik.resetForm({ values: initialValues })
    onClose()
  }

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"

      // Auto-generate next Staff ID for new staff
      if (!isEdit) {
        generateStaffIdApi()
          .then((res) => {
            if (res?.staff_id) {
              formik.setFieldValue("roll_no", res.staff_id)
            }
          })
          .catch(() => {
            const currentYear = new Date().getFullYear()
            formik.setFieldValue("roll_no", `${currentYear}STF001`)
          })
      }
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen, isEdit])

  if (!isOpen) return null

  const isPending = createStaffMutation.isPending || updateStaffMutation.isPending || formik.isSubmitting
  const error = serverError || createStaffMutation.error?.message || updateStaffMutation.error?.message

  // Restriction helper for mobile numbers (digits only)
  const handlePhoneChange = (e) => {
    const numeric = e.target.value.replace(/\D/g, "").slice(0, 15)
    formik.setFieldValue("login_mobile", numeric)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200"
        onClick={handleClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-200">
        <ModalHeader
          title={isEdit ? "Edit Staff Member" : "Create Staff Member"}
          description={
            isEdit
              ? "Update staff profile information."
              : "Register a new staff member. The staff member will create their own password and PIN upon first login."
          }
          onClose={handleClose}
        />

        {/* POST-CREATION SETUP LINK BANNER (When email setup is not configured or email failed) */}
        {createdSetupUrl ? (
          <div className="p-6 sm:p-8 text-center space-y-5 overflow-y-auto">
            <div className="size-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shadow-sm animate-in zoom-in-50 duration-200">
              <CheckCircle2 className="size-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-foreground">Staff Account Created!</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                <strong>{createdStaffName}</strong> is registered in <strong>Pending Activation</strong> status.
                {!isEmailConfigured && (
                  <span className="block mt-1.5 text-primary font-medium">
                    Because Email Setup is not configured, please copy and share the setup link manually.
                  </span>
                )}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-muted/60 border border-border text-left space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Staff First Login Setup Link:
                </label>
                <span className="text-[10px] text-muted-foreground">Expires in 48 hours</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={createdSetupUrl}
                  className="flex-1 h-10 px-3 text-xs bg-background border border-border rounded-lg text-foreground font-mono truncate"
                />
                <Button
                  type="button"
                  onClick={handleCopySetupLink}
                  className="h-10 px-3.5 text-xs font-semibold rounded-lg shrink-0 gap-1.5 cursor-pointer"
                >
                  {isCopied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  <span>{isCopied ? "Copied!" : "Copy Link"}</span>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Send this link privately to the staff member. They will create their own password and 4-digit PIN to activate their account.
              </p>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                onClick={handleClose}
                className="w-full h-11 text-sm font-semibold rounded-xl cursor-pointer"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          /* Main Staff Form */
          <form onSubmit={formik.handleSubmit} noValidate className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle className="font-semibold">Error</AlertTitle>
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {/* Email Setup Status Warning/Notice for Staff Creation */}
            {!isEdit && (
              <>
                {!isEmailConfigured && (
                  <Alert variant="warning">
                    <ShieldAlert className="size-4" />
                    <AlertTitle className="font-semibold text-foreground">
                      Email Setup is not completed
                    </AlertTitle>
                    <AlertDescription className="text-muted-foreground mt-0.5">
                      The Staff member will not receive their first-login link automatically. You can still create the account, and you will be provided a secure setup link to share with them manually after creation.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {/* Section 1: Staff Account & Profile */}
            <div className="space-y-3.5">
              <h4 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/60 pb-2">
                <User className="size-4 text-primary" />
                <span>1. Personal & Contact Information</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">
                    First Name
                  </label>
                  <Input
                    id="first_name"
                    name="first_name"
                    maxLength={50}
                    value={formik.values.first_name}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    className={cn(
                      "h-10 text-sm rounded-xl px-3.5",
                      formik.touched.first_name && formik.errors.first_name && "border-destructive/80 ring-1 ring-destructive/30"
                    )}
                  />
                  {formik.touched.first_name && formik.errors.first_name && (
                    <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                      {formik.errors.first_name}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="last_name" className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">
                    Last Name
                  </label>
                  <Input
                    id="last_name"
                    name="last_name"
                    maxLength={50}
                    value={formik.values.last_name}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    className={cn(
                      "h-10 text-sm rounded-xl px-3.5",
                      formik.touched.last_name && formik.errors.last_name && "border-destructive/80 ring-1 ring-destructive/30"
                    )}
                  />
                  {formik.touched.last_name && formik.errors.last_name && (
                    <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                      {formik.errors.last_name}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="login_mobile" className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">
                    Mobile Number
                  </label>
                  <Input
                    id="login_mobile"
                    name="login_mobile"
                    maxLength={15}
                    value={formik.values.login_mobile}
                    onChange={handlePhoneChange}
                    onBlur={formik.handleBlur}
                    placeholder="e.g. 9876543210"
                    className={cn(
                      "h-10 text-sm rounded-xl px-3.5",
                      formik.touched.login_mobile && formik.errors.login_mobile && "border-destructive/80 ring-1 ring-destructive/30"
                    )}
                  />
                  {formik.touched.login_mobile && formik.errors.login_mobile && (
                    <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                      {formik.errors.login_mobile}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    maxLength={100}
                    value={formik.values.email}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder="staff@school.edu"
                    className={cn(
                      "h-10 text-sm rounded-xl px-3.5",
                      formik.touched.email && formik.errors.email && "border-destructive/80 ring-1 ring-destructive/30"
                    )}
                  />
                  {formik.touched.email && formik.errors.email && (
                    <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                      {formik.errors.email}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Staff Profile Details */}
            <div className="space-y-3.5">
              <h4 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/60 pb-2">
                <Layers className="size-4 text-primary" />
                <span>2. Staff Profile Details</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="roll_no" className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">
                    Staff ID
                  </label>
                  <Input
                    id="roll_no"
                    name="roll_no"
                    readOnly
                    tabIndex={-1}
                    value={formik.values.roll_no}
                    placeholder="Generating Staff ID..."
                    className="h-10 text-sm font-mono rounded-xl px-3.5 bg-muted/40 cursor-not-allowed select-none text-muted-foreground focus-visible:ring-0 focus-visible:border-transparent"
                  />
                  {formik.touched.roll_no && formik.errors.roll_no && (
                    <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                      {formik.errors.roll_no}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="gender" className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">
                    Gender
                  </label>
                  <Combobox
                    id="gender"
                    name="gender"
                    value={formik.values.gender}
                    onValueChange={(val) => {
                      formik.setFieldValue("gender", Number(val))
                      formik.setFieldTouched("gender", true)
                    }}
                    options={[
                      { value: 1, label: "Male" },
                      { value: 2, label: "Female" },
                      { value: 3, label: "Other" },
                    ]}
                    placeholder="Select Gender"
                    className={cn(
                      formik.touched.gender && formik.errors.gender && "border-destructive/80 ring-1 ring-destructive/30"
                    )}
                  />
                  {formik.touched.gender && formik.errors.gender && (
                    <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                      {formik.errors.gender}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="date_of_birth" className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">
                    Date of Birth
                  </label>
                  <DatePicker
                    id="date_of_birth"
                    name="date_of_birth"
                    value={formik.values.date_of_birth}
                    onChange={(dateStr) => {
                      formik.setFieldValue("date_of_birth", dateStr)
                      formik.setFieldTouched("date_of_birth", true, true)
                    }}
                    placeholder="YYYY-MM-DD"
                  />
                  {formik.touched.date_of_birth && formik.errors.date_of_birth && (
                    <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                      {formik.errors.date_of_birth}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/80">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isPending}
                className="h-10 px-5 text-sm font-medium rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-10 px-6 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    <span>Saving...</span>
                  </span>
                ) : isEdit ? (
                  "Update Staff"
                ) : (
                  "Create Staff"
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
export default StaffFormModal
