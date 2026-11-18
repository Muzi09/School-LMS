import { useState, useMemo } from "react"
import {
  Clock,
  Trash2,
  AlertTriangle,
  Check,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { TimePicker } from "@/components/ui/time-picker"
import { toast } from "sonner"
import {
  parseTime,
  format12h,
  format24h,
  calculateDuration,
  addMinutesToTime,
} from "./timeUtils"
import {
  PERIOD_TYPES,
  PERIOD_TYPE_LABELS,
  formatPeriodShortLabel,
  MIN_PERIOD_DURATION_MINUTES,
} from "./validators"
import { renumberPeriods } from "./scheduleReducer"
import { cn } from "@/lib/utils"

export function PeriodModal(props) {
  if (!props.isOpen) return null
  return <PeriodEditor {...props} />
}

function PeriodEditor({
  onClose,
  mode = "add", // "add" | "edit"
  periodData = null,
  periodIndex = 0,
  insertAfterIndex = -1,
  schedule = null,
  onSave,
  onDelete,
}) {
  const [activeMode, setActiveMode] = useState(mode)
  const [activePeriodIndex, setActivePeriodIndex] = useState(periodIndex)

  const periods = schedule?.periods
  const existingPeriod = mode === "edit" ? periods?.[periodIndex] || periodData : null
  const previous = insertAfterIndex >= 0 ? periods?.[insertAfterIndex] : null
  const following = periods?.[insertAfterIndex + 1]
  const defaultStart = previous?.end_time ?? (following ? "08:00" : "08:30")
  const previousDuration = previous ? calculateDuration(previous.start_time, previous.end_time) : 45
  const [type, setType] = useState(existingPeriod?.type || (existingPeriod?.is_break ? PERIOD_TYPES.RECESS : PERIOD_TYPES.CLASS))
  const [startTime, setStartTime] = useState(existingPeriod ? existingPeriod.start_time || "08:30" : defaultStart)
  const [endTime, setEndTime] = useState(existingPeriod ? existingPeriod.end_time || "09:15" : addMinutesToTime(defaultStart, previousDuration > 0 ? previousDuration : 45))

  const isEdit = activeMode === "edit"
  const currentTargetPeriod = isEdit && schedule?.periods?.[activePeriodIndex] ? schedule.periods[activePeriodIndex] : periodData

  // Check if current form inputs differ from original period
  const isFormModified = useMemo(() => {
    if (!currentTargetPeriod) return true
    const origType = currentTargetPeriod.type || (currentTargetPeriod.is_break ? PERIOD_TYPES.RECESS : PERIOD_TYPES.CLASS)
    return type !== origType || startTime !== currentTargetPeriod.start_time || endTime !== currentTargetPeriod.end_time
  }, [currentTargetPeriod, type, startTime, endTime])

  // Handle Type Change
  const handleTypeChange = (newType) => {
    setType(newType)
    // Adjust default durations if switching to/from recess
    if (newType === PERIOD_TYPES.RECESS) {
      const curDur = calculateDuration(startTime, endTime)
      if (curDur > 30 || curDur <= 0) {
        setEndTime(addMinutesToTime(startTime, 15))
      }
    } else if (newType === PERIOD_TYPES.CLASS) {
      const curDur = calculateDuration(startTime, endTime)
      if (curDur < 30) {
        setEndTime(addMinutesToTime(startTime, 45))
      }
    }
  }

  // Validation
  const validationError = useMemo(() => {
    const s = parseTime(startTime)
    const e = parseTime(endTime)
    if (!s) return "Start time format is invalid."
    if (!e) return "End time format is invalid."
    if (s.totalMinutes >= e.totalMinutes) return "End time must be after start time (cannot cross midnight)."
    const dur = e.totalMinutes - s.totalMinutes
    if (dur < MIN_PERIOD_DURATION_MINUTES) return `Duration must be at least ${MIN_PERIOD_DURATION_MINUTES} minutes.`
    if (dur > 180) return "Duration cannot exceed 180 minutes."
    return null
  }, [startTime, endTime])

  // Boundary limits for time selectors (disables selecting durations < 15 mins)
  const maxAllowedStartTime = useMemo(() => {
    const endMinutes = parseTime(endTime)?.totalMinutes
    if (endMinutes == null) return null
    return format24h(endMinutes - (MIN_PERIOD_DURATION_MINUTES - 5))
  }, [endTime])

  const minAllowedEndTime = useMemo(() => {
    const startMinutes = parseTime(startTime)?.totalMinutes
    if (startMinutes == null) return null
    return format24h(startMinutes + (MIN_PERIOD_DURATION_MINUTES - 5))
  }, [startTime])

  // Live timeline preview generator (always follows shift behavior)
  const previewPeriods = useMemo(() => {
    if (!schedule) return []
    let periods = [...(schedule.periods || [])].map((p) => ({ ...p }))
    if (periods.length === 0) return []

    if (validationError) {
      // If validation error, return current schedule periods so the list of periods is always visible and clickable
      return renumberPeriods(periods)
    }

    let defaultLabel = `P${isEdit ? activePeriodIndex + 1 : insertAfterIndex + 2}`
    if (type === PERIOD_TYPES.RECESS) defaultLabel = "R1"
    else if (type === PERIOD_TYPES.ASSEMBLY) defaultLabel = "A1"
    else if (type === PERIOD_TYPES.ACTIVITY) defaultLabel = "E1"

    const newP = {
      type,
      label: defaultLabel,
      start_time: startTime,
      end_time: endTime,
    }

    if (isEdit) {
      if (activePeriodIndex >= 0 && activePeriodIndex < periods.length) {
        periods[activePeriodIndex] = { ...periods[activePeriodIndex], ...newP }
        let lastEnd = parseTime(endTime)?.totalMinutes || 0
        for (let i = activePeriodIndex + 1; i < periods.length; i++) {
          const p = { ...periods[i] }
          const dur = calculateDuration(p.start_time, p.end_time)
          p.start_time = format24h(lastEnd)
          lastEnd += Math.max(MIN_PERIOD_DURATION_MINUTES, dur)
          p.end_time = format24h(lastEnd)
          periods[i] = p
        }
      }
    } else {
      const insertIdx = insertAfterIndex === -1 ? 0 : insertAfterIndex + 1
      periods.splice(insertIdx, 0, newP)
      let lastEnd = parseTime(endTime)?.totalMinutes || 0
      for (let i = insertIdx + 1; i < periods.length; i++) {
        const p = { ...periods[i] }
        const dur = calculateDuration(p.start_time, p.end_time)
        p.start_time = format24h(lastEnd)
        lastEnd += Math.max(MIN_PERIOD_DURATION_MINUTES, dur)
        p.end_time = format24h(lastEnd)
        periods[i] = p
      }
    }

    return renumberPeriods(periods)
  }, [schedule, validationError, isEdit, activePeriodIndex, insertAfterIndex, type, startTime, endTime])


  // Switch to another period when clicked in the list
  const handleSelectOtherPeriod = (targetIdx) => {
    if (isEdit && targetIdx === activePeriodIndex) return

    // If current period had edits, validate and save them first
    if (isFormModified) {
      if (validationError) {
        toast.error(`Please fix invalid times for ${currentTargetPeriod?.label || `P${activePeriodIndex + 1}`} before switching.`)
        return
      }

      const parsedStart = parseTime(startTime)?.normalized || startTime
      const parsedEnd = parseTime(endTime)?.normalized || endTime
      let computedLabel = `P${isEdit ? activePeriodIndex + 1 : insertAfterIndex + 2}`
      if (type === PERIOD_TYPES.RECESS) computedLabel = "R1"
      else if (type === PERIOD_TYPES.ASSEMBLY) computedLabel = "A1"
      else if (type === PERIOD_TYPES.ACTIVITY) computedLabel = "E1"

      onSave(
        {
          periodData: {
            type,
            label: currentTargetPeriod?.hasCustomLabel ? currentTargetPeriod.label : computedLabel,
            hasCustomLabel: currentTargetPeriod?.hasCustomLabel,
            start_time: parsedStart,
            end_time: parsedEnd,
          },
          cascadeMode: "shift",
          shiftEntireDay: false,
          periodIndex: activePeriodIndex,
          mode: activeMode,
          insertAfterIndex,
          nextPeriodIndex: targetIdx,
        },
        { stayOpen: true }
      )
    }

    // Switch active editing period to targetIdx
    setActiveMode("edit")
    setActivePeriodIndex(targetIdx)

    // Load target period's data
    const targetPeriod = previewPeriods[targetIdx] || schedule?.periods?.[targetIdx]
    if (targetPeriod) {
      const pType = targetPeriod.type || (targetPeriod.is_break ? PERIOD_TYPES.RECESS : PERIOD_TYPES.CLASS)
      setType(pType)
      setStartTime(targetPeriod.start_time || "08:30")
      setEndTime(targetPeriod.end_time || "09:15")
    }
  }

  const handleSave = () => {
    if (validationError) return
    const parsedStart = parseTime(startTime)?.normalized || startTime
    const parsedEnd = parseTime(endTime)?.normalized || endTime

    let computedLabel = `P${isEdit ? activePeriodIndex + 1 : insertAfterIndex + 2}`
    if (type === PERIOD_TYPES.RECESS) computedLabel = "R1"
    else if (type === PERIOD_TYPES.ASSEMBLY) computedLabel = "A1"
    else if (type === PERIOD_TYPES.ACTIVITY) computedLabel = "E1"

    onSave({
      periodData: {
        type,
        label: currentTargetPeriod?.hasCustomLabel ? currentTargetPeriod.label : computedLabel,
        hasCustomLabel: currentTargetPeriod?.hasCustomLabel,
        start_time: parsedStart,
        end_time: parsedEnd,
      },
      cascadeMode: "shift",
      shiftEntireDay: false,
      periodIndex: activePeriodIndex,
      mode: activeMode,
      insertAfterIndex,
    })
    onClose()
  }

  const handleClose = () => {
    if (isFormModified && !validationError) {
      handleSave()
    } else {
      onClose()
    }
  }

  // Dynamic modal title
  let modalTitle
  if (isEdit) {
    modalTitle = `Edit ${currentTargetPeriod?.label || `P${activePeriodIndex + 1}`}`
  } else {
    const prevP = insertAfterIndex >= 0 ? schedule?.periods?.[insertAfterIndex] : null
    const nextP = schedule?.periods?.[insertAfterIndex + 1]
    if (prevP && nextP) {
      modalTitle = `Add Period between ${prevP.label || `P${insertAfterIndex + 1}`} and ${nextP.label || `P${insertAfterIndex + 2}`}`
    } else if (prevP) {
      modalTitle = `Add Period after ${prevP.label || `P${insertAfterIndex + 1}`}`
    } else if (nextP) {
      modalTitle = `Add Period before ${nextP.label || "P1"}`
    } else {
      modalTitle = "Add Period"
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in-0 duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="period-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-[490px] bg-card border border-border shadow-2xl rounded-2xl z-10 overflow-hidden flex flex-col space-y-4 p-5 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/80">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
              <Clock className="size-4" />
            </div>
            <div>
              <h3 id="period-modal-title" className="text-base font-bold text-foreground">
                {modalTitle}
              </h3>
              <p className="text-xs text-muted-foreground">
                Configure timing duration and behavior.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-4 text-xs">
          {/* 1. Period Type Segmented Control */}
          <div className="space-y-1.5">
            <label className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
              PERIOD TYPE
            </label>
            <div className="grid grid-cols-4 gap-1 p-1 bg-muted/40 rounded-xl border border-border/60">
              {Object.entries(PERIOD_TYPE_LABELS).map(([t, tLabel]) => {
                const isSel = type === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypeChange(t)}
                    className={cn(
                      "py-2 px-1 rounded-lg font-semibold text-xs transition-all cursor-pointer select-none text-center whitespace-nowrap overflow-hidden",
                      isSel
                        ? "bg-primary text-primary-foreground font-bold shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                    title={tLabel}
                  >
                    {tLabel}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Start Time and End Time with TimePicker */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                Start Time
              </label>
              <TimePicker
                value={startTime}
                onChange={(newTime) => setStartTime(newTime)}
                maxTime={maxAllowedStartTime}
                placeholder="Start Time"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                End Time
              </label>
              <TimePicker
                value={endTime}
                onChange={(newTime) => setEndTime(newTime)}
                minTime={minAllowedEndTime}
                placeholder="End Time"
              />
            </div>
          </div>

          {/* Validation Alert */}
          {validationError && (
            <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive flex items-center gap-2 font-medium">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Live Preview Bar / Period Switcher */}
          {previewPeriods.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Timeline Periods
                </span>
                <span className="text-[10px] text-primary font-medium">
                  Click period to set timing
                </span>
              </div>
              <div className="flex h-9 bg-muted/40 rounded-xl border border-border/80 overflow-hidden divide-x divide-border/60 p-0.5 gap-0.5">
                {previewPeriods.map((p, pIdx) => {
                  const isCur = isEdit ? pIdx === activePeriodIndex : pIdx === insertAfterIndex + 1
                  const shortLabel = formatPeriodShortLabel(p, previewPeriods)
                  const isRecess = p.type === PERIOD_TYPES.RECESS || p.is_break

                  return (
                    <button
                      key={p.id || pIdx}
                      type="button"
                      onClick={() => handleSelectOtherPeriod(pIdx)}
                      style={{ flexGrow: 1 }}
                      className={cn(
                        "flex items-center justify-center text-[10px] sm:text-[11px] font-bold px-1 rounded-lg truncate transition-all cursor-pointer select-none",
                        isCur
                          ? "bg-primary text-primary-foreground font-extrabold shadow-xs ring-2 ring-primary ring-offset-1"
                          : isRecess
                          ? "bg-primary/20 text-foreground font-bold hover:bg-primary/30"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                      )}
                      title={`${p.label || shortLabel}: ${format12h(p.start_time)} – ${format12h(p.end_time)} (${calculateDuration(p.start_time, p.end_time)}m) • Click to edit timing`}
                    >
                      <span>{shortLabel}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/80">
          <div>
            {isEdit && onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onDelete(activePeriodIndex)
                  onClose()
                }}
                className="text-destructive hover:bg-destructive/10 text-xs gap-1.5 cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                <span>Delete Period</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={Boolean(validationError)}
              isDisabled={Boolean(validationError)}
              onClick={handleSave}
              className="bg-primary text-primary-foreground font-semibold text-xs shadow-2xs gap-1.5 cursor-pointer"
            >
              <Check className="size-3.5" />
              <span>Save Timing</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
