import React, { useState, useMemo, useEffect } from "react"
import {
  Clock,
  Calendar,
  CalendarDays,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DAYS,
  getTodayKey,
  timeStringToMinutes,
  minutesToTimeString,
  getTimelineBounds,
} from "../timetableUtils"
import { TimelineBlock } from "./TimelineBlock"

export function TimelineScheduleGrid({
  periods = [],
  entries = [],
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  canManage = false,
  showClass = false,
  emptyMessage = "No scheduled lessons for this day.",
}) {
  const [activeDay, setActiveDay] = useState(getTodayKey)
  const [layoutMode, setLayoutMode] = useState("week") // 'week' | 'day'

  // Current time tracker for "NOW" line
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(() => {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes()
  })

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date()
      setCurrentTimeMinutes(d.getHours() * 60 + d.getMinutes())
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  const bounds = useMemo(() => getTimelineBounds(periods), [periods])
  const { startMinutes, totalMinutes, timeMarkers } = bounds

  // Maximum width for the space between each time marker (each 60 mins is capped at 220px)
  const trackWidthPx = useMemo(() => {
    const HOUR_MAX_WIDTH = 220
    const hours = Math.max(1, totalMinutes / 60)
    return Math.round(hours * HOUR_MAX_WIDTH)
  }, [totalMinutes])

  // Group entries by day
  const entriesByDay = useMemo(() => {
    const map = new Map()
    for (const d of DAYS) {
      map.set(d.key, [])
    }
    for (const e of entries) {
      const day = e.day_of_week
      if (map.has(day)) {
        map.get(day).push(e)
      }
    }
    return map
  }, [entries])

  // Count scheduled entries per day
  const dayStats = useMemo(() => {
    const stats = {}
    for (const d of DAYS) {
      stats[d.key] = entriesByDay.get(d.key)?.length || 0
    }
    return stats
  }, [entriesByDay])

  const todayKey = getTodayKey()
  const activeDayIndex = DAYS.findIndex((d) => d.key === activeDay)
  const currentDayObj = DAYS[activeDayIndex] || DAYS[0]

  const handlePrevDay = () => {
    const prevIndex = (activeDayIndex - 1 + DAYS.length) % DAYS.length
    setActiveDay(DAYS[prevIndex].key)
  }

  const handleNextDay = () => {
    const nextIndex = (activeDayIndex + 1) % DAYS.length
    setActiveDay(DAYS[nextIndex].key)
  }

  // Calculate current time position percent
  const nowPercent = useMemo(() => {
    if (currentTimeMinutes < startMinutes || currentTimeMinutes > startMinutes + totalMinutes) {
      return null
    }
    return ((currentTimeMinutes - startMinutes) / totalMinutes) * 100
  }, [currentTimeMinutes, startMinutes, totalMinutes])

  if (periods.length === 0) {
    return null
  }

  // Helper to render timeline row for a day
  const renderDayTimeline = (dayKey, dayLabel, isWeekly = true) => {
    const dayEntries = entriesByDay.get(dayKey) || []
    const isToday = dayKey === todayKey

    // Identify occupied periods
    const occupiedPeriodIds = new Set(dayEntries.map((e) => e.period_id))

    return (
      <div
        key={dayKey}
        className={cn(
          "relative flex border-b border-border/60 hover:bg-muted/10 transition-colors",
          isToday && "bg-primary/2"
        )}
      >
        {/* Left Sticky Day Header (when in weekly mode) */}
        {isWeekly && (
          <div className="sticky left-0 z-20 w-32 sm:w-36 shrink-0 p-3 bg-card border-r border-border/70 flex flex-col items-center justify-center text-center shadow-xs">
            <span
              className={cn(
                "text-xs sm:text-sm font-bold tracking-tight",
                isToday ? "text-primary" : "text-foreground"
              )}
            >
              {dayLabel}
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              {isToday && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-primary/10 text-primary">
                  Today
                </span>
              )}
              <span className="text-[10px] text-muted-foreground font-medium">
                {dayEntries.length}/{periods.length}
              </span>
            </div>
          </div>
        )}

        {/* Timeline Track */}
        <div
          className="relative shrink-0 py-1.5 px-3 min-h-[92px] sm:min-h-[100px] border-r border-border/30"
          style={{ width: `${trackWidthPx}px` }}
        >
          <div className="relative w-full h-full">
            {/* Background Grid Lines for Time Markers */}
            <div className="absolute inset-0 pointer-events-none flex">
              {timeMarkers.map((marker, i) => {
                const markerPct = ((marker - startMinutes) / totalMinutes) * 100
                if (i === 0 || markerPct === 0) return null
                return (
                  <div
                    key={marker}
                    className="absolute top-0 bottom-0 border-r border-dashed border-border/40"
                    style={{ left: `${markerPct}%` }}
                  />
                )
              })}
            </div>

            {/* Current Time Indicator Line (if today) */}
            {isToday && nowPercent !== null && (
              <div
                className="absolute top-0 bottom-0 z-25 pointer-events-none flex flex-col items-center"
                style={{ left: `${nowPercent}%` }}
              >
                <div className="h-full w-[2px] bg-red-500 shadow-xs" />
                <div className="absolute top-0 -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.2 rounded-full bg-red-500 text-white font-bold text-[8px] uppercase tracking-wider shadow-xs">
                  Now
                </div>
              </div>
            )}

            {/* Render Period Slots (Empty or Gaps) */}
            {periods.map((period) => {
              const isOccupied = occupiedPeriodIds.has(period.id)
              if (isOccupied) return null // Handled by entries

              const pStart = timeStringToMinutes(period.start_time)
              const pEnd = timeStringToMinutes(period.end_time)
              const left = Math.max(0, ((pStart - startMinutes) / totalMinutes) * 100)
              const width = Math.max(2, ((pEnd - pStart) / totalMinutes) * 100)

              return (
                <div
                  key={period.id}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                  }}
                  className="absolute top-1 bottom-1 p-1.5 rounded-xl border border-dashed border-border/50 bg-muted/15 flex flex-col justify-between group hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                    <span className="font-semibold text-muted-foreground/90">
                      P{period.period_number}
                    </span>
                    <span className="text-[9px]">
                      {period.start_time} - {period.end_time}
                    </span>
                  </div>

                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => onAddEntry?.(dayKey, period)}
                      className="w-full py-1 rounded-md text-[10px] font-semibold text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="size-3" />
                      <span>Assign</span>
                    </button>
                  ) : (
                    <div className="text-[10px] text-center text-muted-foreground/40 italic">
                      Free
                    </div>
                  )}
                </div>
              )
            })}

            {/* Render Scheduled Lessons */}
            {dayEntries.map((entry) => {
              const p = periods.find((x) => x.id === entry.period_id)
              const startTime = entry.start_time || p?.start_time || "08:00"
              const endTime = entry.end_time || p?.end_time || "08:45"

              const eStart = timeStringToMinutes(startTime)
              const eEnd = timeStringToMinutes(endTime)
              const left = Math.max(0, ((eStart - startMinutes) / totalMinutes) * 100)
              const width = Math.max(4, ((eEnd - eStart) / totalMinutes) * 100)

              const fullEntry = {
                ...entry,
                start_time: startTime,
                end_time: endTime,
                period_number: entry.period_number || p?.period_number || 0,
              }

              return (
                <TimelineBlock
                  key={entry.id}
                  entry={fullEntry}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                  }}
                  onEdit={onEditEntry}
                  onDelete={onDeleteEntry}
                  canManage={canManage}
                  showClass={showClass}
                />
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full bg-card rounded-2xl border border-border shadow-xs overflow-hidden flex flex-col">
      {/* Top Bar: Layout switcher & Day Selector */}
      <div className="p-3 sm:p-4 border-b border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: View Mode Toggle */}
        <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/60 self-start">
          <button
            type="button"
            onClick={() => setLayoutMode("week")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              layoutMode === "week"
                ? "bg-background text-foreground shadow-xs border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CalendarDays className="size-3.5" />
            <span>Weekly Timeline</span>
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode("day")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              layoutMode === "day"
                ? "bg-background text-foreground shadow-xs border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Calendar className="size-3.5" />
            <span>Day View</span>
          </button>
        </div>

        {/* Right: Day Selector if in Single Day Mode */}
        {layoutMode === "day" && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevDay}
                className="h-8 w-8 rounded-lg border border-border/70 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleNextDay}
                className="h-8 w-8 rounded-lg border border-border/70 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Next Day"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/60 overflow-x-auto">
              {DAYS.map((d) => {
                const isActive = d.key === activeDay
                const isToday = d.key === todayKey
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setActiveDay(d.key)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                      isToday && !isActive && "text-primary font-bold"
                    )}
                  >
                    <span>{d.short}</span>
                    <span className="ml-1 text-[10px] opacity-75">
                      ({dayStats[d.key] || 0})
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Timeline Scrollable Container */}
      <div className="overflow-x-auto scrollbar-thin">
        {/* Sticky Horizontal Time Axis Header */}
        <div className="sticky top-0 z-30 flex bg-muted/80 backdrop-blur-md border-b border-border/80">
          {/* Corner cell */}
          {layoutMode === "week" && (
            <div className="sticky left-0 z-40 w-32 sm:w-36 shrink-0 p-3 bg-muted/95 border-r border-border/70 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Day
            </div>
          )}

          {/* Time scale axis */}
          <div
            className="relative shrink-0 h-9 px-3 border-r border-border/40"
            style={{ width: `${trackWidthPx}px` }}
          >
            <div className="relative w-full h-full">
              {timeMarkers.map((marker, idx) => {
                const pct = ((marker - startMinutes) / totalMinutes) * 100
                const label = minutesToTimeString(marker)
                const isFirst = idx === 0 || pct === 0
                const isLast = idx === timeMarkers.length - 1 || pct >= 100
                return (
                  <div
                    key={marker}
                    className={cn(
                      "absolute top-0 bottom-0 flex flex-col justify-center",
                      isFirst
                        ? "translate-x-0 items-start pl-0.5"
                        : isLast
                        ? "-translate-x-full items-end pr-0.5"
                        : "-translate-x-1/2 items-center"
                    )}
                    style={{ left: `${pct}%` }}
                  >
                    <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground whitespace-nowrap">
                      {label}
                    </span>
                    <div
                      className={cn(
                        "h-1.5 w-[1px] bg-border mt-0.5",
                        isFirst ? "ml-1" : isLast ? "mr-1" : "mx-auto"
                      )}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Timeline Rows */}
        {layoutMode === "week" ? (
          <div className="divide-y divide-border/60">
            {DAYS.map((day) => renderDayTimeline(day.key, day.label, true))}
          </div>
        ) : (
          <div className="p-3 sm:p-5">
            <div className="rounded-xl border border-border/80 bg-background overflow-hidden shadow-xs">
              {renderDayTimeline(activeDay, currentDayObj.label, false)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TimelineScheduleGrid
