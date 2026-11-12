import React, { useState, useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  Clock,
  User,
  Check,
  Trash2,
  Search,
  Loader2,
  ShieldAlert,
  ExternalLink,
  X,
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
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { getSubjectTheme } from "../subjectTheme"
import { formatTimingsInText } from "../timetableUtils"
import { useCheckConflict } from "@/hooks/useTimetable"
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

export function SlotAssignmentDialog({
  isOpen,
  onClose,
  cellData, // { section, day, period, currentEntry, timetableId, scheduleDays, allDays }
  availableSubjects = [],
  eligibleTeachers = [],
  existingEntries = [],
  onAssign, // (payload) => void
  onUnassign, // (entryId) => void
  isSubmitting = false,
}) {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [selectedSubjectId, setSelectedSubjectId] = useState("")
  const [selectedScope, setSelectedScope] = useState("SLOT") // "SLOT" | "WEEKDAYS" | "ALL_DAYS"
  const [conflictWarning, setConflictWarning] = useState(null)
  const [isCheckingConflict, setIsCheckingConflict] = useState(false)
  const [validationError, setValidationError] = useState("")

  const selectedItemRef = useRef(null)
  const checkConflictMutation = useCheckConflict()

  // Weekdays list (Mon-Fri or applicable weekdays)
  const weekdayDays = useMemo(() => {
    if (cellData?.scheduleDays && Array.isArray(cellData.scheduleDays) && cellData.scheduleDays.length > 0) {
      const filtered = cellData.scheduleDays
        .map((d) => String(d).toUpperCase())
        .filter((d) => d !== "SATURDAY" && d !== "SUNDAY")
      if (filtered.length > 0) return filtered
    }
    return ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
  }, [cellData?.scheduleDays])

  // All days list (Mon-Sat or full applicable days)
  const allScheduleDays = useMemo(() => {
    if (cellData?.allDays && Array.isArray(cellData.allDays) && cellData.allDays.length > 0) {
      return cellData.allDays.map((d) => String(d).toUpperCase())
    }
    if (cellData?.scheduleDays && Array.isArray(cellData.scheduleDays) && cellData.scheduleDays.length > 0) {
      const days = cellData.scheduleDays.map((d) => String(d).toUpperCase())
      if (!days.includes("SATURDAY")) {
        return [...days, "SATURDAY"]
      }
      return days
    }
    return ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
  }, [cellData?.allDays, cellData?.scheduleDays])

  // Initialize selected values from cellData
  useEffect(() => {
    if (!isOpen || !cellData) return
    const current = cellData.currentEntry
    if (current?.subject) {
      setSelectedSubjectId(current.subject.id || "")
    } else {
      setSelectedSubjectId("")
    }
    setSearch("")
    setSelectedScope("SLOT")
    setConflictWarning(null)
    setValidationError("")
  }, [isOpen, cellData])

  // Combined subjects list (ensuring current entry subject is present)
  const allSubjects = useMemo(() => {
    const list = [...availableSubjects]
    const cur = cellData?.currentEntry?.subject
    if (cur && cur.id && !list.some((s) => String(s.id) === String(cur.id))) {
      list.push({
        id: cur.id,
        name: cur.name,
        code: cur.code,
        category: cur.category || "academic",
        is_academic: cur.is_academic !== undefined ? cur.is_academic : true,
        assigned: 1,
        target: cur.is_academic === false ? 3 : 6,
        target_weekly: cur.is_academic === false ? 3 : 6,
        current_assigned: 1,
        teacher: cellData?.currentEntry?.teacher || null,
        teacher_id: cellData?.currentEntry?.teacher?.id || null,
      })
    }
    return list
  }, [availableSubjects, cellData?.currentEntry])

  // Matched subject and resolved teacher
  const matchedSubject = useMemo(() => {
    if (!selectedSubjectId) return null
    return allSubjects.find((s) => String(s.id) === String(selectedSubjectId)) || null
  }, [allSubjects, selectedSubjectId])

  const selectedSubjectName = useMemo(() => {
    if (matchedSubject?.name) return matchedSubject.name
    if (cellData?.currentEntry?.subject?.id === selectedSubjectId) {
      return cellData.currentEntry.subject.name || ""
    }
    return ""
  }, [matchedSubject, cellData, selectedSubjectId])

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

  // Filtered subjects by search query
  const filteredSubjects = useMemo(() => {
    if (!search.trim()) return allSubjects
    const q = search.toLowerCase().trim()
    return allSubjects.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.code?.toLowerCase().includes(q) ||
        s.teacher?.name?.toLowerCase().includes(q)
    )
  }, [allSubjects, search])

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
  const checkInstantConflict = (teacher, cell, allEntries, allTeachers) => {
    if (!teacher?.id || !cell?.period || !cell?.day) return null

    // 1. Check if non-academic
    const fullTeacher = allTeachers.find((t) => String(t.id) === String(teacher.id)) || teacher
    if (fullTeacher.is_academic === false) {
      return `${fullTeacher.name || "Teacher"} is registered as Non-Academic staff and cannot be assigned teaching periods.`
    }

    // 2. Check working shifts if configured
    const shifts = fullTeacher.working_shifts || fullTeacher.staff_profile?.working_shifts || []
    if (shifts.length > 0 && cell.period.start_time && cell.period.end_time) {
      const pStart = cell.period.start_time
      const pEnd = cell.period.end_time
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
    if (allEntries && allEntries.length > 0 && cell.period.start_time && cell.period.end_time) {
      const pStart = cell.period.start_time
      const pEnd = cell.period.end_time
      const currentEntryId = cell.currentEntry?.id

      for (const e of allEntries) {
        if (currentEntryId && String(e.id) === String(currentEntryId)) continue
        if (String(e.teacher_user_id || e.teacher?.id) !== String(teacher.id)) continue
        if (e.day_of_week !== cell.day) continue

        const ep = e.period
        if (ep && ep.start_time && ep.end_time) {
          if (ep.start_time < pEnd && pStart < ep.end_time) {
            const clsSec = e.section ? `${e.section.class_name || ""} ${e.section.name || ""}`.trim() : "another section"
            const subName = e.subject?.name || "a subject"
            return `${fullTeacher.name || "Teacher"} is already teaching ${subName} in ${clsSec} at this time (${formatTime12h(ep.start_time)} – ${formatTime12h(ep.end_time)}).`
          }
        }
      }
    }

    return null
  }

  // Check teacher conflict whenever assigned teacher or time changes
  useEffect(() => {
    const teacherId = assignedTeacher?.id
    if (!teacherId || !cellData?.period || !cellData?.day || !cellData?.timetableId) {
      setConflictWarning(null)
      return
    }

    // Immediate 0 ms synchronous pre-check
    const localConflict = checkInstantConflict(assignedTeacher, cellData, existingEntries, eligibleTeachers)
    if (localConflict) {
      setConflictWarning(localConflict)
      return
    }

    setConflictWarning(null)

    let isMounted = true
    setIsCheckingConflict(true)

    const check = async () => {
      try {
        const res = await checkConflictMutation.mutateAsync({
          timetable_id: cellData.timetableId,
          teacher_user_id: teacherId,
          day_of_week: cellData.day,
          period_id: cellData.period.id,
          start_time: cellData.period.start_time,
          end_time: cellData.period.end_time,
          exclude_entry_id: cellData.currentEntry?.id || null,
        })
        if (isMounted) {
          if (res.has_conflict) {
            setConflictWarning(formatTimingsInText(res.message))
          } else {
            setConflictWarning(null)
          }
        }
      } catch {
        // Fall back gracefully to local pre-check result
      } finally {
        if (isMounted) setIsCheckingConflict(false)
      }
    }

    check()
    return () => {
      isMounted = false
    }
  }, [assignedTeacher?.id, cellData, existingEntries, eligibleTeachers])

  // Scroll to selected item when dialog opens
  useEffect(() => {
    if (isOpen && selectedSubjectId && selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      })
    }
  }, [isOpen, selectedSubjectId])

  if (!isOpen || !cellData) return null

  const { section, day, period, currentEntry } = cellData

  const handleSelectSubject = (sub) => {
    setSelectedSubjectId(sub.id)
    setValidationError("")
  }

  // Redirect to Manage School to assign teacher for this specific subject
  const handleAssignNow = async () => {
    const classId = section.class_id || section.classId || ""
    const sectionId = section.id || ""
    const subjectId = selectedSubjectId || ""
    const slotKey = `${section.id}_${day}_${period.id || period.period_number}`

    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0
    const scrollX = window.scrollX || window.pageXOffset || document.documentElement.scrollLeft || 0
    sessionStorage.setItem("timetable_scroll_y", String(scrollY))
    sessionStorage.setItem("timetable_scroll_x", String(scrollX))
    sessionStorage.setItem("timetable_scroll_slot_key", slotKey)
    sessionStorage.setItem("timetable_edit_mode", "true")

    sessionStorage.setItem(
      "timetable_assign_now_target",
      JSON.stringify({
        sectionId,
        classId,
        day,
        periodId: period.id,
        periodNumber: period.period_number,
        subjectId,
        timetableId: cellData?.timetableId,
      })
    )

    let applyDays = [day]
    if (selectedScope === "ALL_DAYS") {
      applyDays = allScheduleDays
    } else if (selectedScope === "WEEKDAYS") {
      applyDays = weekdayDays
    }

    if (selectedSubjectId && onAssign) {
      try {
        await onAssign({
          timetable_id: cellData.timetableId,
          section_id: section.id,
          day_of_week: day,
          period_id: period.id,
          subject_id: selectedSubjectId,
          teacher_user_id: null,
          scope: selectedScope || "SLOT",
          apply_days: applyDays,
          overwrite: true,
          silent: true,
        })
      } catch (err) {
        console.error("Assign now pre-save error:", err)
      }
    }

    onClose()
    navigate(
      `/manage-school?classId=${classId}&sectionId=${sectionId}&subjectId=${subjectId}&highlight=true`
    )
  }

  const handleApply = (e) => {
    if (e) e.preventDefault()
    if (!selectedSubjectId) {
      setValidationError("Please select a subject to assign to this period.")
      return
    }

    if (conflictWarning) {
      toast.error("Teacher has a schedule conflict with this time slot.")
      return
    }

    setValidationError("")

    let applyDays = [day]
    if (selectedScope === "ALL_DAYS") {
      applyDays = allScheduleDays
    } else if (selectedScope === "WEEKDAYS") {
      applyDays = weekdayDays
    }

    onAssign({
      timetable_id: cellData.timetableId,
      section_id: section.id,
      day_of_week: day,
      period_id: period.id,
      subject_id: selectedSubjectId,
      teacher_user_id: assignedTeacher?.id || null,
      scope: selectedScope,
      apply_days: applyDays,
      overwrite: true,
      subject: matchedSubject || cellData.currentEntry?.subject || null,
      teacher: assignedTeacher || null,
    })
    onClose()
  }

  const handleClear = () => {
    let applyDays = [day]
    if (selectedScope === "ALL_DAYS") {
      applyDays = allScheduleDays
    } else if (selectedScope === "WEEKDAYS") {
      applyDays = weekdayDays
    }

    if (currentEntry && selectedScope === "SLOT") {
      onUnassign(currentEntry.id)
    } else {
      onAssign({
        timetable_id: cellData.timetableId,
        section_id: section.id,
        day_of_week: day,
        period_id: period.id,
        subject_id: null,
        scope: selectedScope,
        apply_days: applyDays,
      })
    }
    onClose()
  }

  // Render individual subject item card (space-economized for 8+ visible subjects)
  const renderSubjectItem = (sub) => {
    const isSelected = String(selectedSubjectId) === String(sub.id)
    const isAcademic = isAcademicSubject(sub)
    const theme = getSubjectTheme(sub.name, sub.category)
    const teacher = resolveTeacherForSubject(sub)
    const hasTeacher = Boolean(teacher?.name)

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
            : "border-border/60 hover:border-border hover:bg-muted/40 bg-card/70"
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
              </span>
            ) : (
              <span className="text-[10px] text-amber-600/90 dark:text-amber-400/90 font-medium italic shrink-0">
                · No teacher
              </span>
            )}
          </div>
        </div>

        {/* Right: Count Badge (as in header of the class) + Selection Indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 transition-colors",
              theme.chip,
              isUnder && "ring-1 ring-amber-500/40",
              isOver && "ring-1 ring-blue-500/40"
            )}
            title={`${sub.name}: ${assignedCount} assigned / ${targetCount} target weekly periods`}
          >
            <span className={cn("size-1 rounded-full", theme.dot)} />
            <span>
              {assignedCount}/{targetCount}
            </span>
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
      {/* 1. FIXED HEADER: Never moves with body scroll */}
      <DialogHeader className="px-5 py-3 border-b border-border/60 bg-muted/15 shrink-0 pr-12">
        <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground">
          {section.className || section.class_name} - {section.name}
        </DialogTitle>

        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span className="font-semibold text-foreground capitalize">
            {day?.toLowerCase()}
          </span>
          <span>•</span>
          <span className="font-semibold text-foreground">
            {formatPeriodDisplayLabel(period)}
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Clock className="size-3 text-muted-foreground" />
            {formatTime12h(period.start_time)} – {formatTime12h(period.end_time)}
          </span>
        </div>
      </DialogHeader>

      {/* 2. FIXED TOP ROW: Current Slot, Configured Teacher, Search (never moves with scroll) */}
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
                title={`${currentEntry.subject?.name} · ${currentEntry.teacher?.name || "No teacher"}`}
              >
                {currentEntry.subject?.name}
                <span className="text-muted-foreground font-normal ml-1">
                  · {currentEntry.teacher?.name || "No teacher"}
                </span>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground italic">
                Unassigned slot
              </span>
            )}
          </div>

          {currentEntry && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleClear}
              className="text-destructive hover:bg-destructive/10 text-xs h-6 px-1.5 shrink-0 cursor-pointer"
              title="Unassign current slot"
            >
              <Trash2 className="size-3 mr-1" />
              Unassign
            </Button>
          )}
        </div>

        {/* Center: Selected / Configured Teacher */}
        <div className="px-2.5 py-1.5 rounded-lg border border-border/70 bg-card/60 flex items-center justify-between gap-1.5 h-9 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 truncate flex-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground shrink-0">
              Teacher:
            </span>
            {selectedSubjectId ? (
              assignedTeacher?.name ? (
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <User className="size-3" />
                  </div>
                  <span
                    className="text-xs font-semibold text-foreground truncate"
                    title={assignedTeacher.name}
                  >
                    {assignedTeacher.name}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 py-0 px-1 h-4 shrink-0"
                  >
                    Configured
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center gap-1 min-w-0 truncate">
                  <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300 truncate">
                    No teacher configured
                  </span>
                  <button
                    type="button"
                    onClick={handleAssignNow}
                    className="inline-flex items-center gap-0.5 text-[11px] font-bold text-primary hover:underline px-1.5 py-0.5 rounded hover:bg-primary/10 shrink-0 cursor-pointer"
                  >
                    <span>Assign</span>
                    <ExternalLink className="size-2.5" />
                  </button>
                </div>
              )
            ) : (
              <span className="text-xs text-muted-foreground italic truncate">
                Pick a subject below
              </span>
            )}
          </div>

          {isCheckingConflict && (
            <span
              className="text-[9px] text-muted-foreground flex items-center gap-1 shrink-0"
              title="Checking teacher availability…"
            >
              <Loader2 className="size-3 animate-spin" />
            </span>
          )}
        </div>

        {/* Right: Search Filter Input */}
        <div className="relative h-9">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject or teacher..."
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

      {/* 3. SCROLLABLE SUBJECTS AREA: Single common scroll for both Academic & Activity columns */}
      <div className="flex-1 overflow-y-auto px-5 py-3.5 space-y-3 min-h-[340px] max-h-[460px] scrollbar-thin">
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
      <DialogFooter className="px-5 py-2.5 border-t border-border/60 bg-muted/15 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        {/* Left: Apply Scope Selector (Fixed at bottom) */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-foreground shrink-0">
            Apply Scope:
          </span>
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
            disabled={isSubmitting || Boolean(conflictWarning) || !selectedSubjectId}
            className={cn(
              "h-8 px-4 text-xs font-bold gap-1.5 shadow-xs cursor-pointer",
              (conflictWarning || !selectedSubjectId) && "opacity-50 cursor-not-allowed"
            )}
          >
            {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
            <span>Assign Slot</span>
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
  )
}
