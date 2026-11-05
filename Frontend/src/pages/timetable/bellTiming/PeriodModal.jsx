import React, { useState, useEffect, useMemo } from "react"
import {
  Clock,
  Trash2,
  AlertTriangle,
  Check,
  X,
  Sparkles,
  Layers,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  parseTime,
  format12h,
  format24h,
  calculateDuration,
  addMinutesToTime,
} from "./timeUtils"
import {
  PERIOD_TYPES,
  MIN_PERIOD_DURATION_MINUTES,
  MAX_PERIOD_DURATION_MINUTES,
} from "./validators"
import { cn } from "@/lib/utils"

const QUICK_DURATIONS = [15, 20, 30, 35, 40, 45, 50, 60]

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
  const isFirstPeriod = isEdit && periodIndex === 0

  // Form states
  const [type, setType] = useState(PERIOD_TYPES.CLASS)
  const [label, setLabel] = useState("")
  const [hasCustomLabel, setHasCustomLabel] = useState(false)
  const [startTime, setStartTime] = useState("08:30")
  const [endTime, setEndTime] = useState("09:15")
  const [cascadeMode, setCascadeMode] = useState("shift") // "shift" | "fixed_end" | "none"
  const [shiftEntireDay, setShiftEntireDay] = useState(false)

  // Initialize data on open
  useEffect(() => {
    if (!isOpen) return

    if (isEdit && periodData) {
      const pType = periodData.type || (periodData.is_break ? PERIOD_TYPES.RECESS : PERIOD_TYPES.CLASS)
      setType(pType)
      setLabel(periodData.label || `P${periodIndex + 1}`)
      setHasCustomLabel(Boolean(periodData.hasCustomLabel))
      setStartTime(periodData.start_time || "08:30")
      setEndTime(periodData.end_time || "09:15")
      setCascadeMode("shift")
      setShiftEntireDay(false)
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
      setLabel(`P${insertAfterIndex + 2}`)
      setHasCustomLabel(false)
      setStartTime(defaultStart)
      setEndTime(defaultEnd)
      setCascadeMode("shift")
      setShiftEntireDay(false)
    }
  }, [isOpen, isEdit, periodData, periodIndex, insertAfterIndex, schedule])

  // Duration in minutes
  const currentDuration = useMemo(() => {
    return calculateDuration(startTime, endTime)
  }, [startTime, endTime])

  // Handle quick duration click
  const handleQuickDuration = (minutes) => {
    const s = parseTime(startTime)
    if (!s) return
    const newEnd = addMinutesToTime(startTime, minutes)
    setEndTime(newEnd)
  }

  // Handle Type Change: auto-update label if not custom
  const handleTypeChange = (newType) => {
    setType(newType)
    if (!hasCustomLabel) {
      if (newType === PERIOD_TYPES.RECESS) {
        setLabel("Recess")
        // Default 15m for recess
        handleQuickDuration(15)
      } else if (newType === PERIOD_TYPES.ASSEMBLY) {
        setLabel("Assembly")
      } else if (newType === PERIOD_TYPES.ACTIVITY) {
        setLabel("Activity")
      } else {
        setLabel(`P${isEdit ? periodIndex + 1 : insertAfterIndex + 2}`)
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
    if (dur > MAX_PERIOD_DURATION_MINUTES) return `Duration cannot exceed ${MAX_PERIOD_DURATION_MINUTES} minutes.`
    return null
  }, [startTime, endTime])

  // Check if cascade choices should appear:
  // In edit mode: if duration changed or start time changed.
  // In add mode: if inserting into non-empty schedule.
  const showCascadeChoice = useMemo(() => {
    if (isEdit && periodData) {
      const origDur = calculateDuration(periodData.start_time, periodData.end_time)
      return currentDuration !== origDur || startTime !== periodData.start_time
    }
    return schedule && schedule.periods?.length > 0
  }, [isEdit, periodData, currentDuration, startTime, schedule])

  // Next period squeeze check for fixed-end mode
  const canSqueezeNext = useMemo(() => {
    const nextIdx = isEdit ? periodIndex + 1 : insertAfterIndex + 1
    const nextP = schedule?.periods?.[nextIdx]
    if (!nextP) return false
    const squeezed = calculateDuration(endTime, nextP.end_time)
    return squeezed >= MIN_PERIOD_DURATION_MINUTES
  }, [isEdit, periodIndex, insertAfterIndex, schedule, endTime])

  // Live timeline preview generator
  const previewPeriods = useMemo(() => {
    if (!schedule || validationError) return []
    let periods = [...(schedule.periods || [])].map((p) => ({ ...p }))

    const newP = {
      type,
      label: label.trim() || "P",
      start_time: startTime,
      end_time: endTime,
    }

    if (isEdit) {
      periods[periodIndex] = newP
      if (cascadeMode === "shift") {
        let lastEnd = parseTime(endTime).totalMinutes
        for (let i = periodIndex + 1; i < periods.length; i++) {
          const p = { ...periods[i] }
          const dur = calculateDuration(p.start_time, p.end_time)
          p.start_time = format24h(lastEnd)
          lastEnd += Math.max(15, dur)
          p.end_time = format24h(lastEnd)
          periods[i] = p
        }
      }
    } else {
      const insertIdx = insertAfterIndex === -1 ? 0 : insertAfterIndex + 1
      periods.splice(insertIdx, 0, newP)
      if (cascadeMode === "shift") {
        let lastEnd = parseTime(endTime).totalMinutes
        for (let i = insertIdx + 1; i < periods.length; i++) {
          const p = { ...periods[i] }
          const dur = calculateDuration(p.start_time, p.end_time)
          p.start_time = format24h(lastEnd)
          lastEnd += Math.max(15, dur)
          p.end_time = format24h(lastEnd)
          periods[i] = p
        }
      }
    }

    return periods
  }, [schedule, validationError, isEdit, periodIndex, insertAfterIndex, type, label, startTime, endTime, cascadeMode])

  if (!isOpen) return null

  const handleSave = () => {
    if (validationError) return
    const parsedStart = parseTime(startTime)?.normalized || startTime
    const parsedEnd = parseTime(endTime)?.normalized || endTime

    onSave({
      periodData: {
        type,
        label: label.trim(),
        hasCustomLabel,
        start_time: parsedStart,
        end_time: parsedEnd,
      },
      cascadeMode,
      shiftEntireDay,
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
      <div className="relative w-full max-w-lg bg-card border border-border shadow-2xl rounded-2xl z-10 overflow-hidden flex flex-col space-y-4 p-5 animate-in zoom-in-95 duration-150">
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
            <label className="font-semibold text-muted-foreground">PERIOD TYPE</label>
            <div className="grid grid-cols-4 gap-1 p-1 bg-muted/40 rounded-xl border border-border/60">
              {Object.values(PERIOD_TYPES).map((t) => {
                const isSel = type === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypeChange(t)}
                    className={cn(
                      "py-1.5 px-2 rounded-lg font-semibold text-xs transition-all cursor-pointer select-none text-center",
                      isSel
                        ? "bg-card text-foreground font-bold shadow-xs border border-border/80"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Label Input with Auto-label chip */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-muted-foreground">TITLE / LABEL</label>
              <span className="text-[11px] text-muted-foreground">
                Auto-numbers Class periods
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value)
                  setHasCustomLabel(true)
                }}
                placeholder="e.g. P1, Recess, Assembly"
                className="h-9 text-xs font-semibold"
              />
              <Badge variant="outline" className="h-9 px-3 text-xs font-mono font-bold shrink-0">
                {label || "P"}
              </Badge>
            </div>
          </div>

          {/* 3. In-time and Out-time Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground">IN-TIME (START)</label>
              <Input
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="08:30"
                className="h-9 text-xs font-mono font-bold"
              />
              <span className="text-[11px] text-muted-foreground">
                {format12h(startTime)}
              </span>
            </div>
            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground">OUT-TIME (END)</label>
              <Input
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="09:15"
                className="h-9 text-xs font-mono font-bold"
              />
              <span className="text-[11px] text-muted-foreground">
                {format12h(endTime)}
              </span>
            </div>
          </div>

          {/* 4. Duration Read-only row & Quick chips */}
          <div className="p-3 bg-muted/20 border border-border/70 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-muted-foreground">DURATION</span>
              <Badge
                variant={validationError ? "destructive" : "secondary"}
                className="font-bold px-2 py-0.5"
              >
                {currentDuration > 0 ? `${currentDuration} mins` : "Invalid"}
              </Badge>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">
                Quick:
              </span>
              {QUICK_DURATIONS.map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => handleQuickDuration(dur)}
                  className={cn(
                    "px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer select-none",
                    currentDuration === dur
                      ? "bg-primary text-primary-foreground border-primary font-bold shadow-2xs"
                      : "bg-card text-muted-foreground hover:text-foreground border-border hover:border-primary/40"
                  )}
                >
                  {dur}m
                </button>
              ))}
            </div>
          </div>

          {/* 5. First period entire day shift choice */}
          {isFirstPeriod && (
            <div className="p-2.5 rounded-xl border border-primary/20 bg-primary/5 space-y-1">
              <label className="flex items-center gap-2 cursor-pointer font-semibold select-none text-foreground">
                <input
                  type="checkbox"
                  checked={shiftEntireDay}
                  onChange={(e) => setShiftEntireDay(e.target.checked)}
                  className="size-3.5 rounded text-primary"
                />
                <span>Shift entire day by start time change</span>
              </label>
              <p className="text-[11px] text-muted-foreground pl-5.5">
                Moves all subsequent periods forward or backward preserving individual durations.
              </p>
            </div>
          )}

          {/* 6. Cascade Options */}
          {showCascadeChoice && !shiftEntireDay && (
            <div className="space-y-1.5 p-3 rounded-xl bg-muted/30 border border-border/70">
              <label className="font-bold text-foreground">CASCADE BEHAVIOR</label>
              <div className="space-y-1.5 pt-1">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cascade"
                    value="shift"
                    checked={cascadeMode === "shift"}
                    onChange={() => setCascadeMode("shift")}
                    className="mt-0.5 size-3.5 text-primary"
                  />
                  <div>
                    <span className="font-semibold text-foreground">Shift all following periods</span>
                    <p className="text-[11px] text-muted-foreground">
                      Subsequent periods move forward or backward preserving their duration (recommended).
                    </p>
                  </div>
                </label>

                <label className={cn("flex items-start gap-2 cursor-pointer", !canSqueezeNext && "opacity-50")}>
                  <input
                    type="radio"
                    name="cascade"
                    value="fixed_end"
                    disabled={!canSqueezeNext}
                    checked={cascadeMode === "fixed_end"}
                    onChange={() => setCascadeMode("fixed_end")}
                    className="mt-0.5 size-3.5 text-primary"
                  />
                  <div>
                    <span className="font-semibold text-foreground">Keep day end time fixed</span>
                    <p className="text-[11px] text-muted-foreground">
                      Squeeze the next period (requires at least 5m remaining).
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cascade"
                    value="none"
                    checked={cascadeMode === "none"}
                    onChange={() => setCascadeMode("none")}
                    className="mt-0.5 size-3.5 text-primary"
                  />
                  <div>
                    <span className="font-semibold text-foreground">Only this period</span>
                    <p className="text-[11px] text-muted-foreground">
                      Do not shift others; fails if it overlaps neighboring periods.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Validation Alert */}
          {validationError && (
            <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive flex items-center gap-2 font-medium">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Live Preview Bar */}
          {previewPeriods.length > 0 && !validationError && (
            <div className="space-y-1 pt-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase">
                Resulting Timeline Preview
              </span>
              <div className="flex h-8 bg-muted/40 rounded-lg border border-border/80 overflow-hidden divide-x divide-border/60">
                {previewPeriods.map((p, pIdx) => {
                  const isCur = isEdit ? pIdx === periodIndex : pIdx === insertAfterIndex + 1
                  return (
                    <div
                      key={pIdx}
                      style={{ flexGrow: calculateDuration(p.start_time, p.end_time) }}
                      className={cn(
                        "flex items-center justify-center text-[10px] font-bold px-1 truncate",
                        isCur
                          ? "bg-primary text-primary-foreground"
                          : p.type === PERIOD_TYPES.RECESS
                          ? "bg-amber-400/30 text-amber-900 dark:text-amber-200"
                          : "text-muted-foreground"
                      )}
                      title={`${p.label}: ${p.start_time}-${p.end_time}`}
                    >
                      {p.label}
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
                className="text-destructive hover:bg-destructive/10 text-xs gap-1.5"
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
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={Boolean(validationError)}
              onClick={handleSave}
              className="bg-primary text-primary-foreground font-semibold text-xs shadow-2xs gap-1.5"
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

