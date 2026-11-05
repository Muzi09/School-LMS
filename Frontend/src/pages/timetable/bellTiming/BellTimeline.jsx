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
            <Sparkles className="size-3.5 text-amber-500" />
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
    <div className="space-y-4">
      {/* Summary Strip */}
      {summaryStats && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground bg-muted/20 border border-border/60 px-3.5 py-2 rounded-xl">
          <div className="flex items-center gap-1.5 text-foreground font-semibold">
            <Clock className="size-3.5 text-primary" />
            <span>
              {summaryStats.firstBell} – {summaryStats.lastBell}
            </span>
          </div>
          <span className="text-border/80">|</span>
          <div>
            <strong className="text-foreground font-semibold">{summaryStats.classPeriodsCount}</strong> Class Periods
          </div>
          <span className="text-border/80">|</span>
          <div>
            <strong className="text-foreground font-semibold">{formatDurationHuman(summaryStats.totalTeachingMins)}</strong> Teaching
          </div>
          {summaryStats.totalRecessMins > 0 && (
            <>
              <span className="text-border/80">|</span>
              <div className="flex items-center gap-1">
                <Coffee className="size-3 text-amber-500" />
                <span>
                  <strong className="text-foreground font-semibold">{summaryStats.totalRecessMins}m</strong> Recess
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Desktop / Tablet Horizontal Proportional Timeline */}
      <div className="hidden md:block relative">
        <div className="overflow-x-auto scrollbar-thin pb-4 pt-2">
          <div className="min-w-max flex flex-col">
            {/* Timeline Blocks */}
            <div
              className={cn(
                "flex items-stretch h-14 rounded-xl border overflow-hidden shadow-2xs",
                isAmber
                  ? "bg-amber-500/10 border-amber-300 dark:border-amber-700/60 divide-x divide-amber-300/80 dark:divide-amber-800/60"
                  : "bg-muted/30 border-border/80 divide-x divide-border/60"
              )}
            >
              {periods.map((period, idx) => {
                const duration = calculateDuration(period.start_time, period.end_time)
                const pType = period.type || (period.is_break ? PERIOD_TYPES.RECESS : PERIOD_TYPES.CLASS)
                const isRecess = pType === PERIOD_TYPES.RECESS
                const isRunning = period.id === currentRunningPeriodId

                // Width proportional with minimum 80px
                const widthPercent = totalMinutes > 0 ? (duration / totalMinutes) * 100 : 100 / periods.length
                const minWidthPx = isRecess ? 75 : 95

                return (
                  <button
                    key={period.id || idx}
                    type="button"
                    onClick={() => !readOnly && onOpenPeriodModal(period, idx)}
                    style={{
                      minWidth: `${minWidthPx}px`,
                      flexGrow: duration,
                    }}
                    title={`${period.label || `P${idx + 1}`}: ${format12h(period.start_time)} – ${format12h(period.end_time)} (${duration} mins)`}
                    className={cn(
                      "relative px-2.5 py-1 flex flex-col items-center justify-center text-center transition-all duration-150 select-none group",
                      readOnly ? "cursor-default" : "cursor-pointer",
                      isRecess
                        ? "bg-amber-100/70 dark:bg-amber-950/50 hover:bg-amber-200/60 dark:hover:bg-amber-900/50"
                        : isAmber
                        ? "hover:bg-amber-400/20 active:bg-amber-400/30 text-amber-950 dark:text-amber-100"
                        : "hover:bg-primary/5 active:bg-primary/10 text-foreground",
                      isRunning && "ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30"
                    )}
                    aria-label={`Edit ${period.label || `P${idx + 1}`}`}
                  >
                    {isRunning && (
                      <span className="absolute top-1 right-1.5 size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                    <div className="flex items-center gap-1">
                      {isRecess && <Coffee className="size-3 text-amber-600 dark:text-amber-400 shrink-0" />}
                      <span
                        className={cn(
                          "text-xs font-bold truncate",
                          isRecess ? "text-amber-900 dark:text-amber-200" : isAmber ? "text-amber-950 dark:text-amber-100" : "text-foreground"
                        )}
                      >
                        {period.label || `P${period.period_number}`}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        isAmber ? "text-amber-800/80 dark:text-amber-300/80" : "text-muted-foreground"
                      )}
                    >
                      {duration}m
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Boundaries Row: Time Pills, Ticks, and Circular "+" Buttons */}
            <div className="relative flex items-center justify-between pt-2">
              {periods.map((period, idx) => {
                const isFirst = idx === 0
                const isLast = idx === periods.length - 1

                return (
                  <React.Fragment key={`bound-${period.id || idx}`}>
                    {/* First Boundary (Start of First Period) */}
                    {isFirst && (
                      <div className="flex flex-col items-center gap-1 -translate-x-1/2">
                        <div
                          className={cn(
                            "w-px h-2",
                            isAmber ? "bg-amber-400 dark:bg-amber-600" : "bg-border/80"
                          )}
                        />
                        <BoundaryEditPopover
                          timeStr={period.start_time}
                          boundaryIndex={0}
                          isFirst
                          disabled={readOnly}
                          onSaveTime={(newTime) => onEditBoundaryTime?.(0, newTime, true)}
                        />
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => onInsertPeriodAtBoundary(-1)}
                            className={cn(
                              "size-5 rounded-full flex items-center justify-center transition-colors cursor-pointer shadow-2xs mt-0.5",
                              isAmber
                                ? "bg-amber-500/20 hover:bg-amber-500 text-amber-900 dark:text-amber-100 hover:text-white"
                                : "bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground"
                            )}
                            title="Insert period before first period"
                            aria-label="Insert period before first period"
                          >
                            <Plus className="size-3" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Middle Spacer matching period flex */}
                    <div
                      style={{
                        flexGrow: calculateDuration(period.start_time, period.end_time),
                        minWidth: (period.type === PERIOD_TYPES.RECESS || period.is_break) ? 75 : 95,
                      }}
                    />

                    {/* End Boundary */}
                    <div className="flex flex-col items-center gap-1 translate-x-1/2">
                      <div
                        className={cn(
                          "w-px h-2",
                          isAmber ? "bg-amber-400 dark:bg-amber-600" : "bg-border/80"
                        )}
                      />
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
                          className={cn(
                            "size-5 rounded-full flex items-center justify-center transition-colors cursor-pointer shadow-2xs mt-0.5",
                            isAmber
                              ? "bg-amber-500/20 hover:bg-amber-500 text-amber-900 dark:text-amber-100 hover:text-white"
                              : "bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground"
                          )}
                          title={`Insert period after ${period.label || `P${idx + 1}`}`}
                          aria-label={`Insert period after ${period.label || `P${idx + 1}`}`}
                        >
                          <Plus className="size-3" />
                        </button>
                      )}
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
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
                    ? "bg-amber-500/10 border-amber-300 dark:border-amber-800"
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
                        <Badge variant="outline" className="text-[10px] bg-amber-500/15 border-amber-400">
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
