import React, { useState, useEffect } from "react"
import { useFormik } from "formik"
import {
  X,
  Briefcase,
  Lock,
  Layers,
  AlertCircle,
  Loader2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { useCreateStaff, useUpdateStaff } from "@/hooks/useStaff"
import { getStaffValidationSchema } from "@/validations"
import { ModalHeader } from "@/components/common/ModalHeader"
import { cn } from "@/lib/utils"

export function StaffFormModal({ isOpen, onClose, staff = null }) {
  const isEdit = Boolean(staff && staff.id)

  const createStaffMutation = useCreateStaff()
  const updateStaffMutation = useUpdateStaff()
  const [serverError, setServerError] = useState("")

  const validationSchema = React.useMemo(() => getStaffValidationSchema(isEdit), [isEdit])

  const initialValues = React.useMemo(() => {
    const profile = staff?.staff_profile || {}
    return {
      first_name: staff?.first_name || "",
      last_name: staff?.last_name || "",
      login_mobile: staff?.login_mobile || "",
      email: staff?.email || "",
      password: "",
      roll_no: profile.roll_no || "",
      gender: profile.gender ?? 1,
      date_of_birth: profile.date_of_birth || "",
      father_first_name: profile.father_first_name || "",
      father_last_name: profile.father_last_name || "",
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
              father_first_name: values.father_first_name.trim(),
              father_last_name: values.father_last_name.trim(),
            },
          }
          if (values.password.trim()) {
            updatePayload.password = values.password.trim()
          }

          await updateStaffMutation.mutateAsync({ staffId: staff.id, data: updatePayload })
        } else {
          const payload = {
            first_name: values.first_name.trim(),
            last_name: values.last_name.trim(),
            login_mobile: values.login_mobile.trim(),
            email: values.email.trim(),
            password: values.password.trim(),
            profile: {
              roll_no: values.roll_no.trim(),
              gender: Number(values.gender),
              date_of_birth: values.date_of_birth,
              father_first_name: values.father_first_name.trim(),
              father_last_name: values.father_last_name.trim(),
            },
          }

          await createStaffMutation.mutateAsync(payload)
        }

        handleClose()
      } catch (err) {
        setServerError(err.message || "An error occurred while saving staff.")
      }
    },
  })

  const handleClose = () => {
    setServerError("")
    createStaffMutation.reset?.()
    updateStaffMutation.reset?.()
    formik.resetForm({ values: initialValues })
    onClose()
  }

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
      setServerError("")
      createStaffMutation.reset?.()
      updateStaffMutation.reset?.()
      formik.resetForm({ values: initialValues })
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen, staff])

  if (!isOpen) return null

  const isPending = createStaffMutation.isPending || updateStaffMutation.isPending || formik.isSubmitting
  const error = serverError || createStaffMutation.error?.message || updateStaffMutation.error?.message

  // Restriction helper for mobile numbers (digits only)
  const handlePhoneChange = (e) => {
    const numeric = e.target.value.replace(/\D/g, "").slice(0, 15)
    formik.setFieldValue("login_mobile", numeric)
  }

  const handlePhoneKeyDown = (e) => {
    const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"]
    if (
      !/[0-9]/.test(e.key) &&
      !allowedKeys.includes(e.key) &&
      !(e.ctrlKey || e.metaKey)
    ) {
      e.preventDefault()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <ModalHeader
          icon={Briefcase}
          title={isEdit ? `Edit Staff: ${staff.first_name} ${staff.last_name}` : "Create New Staff Member"}
          description={isEdit ? "Update staff account credentials and profile details." : "Fill in information to register a staff account."}
          onClose={handleClose}
        />

        {/* Form Body */}
        <form onSubmit={formik.handleSubmit} noValidate className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-6">
          {error && (
            <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-center gap-2.5">
              <AlertCircle className="size-4.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Account Credentials */}
          <div className="space-y-3.5">
            <h4 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/60 pb-2">
              <Lock className="size-4 text-primary" />
              <span>1. Staff Account & Credentials</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
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
                <label htmlFor="last_name" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
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
                <label htmlFor="login_mobile" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
                  Login Mobile
                </label>
                <Input
                  id="login_mobile"
                  name="login_mobile"
                  maxLength={15}
                  inputMode="numeric"
                  value={formik.values.login_mobile}
                  onChange={handlePhoneChange}
                  onKeyDown={handlePhoneKeyDown}
                  onBlur={formik.handleBlur}
                  className={cn(
                    "h-10 text-sm font-mono rounded-xl px-3.5",
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
                <label htmlFor="email" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
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

              <div className="sm:col-span-2">
                <label htmlFor="password" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
                  {isEdit ? "New Password" : "Password"}
                </label>
                <Input
                  type="password"
                  id="password"
                  name="password"
                  maxLength={100}
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={cn(
                    "h-10 text-sm rounded-xl px-3.5",
                    formik.touched.password && formik.errors.password && "border-destructive/80 ring-1 ring-destructive/30"
                  )}
                />
                {formik.touched.password && formik.errors.password && (
                  <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                    {formik.errors.password}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="space-y-3.5">
            <h4 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/60 pb-2">
              <Layers className="size-4 text-primary" />
              <span>2. Staff Profile Details</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="roll_no" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
                  Staff ID
                </label>
                <Input
                  id="roll_no"
                  name="roll_no"
                  maxLength={50}
                  value={formik.values.roll_no}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={cn(
                    "h-10 text-sm font-mono rounded-xl px-3.5",
                    formik.touched.roll_no && formik.errors.roll_no && "border-destructive/80 ring-1 ring-destructive/30"
                  )}
                />
                {formik.touched.roll_no && formik.errors.roll_no && (
                  <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                    {formik.errors.roll_no}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="gender" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
                  Gender
                </label>
                <select
                  id="gender"
                  name="gender"
                  value={formik.values.gender}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={cn(
                    "w-full h-10 rounded-xl border border-transparent bg-input/50 px-3.5 py-2 text-sm text-foreground transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 cursor-pointer",
                    formik.touched.gender && formik.errors.gender && "border-destructive/80 ring-1 ring-destructive/30"
                  )}
                >
                  <option value={1} className="bg-popover text-popover-foreground">Male</option>
                  <option value={2} className="bg-popover text-popover-foreground">Female</option>
                  <option value={3} className="bg-popover text-popover-foreground">Other</option>
                </select>
                {formik.touched.gender && formik.errors.gender && (
                  <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                    {formik.errors.gender}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="date_of_birth" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
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
                  className={cn(
                    formik.touched.date_of_birth && formik.errors.date_of_birth && "border-destructive/80 ring-1 ring-destructive/30"
                  )}
                />
                {formik.touched.date_of_birth && formik.errors.date_of_birth && (
                  <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                    {formik.errors.date_of_birth}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="father_first_name" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
                  Father First Name
                </label>
                <Input
                  id="father_first_name"
                  name="father_first_name"
                  maxLength={50}
                  value={formik.values.father_first_name}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={cn(
                    "h-10 text-sm rounded-xl px-3.5",
                    formik.touched.father_first_name && formik.errors.father_first_name && "border-destructive/80 ring-1 ring-destructive/30"
                  )}
                />
                {formik.touched.father_first_name && formik.errors.father_first_name && (
                  <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                    {formik.errors.father_first_name}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="father_last_name" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
                  Father Last Name
                </label>
                <Input
                  id="father_last_name"
                  name="father_last_name"
                  maxLength={50}
                  value={formik.values.father_last_name}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={cn(
                    "h-10 text-sm rounded-xl px-3.5",
                    formik.touched.father_last_name && formik.errors.father_last_name && "border-destructive/80 ring-1 ring-destructive/30"
                  )}
                />
                {formik.touched.father_last_name && formik.errors.father_last_name && (
                  <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                    {formik.errors.father_last_name}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-5 border-t border-border flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={handleClose}
              disabled={isPending}
              className="h-10 px-5 text-sm font-medium rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="default"
              disabled={isPending}
              className="h-10 px-5 text-sm font-medium rounded-xl gap-2 shadow-xs"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              <span>{isEdit ? "Save Changes" : "Create Staff"}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StaffFormModal
