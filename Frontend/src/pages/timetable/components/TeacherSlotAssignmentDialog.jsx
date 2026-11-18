import React, { useState, useMemo, useEffect } from "react"
import {
  Clock,
  User,
  Check,
  Trash2,
  Search,
  Loader2,
  AlertTriangle,
  BookOpen,
  GraduationCap,
  Sparkles,
  Layers,
} from "lucide-react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { getSubjectTheme } from "../subjectTheme"
import { cn } from "@/lib/utils"

function formatTime12h(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return ""
  if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr
  const parts = timeStr.split(":")
  if (parts.length < 2) return timeStr
  const [h, m] = parts.map(Number)
  if (isNaN(h)) return timeStr
  const ampm = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  const mins = String(m || 0).padStart(2, "0")
  return `${hour12}:${mins} ${ampm}`
}

function formatPeriodLabel(period) {
  if (!period) return "Period"
  if (period.name) return period.name
  if (period.label) return period.label
  return period.period_number != null ? `Period ${period.period_number}` : "Period"
}

export function TeacherSlotAssignmentDialog({
  isOpen,
  onClose,
  cellData, // { teacher, day, period, currentEntry, timetableId, scheduleDays, allDays }
  teacherAllocations = [], // [{ section, subject_id, subject_name, subject_code, category, is_academic, assigned, target }]
  allSections = [],
  existingEntries = [],
  onAssign, // (payload) => void
  onUnassign, // (entryId, sectionId, context) => void
  isSubmitting = false,
}) {
  const [search, setSearch] = useState("")
  const [selectedAllocationKey, setSelectedAllocationKey] = useState("")
  const [selectedScope, setSelectedScope] = useState("SLOT") // "SLOT" | "WEEKDAYS"

  const { teacher, day, period, currentEntry, scheduleDays = [] } = cellData || {}

  // Current entry details
  const currentSubjectId = currentEntry?.subject_id || currentEntry?.subject?.id
  const currentSectionId = currentEntry?.section_id || currentEntry?.section?.id

  // Preselect allocation if currentEntry matches
  useEffect(() => {
    if (currentSectionId && currentSubjectId) {
      setSelectedAllocationKey(`${currentSectionId}_${currentSubjectId}`)
    } else if (teacherAllocations.length === 1) {
      const single = teacherAllocations[0]
      setSelectedAllocationKey(`${single.section?.id}_${single.subject_id}`)
    } else {
      setSelectedAllocationKey("")
    }
    setSearch("")
    setSelectedScope("SLOT")
  }, [currentSectionId, currentSubjectId, teacherAllocations, isOpen])

  // Filter allocations by search
  const filteredAllocations = useMemo(() => {
    if (!search.trim()) return teacherAllocations
    const q = search.toLowerCase().trim()
    return teacherAllocations.filter((item) => {
      const cls = (item.section?.school_class?.name || item.section?.class_name || "").toLowerCase()
      const sec = (item.section?.name || "").toLowerCase()
      const sub = (item.subject_name || "").toLowerCase()
      return cls.includes(q) || sec.includes(q) || sub.includes(q)
    })
  }, [teacherAllocations, search])

  // Map existing entries to check if target section is occupied in this slot
  const sectionOccupancyMap = useMemo(() => {
    const map = new Map() // `${sectionId}_${day}_${periodId}` -> entry
    if (!existingEntries || !day || !period) return map

    for (const e of existingEntries) {
      if (e.section_id && e.day_of_week && e.period_id) {
        const k = `${e.section_id}_${e.day_of_week}_${e.period_id}`
        map.set(k, e)
      }
    }
    return map
  }, [existingEntries, day, period])

  // Selected item
  const selectedItem = useMemo(() => {
    if (!selectedAllocationKey) return null
    return teacherAllocations.find(
      (a) => `${a.section?.id}_${a.subject_id}` === selectedAllocationKey
    )
  }, [selectedAllocationKey, teacherAllocations])

  // Check collision for selected item
  const collisionForSelected = useMemo(() => {
    if (!selectedItem || !day || !period) return null
    const k = `${selectedItem.section?.id}_${day}_${period.id}`
    const occ = sectionOccupancyMap.get(k)
    // If it's the current entry itself, not a conflict
    if (occ && String(occ.id) !== String(currentEntry?.id)) {
      const tName = occ.teacher?.name || `${occ.teacher?.first_name || ""} ${occ.teacher?.last_name || ""}`.trim() || "Another teacher"
      const sName = occ.subject?.name || "another subject"
      return `${selectedItem.section?.class_name || "This class"} ${selectedItem.section?.name || ""} is already scheduled for ${sName} with ${tName} in this period.`
    }
    return null
  }, [selectedItem, day, period, sectionOccupancyMap, currentEntry])

  const handleSubmit = () => {
    if (!selectedItem) return

    const daysToApply =
      selectedScope === "WEEKDAYS" && scheduleDays && scheduleDays.length > 0
        ? scheduleDays
        : [day]

    onAssign?.({
      section_id: selectedItem.section.id,
      subject_id: selectedItem.subject_id,
      teacher_user_id: teacher.id,
      scope: selectedScope,
      apply_days: daysToApply,
      subject: {
        id: selectedItem.subject_id,
        name: selectedItem.subject_name,
        code: selectedItem.subject_code,
        category: selectedItem.category,
        is_academic: selectedItem.is_academic,
      },
      teacher: teacher,
      section: selectedItem.section,
    })
  }

  const handleUnassignClick = () => {
    if (currentEntry) {
      onUnassign?.(currentEntry.id, currentEntry.section_id, {
        day,
        period,
      })
    }
  }

  if (!isOpen) return null

  const pLabel = formatPeriodLabel(period)
  const startTime = formatTime12h(period?.start_time)
  const endTime = formatTime12h(period?.end_time)
  const timeStr = startTime && endTime ? `${startTime} – ${endTime}` : ""
  const teacherName = `${teacher?.first_name || ""} ${teacher?.last_name || ""}`.trim() || teacher?.name || "Teacher"

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-xl md:max-w-2xl p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col [&>[data-slot=dialog]]:flex [&>[data-slot=dialog]]:flex-col [&>[data-slot=dialog]]:overflow-hidden [&>[data-slot=dialog]]:h-full [&>[data-slot=dialog]]:max-h-[90vh]"
    >
      {/* HEADER */}
      <DialogHeader className="px-6 py-4 border-b border-border/70 bg-muted/20 shrink-0 pr-12">
        <div className="flex items-center justify-between">
          <div>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="size-5 text-primary" />
              <span>Assign Faculty Lecture</span>
            </DialogTitle>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-medium">
              <span className="font-semibold text-foreground">{teacherName}</span>
              <span>•</span>
              <span>{day}</span>
              <span>•</span>
              <span>{pLabel}</span>
              {timeStr && (
                <>
                  <span>•</span>
                  <span className="font-mono">{timeStr}</span>
                </>
              )}
            </div>
          </div>

          {currentEntry && (
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
              Occupied Slot
            </Badge>
          )}
        </div>
      </DialogHeader>

      {/* BODY */}
      <div className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search class or subject..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-muted/30 border-border/70 text-sm"
              />
            </div>

            {/* Manage School Subject Allocations */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="size-3.5 text-primary" />
                  <span>Allocated Subjects (from Manage School)</span>
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {filteredAllocations.length} {filteredAllocations.length === 1 ? "option" : "options"}
                </span>
              </div>

              {filteredAllocations.length === 0 ? (
                <div className="py-8 text-center space-y-2 border border-dashed rounded-xl bg-muted/10 p-4">
                  <p className="text-xs font-semibold text-foreground">
                    {search ? "No matching allocated subjects found" : "No subjects assigned to this teacher in Manage School"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Assign classes & subjects to this faculty member in <strong>Manage School &gt; Subjects</strong> to see them here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                  {filteredAllocations.map((item) => {
                    const key = `${item.section?.id}_${item.subject_id}`
                    const isSelected = selectedAllocationKey === key
                    const theme = getSubjectTheme(item.subject_name, item.category)
                    const clsName = item.section?.school_class?.name || item.section?.class_name || "Class"
                    const secName = item.section?.name || ""
                    const classSecLabel = `${clsName} - ${secName}`

                    // Collision check
                    const occKey = `${item.section?.id}_${day}_${period?.id}`
                    const occEntry = sectionOccupancyMap.get(occKey)
                    const hasCollision = occEntry && String(occEntry.id) !== String(currentEntry?.id)

                    return (
                      <div
                        key={key}
                        onClick={() => setSelectedAllocationKey(key)}
                        className={cn(
                          "relative rounded-xl border p-3 flex flex-col justify-between gap-2 cursor-pointer transition-all select-none text-left",
                          isSelected
                            ? "border-primary bg-primary/10 ring-2 ring-primary ring-inset shadow-xs"
                            : "border-border/70 bg-card hover:bg-muted/40 hover:border-border",
                          hasCollision && !isSelected && "opacity-80 border-amber-500/40"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {/* Class and Section Badge */}
                            <Badge
                              variant="secondary"
                              className="text-[11px] font-bold px-1.5 py-0.2 rounded-md bg-muted text-foreground mb-1"
                            >
                              {classSecLabel}
                            </Badge>
                            {/* Subject Name */}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={cn("size-2 rounded-full shrink-0", theme.dot || "bg-primary")} />
                              <span className="font-semibold text-sm text-foreground truncate">
                                {item.subject_name}
                              </span>
                            </div>
                          </div>

                          {isSelected && (
                            <div className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-2xs">
                              <Check className="size-3" />
                            </div>
                          )}
                        </div>

                        {/* Weekly Workload Status */}
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                          <span>Target:</span>
                          <span className="font-mono font-medium text-foreground">
                            {item.assigned}/{item.target} pds
                          </span>
                        </div>

                        {/* Collision warning pill */}
                        {hasCollision && (
                          <div className="flex items-center gap-1 text-[10px] text-amber-800 dark:text-amber-300 font-semibold mt-0.5">
                            <AlertTriangle className="size-3 shrink-0 text-amber-500" />
                            <span className="truncate">Section occupied in this period</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Scope Selection */}
            <div className="space-y-1.5 pt-2 border-t border-border/70">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Assignment Scope
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedScope("SLOT")}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-semibold border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer",
                    selectedScope === "SLOT"
                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                      : "border-border/70 bg-card text-muted-foreground hover:bg-muted/40"
                  )}
                >
                  <span>This Slot Only</span>
                  <span className="text-[10px] font-normal opacity-80">{day} only</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedScope("WEEKDAYS")}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-semibold border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer",
                    selectedScope === "WEEKDAYS"
                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                      : "border-border/70 bg-card text-muted-foreground hover:bg-muted/40"
                  )}
                >
                  <span>All Weekdays</span>
                  <span className="text-[10px] font-normal opacity-80">
                    Mon - {scheduleDays.includes("SATURDAY") ? "Sat" : "Fri"}
                  </span>
                </button>
              </div>
            </div>

            {/* Collision Banner Warning if selected */}
            {collisionForSelected && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <strong>Notice:</strong> {collisionForSelected} Assigning will reassign this slot for that section.
                </div>
              </div>
            )}
          </div>

      {/* FOOTER */}
      <DialogFooter className="px-6 py-3.5 bg-muted/20 border-t border-border/70 flex items-center justify-between gap-2 shrink-0">
        <div>
          {currentEntry && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleUnassignClick}
              disabled={isSubmitting}
              className="text-destructive hover:bg-destructive/10 text-xs gap-1.5"
            >
              <Trash2 className="size-3.5" />
              <span>Unassign Slot</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!selectedItem || isSubmitting}
            className="text-xs font-bold gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="size-3.5" />
                <span>Save Assignment</span>
              </>
            )}
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
  )
}

