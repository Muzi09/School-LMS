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
  Clock,
  Plus,
  Trash2,
  GraduationCap,
  Building2,
  Briefcase,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { useCreateStaff, useUpdateStaff } from "@/hooks/useStaff"
import { getPrincipalEmailSetupApi } from "@/api/principalEmailService"
import { generateStaffIdApi } from "@/api/staffService"
import { schoolConfigService } from "@/api/schoolConfigService"
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

  // Query School Configuration to get Wings
  const { data: schoolConfigData } = useQuery({
    queryKey: ["schoolConfig"],
    queryFn: async () => {
      const res = await schoolConfigService.getFullConfig()
      return res?.data ?? res
    },
    staleTime: 60000,
    enabled: isOpen,
  })

  const wings = schoolConfigData?.wings || []
  const isEmailConfigured = Boolean(emailSetupData?.is_configured)

  const validationSchema = React.useMemo(
    () => getStaffValidationSchema(isEdit, Boolean(wings && wings.length > 0)),
    [isEdit, wings]
  )

  const initialValues = React.useMemo(() => {
    const profile = staff?.staff_profile || {}
    const defaultShifts =
      profile.working_shifts && profile.working_shifts.length > 0
        ? profile.working_shifts
        : [{ start_time: "08:00", end_time: "14:00" }]
    return {
      first_name: staff?.first_name || "",
      last_name: staff?.last_name || "",
      login_mobile: staff?.login_mobile || "",
      email: staff?.email || "",
      roll_no: profile.roll_no || "",
      gender: profile.gender ?? 1,
      date_of_birth: profile.date_of_birth || "",
      tag: profile.tag || profile.designation || "Teacher",
      is_academic: profile.is_academic !== undefined ? profile.is_academic : true,
      is_non_academic: profile.is_non_academic !== undefined ? profile.is_non_academic : false,
      assigned_wing_ids: profile.assigned_wing_ids || [],
      working_shifts: defaultShifts,
    }
  }, [staff])

  const formik = useFormik({
    initialValues,
    validationSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setServerError("")

      if (values.is_academic && wings && wings.length > 0 && (!values.assigned_wing_ids || values.assigned_wing_ids.length === 0)) {
        formik.setFieldError("assigned_wing_ids", "Please select at least one wing for academic staff.")
        formik.setFieldTouched("assigned_wing_ids", true)
        return
      }

      try {
        const payload = {
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          login_mobile: values.login_mobile.trim(),
          email: values.email.trim(),
          profile: {
            roll_no: values.roll_no.trim(),
            gender: Number(values.gender),
            date_of_birth: values.date_of_birth,
            tag: values.tag.trim() || "Teacher",
            designation: values.tag.trim() || "Teacher",
            is_academic: Boolean(values.is_academic),
            is_non_academic: Boolean(values.is_non_academic),
            assigned_wing_ids: values.is_academic ? values.assigned_wing_ids : [],
            working_shifts: values.working_shifts,
          },
        }

        if (isEdit) {
          await updateStaffMutation.mutateAsync({ staffId: staff.id, data: payload })
          handleClose()
        } else {
          const res = await createStaffMutation.mutateAsync(payload)
          const data = res?.data || res

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

                <div className="col-span-1 sm:col-span-3">
                  <label htmlFor="tag" className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">
                    Designation
                  </label>
                  <Input
                    id="tag"
                    name="tag"
                    maxLength={100}
                    value={formik.values.tag}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder="e.g. Vice Principal, Coordinator, PGT Commerce, Teacher"
                    className={cn(
                      "h-10 text-sm rounded-xl px-3.5",
                      formik.touched.tag && formik.errors.tag && "border-destructive/80 ring-1 ring-destructive/30"
                    )}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    This tag reflects throughout the app directly with the teacher&apos;s name
                  </p>
                  {formik.touched.tag && formik.errors.tag && (
                    <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                      {formik.errors.tag}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Section 3: Staff Classification (Two Checkboxes) */}
            <div className="space-y-3.5">
              <h4 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/60 pb-2">
                <Briefcase className="size-4 text-primary" />
                <span>3. Staff Classification</span>
              </h4>
              <p className="text-xs text-muted-foreground -mt-1">
                Select one or both classifications (at least one must be checked):
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Academic Staff Checkbox Card */}
                <label
                  className={cn(
                    "flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none",
                    formik.values.is_academic
                      ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20"
                      : "bg-muted/20 border-border hover:bg-muted/40"
                  )}
                >
                  <input
                    type="checkbox"
                    id="is_academic"
                    name="is_academic"
                    checked={formik.values.is_academic}
                    onChange={(e) => {
                      formik.setFieldValue("is_academic", e.target.checked)
                      formik.setFieldTouched("is_academic", true)
                    }}
                    className="mt-0.5 size-4 rounded text-primary focus:ring-primary cursor-pointer"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-semibold text-foreground block">
                      Academic Staff
                    </span>
                    <span className="text-[11px] text-muted-foreground block mt-0.5 leading-relaxed">
                      Teaches classes, subjects &amp; timetable periods.
                    </span>
                  </div>
                </label>

                {/* Non-Academic Staff Checkbox Card */}
                <label
                  className={cn(
                    "flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none",
                    formik.values.is_non_academic
                      ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20"
                      : "bg-muted/20 border-border hover:bg-muted/40"
                  )}
                >
                  <input
                    type="checkbox"
                    id="is_non_academic"
                    name="is_non_academic"
                    checked={formik.values.is_non_academic}
                    onChange={(e) => {
                      formik.setFieldValue("is_non_academic", e.target.checked)
                      formik.setFieldTouched("is_non_academic", true)
                    }}
                    className="mt-0.5 size-4 rounded text-primary focus:ring-primary cursor-pointer"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-semibold text-foreground block">
                      Non-Academic Staff
                    </span>
                    <span className="text-[11px] text-muted-foreground block mt-0.5 leading-relaxed">
                      Administration, office, accounts &amp; operations.
                    </span>
                  </div>
                </label>
              </div>

              {!formik.values.is_academic && !formik.values.is_non_academic && (
                <p className="text-[11px] font-medium text-destructive mt-1">
                  At least one classification must be selected.
                </p>
              )}
            </div>

            {/* Section 4: Assigned Wings (Visible when Academic is selected) */}
            {formik.values.is_academic && (
              <div className="space-y-3.5 animate-in fade-in-0 duration-200">
                <h4 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/60 pb-2">
                  <Building2 className="size-4 text-primary" />
                  <span>
                    4. Assigned Wing(s)
                    {wings && wings.length > 0 && <span className="text-destructive ml-1">*</span>}
                  </span>
                </h4>

                {wings && wings.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {wings.map((w) => {
                        const isSelected = formik.values.assigned_wing_ids.includes(w.id)
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => {
                              const current = formik.values.assigned_wing_ids
                              const updated = isSelected
                                ? current.filter((id) => id !== w.id)
                                : [...current, w.id]
                              formik.setFieldValue("assigned_wing_ids", updated)
                              formik.setFieldTouched("assigned_wing_ids", true)
                            }}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <Check className={cn("size-3.5 transition-transform", isSelected ? "scale-100" : "scale-0 w-0 -mr-1")} />
                            <span>{w.name}</span>
                          </button>
                        )
                      })}
                    </div>
                    {((formik.touched.assigned_wing_ids || formik.submitCount > 0) && formik.values.assigned_wing_ids.length === 0) && (
                      <p className="text-[11px] font-medium text-destructive mt-1.5 leading-tight">
                        Please select at least one wing for academic staff.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No wings configured in school. Staff will be available across the entire school.
                  </p>
                )}
              </div>
            )}

            {/* Section 5: Daily Working Hours & Timetable Timing */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <h4 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  <span>{formik.values.is_academic ? "5. Daily Working Hours & Timetable Timing" : "4. Daily Working Hours"}</span>
                </h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const shifts = formik.values.working_shifts || []
                    formik.setFieldValue("working_shifts", [
                      ...shifts,
                      { start_time: "14:00", end_time: "17:00" },
                    ])
                  }}
                  className="h-7 text-xs font-semibold gap-1 text-primary cursor-pointer hover:bg-primary/10"
                >
                  <Plus className="size-3.5" />
                  <span>Add Shift</span>
                </Button>
              </div>

              <div className="space-y-2.5">
                {(formik.values.working_shifts || []).map((shift, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                    <span className="text-xs font-semibold text-muted-foreground min-w-[50px]">
                      Shift {idx + 1}:
                    </span>
                    <div className="flex-1 grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-0.5">
                          Log In Time
                        </label>
                        <Input
                          type="time"
                          value={shift.start_time || "08:00"}
                          onChange={(e) => {
                            const copy = [...formik.values.working_shifts]
                            copy[idx] = { ...copy[idx], start_time: e.target.value }
                            formik.setFieldValue("working_shifts", copy)
                          }}
                          className="h-9 text-xs rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-0.5">
                          Log Out Time
                        </label>
                        <Input
                          type="time"
                          value={shift.end_time || "14:00"}
                          onChange={(e) => {
                            const copy = [...formik.values.working_shifts]
                            copy[idx] = { ...copy[idx], end_time: e.target.value }
                            formik.setFieldValue("working_shifts", copy)
                          }}
                          className="h-9 text-xs rounded-lg"
                        />
                      </div>
                    </div>
                    {formik.values.working_shifts.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const copy = formik.values.working_shifts.filter((_, i) => i !== idx)
                          formik.setFieldValue("working_shifts", copy)
                        }}
                        className="size-8 text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer shrink-0 mt-3"
                        title="Remove Shift"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
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
