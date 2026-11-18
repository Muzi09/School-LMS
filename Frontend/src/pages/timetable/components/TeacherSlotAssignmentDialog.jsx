import React, { useState, useMemo, useEffect, useRef } from "react"
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
  X,
  ShieldAlert,
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

function isAcademicSubject(sub) {
  if (sub.is_academic !== undefined && sub.is_academic !== null) {
    return Boolean(sub.is_academic)
  }
  const cat = (sub.category || "").toLowerCase()
  if (cat.includes("academic") || cat.includes("core")) return true
  if (
    cat.includes("activity") ||
    cat.includes("extra") ||
    cat.includes("co-curricular") ||
    cat.includes("sports")
  ) {
    return false
  }
  return true
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
  const [selectedScope, setSelectedScope] = useState("SLOT") // "SLOT" | "WEEKDAYS" | "ALL_DAYS"
  const selectedItemRef = useRef(null)

  const { teacher, day, period, currentEntry, scheduleDays = [], allDays = [] } = cellData || {}

  const allScheduleDays = useMemo(() => {
    if (allDays && allDays.length > 0) return allDays
    if (scheduleDays && scheduleDays.length > 0) return scheduleDays
    return ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
  }, [allDays, scheduleDays])

  const weekdayDays = useMemo(() => {
    return allScheduleDays.filter((d) => !["SATURDAY", "SUNDAY"].includes(d.toUpperCase()))
  }, [allScheduleDays])

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
      const code = (item.subject_code || "").toLowerCase()
      return cls.includes(q) || sec.includes(q) || sub.includes(q) || code.includes(q)
    })
  }, [teacherAllocations, search])

  // Split into Academic and Activity
  const academicAllocations = useMemo(
    () => filteredAllocations.filter((a) => isAcademicSubject(a)),
    [filteredAllocations]
  )
  const nonAcademicAllocations = useMemo(
    () => filteredAllocations.filter((a) => !isAcademicSubject(a)),
    [filteredAllocations]
  )

  // Map existing entries to check if target section is occupied in this slot
  const sectionOccupancyMap = useMemo(() => {
    const map = new Map() // `${sectionId}_${day}_${periodId}` -> entry
    if (!existingEntries || !day || !period) return map

    for (const e of existingEntries) {
      if (e.section_id && e.day_of_week && (e.period_id || e.period?.id)) {
        const pId = e.period_id || e.period?.id
        const k = `${e.section_id}_${e.day_of_week}_${pId}`
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
      const tName =
        occ.teacher?.name ||
        `${occ.teacher?.first_name || ""} ${occ.teacher?.last_name || ""}`.trim() ||
        "Another teacher"
      const sName = occ.subject?.name || "another subject"
      return `${selectedItem.section?.class_name || "This class"} ${selectedItem.section?.name || ""} is already scheduled for ${sName} with ${tName} in this period.`
    }
    return null
  }, [selectedItem, day, period, sectionOccupancyMap, currentEntry])

  const handleSubmit = (e) => {
    if (e) e.preventDefault()
    if (!selectedItem) return

    let daysToApply = [day]
    if (selectedScope === "ALL_DAYS") {
      daysToApply = allScheduleDays
    } else if (selectedScope === "WEEKDAYS") {
      daysToApply = weekdayDays
    }

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
  const teacherName =
    `${teacher?.first_name || ""} ${teacher?.last_name || ""}`.trim() ||
    teacher?.name ||
    "Teacher"

  const renderAllocationItem = (item) => {
    const key = `${item.section?.id}_${item.subject_id}`
    const isSelected = selectedAllocationKey === key
    const theme = getSubjectTheme(item.subject_name, item.category)
    const clsName = item.section?.school_class?.name || item.section?.class_name || "Class"
    const secName = item.section?.name || ""
    const classSecLabel = `${clsName} - ${secName}`.trim()

    const assignedCount = item.assigned ?? 0
    const targetCount = item.target ?? (isAcademicSubject(item) ? 6 : 3)
    const isUnder = assignedCount < targetCount
    const isOver = assignedCount > targetCount

    // Collision check
    const occKey = `${item.section?.id}_${day}_${period?.id}`
    const occEntry = sectionOccupancyMap.get(occKey)
    const hasCollision = occEntry && String(occEntry.id) !== String(currentEntry?.id)

    return (
      <div
        key={key}
        ref={isSelected ? selectedItemRef : null}
        role="button"
        tabIndex={0}
        onClick={() => setSelectedAllocationKey(key)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setSelectedAllocationKey(key)
          }
        }}
        className={cn(
          "w-full px-2.5 py-1.5 rounded-lg border text-left transition-all flex items-center justify-between gap-2 group cursor-pointer select-none",
          isSelected
            ? "border-primary bg-primary/10 ring-1.5 ring-primary/60 shadow-2xs"
            : "border-border/60 hover:border-border hover:bg-muted/40 bg-card/70",
          hasCollision && !isSelected && "border-amber-500/40"
        )}
      >
        {/* Left: Dot + Subject Name & Code + Class & Section pill */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={cn("size-2 rounded-full shrink-0", theme.dot || "bg-primary")} />
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span
              className={cn(
                "text-xs font-semibold truncate max-w-[125px] sm:max-w-[145px]",
                isSelected ? "text-primary font-bold" : "text-foreground"
              )}
              title={item.subject_name}
            >
              {item.subject_name}
            </span>
            {item.subject_code && (
              <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                ({item.subject_code})
              </span>
            )}
            <span className="opacity-40 text-muted-foreground">·</span>
            <span
              className="text-[11px] font-medium text-foreground/85 bg-muted/70 border border-border/60 px-1.5 py-0.2 rounded shrink-0"
              title={`Class: ${classSecLabel}`}
            >
              {classSecLabel}
            </span>
            {hasCollision && (
              <span
                className="text-[9.5px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-1.5 py-0.2 rounded border border-amber-500/30 flex items-center gap-0.5 shrink-0"
                title="Section is already scheduled for another class in this period"
              >
                <AlertTriangle className="size-2.5 text-amber-500 shrink-0" />
                <span>Occupied</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Count Badge (assigned/target) + Selection Check Indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 transition-colors",
              theme.chip,
              isUnder && "ring-1 ring-amber-500/40",
              isOver &&
                "ring-1 ring-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-500/40"
            )}
            title={`${item.subject_name} (${classSecLabel}): ${assignedCount} assigned / ${targetCount} target weekly periods${isOver ? " (Over Target)" : ""}`}
          >
            <span className={cn("size-1 rounded-full", isOver ? "bg-amber-500" : theme.dot)} />
            <span>
              {assignedCount}/{targetCount}
            </span>
            {isOver && (
              <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300 uppercase">
                Over
              </span>
            )}
          </span>

          <div
            className={cn(
              "size-4 rounded-full flex items-center justify-center shrink-0 border transition-all",
              isSelected
                ? "border-primary bg-primary text-primary-foreground shadow-2xs"
                : "border-border/60 bg-muted/20 opacity-30 group-hover:opacity-70"
            )}
          >
            {isSelected && <Check className="size-2.5 stroke-[2.5]" />}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-3xl md:max-w-4xl p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col [&>[data-slot=dialog]]:flex [&>[data-slot=dialog]]:flex-col [&>[data-slot=dialog]]:overflow-hidden [&>[data-slot=dialog]]:h-full [&>[data-slot=dialog]]:max-h-[92vh]"
    >
      {/* 1. FIXED HEADER */}
      <DialogHeader className="px-5 py-3 border-b border-border/60 bg-muted/15 shrink-0 pr-12">
        <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
          <GraduationCap className="size-5 text-primary" />
          <span>{teacherName}</span>
          {(teacher?.designation || teacher?.department) && (
            <Badge
              variant="outline"
              className="text-[11px] font-semibold bg-primary/5 text-primary border-primary/20 ml-1"
            >
              {teacher?.department || teacher?.designation}
            </Badge>
          )}
        </DialogTitle>

        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          {day && (
            <span className="font-semibold text-foreground capitalize">
              {day.toLowerCase()}
            </span>
          )}
          <span>•</span>
          <span className="font-semibold text-foreground">{pLabel}</span>
          {timeStr && (
            <>
              <span>•</span>
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Clock className="size-3 text-muted-foreground" />
                {timeStr}
              </span>
            </>
          )}
        </div>
      </DialogHeader>

      {/* 2. FIXED TOP ROW: Current Slot, Selected Class/Subject, Search */}
      <div className="px-5 py-2.5 border-b border-border/60 bg-muted/10 shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
        {/* Left: Current Slot Status */}
        <div className="px-2.5 py-1.5 rounded-lg border border-border/70 bg-card/60 flex items-center justify-between gap-1.5 h-9 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <span className="text-[10px] uppercase font-bold text-muted-foreground shrink-0">
              Current:
            </span>
            {currentEntry ? (
              <span
                className="text-xs font-semibold text-foreground truncate"
                title={`${currentEntry.subject?.name || "Subject"} · ${currentEntry.section?.class_name || ""} ${currentEntry.section?.name || ""}`}
              >
                {currentEntry.subject?.name || "Subject"}
                <span className="text-muted-foreground font-normal ml-1">
                  · {currentEntry.section?.class_name || ""} {currentEntry.section?.name || ""}
                </span>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground italic">Unassigned slot</span>
            )}
          </div>

          {currentEntry && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleUnassignClick}
              disabled={isSubmitting}
              className="text-destructive hover:bg-destructive/10 text-xs h-6 px-1.5 shrink-0 cursor-pointer"
              title="Unassign current slot"
            >
              <Trash2 className="size-3 mr-1" />
              Unassign
            </Button>
          )}
        </div>

        {/* Center: Selected Class & Subject */}
        <div className="px-2.5 py-1.5 rounded-lg border border-border/70 bg-card/60 flex items-center justify-between gap-1.5 h-9 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 truncate flex-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground shrink-0">
              Selected:
            </span>
            {selectedItem ? (
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                <span
                  className={cn(
                    "size-2 rounded-full shrink-0",
                    getSubjectTheme(selectedItem.subject_name, selectedItem.category).dot ||
                      "bg-primary"
                  )}
                />
                <span
                  className="text-xs font-semibold text-foreground truncate"
                  title={`${selectedItem.subject_name} (${selectedItem.section?.class_name || "Class"} ${selectedItem.section?.name || ""})`}
                >
                  {selectedItem.subject_name}
                </span>
                <span className="text-[10px] font-medium text-foreground/80 bg-muted/70 border border-border/60 px-1 py-0.2 rounded shrink-0">
                  {selectedItem.section?.class_name || "Class"} {selectedItem.section?.name || ""}
                </span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic truncate">
                Pick an allocated subject below
              </span>
            )}
          </div>
        </div>

        {/* Right: Search Filter Input */}
        <div className="relative h-9">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search class or subject..."
            className="w-full h-9 rounded-lg pl-8 pr-7 text-xs bg-card/60 border-border/70 text-foreground transition-colors"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground cursor-pointer"
              title="Clear search"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>
      </div>

      {/* 3. SCROLLABLE ALLOCATIONS AREA: Single common scroll for both Academic & Activity columns */}
      <div className="flex-1 overflow-y-auto px-5 py-3.5 space-y-3 min-h-[340px] max-h-[460px] scrollbar-thin">
        {filteredAllocations.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground border border-dashed rounded-xl space-y-1.5 p-4">
            <p className="font-semibold text-foreground">
              {search
                ? "No matching allocated subjects found"
                : "No subjects assigned to this teacher in Manage School"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Assign classes & subjects to this faculty member in{" "}
              <strong>Manage School &gt; Subjects</strong> to see them here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-start">
            {/* COLUMN 1: Academic Subjects */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between pb-1 px-1 border-b border-border/60">
                <div className="flex items-center gap-1.5">
                  <GraduationCap className="size-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Academic
                  </span>
                </div>
                <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-semibold">
                  {academicAllocations.length}
                </Badge>
              </div>

              {academicAllocations.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground italic border border-dashed rounded-lg">
                  No academic subjects match
                </div>
              ) : (
                <div className="space-y-1">
                  {academicAllocations.map((item) => renderAllocationItem(item))}
                </div>
              )}
            </div>

            {/* COLUMN 2: Activity Subjects */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between pb-1 px-1 border-b border-border/60">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Activity
                  </span>
                </div>
                <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-semibold">
                  {nonAcademicAllocations.length}
                </Badge>
              </div>

              {nonAcademicAllocations.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground italic border border-dashed rounded-lg">
                  No activity subjects match
                </div>
              ) : (
                <div className="space-y-1">
                  {nonAcademicAllocations.map((item) => renderAllocationItem(item))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. SECTION CONFLICT NOTICE */}
      {collisionForSelected && (
        <div className="px-5 py-2 bg-destructive/10 border-t border-destructive/20 text-destructive text-xs flex items-center gap-2 shrink-0 animate-in fade-in-0 duration-150">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <span className="text-[11px] leading-tight font-medium truncate">
            {collisionForSelected} Assigning will reassign that class's slot.
          </span>
        </div>
      )}

      {/* 5. FIXED FOOTER: Apply Scope + Action Buttons */}
      <DialogFooter className="px-5 py-2.5 border-t border-border/60 bg-muted/15 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        {/* Left: Apply Scope Selector (Fixed at bottom) */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-foreground shrink-0">Apply Scope:</span>
          <div className="inline-flex items-center p-0.5 rounded-lg border border-border/70 bg-background text-xs shadow-2xs">
            {/* Option 1: This slot only */}
            <button
              type="button"
              onClick={() => setSelectedScope("SLOT")}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap",
                selectedScope === "SLOT"
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              This slot only
            </button>

            {/* Option 2: Weekdays */}
            <button
              type="button"
              onClick={() => setSelectedScope("WEEKDAYS")}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap",
                selectedScope === "WEEKDAYS"
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              title={`Apply to ${weekdayDays.map((d) => d.slice(0, 3)).join(", ")}`}
            >
              Weekdays ({weekdayDays.length}d)
            </button>

            {/* Option 3: All days */}
            <button
              type="button"
              onClick={() => setSelectedScope("ALL_DAYS")}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap",
                selectedScope === "ALL_DAYS"
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              title={`Apply to all active days: ${allScheduleDays.map((d) => d.slice(0, 3)).join(", ")}`}
            >
              All days ({allScheduleDays.length}d)
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0 justify-end">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onClose}
            className="h-8 px-3.5 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            size="default"
            disabled={isSubmitting || !selectedItem}
            className={cn(
              "h-8 px-4 text-xs font-bold gap-1.5 shadow-xs cursor-pointer",
              !selectedItem && "opacity-50 cursor-not-allowed"
            )}
          >
            {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
            <span>{isSubmitting ? "Assigning..." : "Assign Slot"}</span>
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
  )
}
