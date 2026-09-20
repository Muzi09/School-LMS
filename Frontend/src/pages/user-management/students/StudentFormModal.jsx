import React, { useState, useEffect, useRef } from "react"
import { useFormik } from "formik"
import {
  GraduationCap,
  User,
  AlertCircle,
  Loader2,
  BookOpen,
  Check,
} from "lucide-react"

import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { useCreateStudent, useUpdateStudent } from "@/hooks/useStudents"
import { schoolConfigService } from "@/api/schoolConfigService"
import { calculateStudentRollNoApi } from "@/api/studentService"
import { getStudentValidationSchema } from "@/validations"
import { ModalHeader } from "@/components/common/ModalHeader"
import { cn } from "@/lib/utils"

const STREAM_FALLBACK_SUBJECTS = {
  Science: {
    academic: [
      "English",
      "Physics",
      "Chemistry",
      "Mathematics",
      "Biology",
      "Computer Science/Informatics Practices",
    ],
    nonAcademic: ["Physical Education"],
  },
  Commerce: {
    academic: [
      "English",
      "Accountancy",
      "Business Studies",
      "Economics",
      "Mathematics",
      "Computer Science/Informatics Practices",
    ],
    nonAcademic: ["Physical Education"],
  },
  "Arts/Humanities": {
    academic: [
      "English",
      "History",
      "Political Science",
      "Geography",
      "Economics",
      "Sociology",
    ],
    nonAcademic: ["Physical Education"],
  },
  Arts: {
    academic: [
      "English",
      "History",
      "Political Science",
      "Geography",
      "Economics",
      "Sociology",
    ],
    nonAcademic: ["Physical Education"],
  },
  Humanities: {
    academic: [
      "English",
      "History",
      "Political Science",
      "Geography",
      "Economics",
      "Sociology",
    ],
    nonAcademic: ["Physical Education"],
  },
}

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
      roll_no: profile.roll_no || "",
      gender: profile.gender ?? 1,
      date_of_birth: profile.date_of_birth || "",
      class_name: profile.class_name || "",
      section: profile.section || "",
      house: profile.house || "",
      father_first_name: profile.father_first_name || "",
      father_last_name: profile.father_last_name || "",
      selected_subjects: [],
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
            email: values.email?.trim() || null,
            profile: {
              middle_name: values.middle_name ? values.middle_name.trim() : null,
              roll_no: values.roll_no ? values.roll_no.trim() : undefined,
              gender: Number(values.gender),
              date_of_birth: values.date_of_birth,
              class_name: values.class_name.trim(),
              section: values.section.trim(),
              house: values.house.trim(),
              father_first_name: values.father_first_name.trim(),
              father_last_name: values.father_last_name.trim(),
            },
            subjects: isUntickedSameForAll ? values.selected_subjects : undefined,
          }
          await updateStudentMutation.mutateAsync({
            studentId: student.id,
            data: updatePayload,
          })
        } else {
          const createPayload = {
            first_name: values.first_name.trim(),
            last_name: values.last_name.trim(),
            login_mobile: values.login_mobile.trim(),
            email: values.email?.trim() || null,
            profile: {
              middle_name: values.middle_name ? values.middle_name.trim() : null,
              roll_no: values.roll_no ? values.roll_no.trim() : "",
              gender: Number(values.gender),
              date_of_birth: values.date_of_birth,
              class_name: values.class_name.trim(),
              section: values.section.trim(),
              house: values.house.trim(),
              father_first_name: values.father_first_name.trim(),
              father_last_name: values.father_last_name.trim(),
            },
            subjects: isUntickedSameForAll ? values.selected_subjects : undefined,
          }
          await createStudentMutation.mutateAsync(createPayload)
        }

        handleClose()
      } catch (err) {
        setServerError(err?.message || "Operation failed. Please try again.")
      }
    },
  })

  // Debounced Roll Number Calculation
  const calculationTimerRef = useRef(null)
  useEffect(() => {
    const fn = formik.values.first_name?.trim()
    const ln = formik.values.last_name?.trim()
    const cn = formik.values.class_name?.trim()
    const sec = formik.values.section?.trim()

    if (calculationTimerRef.current) {
      clearTimeout(calculationTimerRef.current)
    }

    if (fn && ln && cn && sec) {
      calculationTimerRef.current = setTimeout(async () => {
        try {
          const res = await calculateStudentRollNoApi({
            firstName: fn,
            lastName: ln,
            className: cn,
            section: sec,
            studentId: isEdit ? student?.id : undefined,
          })
          if (res?.roll_no) {
            formik.setFieldValue("roll_no", res.roll_no)
          }
        } catch {
          // Keep current roll number if calculation fails
        }
      }, 350)
    } else {
      if (!isEdit) {
        formik.setFieldValue("roll_no", "")
      }
    }

    return () => {
      if (calculationTimerRef.current) {
        clearTimeout(calculationTimerRef.current)
      }
    }
  }, [
    formik.values.first_name,
    formik.values.last_name,
    formik.values.class_name,
    formik.values.section,
    isEdit,
    student?.id,
  ])

  const handleClose = () => {
    setServerError("")
    createStudentMutation.reset?.()
    updateStudentMutation.reset?.()
    formik.resetForm({ values: initialValues })
    onClose()
  }

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
      setServerError("")
      createStudentMutation.reset?.()
      updateStudentMutation.reset?.()
      formik.resetForm({ values: initialValues })
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen, student])

  const currentClassObj = schoolClasses.find((c) => c.name === formik.values.class_name)
  const currentSectionObj = currentClassObj?.sections?.find((s) => s.name === formik.values.section)

  // Determine if this class has 'same for all sections' unticked during onboarding
  const isUntickedSameForAll = React.useMemo(() => {
    if (!formik.values.class_name || !formik.values.section) return false

    if (currentClassObj) {
      if (currentClassObj.same_for_all_sections === false) return true
      return false
    }

    // Fallback if testing with static classes (e.g. Senior classes)
    const clsName = formik.values.class_name.toLowerCase()
    if (clsName.includes("11") || clsName.includes("12")) {
      return true
    }

    return false
  }, [currentClassObj, formik.values.class_name, formik.values.section])

  // Get and categorize available subjects for the selected section
  const { academicSubjects, nonAcademicSubjects } = React.useMemo(() => {
    if (!isUntickedSameForAll) {
      return { academicSubjects: [], nonAcademicSubjects: [] }
    }

    // 1. From API section data if available
    if (currentSectionObj?.subjects && currentSectionObj.subjects.length > 0) {
      const acad = currentSectionObj.subjects.filter(
        (s) => s.is_academic || s.category === "academic"
      )
      const nonAcad = currentSectionObj.subjects.filter(
        (s) => !s.is_academic && s.category !== "academic"
      )
      return { academicSubjects: acad, nonAcademicSubjects: nonAcad }
    }

    // 2. Stream fallback
    const secName = formik.values.section || ""
    let fallback = STREAM_FALLBACK_SUBJECTS[secName]
    if (!fallback) {
      const lower = secName.toLowerCase()
      if (lower.includes("sci")) fallback = STREAM_FALLBACK_SUBJECTS.Science
      else if (lower.includes("comm")) fallback = STREAM_FALLBACK_SUBJECTS.Commerce
      else if (lower.includes("art") || lower.includes("hum")) fallback = STREAM_FALLBACK_SUBJECTS["Arts/Humanities"]
      else fallback = STREAM_FALLBACK_SUBJECTS.Science
    }

    const acad = (fallback.academic || []).map((name, i) => ({
      id: `fallback-acad-${i}`,
      name,
      is_academic: true,
      category: "academic",
    }))
    const nonAcad = (fallback.nonAcademic || []).map((name, i) => ({
      id: `fallback-nonacad-${i}`,
      name,
      is_academic: false,
      category: "non_academic",
    }))

    return { academicSubjects: acad, nonAcademicSubjects: nonAcad }
  }, [isUntickedSameForAll, currentSectionObj, formik.values.section])

  // By default all subjects must be ticked initially when section is selected
  useEffect(() => {
    if (isOpen && isUntickedSameForAll) {
      const allSubjectNames = [...academicSubjects, ...nonAcademicSubjects].map((s) => s.name)
      if (allSubjectNames.length > 0) {
        formik.setFieldValue("selected_subjects", allSubjectNames)
      }
    } else if (!isUntickedSameForAll) {
      if (formik.values.selected_subjects?.length > 0) {
        formik.setFieldValue("selected_subjects", [])
      }
    }
  }, [
    isOpen,
    formik.values.class_name,
    formik.values.section,
    isUntickedSameForAll,
    academicSubjects,
    nonAcademicSubjects,
  ])

  const handleToggleSubject = (subjectName) => {
    const current = formik.values.selected_subjects || []
    if (current.includes(subjectName)) {
      formik.setFieldValue(
        "selected_subjects",
        current.filter((s) => s !== subjectName)
      )
    } else {
      formik.setFieldValue("selected_subjects", [...current, subjectName])
    }
  }

  const handleSelectAllSubjects = () => {
    const allNames = [...academicSubjects, ...nonAcademicSubjects].map((s) => s.name)
    formik.setFieldValue("selected_subjects", allNames)
  }

  const handleDeselectAllSubjects = () => {
    formik.setFieldValue("selected_subjects", [])
  }

  const isPending = createStudentMutation.isPending || updateStudentMutation.isPending
  const availableSections = currentClassObj?.sections || [
    { id: "A", name: "A" },
    { id: "B", name: "B" },
    { id: "C", name: "C" },
    { id: "D", name: "D" },
  ]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <ModalHeader
          icon={GraduationCap}
          title={isEdit ? "Edit Student Profile" : "Register New Student"}
          description={isEdit ? "Update personal and academic records" : "Add a new student to your school roster"}
          onClose={handleClose}
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

            {/* Personal Info Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                <User className="size-4 text-primary" />
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Personal Info
                </h4>
              </div>

              {/* Student Names */}
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

              {/* Father's Names */}
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

              {/* Contact Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    Email Address <span className="text-muted-foreground font-normal text-xs">(Optional)</span>
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
              </div>
            </div>

            {/* Academic Profile Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                <GraduationCap className="size-4 text-primary" />
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Academic Profile
                </h4>
              </div>

              {/* Exact Ordered Grid: Gender -> DOB -> Class -> Section -> House -> Roll No */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Gender */}
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

                {/* 2. Date of Birth */}
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

                {/* 3. Class / Grade */}
                <div>
                  <label htmlFor="class_name" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
                    Class / Grade
                  </label>
                  <select
                    id="class_name"
                    name="class_name"
                    value={formik.values.class_name}
                    onChange={(e) => {
                      const selectedClass = e.target.value
                      formik.setFieldValue("class_name", selectedClass)
                      const cls = schoolClasses.find((c) => c.name === selectedClass)
                      const defaultSection = cls?.sections?.[0]?.name || "A"
                      formik.setFieldValue("section", defaultSection)
                    }}
                    onBlur={formik.handleBlur}
                    className={cn(
                      "w-full h-10 rounded-xl border border-transparent bg-input/50 px-3.5 py-2 text-sm text-foreground transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 cursor-pointer",
                      formik.touched.class_name && formik.errors.class_name && "border-destructive/80 ring-1 ring-destructive/30"
                    )}
                  >
                    <option value="" disabled className="bg-popover text-muted-foreground">Select Class</option>
                    {schoolClasses.length > 0 ? (
                      schoolClasses.map((c) => (
                        <option key={c.id} value={c.name} className="bg-popover text-popover-foreground">
                          {c.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Class 1" className="bg-popover text-popover-foreground">Class 1</option>
                        <option value="Class 2" className="bg-popover text-popover-foreground">Class 2</option>
                        <option value="Class 3" className="bg-popover text-popover-foreground">Class 3</option>
                        <option value="Class 4" className="bg-popover text-popover-foreground">Class 4</option>
                        <option value="Class 5" className="bg-popover text-popover-foreground">Class 5</option>
                        <option value="Class 6" className="bg-popover text-popover-foreground">Class 6</option>
                        <option value="Class 7" className="bg-popover text-popover-foreground">Class 7</option>
                        <option value="Class 8" className="bg-popover text-popover-foreground">Class 8</option>
                        <option value="Class 9" className="bg-popover text-popover-foreground">Class 9</option>
                        <option value="Class 10" className="bg-popover text-popover-foreground">Class 10</option>
                        <option value="Class 11" className="bg-popover text-popover-foreground">Class 11</option>
                        <option value="Class 12" className="bg-popover text-popover-foreground">Class 12</option>
                      </>
                    )}
                  </select>
                  {formik.touched.class_name && formik.errors.class_name && (
                    <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                      {formik.errors.class_name}
                    </p>
                  )}
                </div>

                {/* 4. Section (Always Dropdown, Disabled if Class not selected) */}
                <div>
                  <label htmlFor="section" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
                    Section
                  </label>
                  <select
                    id="section"
                    name="section"
                    disabled={!formik.values.class_name}
                    value={formik.values.section}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    className={cn(
                      "w-full h-10 rounded-xl border border-transparent bg-input/50 px-3.5 py-2 text-sm text-foreground transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                      formik.touched.section && formik.errors.section && "border-destructive/80 ring-1 ring-destructive/30"
                    )}
                  >
                    {!formik.values.class_name ? (
                      <option value="" disabled className="bg-popover text-muted-foreground">Select class first</option>
                    ) : (
                      <>
                        <option value="" disabled className="bg-popover text-muted-foreground">Select Section</option>
                        {availableSections.map((s) => (
                          <option key={s.id || s.name} value={s.name} className="bg-popover text-popover-foreground">
                            {s.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  {formik.touched.section && formik.errors.section && (
                    <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                      {formik.errors.section}
                    </p>
                  )}
                </div>

                {/* 5. House */}
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

                {/* 6. Roll No */}
                <div>
                  <label htmlFor="roll_no" className="text-xs sm:text-sm font-medium text-foreground block mb-2">
                    Roll Number <span className="text-muted-foreground font-normal text-xs">(Auto-generated)</span>
                  </label>
                  <Input
                    id="roll_no"
                    name="roll_no"
                    readOnly
                    tabIndex={-1}
                    value={formik.values.roll_no}
                    className="h-10 text-sm rounded-xl px-3.5 font-mono bg-muted/40 cursor-not-allowed select-none text-muted-foreground focus-visible:ring-0 focus-visible:border-transparent"
                  />
                  {formik.touched.roll_no && formik.errors.roll_no && (
                    <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                      {formik.errors.roll_no}
                    </p>
                  )}
                </div>
              </div>

              {/* Subject Selection: Rendered ONLY when 'same for all section' was unticked for this class */}
              {isUntickedSameForAll && (academicSubjects.length > 0 || nonAcademicSubjects.length > 0) && (
                <div className="space-y-4 pt-3 animate-in fade-in-0 duration-200">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2 w-full">
                    <div className="flex items-center gap-2">
                      <BookOpen className="size-4 text-primary" />
                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                        Choose the subject taught to this student
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllSubjects}
                        className="text-xs font-medium text-primary hover:underline cursor-pointer px-2 py-0.5 rounded hover:bg-primary/10 transition-colors"
                      >
                        Select All
                      </button>
                      <span className="text-muted-foreground/40 text-xs">•</span>
                      <button
                        type="button"
                        onClick={handleDeselectAllSubjects}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer px-2 py-0.5 rounded hover:bg-muted transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Separation between Academic and Non-Academic Subjects */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Academic Subjects Card */}
                    {academicSubjects.length > 0 && (
                      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.02] p-4 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-blue-500/10">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-blue-500" />
                            <h5 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                              Academic Subjects
                            </h5>
                          </div>
                          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md font-mono">
                            {formik.values.selected_subjects?.filter((n) => academicSubjects.some((s) => s.name === n)).length} / {academicSubjects.length}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          {academicSubjects.map((sub) => {
                            const isChecked = formik.values.selected_subjects?.includes(sub.name)
                            return (
                              <div
                                key={sub.id || sub.name}
                                onClick={() => handleToggleSubject(sub.name)}
                                className={cn(
                                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all duration-150 select-none",
                                  isChecked
                                    ? "bg-blue-500/10 border-blue-500/30 text-foreground shadow-xs"
                                    : "bg-card/60 border-border/60 text-muted-foreground hover:border-border hover:bg-card"
                                )}
                              >
                                <div
                                  className={cn(
                                    "size-4.5 rounded-md flex items-center justify-center border transition-all shrink-0",
                                    isChecked
                                      ? "bg-blue-600 border-blue-600 text-white"
                                      : "border-muted-foreground/40 bg-background"
                                  )}
                                >
                                  {isChecked && <Check className="size-3.5 stroke-[3]" />}
                                </div>
                                <span className="truncate flex-1 font-medium">{sub.name}</span>
                                {sub.code && (
                                  <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60">
                                    {sub.code}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Non-Academic Subjects Card */}
                    {nonAcademicSubjects.length > 0 && (
                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.02] p-4 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-emerald-500/10">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-emerald-500" />
                            <h5 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                              Non-Academic Subjects
                            </h5>
                          </div>
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-mono">
                            {formik.values.selected_subjects?.filter((n) => nonAcademicSubjects.some((s) => s.name === n)).length} / {nonAcademicSubjects.length}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          {nonAcademicSubjects.map((sub) => {
                            const isChecked = formik.values.selected_subjects?.includes(sub.name)
                            return (
                              <div
                                key={sub.id || sub.name}
                                onClick={() => handleToggleSubject(sub.name)}
                                className={cn(
                                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all duration-150 select-none",
                                  isChecked
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-foreground shadow-xs"
                                    : "bg-card/60 border-border/60 text-muted-foreground hover:border-border hover:bg-card"
                                )}
                              >
                                <div
                                  className={cn(
                                    "size-4.5 rounded-md flex items-center justify-center border transition-all shrink-0",
                                    isChecked
                                      ? "bg-emerald-600 border-emerald-600 text-white"
                                      : "border-muted-foreground/40 bg-background"
                                  )}
                                >
                                  {isChecked && <Check className="size-3.5 stroke-[3]" />}
                                </div>
                                <span className="truncate flex-1 font-medium">{sub.name}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-border/70 bg-muted/20 flex items-center justify-end gap-3">
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
