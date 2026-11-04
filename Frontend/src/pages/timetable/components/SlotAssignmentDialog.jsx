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
} from "lucide-react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { getSubjectTheme } from "../subjectTheme"
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

export function SlotAssignmentDialog({
  isOpen,
  onClose,
  cellData, // { section, day, period, currentEntry, timetableId }
  availableSubjects = [],
  eligibleTeachers = [],
  onAssign, // (payload) => void
  onUnassign, // (entryId) => void
  isSubmitting = false,
}) {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [selectedSubjectId, setSelectedSubjectId] = useState("")
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [selectedScope, setSelectedScope] = useState("SLOT") // "SLOT" | "WEEKDAYS" | "CLASS_SECTIONS" | "FILL_TARGET"
  const [conflictWarning, setConflictWarning] = useState(null)
  const [isCheckingConflict, setIsCheckingConflict] = useState(false)
  const [validationError, setValidationError] = useState("")

  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  const checkConflictMutation = useCheckConflict()

  // Initialize selected values from cellData
  useEffect(() => {
    if (!isOpen || !cellData) return
    const current = cellData.currentEntry
    if (current?.subject) {
      setSelectedSubjectId(current.subject.id || "")
      setSearch(current.subject.name || "")
    } else {
      setSelectedSubjectId("")
      setSearch("")
    }
    setSelectedScope("SLOT")
    setConflictWarning(null)
    setValidationError("")
    setIsDropdownOpen(false)
    setHighlightedIndex(-1)
  }, [isOpen, cellData])

  // Resolve matched subject & its configured teacher from Manage School
  const matchedSubject = useMemo(() => {
    if (!selectedSubjectId) return null
    return availableSubjects.find((s) => s.id === selectedSubjectId) || null
  }, [availableSubjects, selectedSubjectId])

  const assignedTeacher = useMemo(() => {
    if (matchedSubject?.teacher) return matchedSubject.teacher
    if (cellData?.currentEntry?.subject?.id === selectedSubjectId && cellData.currentEntry.teacher) {
      return cellData.currentEntry.teacher
    }
    return null
  }, [matchedSubject, cellData, selectedSubjectId])

  // Check teacher conflict whenever assigned teacher or time changes
  useEffect(() => {
    const teacherId = assignedTeacher?.id
    if (!teacherId || !cellData?.period || !cellData?.day || !cellData?.timetableId) {
      setConflictWarning(null)
      return
    }

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
            setConflictWarning(res.message)
          } else {
            setConflictWarning(null)
          }
        }
      } catch (err) {
        if (isMounted) setConflictWarning(null)
      } finally {
        if (isMounted) setIsCheckingConflict(false)
      }
    }

    check()
    return () => {
      isMounted = false
    }
  }, [assignedTeacher?.id, cellData])

  // Click outside listener for autocomplete dropdown
  useEffect(() => {
    if (!isDropdownOpen) return
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isDropdownOpen])

  if (!isOpen || !cellData) return null

  const { section, day, period, currentEntry } = cellData

  const filteredSubjects = availableSubjects.filter((s) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      s.name?.toLowerCase().includes(q) ||
      s.code?.toLowerCase().includes(q)
    )
  })

  const handleSelectSubject = (sub) => {
    setSelectedSubjectId(sub.id)
    setSearch(sub.name)
    setValidationError("")
    setIsDropdownOpen(false)
    setHighlightedIndex(-1)
  }

  const handleClearSubject = (e) => {
    e.stopPropagation()
    setSelectedSubjectId("")
    setSearch("")
    setValidationError("")
    setIsDropdownOpen(true)
    setHighlightedIndex(-1)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (!isDropdownOpen) {
        setIsDropdownOpen(true)
        setHighlightedIndex(0)
        return
      }
      setHighlightedIndex((prev) =>
        prev < filteredSubjects.length - 1 ? prev + 1 : 0
      )
      return
    }

    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (!isDropdownOpen) {
        setIsDropdownOpen(true)
        return
      }
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredSubjects.length - 1
      )
      return
    }

    if (e.key === "Enter") {
      if (isDropdownOpen && highlightedIndex >= 0 && highlightedIndex < filteredSubjects.length) {
        e.preventDefault()
        handleSelectSubject(filteredSubjects[highlightedIndex])
        return
      }
      if (isDropdownOpen && !selectedSubjectId && filteredSubjects.length === 1) {
        e.preventDefault()
        handleSelectSubject(filteredSubjects[0])
        return
      }
    }

    if (e.key === "Escape") {
      setIsDropdownOpen(false)
      return
    }
  }

  // Redirect to Manage School to assign teacher for this specific subject
  const handleAssignNow = async () => {
    const classId = section.class_id || section.classId || ""
    const sectionId = section.id || ""
    const subjectId = selectedSubjectId || ""
    const slotKey = `${section.id}_${day}_${period.id || period.period_number}`

    // 1. Persist scroll position, slot key, and edit mode to sessionStorage
    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0
    const scrollX = window.scrollX || window.pageXOffset || document.documentElement.scrollLeft || 0
    sessionStorage.setItem("timetable_scroll_y", String(scrollY))
    sessionStorage.setItem("timetable_scroll_x", String(scrollX))
    sessionStorage.setItem("timetable_scroll_slot_key", slotKey)
    sessionStorage.setItem("timetable_edit_mode", "true")

    // 2. Persist assign-now target in sessionStorage
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

    // 3. Immediately assign the slot with this subject in the timetable so it exists in the database
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

    setValidationError("")
    onAssign({
      timetable_id: cellData.timetableId,
      section_id: section.id,
      day_of_week: day,
      period_id: period.id,
      subject_id: selectedSubjectId,
      teacher_user_id: assignedTeacher?.id || null,
      scope: selectedScope,
      overwrite: true,
    })
    onClose()
  }

  const handleClear = () => {
    if (currentEntry) {
      onUnassign(currentEntry.id)
    } else {
      onAssign({
        timetable_id: cellData.timetableId,
        section_id: section.id,
        day_of_week: day,
        period_id: period.id,
        subject_id: null,
        scope: selectedScope,
      })
    }
    onClose()
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-lg"
    >
      <DialogHeader className="space-y-1">
        {/* First Row: Bigger Class and Section Text */}
        <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
          {section.className || section.class_name} - {section.name}
        </DialogTitle>

        {/* Second Row: Day, Period number and formatted time with AM/PM */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span className="font-semibold text-foreground capitalize">
            {day?.toLowerCase()}
          </span>
          <span>•</span>
          <span className="font-semibold text-foreground">
            {period.label || (period.period_number != null ? `Period ${period.period_number}` : "Period")}
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Clock className="size-3 text-muted-foreground" />
            {formatTime12h(period.start_time)} – {formatTime12h(period.end_time)}
          </span>
        </div>
      </DialogHeader>

      <form onSubmit={handleApply} noValidate className="space-y-4 py-2">
        {/* Current Assignment Status Card */}
        <div className="p-3 rounded-xl border border-border/80 bg-muted/20 text-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Current Slot Status
            </span>
            {currentEntry ? (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-bold text-foreground">
                  {currentEntry.subject?.name}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {currentEntry.teacher?.name || "No teacher"}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground italic mt-0.5 block">
                Unassigned slot
              </span>
            )}
          </div>

          {currentEntry && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleClear}
              className="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs h-7 px-2.5"
            >
              <Trash2 className="size-3 mr-1" />
              Unassign
            </Button>
          )}
        </div>

        {/* Subject Selection with Autocomplete */}
        <div className="space-y-1.5 relative">
          <label className="text-xs font-semibold text-foreground">
            Select Subject
          </label>
          <div className="relative">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setIsDropdownOpen(true)
                setHighlightedIndex(0)
                if (selectedSubjectId) {
                  setSelectedSubjectId("")
                }
              }}
              onFocus={() => {
                setIsDropdownOpen(true)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search subject"
              className={cn(
                "pl-8.5 pr-8 h-9 text-xs rounded-xl bg-background",
                isDropdownOpen && "ring-2 ring-primary/40 border-primary"
              )}
            />
            {selectedSubjectId ? (
              <button
                type="button"
                onClick={handleClearSubject}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground size-5 rounded flex items-center justify-center cursor-pointer"
                title="Clear selected subject"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          {/* Autocomplete Dropdown List */}
          {isDropdownOpen && (
            <div
              ref={dropdownRef}
              className="absolute z-50 left-0 right-0 top-full mt-1.5 max-h-52 overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-xl p-1 animate-in fade-in-0 zoom-in-95 duration-100"
            >
              {filteredSubjects.length === 0 ? (
                <div className="py-5 text-center text-xs text-muted-foreground">
                  No matching subjects found for this class section.
                </div>
              ) : (
                filteredSubjects.map((sub, idx) => {
                  const isSelected = selectedSubjectId === sub.id
                  const isHighlighted = highlightedIndex === idx
                  const theme = getSubjectTheme(sub.name, sub.category)
                  const hasTeacher = Boolean(sub.teacher?.name)

                  return (
                    <div
                      key={sub.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectSubject(sub)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer",
                        isSelected
                          ? "bg-primary/15 text-primary font-bold shadow-2xs"
                          : isHighlighted
                          ? "bg-muted/80 text-foreground"
                          : "hover:bg-muted/50 text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn("size-2 rounded-full shrink-0", theme.dot)} />
                        <span className="truncate font-semibold">{sub.name}</span>
                        {sub.code && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ({sub.code})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {hasTeacher ? (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                            {sub.teacher.name}
                          </span>
                        ) : (
                          <span className="text-[9px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full font-medium">
                            No teacher
                          </span>
                        )}
                        {isSelected && <Check className="size-3.5 text-primary shrink-0 ml-1" />}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {validationError && (
            <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
              {validationError}
            </p>
          )}
        </div>

        {/* Assigned Teacher Display (Fetched automatically from selected subject configuration) */}
        {selectedSubjectId ? (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Assigned Teacher
              </label>
              {isCheckingConflict && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" />
                  <span>Checking availability…</span>
                </span>
              )}
            </div>

            {assignedTeacher?.name ? (
              <div className="p-3 rounded-xl border border-border/80 bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <User className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">
                      {assignedTeacher.name}
                    </p>
                    {(assignedTeacher.department || assignedTeacher.designation) && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {[assignedTeacher.department, assignedTeacher.designation].filter(Boolean).join(" • ")}
                      </p>
                    )}
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
                >
                  Configured
                </Badge>
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-dashed border-amber-300 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="size-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="font-semibold text-amber-800 dark:text-amber-300">
                    Unassigned
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleAssignNow}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline cursor-pointer px-2.5 py-1 rounded-lg hover:bg-primary/10 transition-colors"
                >
                  <span>Assign now</span>
                  <ExternalLink className="size-3" />
                </button>
              </div>
            )}
          </div>
        ) : null}

        {/* Teacher Conflict Alert */}
        {conflictWarning && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs space-y-1 animate-in fade-in-0 duration-150">
            <div className="flex items-start gap-2 font-bold">
              <ShieldAlert className="size-4 shrink-0 text-destructive mt-0.5" />
              <span>Teacher Conflict Detected</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90 pl-6">
              {conflictWarning}
            </p>
          </div>
        )}

        {/* Apply Scope Selector */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-semibold text-foreground">
            Apply Scope
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setSelectedScope("SLOT")}
              className={cn(
                "p-2.5 rounded-xl border text-left cursor-pointer transition-all",
                selectedScope === "SLOT"
                  ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                  : "border-border/80 hover:bg-muted/40 text-foreground"
              )}
            >
              <span>This slot only</span>
              <span className="text-[10px] text-muted-foreground block font-normal mt-0.5">
                Single class slot
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedScope("WEEKDAYS")}
              className={cn(
                "p-2.5 rounded-xl border text-left cursor-pointer transition-all",
                selectedScope === "WEEKDAYS"
                  ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                  : "border-border/80 hover:bg-muted/40 text-foreground"
              )}
            >
              <span>Same period (Mon–Fri)</span>
              <span className="text-[10px] text-muted-foreground block font-normal mt-0.5">
                All 5 weekdays
              </span>
            </button>
          </div>
        </div>

        <DialogFooter className="pt-3 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onClose}
            className="h-9 px-4 text-xs font-semibold"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            size="default"
            disabled={isSubmitting}
            className="h-9 px-4 text-xs font-bold gap-1.5 shadow-xs"
          >
            {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
            <span>{conflictWarning ? "Assign Anyway" : "Assign Slot"}</span>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
