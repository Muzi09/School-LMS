import React, { useState, useEffect } from "react"
import {
  X,
  GraduationCap,
  Lock,
  Layers,
  AlertCircle,
  Loader2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { useCreateStudent, useUpdateStudent } from "@/hooks/useStudents"

export function StudentFormModal({ isOpen, onClose, student = null }) {
  const isEdit = Boolean(student && student.id)

  const createStudentMutation = useCreateStudent()
  const updateStudentMutation = useUpdateStudent()

  const [firstName, setFirstName] = useState("")
  const [middleName, setMiddleName] = useState("")
  const [lastName, setLastName] = useState("")
  const [loginMobile, setLoginMobile] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // Student Profile
  const [rollNo, setRollNo] = useState("")
  const [gender, setGender] = useState(1) // 1=Male, 2=Female, 3=Other
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [className, setClassName] = useState("")
  const [section, setSection] = useState("")
  const [house, setHouse] = useState("")
  const [fatherFirstName, setFatherFirstName] = useState("")
  const [fatherLastName, setFatherLastName] = useState("")

  const [formError, setFormError] = useState("")

  useEffect(() => {
    if (!isOpen) return

    if (student) {
      setFirstName(student.first_name || "")
      setLastName(student.last_name || "")
      setLoginMobile(student.login_mobile || "")
      setEmail(student.email || "")
      setPassword("")

      const profile = student.student_profile || {}
      setMiddleName(profile.middle_name || "")
      setRollNo(profile.roll_no || "")
      setGender(profile.gender || 1)
      setDateOfBirth(profile.date_of_birth || "")
      setClassName(profile.class_name || "")
      setSection(profile.section || "")
      setHouse(profile.house || "")
      setFatherFirstName(profile.father_first_name || "")
      setFatherLastName(profile.father_last_name || "")
    } else {
      setFirstName("")
      setMiddleName("")
      setLastName("")
      setLoginMobile("")
      setEmail("")
      setPassword("")
      setRollNo("")
      setGender(1)
      setDateOfBirth("")
      setClassName("")
      setSection("")
      setHouse("")
      setFatherFirstName("")
      setFatherLastName("")
    }
    setFormError("")
  }, [student, isOpen])

  if (!isOpen) return null

  const isPending = createStudentMutation.isPending || updateStudentMutation.isPending
  const error = formError || createStudentMutation.error?.message || updateStudentMutation.error?.message

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError("")

    try {
      if (isEdit) {
        const updatePayload = {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          login_mobile: loginMobile.trim(),
          email: email.trim() ? email.trim() : null,
          profile: {
            middle_name: middleName.trim(),
            roll_no: rollNo.trim(),
            gender: Number(gender),
            date_of_birth: dateOfBirth,
            class_name: className.trim(),
            section: section.trim(),
            house: house.trim(),
            father_first_name: fatherFirstName.trim(),
            father_last_name: fatherLastName.trim(),
          },
        }
        if (password.trim()) {
          updatePayload.password = password.trim()
        }

        await updateStudentMutation.mutateAsync({ studentId: student.id, data: updatePayload })
      } else {
        const payload = {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          login_mobile: loginMobile.trim(),
          email: email.trim() ? email.trim() : null,
          password: password,
          profile: {
            middle_name: middleName.trim(),
            roll_no: rollNo.trim(),
            gender: Number(gender),
            date_of_birth: dateOfBirth,
            class_name: className.trim(),
            section: section.trim(),
            house: house.trim(),
            father_first_name: fatherFirstName.trim(),
            father_last_name: fatherLastName.trim(),
          },
        }

        await createStudentMutation.mutateAsync(payload)
      }

      onClose()
    } catch (err) {
      setFormError(err.message || "An error occurred while saving student.")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-card border border-border shadow-2xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/70 bg-muted/30">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <GraduationCap className="size-4 text-primary" />
              <span>{isEdit ? `Edit Student: ${student.first_name} ${student.last_name}` : "Register New Student"}</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isEdit ? "Update student enrollment and personal details." : "Fill in student and guardian information."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2.5">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Account Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/50 pb-1.5">
              <Lock className="size-3.5 text-primary" />
              <span>1. Student Account & Credentials</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">First Name</label>
                <Input
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Middle Name</label>
                <Input
                  required
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Last Name</label>
                <Input
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Login Mobile</label>
                <Input
                  required
                  value={loginMobile}
                  onChange={(e) => setLoginMobile(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Email Address</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  {isEdit ? "New Password" : "Password"}
                </label>
                <Input
                  type="password"
                  required={!isEdit}
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          {/* Academic & Personal Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/50 pb-1.5">
              <Layers className="size-3.5 text-primary" />
              <span>2. Academic & Guardian Information</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Roll No</label>
                <Input
                  required
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                >
                  <option value={1}>Male</option>
                  <option value={2}>Female</option>
                  <option value={3}>Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Date of Birth</label>
                <DatePicker
                  required
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Class / Grade</label>
                <Input
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Section</label>
                <Input
                  required
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">House</label>
                <Input
                  required
                  value={house}
                  onChange={(e) => setHouse(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1 sm:col-span-1.5">
                <label className="text-xs font-medium text-foreground">Father First Name</label>
                <Input
                  required
                  value={fatherFirstName}
                  onChange={(e) => setFatherFirstName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1 sm:col-span-1.5">
                <label className="text-xs font-medium text-foreground">Father Last Name</label>
                <Input
                  required
                  value={fatherLastName}
                  onChange={(e) => setFatherLastName(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              <span>{isEdit ? "Save Changes" : "Register Student"}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StudentFormModal
