import React, { useMemo } from "react"
import {
  Plus,
  Coffee,
  Clock,
  Sparkles,
  BookOpen,
  Activity,
  Users,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BoundaryEditPopover } from "./BoundaryEditPopover"
import {
  parseTime,
  format12h,
  calculateDuration,
  formatDurationHuman,
} from "./timeUtils"
import { PERIOD_TYPES } from "./validators"
import { cn } from "@/lib/utils"

export function BellTimeline({
  schedule,
  setupId,
  isTodaySchedule = false,
  isAmber = false,
  readOnly = false,
  onOpenPeriodModal,
  onInsertPeriodAtBoundary,
  onEditBoundaryTime,
  onApplyTemplate,
  otherSetups = [],
  onCopyFromOtherSetup,
}) {
  const periods = schedule?.periods || []

  // Check current running period if today
  const currentRunningPeriodId = useMemo(() => {
    if (!isTodaySchedule) return null
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const active = periods.find((p) => {
      const s = parseTime(p.start_time)?.totalMinutes ?? -1
      const e = parseTime(p.end_time)?.totalMinutes ?? -1
      return nowMin >= s && nowMin < e
    })
    return active ? active.id : null
  }, [isTodaySchedule, periods])

  // Summary strip statistics
  const summaryStats = useMemo(() => {
    if (periods.length === 0) return null
    const firstBell = periods[0].start_time
    const lastBell = periods[periods.length - 1].end_time

    let totalTeachingMins = 0
    let totalRecessMins = 0
    let classPeriodsCount = 0

    periods.forEach((p) => {
      const dur = calculateDuration(p.start_time, p.end_time)
      const pType = p.type || (p.is_break ? PERIOD_TYPES.RECESS : PERIOD_TYPES.CLASS)
      if (pType === PERIOD_TYPES.CLASS) {
        totalTeachingMins += dur
        classPeriodsCount += 1
      } else if (pType === PERIOD_TYPES.RECESS) {
        totalRecessMins += dur
      }
    })

    return {
      firstBell: format12h(firstBell),
      lastBell: format12h(lastBell),
      totalTeachingMins,
      classPeriodsCount,
      totalRecessMins,
      totalDayMins: calculateDuration(firstBell, lastBell),
    }
  }, [periods])

  if (periods.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border/80 rounded-2xl bg-muted/15 text-center space-y-4">
        <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Clock className="size-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-foreground">No periods configured for this schedule</h4>
          <p className="text-xs text-muted-foreground max-w-sm">
            Add periods manually or start from a standard school template.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => onInsertPeriodAtBoundary(-1)}
            className="gap-1.5 text-xs font-semibold"
          >
            <Plus className="size-3.5" />
            <span>Add First Period</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onApplyTemplate?.("standard")}
            className="gap-1.5 text-xs font-semibold"
          >
            <Sparkles className="size-3.5 text-primary" />
            <span>Start from 8-Period Template</span>
          </Button>
          {otherSetups.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onCopyFromOtherSetup?.(otherSetups[0].id)}
              className="gap-1.5 text-xs text-muted-foreground"
            >
              <span>Copy from {otherSetups[0].name}</span>
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Calculate total timeline minutes for proportional sizing
  const totalMinutes = useMemo(() => {
    return periods.reduce((acc, p) => acc + Math.max(5, calculateDuration(p.start_time, p.end_time)), 0)
  }, [periods])

  return (
    <div className="w-full space-y-2">
      {/* Accessible Summary Info */}
      {summaryStats && (
        <span className="sr-only">
          {summaryStats.classPeriodsCount} Class Periods, {summaryStats.totalTeachingMins}m Teaching
        </span>
      )}

      {/* Desktop / Tablet Single-Row Unified Timeline Strip (just like timetable header) */}
      <div className="hidden md:block relative w-full">
        <div className="overflow-x-auto scrollbar-thin py-3 px-1">
          <div className="min-w-max flex items-stretch h-14 rounded-xl border border-border/70 bg-primary/5 dark:bg-primary/10 select-none">
            {/* 1. START EMPTY SPACE: Ensures first start time chip and "+" button are 100% visible, not hidden */}
            <div className="relative w-12 shrink-0 border-r border-border/70 bg-primary/5 dark:bg-primary/10">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 flex flex-col items-center gap-1 pointer-events-auto">
                <BoundaryEditPopover
                  timeStr={periods[0].start_time}
                  boundaryIndex={0}
                  isFirst
                  disabled={readOnly}
                  onSaveTime={(newTime) => onEditBoundaryTime?.(0, newTime, true)}
                />
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => onInsertPeriodAtBoundary(-1)}
                    className="size-4.5 rounded-full bg-background border border-border/80 hover:bg-primary hover:text-primary-foreground text-muted-foreground flex items-center justify-center shadow-2xs cursor-pointer transition-all hover:scale-110"
                    title="Insert period before first period"
                    aria-label="Insert period before first period"
                  >
                    <Plus className="size-3" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. PERIOD CELLS: One row just like timetable header, time chips sit on the divider */}
            {periods.map((period, idx) => {
              const duration = calculateDuration(period.start_time, period.end_time)
              const pType = period.type || (period.is_break ? PERIOD_TYPES.RECESS : PERIOD_TYPES.CLASS)
              const isRecess = pType === PERIOD_TYPES.RECESS
              const isRunning = period.id === currentRunningPeriodId
              const isLast = idx === periods.length - 1

              return (
                <div
                  key={period.id || idx}
                  className={cn(
                    "relative flex items-center justify-center border-r border-border/70 transition-colors",
                    isRecess
                      ? "bg-primary/10 dark:bg-primary/15"
                      : "bg-primary/5 dark:bg-primary/10 hover:bg-primary/10"
                  )}
                  style={{
                    flexGrow: duration,
                    minWidth: isRecess ? "85px" : "110px",
                  }}
                >
                  {/* Period Button: click to edit period in modal */}
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => !readOnly && onOpenPeriodModal(period, idx)}
                    className={cn(
                      "w-full h-full flex items-center justify-center gap-1.5 px-3 select-none text-center",
                      readOnly ? "cursor-default" : "cursor-pointer"
                    )}
                    title={`${period.label || `P${idx + 1}`}: ${format12h(period.start_time)} – ${format12h(period.end_time)} (${duration}m) · Click to edit`}
                    aria-label={`Edit ${period.label || `P${idx + 1}`}`}
                  >
                    {isRunning && (
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    )}
                    {isRecess && (
                      <Coffee className="size-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-xs font-bold text-foreground">
                      {period.label || `P${period.period_number}`}
                    </span>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {duration}m
                    </span>
                  </button>

                  {/* Boundary End Time Chip & Insert Period Between / After Icon */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 flex flex-col items-center gap-1 pointer-events-auto">
                    <BoundaryEditPopover
                      timeStr={period.end_time}
                      boundaryIndex={idx + 1}
                      isLast={isLast}
                      disabled={readOnly}
                      onSaveTime={(newTime) => onEditBoundaryTime?.(idx, newTime, false)}
                    />
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => onInsertPeriodAtBoundary(idx)}
                        className="size-4.5 rounded-full bg-background border border-border/80 hover:bg-primary hover:text-primary-foreground text-muted-foreground flex items-center justify-center shadow-2xs cursor-pointer transition-all hover:scale-110"
                        title={`Insert period after ${period.label || `P${idx + 1}`}`}
                        aria-label={`Insert period after ${period.label || `P${idx + 1}`}`}
                      >
                        <Plus className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {/* 3. END EMPTY SPACE: Ensures ending time badge & plus icon have comfortable breathing room */}
            <div className="w-12 shrink-0 bg-primary/5 dark:bg-primary/10" />
          </div>
        </div>
      </div>

      {/* Mobile Vertical Timeline List */}
      <div className="md:hidden space-y-2">
        <div className="flex items-center justify-between pb-1 border-b border-border/60">
          <span className="text-xs font-semibold text-muted-foreground">Periods Timeline</span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => onInsertPeriodAtBoundary(-1)}
            className="text-xs gap-1"
          >
            <Plus className="size-3" />
            <span>Add Period</span>
          </Button>
        </div>

        <div className="space-y-1.5">
          {periods.map((period, idx) => {
            const dur = calculateDuration(period.start_time, period.end_time)
            const isRecess = period.type === PERIOD_TYPES.RECESS || period.is_break

            return (
              <div
                key={period.id || idx}
                className={cn(
                  "p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-colors",
                  isRecess
                    ? "bg-primary/10 border-border/70 text-foreground"
                    : "bg-card border-border/70"
                )}
              >
                <div
                  className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                  onClick={() => onOpenPeriodModal(period, idx)}
                >
                  <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground truncate">
                        {period.label || `P${period.period_number}`}
                      </span>
                      {isRecess && (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 border-border/60">
                          Recess
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      {format12h(period.start_time)} – {format12h(period.end_time)} ({dur}m)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onInsertPeriodAtBoundary(idx)}
                  className="size-7 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground flex items-center justify-center text-muted-foreground transition-colors cursor-pointer shrink-0"
                  aria-label={`Insert after ${period.label || `P${idx + 1}`}`}
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
