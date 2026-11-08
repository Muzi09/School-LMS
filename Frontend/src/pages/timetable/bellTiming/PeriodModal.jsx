import React, { useState, useEffect, useMemo } from "react"
import {
  Clock,
  Trash2,
  AlertTriangle,
  Check,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { TimePicker } from "@/components/ui/time-picker"
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
  MAX_PERIOD_DURATION_MINUTES,
} from "./validators"
import { renumberPeriods } from "./scheduleReducer"
import { cn } from "@/lib/utils"

export function PeriodModal({
  isOpen,
  onClose,
  mode = "add", // "add" | "edit"
  periodData = null,
  periodIndex = 0,
  insertAfterIndex = -1,
  schedule = null,
  onSave,
  onDelete,
}) {
  const isEdit = mode === "edit"

  // Form states
  const [type, setType] = useState(PERIOD_TYPES.CLASS)
  const [startTime, setStartTime] = useState("08:30")
  const [endTime, setEndTime] = useState("09:15")

  // Initialize data on open
  useEffect(() => {
    if (!isOpen) return

    if (isEdit && periodData) {
      const pType = periodData.type || (periodData.is_break ? PERIOD_TYPES.RECESS : PERIOD_TYPES.CLASS)
      setType(pType)
      setStartTime(periodData.start_time || "08:30")
      setEndTime(periodData.end_time || "09:15")
    } else {
      // Add mode: derive sensible defaults from neighbors
      const prevPeriod = insertAfterIndex >= 0 && schedule?.periods?.[insertAfterIndex] ? schedule.periods[insertAfterIndex] : null
      const nextPeriod = schedule?.periods?.[insertAfterIndex + 1] || null

      let defaultStart = "08:30"
      if (prevPeriod) {
        defaultStart = prevPeriod.end_time
      } else if (nextPeriod) {
        defaultStart = "08:00"
      }

      const defaultDur = prevPeriod ? calculateDuration(prevPeriod.start_time, prevPeriod.end_time) : 45
      const defaultEnd = addMinutesToTime(defaultStart, defaultDur > 0 ? defaultDur : 45)

      setType(PERIOD_TYPES.CLASS)
      setStartTime(defaultStart)
      setEndTime(defaultEnd)
    }
  }, [isOpen, isEdit, periodData, periodIndex, insertAfterIndex, schedule])

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
    // TimePicker checkTimeDisabled checks totalM >= maxM. Setting maxM = end - 10 disables end - 10, end - 5, end
    return format24h(endMinutes - (MIN_PERIOD_DURATION_MINUTES - 5))
  }, [endTime])

  const minAllowedEndTime = useMemo(() => {
    const startMinutes = parseTime(startTime)?.totalMinutes
    if (startMinutes == null) return null
    // TimePicker checkTimeDisabled checks totalM <= minM. Setting minM = start + 10 disables start, start + 5, start + 10
    return format24h(startMinutes + (MIN_PERIOD_DURATION_MINUTES - 5))
  }, [startTime])

  // Live timeline preview generator (always follows shift behavior)
  const previewPeriods = useMemo(() => {
    if (!schedule || validationError) return []
    let periods = [...(schedule.periods || [])].map((p) => ({ ...p }))

    let defaultLabel = `P${isEdit ? periodIndex + 1 : insertAfterIndex + 2}`
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
      periods[periodIndex] = newP
      let lastEnd = parseTime(endTime)?.totalMinutes || 0
      for (let i = periodIndex + 1; i < periods.length; i++) {
        const p = { ...periods[i] }
        const dur = calculateDuration(p.start_time, p.end_time)
        p.start_time = format24h(lastEnd)
        lastEnd += Math.max(MIN_PERIOD_DURATION_MINUTES, dur)
        p.end_time = format24h(lastEnd)
        periods[i] = p
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
  }, [schedule, validationError, isEdit, periodIndex, insertAfterIndex, type, startTime, endTime])

  if (!isOpen) return null

  const handleSave = () => {
    if (validationError) return
    const parsedStart = parseTime(startTime)?.normalized || startTime
    const parsedEnd = parseTime(endTime)?.normalized || endTime

    let computedLabel = `P${isEdit ? periodIndex + 1 : insertAfterIndex + 2}`
    if (type === PERIOD_TYPES.RECESS) computedLabel = "R1"
    else if (type === PERIOD_TYPES.ASSEMBLY) computedLabel = "A1"
    else if (type === PERIOD_TYPES.ACTIVITY) computedLabel = "E1"

    onSave({
      periodData: {
        type,
        label: computedLabel,
        start_time: parsedStart,
        end_time: parsedEnd,
      },
      cascadeMode: "shift",
      shiftEntireDay: false,
    })
    onClose()
  }

  // Dynamic modal title
  let modalTitle = "Edit Period"
  if (isEdit) {
    modalTitle = `Edit ${periodData?.label || `P${periodIndex + 1}`}`
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
        onClick={onClose}
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
            onClick={onClose}
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

          {/* Live Preview Bar */}
          {previewPeriods.length > 0 && !validationError && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Resulting Timeline Preview
              </span>
              <div className="flex h-8 bg-muted/40 rounded-lg border border-border/80 overflow-hidden divide-x divide-border/60">
                {previewPeriods.map((p, pIdx) => {
                  const isCur = isEdit ? pIdx === periodIndex : pIdx === insertAfterIndex + 1
                  const shortLabel = formatPeriodShortLabel(p, previewPeriods)
                  const isRecess = p.type === PERIOD_TYPES.RECESS || p.is_break

                  return (
                    <div
                      key={pIdx}
                      style={{ flexGrow: 1}}
                      className={cn(
                        "flex items-center justify-center text-[10px] font-bold px-1 truncate transition-colors",
                        isCur
                          ? "bg-primary text-primary-foreground"
                          : isRecess
                          ? "bg-primary/20 text-foreground font-bold"
                          : "text-muted-foreground"
                      )}
                      title={`${p.label || shortLabel}: ${format12h(p.start_time)} – ${format12h(p.end_time)} (${calculateDuration(p.start_time, p.end_time)}m)`}
                    >
                      {shortLabel}
                    </div>
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
                  onDelete(periodIndex)
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
