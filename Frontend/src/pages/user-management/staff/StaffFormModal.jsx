import React, { useState, useEffect } from "react"
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

export function StaffFormModal({ isOpen, onClose, staff = null }) {
  const isEdit = Boolean(staff && staff.id)

  const createStaffMutation = useCreateStaff()
  const updateStaffMutation = useUpdateStaff()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [loginMobile, setLoginMobile] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // Staff Profile
  const [rollNo, setRollNo] = useState("")
  const [gender, setGender] = useState(1) // 1=Male, 2=Female, 3=Other
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [fatherFirstName, setFatherFirstName] = useState("")
  const [fatherLastName, setFatherLastName] = useState("")

  const [formError, setFormError] = useState("")

  useEffect(() => {
    if (!isOpen) return

    if (staff) {
      setFirstName(staff.first_name || "")
      setLastName(staff.last_name || "")
      setLoginMobile(staff.login_mobile || "")
      setEmail(staff.email || "")
      setPassword("")

      const profile = staff.staff_profile || {}
      setRollNo(profile.roll_no || "")
      setGender(profile.gender || 1)
      setDateOfBirth(profile.date_of_birth || "")
      setFatherFirstName(profile.father_first_name || "")
      setFatherLastName(profile.father_last_name || "")
    } else {
      setFirstName("")
      setLastName("")
      setLoginMobile("")
      setEmail("")
      setPassword("")
      setRollNo("")
      setGender(1)
      setDateOfBirth("")
      setFatherFirstName("")
      setFatherLastName("")
    }
    setFormError("")
  }, [staff, isOpen])

  if (!isOpen) return null

  const isPending = createStaffMutation.isPending || updateStaffMutation.isPending
  const error = formError || createStaffMutation.error?.message || updateStaffMutation.error?.message

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError("")

    try {
      if (isEdit) {
        const updatePayload = {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          login_mobile: loginMobile.trim(),
          email: email.trim(),
          profile: {
            roll_no: rollNo.trim(),
            gender: Number(gender),
            date_of_birth: dateOfBirth,
            father_first_name: fatherFirstName.trim(),
            father_last_name: fatherLastName.trim(),
          },
        }
        if (password.trim()) {
          updatePayload.password = password.trim()
        }

        await updateStaffMutation.mutateAsync({ staffId: staff.id, data: updatePayload })
      } else {
        const payload = {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          login_mobile: loginMobile.trim(),
          email: email.trim(),
          password: password,
          profile: {
            roll_no: rollNo.trim(),
            gender: Number(gender),
            date_of_birth: dateOfBirth,
            father_first_name: fatherFirstName.trim(),
            father_last_name: fatherLastName.trim(),
          },
        }

        await createStaffMutation.mutateAsync(payload)
      }

      onClose()
    } catch (err) {
      setFormError(err.message || "An error occurred while saving staff.")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-card border border-border shadow-2xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/70 bg-muted/30">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Briefcase className="size-4 text-primary" />
              <span>{isEdit ? `Edit Staff: ${staff.first_name} ${staff.last_name}` : "Create New Staff Member"}</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isEdit ? "Update staff account credentials and profile." : "Fill in information to register a staff account."}
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

          {/* Account Credentials */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/50 pb-1.5">
              <Lock className="size-3.5 text-primary" />
              <span>1. Staff Account & Credentials</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <label className="text-xs font-medium text-foreground">Last Name</label>
                <Input
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="text-xs"
                />
              </div>

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
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
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

          {/* Profile Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/50 pb-1.5">
              <Layers className="size-3.5 text-primary" />
              <span>2. Staff Profile Details</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Roll No / Staff ID</label>
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

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-foreground">Date of Birth</label>
                <DatePicker
                  required
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Father First Name</label>
                <Input
                  required
                  value={fatherFirstName}
                  onChange={(e) => setFatherFirstName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
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
              <span>{isEdit ? "Save Changes" : "Create Staff"}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StaffFormModal
