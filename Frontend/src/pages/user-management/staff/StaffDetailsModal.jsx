import React from "react"
import {
  X,
  Briefcase,
  Phone,
  Layers,
  CheckCircle,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function StaffDetailsModal({ isOpen, onClose, staff, onEdit }) {
  if (!isOpen || !staff) return null

  const profile = staff.staff_profile || {}
  const genderMap = { 1: "Male", 2: "Female", 3: "Other" }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-card border border-border shadow-2xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/70 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-base">
              {staff.first_name?.[0]}{staff.last_name?.[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">
                  {staff.first_name} {staff.last_name}
                </h3>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1 font-medium text-xs">
                  <Briefcase className="size-3" /> Staff
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                Staff ID: {profile.roll_no || staff.id.slice(0, 8)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Bar */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/20 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Account Status:</span>
              <span className={`font-semibold flex items-center gap-1 ${staff.is_active ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {staff.is_active ? <CheckCircle className="size-3.5" /> : <XCircle className="size-3.5" />}
                {staff.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Registered:</span>
              <span className="font-medium text-foreground">
                {staff.created_at ? new Date(staff.created_at).toLocaleDateString() : "N/A"}
              </span>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="size-3.5 text-primary" />
              <span>Contact Information</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border border-border bg-card">
              <div>
                <span className="text-[11px] text-muted-foreground block">Login Mobile</span>
                <span className="text-xs font-semibold font-mono text-foreground">{staff.login_mobile || "N/A"}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Email</span>
                <span className="text-xs font-semibold text-foreground">{staff.email || "—"}</span>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="size-3.5 text-primary" />
              <span>Profile & Personal Details</span>
            </h4>
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl border border-border bg-card text-xs">
              <div>
                <span className="text-[11px] text-muted-foreground block">Roll / Employee ID</span>
                <span className="font-semibold font-mono text-foreground">{profile.roll_no || "N/A"}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Gender</span>
                <span className="font-semibold text-foreground">{genderMap[profile.gender] || "N/A"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[11px] text-muted-foreground block">Date of Birth</span>
                <span className="font-semibold text-foreground">{profile.date_of_birth || "N/A"}</span>
              </div>
              <div className="col-span-2 pt-2 border-t border-border/50 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] text-muted-foreground block">Father First Name</span>
                  <span className="font-semibold text-foreground">{profile.father_first_name || "N/A"}</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Father Last Name</span>
                  <span className="font-semibold text-foreground">{profile.father_last_name || "N/A"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2 bg-muted/20">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button size="sm" onClick={() => { onClose(); onEdit(staff); }}>
            Edit Staff
          </Button>
        </div>
      </div>
    </div>
  )
}

export default StaffDetailsModal
