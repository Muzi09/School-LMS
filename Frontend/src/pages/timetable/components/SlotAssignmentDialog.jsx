import { AssignmentTabs } from "./AssignmentTabs"
import { useState, useEffect, useMemo, useRef } from "react"
import {
  Clock,
  User,
  Check,
  Trash2,
  Loader2,
  ShieldAlert,
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
import { toast } from "sonner"
import { getSubjectTheme } from "../subjectTheme"
import { formatTimingsInText, formatClassSection } from "../timetableUtils"
import { isTeachingSlot, periodsOn, scheduleGroups, setupForSection } from "../sectionSchedule"

const dayLabels = { MONDAY: "M", TUESDAY: "Tu", WEDNESDAY: "W", THURSDAY: "Th", FRIDAY: "F", SATURDAY: "S", SUNDAY: "Su" }
import { useQuery } from "@tanstack/react-query"
import { checkConflictApi } from "@/api/timetableService"
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

function formatPeriodDisplayLabel(period) {
  if (!period) return "Period"
  if (period.label) {
    return period.label.replace(/\bactivit(y|ies)\b/gi, "Extra-curricular")
  }
  const pType = (period.type || period.period_type || "").toUpperCase()
  if (pType === "ACTIVITY" || pType === "EXTRA_CURRICULAR") {
    return "Extra-curricular"
  }
  return period.period_number != null ? `Period ${period.period_number}` : "Period"
}

function isAcademicSubject(sub) {
  if (sub.is_academic !== undefined && sub.is_academic !== null) {
    return Boolean(sub.is_academic)
  }
  const cat = String(sub.category || "").toLowerCase()
  if (
    cat.includes("non") ||
    cat.includes("activity") ||
    cat.includes("extra") ||
    cat.includes("co-curricul")
  ) {
    return false
  }
  return true
}

export function SlotAssignmentDialog(props) {
  const cell = props.cellData
  if (!props.isOpen || !cell) return null
  const key = [cell.timetableId, cell.section?.id, cell.day, cell.period?.id].join(":")
  return <SlotAssignmentEditor key={key} {...props} />
}

function SlotAssignmentEditor({
  isOpen,
  onClose,
  cellData, // { section, day, period, currentEntry, timetableId, scheduleDays, allDays }
  availableSubjects = [],
  eligibleTeachers = [],
  existingEntries = [],
  allSections = [],
  periodMap = null,
  onAssign, // (payload) => void
  onUnassign, // (entryId) => void
  isSubmitting = false,
  setups = [],
  groupPanel,
  preferGroup,
  groupBusy,
}) {
  const [selectedSubjectId, setSelectedSubjectId] = useState(() => cellData.currentEntry?.subject?.id || "")
  const [selectedDays, setSelectedDays] = useState(() => [cellData.day])
  const [validationError, setValidationError] = useState("")

  const selectedItemRef = useRef(null)

  // Map sections by ID for 0 ms section and class lookup
  const sectionMap = useMemo(() => {
    const map = new Map()
    for (const s of allSections || []) {
      if (s?.id) {
        map.set(s.id, s)
        map.set(String(s.id), s)
      }
    }
    return map
  }, [allSections])

  const currentEntry = cellData.currentEntry ?? null
  const currentSubject = currentEntry?.subject
  const currentTeacher = currentEntry?.teacher
  const allSubjects = useMemo(() => {
    if (!currentSubject?.id || availableSubjects.some((subject) => String(subject.id) === String(currentSubject.id))) {
      return availableSubjects
    }
    const weeklyTarget = currentSubject.is_academic === false ? 3 : 6
    return [...availableSubjects, {
      id: currentSubject.id,
      name: currentSubject.name,
      code: currentSubject.code,
      category: currentSubject.category || "academic",
      is_academic: currentSubject.is_academic ?? true,
      assigned: 1,
      target: weeklyTarget,
      target_weekly: weeklyTarget,
      current_assigned: 1,
      teacher: currentTeacher ?? null,
      teacher_id: currentTeacher?.id ?? null,
    }]
  }, [availableSubjects, currentSubject, currentTeacher])

  // Matched subject and resolved teacher
  const matchedSubject = useMemo(() => {
    if (!selectedSubjectId) return null
    return allSubjects.find((s) => String(s.id) === String(selectedSubjectId)) || null
  }, [allSubjects, selectedSubjectId])

  const assignedTeacher = useMemo(() => {
    if (!matchedSubject) return null
    if (matchedSubject.teacher && matchedSubject.teacher.name) {
      return matchedSubject.teacher
    }
    if (matchedSubject.teacher_id && eligibleTeachers?.length > 0) {
      const found = eligibleTeachers.find((t) => String(t.id) === String(matchedSubject.teacher_id))
      if (found) return found
    }
    if (cellData?.currentEntry?.subject?.id === selectedSubjectId && cellData.currentEntry.teacher) {
      return cellData.currentEntry.teacher
    }
    return null
  }, [matchedSubject, eligibleTeachers, cellData, selectedSubjectId])

  // Helper to resolve teacher for any subject card
  const resolveTeacherForSubject = (sub) => {
    if (sub.teacher && sub.teacher.name) return sub.teacher
    if (sub.teacher_id && eligibleTeachers?.length > 0) {
      const found = eligibleTeachers.find((t) => String(t.id) === String(sub.teacher_id))
      if (found) return found
    }
    if (cellData?.currentEntry?.subject?.id === sub.id && cellData.currentEntry.teacher) {
      return cellData.currentEntry.teacher
    }
    return null
  }

  const filteredSubjects = allSubjects

  // Split subjects into two categories: Academic and Activity
  const { academicSubjects, nonAcademicSubjects } = useMemo(() => {
    const academic = []
    const nonAcademic = []
    for (const sub of filteredSubjects) {
      if (isAcademicSubject(sub)) {
        academic.push(sub)
      } else {
        nonAcademic.push(sub)
      }
    }
    return { academicSubjects: academic, nonAcademicSubjects: nonAcademic }
  }, [filteredSubjects])

  // Synchronous in-memory conflict check helper
  const checkInstantConflict = (teacher, cell, allEntries, allTeachers, pMap, sMap) => {
    const tId = String(teacher?.id || teacher?.user_id || "")
    if (!tId || !cell?.period || !cell?.day) return null

    // 1. Check if non-academic
    const fullTeacher = allTeachers.find((t) => String(t.id || t.user_id) === tId) || teacher
    if (fullTeacher.is_academic === false) {
      return `${fullTeacher.name || "Teacher"} is registered as Non-Academic staff and cannot be assigned teaching periods.`
    }

    // Resolve cell start and end time
    let pStart = cell.period.start_time
    let pEnd = cell.period.end_time
    if ((!pStart || !pEnd) && pMap && cell.period.id) {
      const mapped = pMap.get(cell.period.id) || pMap.get(String(cell.period.id))
      if (mapped) {
        pStart = mapped.start_time
        pEnd = mapped.end_time
      }
    }

    // 2. Check working shifts if configured
    const shifts = fullTeacher.working_shifts || fullTeacher.staff_profile?.working_shifts || []
    if (shifts.length > 0 && pStart && pEnd) {
      const fitsShift = shifts.some((s) => {
        const sStart = s.start_time
        const sEnd = s.end_time
        return sStart && sEnd && sStart <= pStart && pEnd <= sEnd
      })
      if (!fitsShift) {
        const shiftStr = shifts
          .filter((s) => s.start_time && s.end_time)
          .map((s) => `${s.start_time} - ${s.end_time}`)
          .join(", ")
        return `${fullTeacher.name || "Teacher"} is not available at ${formatTime12h(pStart)} – ${formatTime12h(pEnd)}. Configured shifts: ${shiftStr}.`
      }
    }

    // 3. Check double-booking against existingEntries
    if (allEntries && allEntries.length > 0 && pStart && pEnd) {
      const currentEntryId = cell.currentEntry?.id
      const targetDay = String(cell.day).toUpperCase()

      for (const e of allEntries) {
        if (currentEntryId && String(e.id) === String(currentEntryId)) continue
        const entryTeacherId = String(e.teacher_user_id || e.teacher?.id || e.teacher?.user_id || "")
        if (!entryTeacherId || entryTeacherId !== tId) continue
        if (String(e.day_of_week).toUpperCase() !== targetDay) continue

        let ep = e.period
        if ((!ep || !ep.start_time || !ep.end_time) && pMap && e.period_id) {
          ep = pMap.get(e.period_id) || pMap.get(String(e.period_id))
        }

        if (ep && ep.start_time && ep.end_time) {
          const toMin = (t) => {
            if (!t) return null
            const [h, m] = String(t).split(":").map(Number)
            return (h || 0) * 60 + (m || 0)
          }
          const epStart = toMin(ep.start_time)
          const epEnd = toMin(ep.end_time)
          const curStart = toMin(pStart)
          const curEnd = toMin(pEnd)

          if (epStart != null && epEnd != null && curStart != null && curEnd != null) {
            if (epStart < curEnd && curStart < epEnd) {
              let secObj = e.section
              if (!secObj || (!secObj.class_name && !secObj.className && !secObj.school_class)) {
                if (sMap && e.section_id) {
                  secObj = sMap.get(e.section_id) || sMap.get(String(e.section_id)) || secObj
                }
              }
              const className = secObj?.class_name || secObj?.className || secObj?.school_class?.name
              const clsSec = className ? [className, secObj.name].filter(Boolean).join(" ") : formatClassSection(secObj)
              const subName = e.subject?.name || "a subject"
              const day = targetDay[0] + targetDay.slice(1).toLowerCase()
              const bookedPeriod = ep.period_number ?? pMap?.get(e.period_id)?.period_number
              const periodLabel = bookedPeriod == null ? "" : `, P${bookedPeriod}`
              return `${fullTeacher.name || "Teacher"} is already teaching ${subName} in ${clsSec} on ${day}${periodLabel} (${formatTime12h(ep.start_time)} – ${formatTime12h(ep.end_time)}).`
            }
          }
        }
      }
    }

    return null
  }

  const teacherId = assignedTeacher?.id || assignedTeacher?.user_id
  const canCheckConflict = Boolean(teacherId && cellData.period && cellData.day && cellData.timetableId)
  const localConflict = canCheckConflict
    ? checkInstantConflict(assignedTeacher, cellData, existingEntries, eligibleTeachers, periodMap, sectionMap)
    : null
  const conflictRequest = {
    timetable_id: cellData.timetableId,
    teacher_user_id: teacherId,
    day_of_week: cellData.day,
    period_id: cellData.period?.id,
    start_time: cellData.period?.start_time,
    end_time: cellData.period?.end_time,
    exclude_entry_id: cellData.currentEntry?.id ?? null,
  }
  const { data: conflictResult, isFetching: isCheckingConflict } = useQuery({
    queryKey: ["timetable", "slot-conflict", conflictRequest],
    queryFn: () => checkConflictApi(conflictRequest),
    enabled: canCheckConflict && !localConflict,
    retry: false,
    gcTime: 0,
  })
  const conflictWarning = localConflict || (conflictResult?.has_conflict ? formatTimingsInText(conflictResult.message) : null)

  // Scroll to selected item when dialog opens
  useEffect(() => {
    if (isOpen && selectedSubjectId && selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView?.({
        behavior: "smooth",
        block: "nearest",
      })
    }
  }, [isOpen, selectedSubjectId])

  if (!isOpen || !cellData) return null

  const section = cellData?.section || cellData?.currentEntry?.section || {}
  const day = cellData?.day || cellData?.currentEntry?.day_of_week || ""
  const period = cellData?.period || cellData?.currentEntry?.period || {}

  const className =
    section?.className ||
    section?.class_name ||
    section?.school_class?.name ||
    currentEntry?.section?.school_class?.name ||
    currentEntry?.section?.class_name ||
    "Class"
  const sectionName = section?.name || currentEntry?.section?.name || ""

  const bellGroups = scheduleGroups(setupForSection(section, setups))
  const dayProblems = Object.fromEntries(Object.keys(dayLabels).map(date => {
    if (date === day) return [date, conflictWarning]
    const matching = periodsOn(bellGroups, date).filter(p => p.period_number === period.period_number)
    if (matching.length !== 1 || !isTeachingSlot(matching[0])) return [date, "No matching teaching period"]
    const destination = matching[0]
    const occupied = existingEntries.some(entry => String(entry.section_id) === String(section.id) &&
      entry.day_of_week === date && String(entry.period_id || entry.period?.id) === String(destination.id))
    return [date, occupied ? "This period is already scheduled" : checkInstantConflict(
      assignedTeacher, { ...cellData, day: date, period: destination }, existingEntries, eligibleTeachers, periodMap, sectionMap,
    )]
  }))
  const applyDays = selectedDays.filter(date => !dayProblems[date])
  const isCurrentSubject = Boolean(currentEntry && String(currentSubject?.id || currentEntry.subject_id) === String(selectedSubjectId))

  const handleSelectSubject = (sub) => {
    setSelectedSubjectId(sub.id)
    setSelectedDays([day])
    setValidationError("")
  }

  const handleApply = (e) => {
    if (e) e.preventDefault()
    if (!selectedSubjectId || !applyDays.length) {
      setValidationError("Please select a subject to assign to this period.")
      return
    }

    if (isCheckingConflict) {
      toast.info("Checking teacher availability, please wait...")
      return
    }

    if (selectedDays.includes(day) && conflictWarning) {
      toast.error("Teacher has a schedule conflict with this time slot.")
      return
    }

    setValidationError("")

    onAssign({
      timetable_id: cellData?.timetableId,
      section_id: section?.id,
      day_of_week: day,
      period_id: period?.id,
      subject_id: selectedSubjectId,
      teacher_user_id: teacherId || null,
      apply_days: applyDays,
      overwrite: true,
      subject: matchedSubject || cellData?.currentEntry?.subject || null,
      teacher: assignedTeacher || null,
    })
    onClose()
  }

  const handleClear = () => {
    if (!currentEntry?.id) return
    onUnassign(currentEntry.id, section?.id)
    onClose()
  }

  const renderSubjectItem = (sub) => {
    const isSelected = String(selectedSubjectId) === String(sub.id)
    const isAcademic = isAcademicSubject(sub)
    const theme = getSubjectTheme(sub.name)
    const teacher = resolveTeacherForSubject(sub)
    const hasTeacher = Boolean(teacher?.name)
    const unavailable = teacher && checkInstantConflict(teacher, cellData, existingEntries, eligibleTeachers, periodMap, sectionMap)

    const assignedCount = sub.assigned ?? sub.current_assigned ?? 0
    const targetCount = sub.target ?? sub.target_weekly ?? (isAcademic ? 6 : 3)
    const isUnder = assignedCount < targetCount
    const isOver = assignedCount > targetCount

    return (
      <div
        key={sub.id}
        ref={isSelected ? selectedItemRef : null}
        role="button"
        tabIndex={0}
        onClick={() => handleSelectSubject(sub)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handleSelectSubject(sub)
          }
        }}
        className={cn(
          "w-full px-2.5 py-1.5 rounded-lg border text-left transition-all flex items-center justify-between gap-2 group cursor-pointer select-none",
          isSelected
            ? "border-primary bg-primary/10 ring-1.5 ring-primary/60 shadow-2xs"
            : "border-border/60 hover:border-border hover:bg-muted/40 bg-card/70",
          unavailable && "opacity-65"
        )}
      >
        {/* Left: Dot + Subject Name & Code + Teacher Name near the subject */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={cn("size-2 rounded-full shrink-0", theme.dot)} />
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span
              className={cn(
                "text-xs font-semibold truncate max-w-[125px] sm:max-w-[145px]",
                isSelected ? "text-primary font-bold" : "text-foreground"
              )}
              title={sub.name}
            >
              {sub.name}
            </span>
            {sub.code && (
              <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                ({sub.code})
              </span>
            )}
            {hasTeacher ? (
              <span
                className="text-[11px] text-muted-foreground truncate flex items-center gap-0.5 shrink min-w-0"
                title={`Assigned Teacher: ${teacher.name}`}
              >
                <span className="opacity-40">·</span>
                <User className="size-2.5 shrink-0 opacity-70 ml-0.5" />
                <span className="truncate font-medium text-foreground/85 max-w-[110px]">
                  {teacher.name}
                </span>
                {(() => {
                  const tLoad = (existingEntries || []).filter(
                    (e) => String(e.teacher_user_id || e.teacher?.id) === String(teacher.id) && e.day_of_week === cellData?.day
                  ).length
                  return tLoad >= 5 ? (
                    <span
                      className="ml-1 text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-1 py-0.2 rounded border border-amber-500/30 shrink-0"
                      title={`${teacher.name} has ${tLoad} periods scheduled on ${cellData?.day} (Heavy Load)`}
                    >
                      {tLoad}P
                    </span>
                  ) : null
                })()}
              </span>
            ) : null}
          </div>
        </div>

        {/* Right: Count Badge (as in header of the class) + Selection Indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 transition-colors",
              theme.chip,
              isUnder && "ring-1 ring-amber-500/40",
              isOver && "ring-1 ring-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-500/40"
            )}
            title={`${sub.name}: ${assignedCount} assigned / ${targetCount} target weekly periods${isOver ? " (Over Target)" : ""}`}
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
      {/* 1. FIXED HEADER: Never moves with body scroll */}
      <DialogHeader className="px-5 py-3 border-b border-border/60 bg-muted/15 shrink-0 pr-12">
        <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground">
          {className}{sectionName ? ` - ${sectionName}` : ""}
        </DialogTitle>


        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          {day && (
            <span className="font-semibold text-foreground capitalize">
              {day.toLowerCase()}
            </span>
          )}
          <span>•</span>
          <span className="font-semibold text-foreground">
            {formatPeriodDisplayLabel(period)}
          </span>
          {period?.start_time && period?.end_time && (
            <>
              <span>•</span>
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Clock className="size-3 text-muted-foreground" />
                {formatTime12h(period.start_time)} – {formatTime12h(period.end_time)}
              </span>
            </>
          )}
        </div>
      </DialogHeader>
      <AssignmentTabs groupPanel={groupPanel} preferGroup={preferGroup} busy={groupBusy || isSubmitting}>

        {matchedSubject && <div className="px-5 py-2 flex flex-wrap items-center gap-2 text-sm">
          <span>{matchedSubject.name}{assignedTeacher?.name && ` · ${assignedTeacher.name}`}</span>
          {!assignedTeacher && <a className="underline" href={`/manage-school?classId=${section.class_id || section.classId || ""}&sectionId=${section.id}&subjectId=${matchedSubject.id}&highlight=true`}>Manage School</a>}
          {isCurrentSubject && <Button variant="ghost" size="xs" onPress={handleClear} isDisabled={isSubmitting}><Trash2 className="size-3" /> Unassign</Button>}
        </div>}
      {/* 3. SCROLLABLE SUBJECTS AREA: Single common scroll for both Academic & Activity columns */}
      <div className="flex-1 overflow-y-auto px-5 py-3.5 space-y-3 min-h-0 max-h-[460px] scrollbar-thin">
        {filteredSubjects.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
            No matching subjects found.
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
                  {academicSubjects.length}
                </Badge>
              </div>

              {academicSubjects.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground italic border border-dashed rounded-lg">
                  No academic subjects match
                </div>
              ) : (
                <div className="space-y-1">
                  {academicSubjects.map((sub) => renderSubjectItem(sub))}
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
                  {nonAcademicSubjects.length}
                </Badge>
              </div>

              {nonAcademicSubjects.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground italic border border-dashed rounded-lg">
                  No activity subjects match
                </div>
              ) : (
                <div className="space-y-1">
                  {nonAcademicSubjects.map((sub) => renderSubjectItem(sub))}
                </div>
              )}
            </div>
          </div>
        )}

        {validationError && (
          <p className="text-[11px] font-medium text-destructive leading-tight px-1">
            {validationError}
          </p>
        )}
      </div>

      {/* 4. TEACHER CONFLICT ALERT (Fixed above footer if conflict detected) */}
      {conflictWarning && (
        <div className="px-5 py-2 bg-destructive/10 border-t border-destructive/20 text-destructive text-xs flex items-center gap-2 shrink-0 animate-in fade-in-0 duration-150">
          <ShieldAlert className="size-4 shrink-0 text-destructive" />
          <span className="text-[11px] leading-tight font-medium truncate">
            {formatTimingsInText(conflictWarning)}
          </span>
        </div>
      )}

      {/* 5. FIXED FOOTER: Apply Scope (3 options) + Action Buttons */}
      <p className="px-5 text-xs">Room · {(selectedSubjectId && selectedSubjectId === currentSubject?.id ? currentEntry?.room_number : matchedSubject?.room_number) || "Not assigned"}</p>
      <DialogFooter className="px-5 py-2.5 border-t border-border/60 bg-muted/15 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <fieldset className="flex flex-wrap items-center gap-2 text-xs">
          <legend className="font-semibold">Apply to days</legend>
          {Object.entries(dayLabels).filter(([date]) => date !== "SUNDAY" || date === day || !dayProblems[date]).map(([date, label]) => {
            const reason = dayProblems[date]
            return <label key={date} title={reason || undefined} className={cn("flex items-center gap-1", reason && "text-muted-foreground")}>
              <input type="checkbox" aria-label={date} disabled={Boolean(reason) || isSubmitting}
                checked={selectedDays.includes(date) && (date === day || !reason)}
                onChange={event => {
                  const checked = event.target.checked
                  setSelectedDays(previous => checked ? [...previous, date] : previous.filter(value => value !== date))
                }} />
              {label}
            </label>
          })}
        </fieldset>

        {/* Right: Actions (Fixed at bottom) */}
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
            onClick={handleApply}
            size="default"
            disabled={isSubmitting || isCheckingConflict || !selectedSubjectId || !applyDays.length || (selectedDays.includes(day) && Boolean(conflictWarning))}
            className={cn(
              "h-8 px-4 text-xs font-bold gap-1.5 shadow-xs cursor-pointer",
              (isCheckingConflict || !selectedSubjectId || !applyDays.length) && "opacity-50 cursor-not-allowed"
            )}
          >
            {(isSubmitting || isCheckingConflict) && <Loader2 className="size-3.5 animate-spin" />}
            <span>
              {isSubmitting
                ? "Assigning..."
                : isCheckingConflict
                ? "Checking..."
                : "Assign Slot"}
            </span>
          </Button>
        </div>
      </DialogFooter>
      </AssignmentTabs>
    </Dialog>
  )
}
