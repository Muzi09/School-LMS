import { AssignmentTabs } from "./AssignmentTabs"
import { setupForSection, scheduleGroups, periodsOn, isTeachingSlot } from "../sectionSchedule"
import { useState, useMemo, useRef } from "react"
import {
  Clock,
  Check,
  Trash2,
  Loader2,
  AlertTriangle,
  GraduationCap,
  Sparkles,
} from "lucide-react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
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
  setups = [],
  existingEntries = [],
  onAssign, // (payload) => void
  onUnassign, // (entryId, sectionId, context) => void
  isSubmitting = false,
  groupPanel,
  preferGroup,
  groupBusy,
}) {
  const [selectedScope, setSelectedScope] = useState("SLOT") // "SLOT" | "WEEKDAYS" | "ALL_DAYS"
  const selectedItemRef = useRef(null)

  const { teacher, day, period: clickedPeriod, currentEntry, at, stretch } = cellData || {}
  const [periodChoice, setPeriodChoice] = useState("")
  // Current entry details
  const currentSubjectId = currentEntry?.subject_id || currentEntry?.subject?.id
  const currentSectionId = currentEntry?.section_id || currentEntry?.section?.id
  const currentAllocation = teacherAllocations.find(item =>
    String(item.section?.id) === String(currentSectionId) && String(item.subject_id) === String(currentSubjectId)
  )

  // The parent mounts a fresh dialog for each selected slot.
  const [selectedAllocationKey, setSelectedAllocationKey] = useState(() => {
    if (currentSectionId && currentSubjectId) return `${currentSectionId}_${currentSubjectId}`
    const single = teacherAllocations.length === 1 ? teacherAllocations[0] : null
    return single ? `${single.section?.id}_${single.subject_id}` : ""
  })

  const filteredAllocations = teacherAllocations
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
    if (!existingEntries || !day) return map

    for (const e of existingEntries) {
      if (e.section_id && e.day_of_week && (e.period_id || e.period?.id)) {
        const pId = e.period_id || e.period?.id
        const k = `${e.section_id}_${e.day_of_week}_${pId}`
        map.set(k, e)
      }
    }
    return map
  }, [existingEntries, day])

  // Selected item
  const selectedItem = useMemo(() => {
    if (!selectedAllocationKey) return null
    return teacherAllocations.find(
      (a) => `${a.section?.id}_${a.subject_id}` === selectedAllocationKey
    )
  }, [selectedAllocationKey, teacherAllocations])

  const groups = scheduleGroups(setupForSection(selectedItem?.section, setups))
  const periodsFor = section => periodsOn(scheduleGroups(setupForSection(section, setups)), day)
    .filter(p => isTeachingSlot(p) && (!stretch || (
      p.start_time.slice(0, 5) >= stretch[0] && p.end_time.slice(0, 5) <= stretch[1]
    )))
  const periods = periodsFor(selectedItem?.section)
  const preferredPeriod = options => options.find(p => String(p.id) === String(clickedPeriod?.id)) ||
    options.find(p => clickedPeriod && p.start_time === clickedPeriod.start_time && p.end_time === clickedPeriod.end_time) ||
    options.find(p => at && p.start_time.slice(0, 5) <= at && at < p.end_time.slice(0, 5))
  const period = periods.find(p => String(p.id) === periodChoice) ||
    preferredPeriod(periods)
  const allScheduleDays = groups.flatMap(g => g.days)
  const weekdayDays = allScheduleDays.filter(d => d !== "SATURDAY" && d !== "SUNDAY")
  // Check collision for selected item
  const getCollisionForSelected = () => {
    if (!selectedItem || !day) return null
    if (!period && stretch) return periods.length
      ? "Choose a period within this free stretch."
      : "No full teaching period fits in this free stretch."
    if (!period) return null
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
  }
  const collisionForSelected = getCollisionForSelected()

  const handleSubmit = (e) => {
    if (e) e.preventDefault()
    if (!selectedItem || !period || collisionForSelected) return

    let daysToApply = [day]
    if (selectedScope === "ALL_DAYS") {
      daysToApply = allScheduleDays
    } else if (selectedScope === "WEEKDAYS") {
      daysToApply = weekdayDays
    }

    onAssign?.({
      period,
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
    const theme = getSubjectTheme(item.subject_name)
    const clsName = item.section?.school_class?.name || item.section?.class_name || "Class"
    const secName = item.section?.name || ""
    const classSecLabel = `${clsName} - ${secName}`.trim()

    const assignedCount = item.assigned ?? 0
    const targetCount = item.target ?? (isAcademicSubject(item) ? 6 : 3)
    const isUnder = assignedCount < targetCount
    const isOver = assignedCount > targetCount

    // Collision check
    const itemPeriods = isSelected ? periods : periodsFor(item.section)
    const candidate = isSelected ? period : preferredPeriod(itemPeriods)
    const occKey = `${item.section?.id}_${day}_${candidate?.id}`
    const occEntry = sectionOccupancyMap.get(occKey)
    const hasCollision = occEntry && String(occEntry.id) !== String(currentEntry?.id)

    return (
      <div
        key={key}
        ref={isSelected ? selectedItemRef : null}
        role="button"
        tabIndex={0}
        onClick={() => { setSelectedAllocationKey(key); setPeriodChoice("") }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setSelectedAllocationKey(key)
            setPeriodChoice("")
          }
        }}
        className={cn(
          "w-full px-2.5 py-1.5 rounded-lg border text-left transition-all flex items-center justify-between gap-2 group cursor-pointer select-none",
          isSelected
            ? "border-primary bg-primary/10 ring-1.5 ring-primary/60 shadow-2xs"
            : "border-border/60 hover:border-border hover:bg-muted/40 bg-card/70",
          (hasCollision || (stretch && !itemPeriods.length)) && "border-amber-500/40 opacity-65"
        )}
      >
        {/* Left: Dot + Subject Name & Code + Class & Section pill */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={cn("size-2 rounded-full shrink-0", theme.dot || "bg-primary")} />
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span className="text-xs font-semibold">{classSecLabel}</span>
            <span aria-hidden="true" className="text-muted-foreground">·</span>
            <span
              className={cn(
                "text-xs font-semibold",
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
      onOpenChange={(open) => !open && !groupBusy && onClose()}
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

      <AssignmentTabs groupPanel={groupPanel} preferGroup={preferGroup} busy={groupBusy || isSubmitting}>
      {currentEntry && <div className="px-5 py-2 flex flex-wrap items-center gap-2 text-sm">
        <span>{[currentEntry.section?.class_name, currentEntry.section?.name, currentEntry.subject?.name].filter(Boolean).join(" · ")}</span>
        {!currentAllocation && <a className="underline" href={`/manage-school?classId=${currentEntry.section?.class_id || ""}&sectionId=${currentSectionId}&subjectId=${currentSubjectId}&highlight=true`}>Manage School</a>}
        <Button variant="ghost" size="xs" onPress={handleUnassignClick} isDisabled={isSubmitting}>
          <Trash2 className="size-3" /> Unassign
        </Button>
      </div>}

      {/* 3. SCROLLABLE ALLOCATIONS AREA: Single common scroll for both Academic & Activity columns */}
      <div className="flex-1 overflow-y-auto px-5 py-3.5 space-y-3 min-h-0 max-h-[460px] scrollbar-thin">
        <h3 className="text-xs font-semibold text-muted-foreground">Assigned subjects</h3>
        {filteredAllocations.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground border border-dashed rounded-xl space-y-1.5 p-4">
            <p className="font-semibold text-foreground">
              No subjects assigned to this teacher in Manage School
            </p>
            <p className="text-[11px] text-muted-foreground">
              Assign classes & subjects to this faculty member in{" "}
              <a className="underline" href="/manage-school">Manage School &gt; Subjects</a> to see them here.
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
      {selectedItem && <label className="mx-4 flex items-center gap-2 text-sm">
        {selectedItem.section.class_name} {selectedItem.section.name} · {day?.toLowerCase()} period
        <select className="rounded-md border bg-background p-1.5" value={period?.id || ""}
          disabled={Boolean(currentEntry)} onChange={e => setPeriodChoice(e.target.value)}>
          <option value="" disabled>Choose a class period</option>
          {periods.map(p => <option key={p.id} value={p.id}>{formatPeriodLabel(p)} · {p.start_time}–{p.end_time}</option>)}
        </select>
      </label>}
      {collisionForSelected && (
        <div className="px-5 py-2 bg-destructive/10 border-t border-destructive/20 text-destructive text-xs flex items-center gap-2 shrink-0 animate-in fade-in-0 duration-150">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <span className="text-[11px] leading-tight font-medium truncate">
            {collisionForSelected}
          </span>
        </div>
      )}

      {/* 5. FIXED FOOTER: Apply Scope + Action Buttons */}
      <p className="px-5 text-xs">Room · {(selectedAllocationKey === `${currentSectionId}_${currentSubjectId}` ? currentEntry?.room_number : selectedItem?.room_number) || "Not assigned"}</p>
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
            disabled={isSubmitting || !selectedItem || !period || Boolean(collisionForSelected) || (selectedScope === "WEEKDAYS" && !weekdayDays.length)}
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
      </AssignmentTabs>
    </Dialog>
  )
}
