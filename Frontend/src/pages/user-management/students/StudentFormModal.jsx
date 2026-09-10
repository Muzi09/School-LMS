import React, { useState } from "react"
import { useFormik } from "formik"
import {
  X,
  GraduationCap,
  Lock,
  Layers,
  AlertCircle,
  Loader2,
} from "lucide-react"

import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { useCreateStudent, useUpdateStudent } from "@/hooks/useStudents"
import { schoolConfigService } from "@/api/schoolConfigService"
import { getStudentValidationSchema } from "./studentValidation"
import { ModalHeader } from "@/components/common/ModalHeader"
import { cn } from "@/lib/utils"

export function StudentFormModal({ isOpen, onClose, student = null }) {
  const isEdit = Boolean(student && student.id)

  const createStudentMutation = useCreateStudent()
  const updateStudentMutation = useUpdateStudent()
  const [serverError, setServerError] = useState("")

  const validationSchema = React.useMemo(() => getStudentValidationSchema(isEdit), [isEdit])

  const initialValues = React.useMemo(() => {
    const profile = student?.student_profile || {}
    return {
      first_name: student?.first_name || "",
      middle_name: profile.middle_name || "",
      last_name: student?.last_name || "",
      login_mobile: student?.login_mobile || "",
      email: student?.email || "",
      password: "",
      roll_no: profile.roll_no || "",
      gender: profile.gender ?? 1,
      date_of_birth: profile.date_of_birth || "",
      class_name: profile.class_name || "",
      section: profile.section || "",
      house: profile.house || "",
      father_first_name: profile.father_first_name || "",
      father_last_name: profile.father_last_name || "",
    }
  }, [student])

  const { data: schoolClasses = [] } = useQuery({
    queryKey: ["schoolClasses"],
    queryFn: schoolConfigService.getClasses,
    staleTime: 5 * 60 * 1000,
  })

  const { data: schoolHouses = [] } = useQuery({
    queryKey: ["schoolHouses"],
    queryFn: schoolConfigService.getHouses,
    staleTime: 5 * 60 * 1000,
  })

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
              middle_name: values.middle_name ? values.middle_name.trim() : null,
              roll_no: values.roll_no.trim(),
              gender: Number(values.gender),
              date_of_birth: values.date_of_birth,
              class_name: values.class_name.trim(),
              section: values.section.trim(),
              house: values.house.trim(),
              father_first_name: values.father_first_name.trim(),
              father_last_name: values.father_last_name.trim(),
            },
          }
          if (values.password.trim()) {
            updatePayload.password = values.password.trim()
          }
          await updateStudentMutation.mutateAsync({
            id: student.id,
            data: updatePayload,
          })
        } else {
          const createPayload = {
            first_name: values.first_name.trim(),
            last_name: values.last_name.trim(),
            login_mobile: values.login_mobile.trim(),
            email: values.email.trim(),
            password: values.password.trim(),
            profile: {
              middle_name: values.middle_name ? values.middle_name.trim() : null,
              roll_no: values.roll_no.trim(),
              gender: Number(values.gender),
              date_of_birth: values.date_of_birth,
              class_name: values.class_name.trim(),
              section: values.section.trim(),
              house: values.house.trim(),
              father_first_name: values.father_first_name.trim(),
              father_last_name: values.father_last_name.trim(),
            },
          }
          await createStudentMutation.mutateAsync(createPayload)
        }
        onClose()
      } catch (err) {
        setServerError(err?.message || "Operation failed. Please try again.")
      }
    },
  })

  if (!isOpen) return null

  const isPending = createStudentMutation.isPending || updateStudentMutation.isPending
  const currentClassObj = schoolClasses.find((c) => c.name === formik.values.class_name)
  const availableSections = currentClassObj?.sections || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <ModalHeader
          icon={GraduationCap}
          title={isEdit ? "Edit Student Profile" : "Register New Student"}
          description={isEdit ? "Update personal and academic records" : "Add a new student to your school roster"}
          onClose={onClose}
        />

        {/* Form */}
        <form onSubmit={formik.handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-6">
            {serverError && (
              <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2.5">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span className="leading-tight">{serverError}</span>
              </div>
            )}

            {/* Account & Security Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                <Lock className="size-4 text-primary" />
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Account & Security
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  <label htmlFor="middle_name" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
                    Middle Name <span className="text-muted-foreground font-normal text-xs">(Optional)</span>
                  </label>
                  <Input
                    id="middle_name"
                    name="middle_name"
                    maxLength={50}
                    value={formik.values.middle_name}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    className={cn(
                      "h-10 text-sm rounded-xl px-3.5",
                      formik.touched.middle_name && formik.errors.middle_name && "border-destructive/80 ring-1 ring-destructive/30"
                    )}
                  />
                  {formik.touched.middle_name && formik.errors.middle_name && (
                    <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                      {formik.errors.middle_name}
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="login_mobile" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
                    Login Mobile
                  </label>
                  <Input
                    id="login_mobile"
                    name="login_mobile"
                    maxLength={20}
                    value={formik.values.login_mobile}
                    onChange={(e) => {
                      const onlyNumbers = e.target.value.replace(/\D/g, "")
                      formik.setFieldValue("login_mobile", onlyNumbers)
                    }}
                    onBlur={formik.handleBlur}
                    className={cn(
                      "h-10 text-sm rounded-xl px-3.5 font-mono",
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
                    id="email"
                    name="email"
                    type="email"
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

                <div>
                  <label htmlFor="password" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
                    {isEdit ? "New Password" : "Password"}
                  </label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder={isEdit ? "Leave blank to keep current" : "••••••••"}
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

            {/* Academic Profile Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                <Layers className="size-4 text-primary" />
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Academic & Personal Profile
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="roll_no" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
                    Roll Number
                  </label>
                  <Input
                    id="roll_no"
                    name="roll_no"
                    maxLength={50}
                    value={formik.values.roll_no}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    className={cn(
                      "h-10 text-sm rounded-xl px-3.5 font-mono",
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

                {/* Class / Grade (Dynamic from School Config) */}
                <div>
                  <label htmlFor="class_name" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
                    Class / Grade
                  </label>
                  {schoolClasses.length > 0 ? (
                    <select
                      id="class_name"
                      name="class_name"
                      value={formik.values.class_name}
                      onChange={(e) => {
                        formik.setFieldValue("class_name", e.target.value)
                        const cls = schoolClasses.find((c) => c.name === e.target.value)
                        if (cls?.sections?.length > 0) {
                          formik.setFieldValue("section", cls.sections[0].name)
                        }
                      }}
                      onBlur={formik.handleBlur}
                      className={cn(
                        "w-full h-10 rounded-xl border border-transparent bg-input/50 px-3.5 py-2 text-sm text-foreground transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 cursor-pointer",
                        formik.touched.class_name && formik.errors.class_name && "border-destructive/80 ring-1 ring-destructive/30"
                      )}
                    >
                      <option value="" disabled className="bg-popover text-muted-foreground">Select Class</option>
                      {schoolClasses.map((c) => (
                        <option key={c.id} value={c.name} className="bg-popover text-popover-foreground">
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id="class_name"
                      name="class_name"
                      maxLength={50}
                      placeholder="e.g. Class 1"
                      value={formik.values.class_name}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      className={cn(
                        "h-10 text-sm rounded-xl px-3.5",
                        formik.touched.class_name && formik.errors.class_name && "border-destructive/80 ring-1 ring-destructive/30"
                      )}
                    />
                  )}
                  {formik.touched.class_name && formik.errors.class_name && (
                    <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                      {formik.errors.class_name}
                    </p>
                  )}
                </div>

                {/* Section (Dynamic from Selected Class) */}
                <div>
                  <label htmlFor="section" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
                    Section
                  </label>
                  {availableSections.length > 0 ? (
                    <select
                      id="section"
                      name="section"
                      value={formik.values.section}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      className={cn(
                        "w-full h-10 rounded-xl border border-transparent bg-input/50 px-3.5 py-2 text-sm text-foreground transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 cursor-pointer",
                        formik.touched.section && formik.errors.section && "border-destructive/80 ring-1 ring-destructive/30"
                      )}
                    >
                      <option value="" disabled className="bg-popover text-muted-foreground">Select Section</option>
                      {availableSections.map((s) => (
                        <option key={s.id} value={s.name} className="bg-popover text-popover-foreground">
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id="section"
                      name="section"
                      maxLength={50}
                      placeholder="e.g. A"
                      value={formik.values.section}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      className={cn(
                        "h-10 text-sm rounded-xl px-3.5",
                        formik.touched.section && formik.errors.section && "border-destructive/80 ring-1 ring-destructive/30"
                      )}
                    />
                  )}
                  {formik.touched.section && formik.errors.section && (
                    <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                      {formik.errors.section}
                    </p>
                  )}
                </div>

                {/* House (Dynamic from School Config) */}
                <div>
                  <label htmlFor="house" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
                    House
                  </label>
                  {schoolHouses.length > 0 ? (
                    <select
                      id="house"
                      name="house"
                      value={formik.values.house}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      className={cn(
                        "w-full h-10 rounded-xl border border-transparent bg-input/50 px-3.5 py-2 text-sm text-foreground transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 cursor-pointer",
                        formik.touched.house && formik.errors.house && "border-destructive/80 ring-1 ring-destructive/30"
                      )}
                    >
                      <option value="" disabled className="bg-popover text-muted-foreground">Select House</option>
                      {schoolHouses.map((h) => (
                        <option key={h.id} value={h.name} className="bg-popover text-popover-foreground">
                          {h.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id="house"
                      name="house"
                      maxLength={50}
                      placeholder="e.g. Red House"
                      value={formik.values.house}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      className={cn(
                        "h-10 text-sm rounded-xl px-3.5",
                        formik.touched.house && formik.errors.house && "border-destructive/80 ring-1 ring-destructive/30"
                      )}
                    />
                  )}
                  {formik.touched.house && formik.errors.house && (
                    <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                      {formik.errors.house}
                    </p>
                  )}
                </div>

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
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-border/70 bg-muted/20 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={onClose}
              disabled={isPending}
              className="h-10 px-5 text-sm font-medium rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="default"
              disabled={isPending}
              className="h-10 px-5 text-sm font-medium rounded-xl gap-2 shadow-xs cursor-pointer"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              <span>{isEdit ? "Save Changes" : "Register Student"}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
