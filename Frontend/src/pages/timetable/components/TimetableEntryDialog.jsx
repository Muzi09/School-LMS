import { useState, useEffect, useMemo } from "react"
import {
  CalendarDays,
  BookOpen,
  User,
  AlertTriangle,
  Loader2,
  Trash2,
  Info,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { ModalHeader } from "@/components/common/ModalHeader"
import { Combobox } from "@/components/ui/combobox"
import { cn } from "@/lib/utils"

const DAY_LABELS = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
}

export function TimetableEntryDialog({
  isOpen,
  onClose,
  entry = null, // If null => Add mode, else => Edit mode
  initialDay = "MONDAY",
  initialPeriod = null,
  section = null, // { id, class_name, section_name }
  subjects = [], // Available subjects for this section
  teachers = [], // Eligible active teaching staff
  periods = [], // Configured periods
  entries = [], // Current timetable entries for conflict / overwrite detection
  onSave,
  onDeleteRequest,
  isPending = false,
  canManage = false,
  isSlotReadOnly = false,
}) {
  const isEdit = Boolean(entry && entry.id)

  const [selectedDay, setSelectedDay] = useState("MONDAY")
  const [selectedPeriodId, setSelectedPeriodId] = useState("")
  const [selectedSubjectId, setSelectedSubjectId] = useState("")

  // Initialize or reset state when modal opens or entry changes
  useEffect(() => {
    if (isOpen) {
      if (isEdit && entry) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedDay(entry.day_of_week)
        setSelectedPeriodId(entry.period_id ? String(entry.period_id) : "")
        setSelectedSubjectId(entry.subject?.id ? String(entry.subject.id) : "")
      } else {
        // Defaults to initialDay (or MONDAY) and initialPeriod (or Period 1)
        setSelectedDay(initialDay ? String(initialDay).toUpperCase() : "MONDAY")

        const period1 = periods.find((p) => Number(p.period_number) === 1)
        const defaultPeriod =
          initialPeriod?.id ||
          (typeof initialPeriod === "string" || typeof initialPeriod === "number" ? initialPeriod : null) ||
          period1?.id ||
          periods[0]?.id ||
          ""
        setSelectedPeriodId(defaultPeriod ? String(defaultPeriod) : "")
        setSelectedSubjectId("")
      }
    }
  }, [isOpen, isEdit, entry, initialDay, initialPeriod, periods])

  // Look up selected subject to get assigned teacher from School Management
  const selectedSubject = useMemo(() => {
    return subjects.find((s) => String(s.id) === String(selectedSubjectId)) || null
  }, [subjects, selectedSubjectId])

  const assignedTeacher = useMemo(() => {
    if (selectedSubject?.teacher) return selectedSubject.teacher
    if (isEdit && entry?.subject?.id === selectedSubjectId && entry?.teacher) return entry.teacher
    return null
  }, [selectedSubject, isEdit, entry, selectedSubjectId])

  // Detect if selected (Day, Period) already has an entry on this section
  const existingSlotEntry = useMemo(() => {
    if (!selectedDay || !selectedPeriodId) return null
    return (
      entries.find(
        (e) =>
          e.day_of_week?.toUpperCase() === selectedDay?.toUpperCase() &&
          String(e.period_id) === String(selectedPeriodId) &&
          (!entry || String(e.id) !== String(entry.id))
      ) || null
    )
  }, [entries, selectedDay, selectedPeriodId, entry])

  const currentPeriod = useMemo(() => {
    if (!selectedPeriodId) return null
    return periods.find((p) => String(p.id) === String(selectedPeriodId)) || null
  }, [periods, selectedPeriodId])

  if (!isOpen) return null

  const isSlotDisabled = !canManage || isPending || isEdit || isSlotReadOnly

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedDay) {
      toast.warning("Please select a day of the week.")
      return
    }
    if (!selectedPeriodId) {
      toast.warning("Please select a period.")
      return
    }
    if (!selectedSubjectId) {
      toast.warning("Please select a subject.")
      return
    }

    const resolvedTeacherId = assignedTeacher?.id || selectedSubject?.teacher_id || null

    try {
      if (isEdit && !existingSlotEntry) {
        await onSave({
          isEdit: true,
          entryId: entry.id,
          payload: {
            subject_id: selectedSubjectId,
            teacher_user_id: resolvedTeacherId,
            period_id: selectedPeriodId,
            day_of_week: selectedDay,
          },
        })
      } else {
        await onSave({
          section_id: section?.id || section?.section_id,
          subject_id: selectedSubjectId,
          teacher_user_id: resolvedTeacherId,
          period_id: selectedPeriodId,
          day_of_week: selectedDay,
          overwrite: true,
        })
      }
      toast.success(isEdit ? "Timetable entry updated successfully." : "Timetable entry saved successfully.")
      onClose()
    } catch (err) {
      const errData = err.data || err.response?.data || {}
      const msg = errData.detail || errData.message || err.message || "Failed to save timetable entry."
      const conflictTitle =
        errData.code === "TEACHER_SCHEDULE_CONFLICT"
          ? "Teacher Conflict"
          : errData.code === "SECTION_SCHEDULE_CONFLICT"
          ? "Section Conflict"
          : null
      if (conflictTitle) {
        toast.error(conflictTitle, { description: msg })
      } else {
        toast.error(msg)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-200">
        <ModalHeader
          icon={CalendarDays}
          title={isEdit ? "Edit Timetable Entry" : "Add Timetable Entry"}
          description={
            section
              ? `${section.class_name} • ${section.section_name}`
              : "Assign subject and teacher to a schedule slot."
          }
          onClose={onClose}
        />

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* Overwrite Information Alert when slot is already configured */}
            {existingSlotEntry && (
              <Alert variant="warning" className="shadow-2xs">
                <AlertTriangle className="size-4" />
                <AlertTitle className="text-sm font-bold text-amber-800 dark:text-amber-300">
                  Slot Already Configured
                </AlertTitle>
                <AlertDescription className="space-y-2 mt-1">
                  <p className="leading-relaxed">
                    A timetable entry is already configured for{" "}
                    <strong className="font-semibold text-foreground">
                      {DAY_LABELS[selectedDay] || selectedDay}
                    </strong>{" "}
                    (
                    <strong className="font-semibold text-foreground">
                      {currentPeriod
                        ? `Period ${currentPeriod.period_number}`
                        : "selected period"}
                    </strong>
                    ):
                  </p>
                  <div className="flex items-center gap-2 flex-wrap bg-amber-500/10 dark:bg-amber-500/5 p-2 rounded-lg border border-amber-500/20">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border border-border font-semibold text-foreground text-xs shadow-2xs">
                      <BookOpen className="size-3.5 text-primary shrink-0" />
                      <span>
                        {existingSlotEntry.subject?.name || "Subject"}
                        {existingSlotEntry.subject?.code && (
                          <span className="text-muted-foreground ml-1 font-normal">
                            ({existingSlotEntry.subject.code})
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="text-muted-foreground text-xs">&bull;</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border border-border font-semibold text-foreground text-xs shadow-2xs">
                      <User className="size-3.5 text-primary shrink-0" />
                      <span className={cn(!existingSlotEntry.teacher?.name && "italic font-normal text-muted-foreground")}>
                        {existingSlotEntry.teacher?.name || "Unassigned"}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5 pt-0.5 text-amber-800 dark:text-amber-300 font-medium">
                    <Info className="size-3.5 shrink-0 mt-0.5" />
                    <span>
                      Saving this entry will <strong className="underline decoration-amber-500 underline-offset-2">overwrite</strong> the existing schedule on this slot.
                    </span>
                  </div>
                </AlertDescription>
              </Alert>
            )}



            {/* Day and Period Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Day Dropdown */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label
                    htmlFor="timetable-day-select"
                    className="text-xs sm:text-sm font-medium text-foreground block"
                  >
                    Day
                  </label>
                </div>
                <Combobox
                  id="timetable-day-select"
                  value={selectedDay}
                  onValueChange={(val) => setSelectedDay(val)}
                  options={Object.entries(DAY_LABELS).map(([key, label]) => ({
                    value: key,
                    label,
                  }))}
                  placeholder="Select Day"
                  disabled={isSlotDisabled}
                  className={cn(isSlotDisabled && "!opacity-90 !cursor-not-allowed bg-muted/40 font-medium")}
                />
              </div>

              {/* Period Dropdown */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label
                    htmlFor="timetable-period-select"
                    className="text-xs sm:text-sm font-medium text-foreground block"
                  >
                    Period
                  </label>
                </div>
                <Combobox
                  id="timetable-period-select"
                  value={selectedPeriodId}
                  onValueChange={(val) => setSelectedPeriodId(val)}
                  options={periods.map((p) => ({
                    value: String(p.id),
                    label: `Period ${p.period_number} (${p.start_time} - ${p.end_time})`,
                  }))}
                  placeholder={periods.length === 0 ? "No Periods Configured" : "Select Period"}
                  disabled={isSlotDisabled || periods.length === 0}
                  className={cn(isSlotDisabled && "!opacity-90 !cursor-not-allowed bg-muted/40 font-medium")}
                />
              </div>
            </div>

            {/* Subject Selection */}
            <div>
              <label
                htmlFor="timetable-subject-select"
                className="text-xs sm:text-sm font-medium text-foreground block mb-0.5"
              >
                Subject
              </label>

              {subjects.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
                  No subjects are currently assigned to this section. Please configure subjects in School Configuration before creating timetable entries.
                </div>
              ) : (
                <Combobox
                  id="timetable-subject-select"
                  value={selectedSubjectId}
                  onValueChange={(val) => setSelectedSubjectId(val)}
                  options={subjects.map((sub) => ({
                    value: String(sub.id),
                    label: sub.name,
                    description: sub.code || null,
                  }))}
                  placeholder="Select Subject"
                  disabled={!canManage || isPending}
                />
              )}
            </div>

            {/* Assigned Teacher (read-only from School Management) */}
            <div>
              <label className="text-xs sm:text-sm font-medium text-foreground block mb-1">
                Assigned Teacher
              </label>

              {selectedSubjectId ? (
                assignedTeacher ? (
                  <div className="flex items-center justify-between p-2.5 px-3 rounded-xl border border-border bg-card">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                        {assignedTeacher.name ? assignedTeacher.name.charAt(0).toUpperCase() : "T"}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-foreground truncate">
                          {assignedTeacher.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {assignedTeacher.email || "No email"}
                          {assignedTeacher.roll_no ? ` • ${assignedTeacher.roll_no}` : ""}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold shrink-0">
                      Assigned
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2.5 px-3 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400">
                    <div className="flex items-center gap-2 min-w-0 text-xs">
                      <User className="size-4 shrink-0 opacity-70" />
                      <span className="truncate">Unassigned in School Management</span>
                    </div>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-semibold shrink-0">
                      Unassigned
                    </span>
                  </div>
                )
              ) : (
                <div className="p-2.5 px-3 rounded-xl border border-border/60 bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
                  <User className="size-4 opacity-40 shrink-0" />
                  <span>Select a subject above to view its assigned teacher</span>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between p-4 px-6 border-t border-border/70 bg-muted/20">
            {isEdit && canManage ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => onDeleteRequest(entry)}
                disabled={isPending}
                className="gap-1.5 h-10 px-4 text-sm font-medium rounded-xl cursor-pointer"
              >
                <Trash2 className="size-4" />
                <span>Delete</span>
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isPending}
                className="h-10 px-5 text-sm font-medium rounded-xl cursor-pointer"
              >
                Cancel
              </Button>

              {canManage && (
                <Button
                  type="submit"
                  disabled={isPending || subjects.length === 0 || periods.length === 0}
                  className="h-10 px-6 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
                >
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  <span>
                    {existingSlotEntry
                      ? "Overwrite & Save"
                      : isEdit
                      ? "Save Changes"
                      : "Save Entry"}
                  </span>
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TimetableEntryDialog
