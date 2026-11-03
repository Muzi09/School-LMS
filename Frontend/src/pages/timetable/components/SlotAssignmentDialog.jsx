import React, { useState, useEffect, useMemo } from "react"
import {
  Calendar,
  Clock,
  User,
  BookOpen,
  AlertTriangle,
  Check,
  Trash2,
  Search,
  ChevronDown,
  Layers,
  Sparkles,
  Loader2,
  ShieldAlert,
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
import { Combobox } from "@/components/ui/combobox"
import { getSubjectTheme } from "../subjectTheme"
import { useCheckConflict } from "@/hooks/useTimetable"
import { cn } from "@/lib/utils"

const SPECIAL_ACTIVITIES = [
  { id: "free", name: "Free Period", category: "activity" },
  { id: "library", name: "Library", category: "activity" },
  { id: "assembly", name: "Assembly", category: "activity" },
  { id: "sports", name: "Games / Sports", category: "activity" },
  { id: "activity", name: "Club / Activity", category: "activity" },
]

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
  const [search, setSearch] = useState("")
  const [selectedSubjectId, setSelectedSubjectId] = useState("")
  const [selectedTeacherId, setSelectedTeacherId] = useState("")
  const [selectedScope, setSelectedScope] = useState("SLOT") // "SLOT" | "WEEKDAYS" | "CLASS_SECTIONS" | "FILL_TARGET"
  const [conflictWarning, setConflictWarning] = useState(null)
  const [isCheckingConflict, setIsCheckingConflict] = useState(false)
  const [validationError, setValidationError] = useState("")

  const checkConflictMutation = useCheckConflict()

  // Initialize selected values from cellData
  useEffect(() => {
    if (!isOpen || !cellData) return
    const current = cellData.currentEntry
    if (current) {
      setSelectedSubjectId(current.subject?.id || "")
      setSelectedTeacherId(current.teacher?.id || "")
    } else {
      setSelectedSubjectId("")
      setSelectedTeacherId("")
    }
    setSelectedScope("SLOT")
    setConflictWarning(null)
    setValidationError("")
    setSearch("")
  }, [isOpen, cellData])

  // When selected subject changes, auto-populate default teacher if not overridden
  useEffect(() => {
    if (!selectedSubjectId) return
    const matchedSubject = availableSubjects.find((s) => s.id === selectedSubjectId)
    if (matchedSubject?.teacher_id && !selectedTeacherId) {
      setSelectedTeacherId(matchedSubject.teacher_id)
    }
  }, [selectedSubjectId, availableSubjects, selectedTeacherId])

  // Check teacher conflict whenever teacher or time changes
  useEffect(() => {
    if (!selectedTeacherId || !cellData?.period || !cellData?.day || !cellData?.timetableId) {
      setConflictWarning(null)
      return
    }

    let isMounted = true
    setIsCheckingConflict(true)

    const check = async () => {
      try {
        const res = await checkConflictMutation.mutateAsync({
          timetable_id: cellData.timetableId,
          teacher_user_id: selectedTeacherId,
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
  }, [selectedTeacherId, cellData])

  const teacherOptions = useMemo(() => {
    return [
      { value: "", label: "No teacher assigned" },
      ...eligibleTeachers.map((t) => ({
        value: String(t.id),
        label: `${t.name}${t.department ? ` (${t.department})` : ""}`,
      })),
    ]
  }, [eligibleTeachers])

  if (!isOpen || !cellData) return null

  const { section, day, period, currentEntry } = cellData

  const filteredSubjects = availableSubjects.filter((s) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      s.name?.toLowerCase().includes(q) ||
      s.code?.toLowerCase().includes(q) ||
      s.teacher?.name?.toLowerCase().includes(q)
    )
  })

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
      teacher_user_id: selectedTeacherId || null,
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
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-bold text-xs">
            {section.className || section.class_name} - {section.name}
          </Badge>
          <span className="text-xs font-semibold text-muted-foreground">·</span>
          <span className="text-xs font-bold text-foreground capitalize">
            {day?.toLowerCase()}
          </span>
          <span className="text-xs font-semibold text-muted-foreground">·</span>
          <span className="text-xs font-bold text-foreground">
            {period.label || `P${period.period_number}`}
          </span>
        </div>
        <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
          <Clock className="size-3" />
          <span>
            {period.start_time} – {period.end_time}
          </span>
        </DialogDescription>
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

        {/* Search Subjects Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Select Subject <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search section subjects..."
              className="pl-8.5 h-9 text-xs rounded-xl"
            />
          </div>

          {/* Subjects List */}
          <div className="max-h-48 overflow-y-auto space-y-1 p-1 rounded-xl border border-border/70 bg-background/50">
            {filteredSubjects.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No matching subjects configured for this class section.
              </div>
            ) : (
              filteredSubjects.map((sub) => {
                const isSelected = selectedSubjectId === sub.id
                const theme = getSubjectTheme(sub.name, sub.category)
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      setSelectedSubjectId(sub.id)
                      setValidationError("")
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-xl flex items-center justify-between text-xs transition-all cursor-pointer",
                      isSelected
                        ? "bg-primary/10 text-primary font-bold shadow-2xs"
                        : "hover:bg-muted/60 text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("size-2 rounded-full shrink-0", theme.dot)} />
                      <span className="truncate font-semibold">{sub.name}</span>
                      {sub.code && (
                        <span className="text-[10px] text-muted-foreground">
                          ({sub.code})
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="size-4 text-primary shrink-0" />
                    )}
                  </button>
                )
              })
            )}
          </div>

          {validationError && (
            <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
              {validationError}
            </p>
          )}
        </div>

        {/* Teacher Selection via Combobox */}
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

          <Combobox
            options={teacherOptions}
            value={selectedTeacherId ? String(selectedTeacherId) : ""}
            onValueChange={(val) => setSelectedTeacherId(val || "")}
            placeholder="Select a teacher (Optional)"
            className="w-full h-9 text-xs rounded-xl bg-background border border-border"
          />
        </div>

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
