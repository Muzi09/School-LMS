import React from "react"
import {
  X,
  Briefcase,
  Phone,
  Layers,
  CheckCircle,
  XCircle,
  Edit2,
  Calendar,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils"

export function StaffDetailsModal({ isOpen, onClose, staff, onEdit }) {
  if (!isOpen || !staff) return null

  const profile = staff.staff_profile || {}
  const genderMap = { 1: "Male", 2: "Female", 3: "Other" }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/70 bg-muted/30">
          <div className="flex items-center gap-3.5">
            <div className="size-13 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg shadow-xs">
              {staff.first_name?.[0]}{staff.last_name?.[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                  {staff.first_name} {staff.last_name}
                </h3>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1 font-medium text-xs py-0.5">
                  <Briefcase className="size-3" /> Staff
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 font-mono">
                Staff ID: {profile.roll_no || staff.id.slice(0, 8)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Close"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-6">
          {/* Status Bar */}
          <div className="grid grid-cols-2 gap-3.5 p-4.5 rounded-2xl border border-border bg-card">
            <div>
              <span className="text-xs font-medium text-muted-foreground block mb-0.5">Account Status</span>
              <span className={`text-sm font-semibold flex items-center gap-1.5 ${staff.is_active ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {staff.is_active ? <CheckCircle className="size-4" /> : <XCircle className="size-4" />}
                {staff.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground block mb-0.5">Registered Date</span>
              <span className="text-sm font-semibold text-foreground">
                {staff.created_at ? formatDateTime(staff.created_at) : "N/A"}
              </span>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-3">
            <h4 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 ">
              <Phone className="size-4 text-primary" />
              <span>Contact Information</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4.5 rounded-2xl border border-border bg-card">
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-0.5">Login Mobile</span>
                <span className="text-sm font-semibold font-mono text-foreground">{staff.login_mobile || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-0.5">Email Address</span>
                <span className="text-sm font-semibold text-foreground">{staff.email || "—"}</span>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="space-y-3">
            <h4 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 ">
              <Layers className="size-4 text-primary" />
              <span>Profile & Personal Details</span>
            </h4>
            <div className="grid grid-cols-2 gap-3.5 p-4.5 rounded-2xl border border-border bg-card">
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-0.5">Staff ID</span>
                <span className="text-sm font-semibold font-mono text-foreground">{profile.roll_no || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-0.5">Gender</span>
                <span className="text-sm font-semibold text-foreground">{genderMap[profile.gender] || "N/A"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-xs font-medium text-muted-foreground block mb-0.5">Date of Birth</span>
                <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <span>{profile.date_of_birth || "N/A"}</span>
                </span>
              </div>
              <div className="col-span-2 pt-3 border-t border-border/60 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs font-medium text-muted-foreground block mb-0.5">Father First Name</span>
                  <span className="text-sm font-semibold text-foreground">{profile.father_first_name || "N/A"}</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground block mb-0.5">Father Last Name</span>
                  <span className="text-sm font-semibold text-foreground">{profile.father_last_name || "N/A"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4.5 border-t border-border flex items-center justify-end gap-3 bg-muted/20">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onClose}
            className="h-10 px-5 text-sm font-medium rounded-xl"
          >
            Close
          </Button>
          <Button
            type="button"
            size="default"
            onClick={() => { onClose(); onEdit(staff); }}
            className="h-10 px-5 text-sm font-medium rounded-xl gap-2 shadow-xs"
          >
            <Edit2 className="size-4" />
            <span>Edit Staff</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default StaffDetailsModal
