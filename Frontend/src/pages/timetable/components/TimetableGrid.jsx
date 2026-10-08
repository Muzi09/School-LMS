import React, { useState, useMemo, useEffect } from "react"
import {
  Clock,
  CalendarDays,
  Calendar,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  Sparkles,
} from "lucide-react"
import { TimetableCell } from "./TimetableCell"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const DAYS = [
  { key: "MONDAY", label: "Monday", short: "Mon" },
  { key: "TUESDAY", label: "Tuesday", short: "Tue" },
  { key: "WEDNESDAY", label: "Wednesday", short: "Wed" },
  { key: "THURSDAY", label: "Thursday", short: "Thu" },
  { key: "FRIDAY", label: "Friday", short: "Fri" },
  { key: "SATURDAY", label: "Saturday", short: "Sat" },
]

// Determine today's day key (Mon-Sat), fallback to Monday
const getTodayKey = () => {
  const dayIndex = new Date().getDay() // 0 = Sun, 1 = Mon ... 6 = Sat
  if (dayIndex >= 1 && dayIndex <= 6) {
    return DAYS[dayIndex - 1].key
  }
  return "MONDAY"
}

export function TimetableGrid({
  periods = [],
  entries = [],
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  canManage = false,
}) {
  // Determine initial view mode: 'day' for screens < 1024px, 'week' for wide desktop
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      return "day"
    }
    return "week"
  })

  // Selected day for the responsive Day View
  const [activeDay, setActiveDay] = useState(getTodayKey)

  // Listen to window resize to suggest/default day mode on small screens
  useEffect(() => {
    const handleResize = () => {
      // If screen is resized very small, auto-switch to Day view if currently in week view
      if (window.innerWidth < 768 && viewMode === "week") {
        setViewMode("day")
      }
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [viewMode])

  // Index entries by `day_of_week` and `period_id` for O(1) lookup
  const entryMap = useMemo(() => {
    const map = new Map()
    for (const e of entries) {
      const key = `${e.day_of_week}_${e.period_id}`
      map.set(key, e)
    }
    return map
  }, [entries])

  // Count scheduled entries per day for badges
  const dayStats = useMemo(() => {
    const stats = {}
    for (const day of DAYS) {
      let count = 0
      for (const p of periods) {
        if (entryMap.has(`${day.key}_${p.id}`)) {
          count++
        }
      }
      stats[day.key] = count
    }
    return stats
  }, [periods, entryMap])

  if (periods.length === 0) {
    return null
  }

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

  return (
    <div className="w-full bg-card rounded-2xl border border-border shadow-xs overflow-hidden flex flex-col">
      {/* View Mode & Day Navigation Bar */}
      <div className="p-3 sm:p-4 border-b border-border/80 bg-muted/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Left: View Mode Toggle */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/60 self-start">
          <button
            type="button"
            onClick={() => setViewMode("day")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              viewMode === "day"
                ? "bg-background text-foreground shadow-xs border border-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-background/40"
            )}
          >
            <Calendar className="size-3.5" />
            <span>Day Schedule</span>
            <span className="text-[10px] py-0.2 px-1.5 rounded-full bg-primary/10 text-primary font-bold hidden sm:inline-block">
              Mobile Friendly
            </span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("week")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              viewMode === "week"
                ? "bg-background text-foreground shadow-xs border border-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-background/40"
            )}
          >
            <LayoutGrid className="size-3.5" />
            <span>Week Matrix</span>
          </button>
        </div>

        {/* Right: Day Prev/Next Controls when in Day View */}
        {viewMode === "day" && (
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevDay}
                className="h-8 px-2 rounded-lg text-xs"
                title="Previous Day"
                aria-label="Previous Day"
              >
                <ChevronLeft className="size-4" />
                <span className="hidden md:inline">Prev</span>
              </Button>
              <span className="text-xs font-bold text-foreground px-2 py-1 bg-muted/40 rounded-lg border border-border/40 whitespace-nowrap">
                {currentDayObj.label}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextDay}
                className="h-8 px-2 rounded-lg text-xs"
                title="Next Day"
                aria-label="Next Day"
              >
                <span className="hidden md:inline">Next</span>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ===================== DAY VIEW (PERFECTLY RESPONSIVE, ZERO HORIZONTAL SCROLL) ===================== */}
      {viewMode === "day" && (
        <div className="p-3 sm:p-5 space-y-4">
          {/* Day Pills Selector Bar */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2">
            {DAYS.map((day) => {
              const isActive = day.key === activeDay
              const count = dayStats[day.key] || 0
              const isToday = day.key === todayKey

              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => setActiveDay(day.key)}
                  className={cn(
                    "relative flex flex-col items-center justify-center py-2 sm:py-2.5 px-1.5 sm:px-2 rounded-xl border transition-all text-center cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20"
                      : "bg-background hover:bg-muted/60 text-foreground border-border/80"
                  )}
                >
                  {isToday && (
                    <span
                      className={cn(
                        "absolute -top-1.5 right-1.5 text-[9px] font-bold px-1 rounded-full",
                        isActive
                          ? "bg-primary-foreground text-primary"
                          : "bg-primary text-primary-foreground"
                      )}
                    >
                      Today
                    </span>
                  )}
                  <span className="text-xs sm:text-sm font-bold truncate">
                    <span className="sm:hidden">{day.short}</span>
                    <span className="hidden sm:inline">{day.label}</span>
                  </span>
                  <div
                    className={cn(
                      "mt-1 text-[10px] font-semibold px-1.5 py-0.2 rounded-full",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count} / {periods.length}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Active Day Header Banner */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                {currentDayObj.short}
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  {currentDayObj.label} Schedule
                </h3>
                <p className="text-xs text-muted-foreground">
                  {dayStats[activeDay] || 0} of {periods.length} periods assigned
                </p>
              </div>
            </div>

            {canManage && (
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                Click any slot card to edit or assign subjects
              </span>
            )}
          </div>

          {/* Periods Cards List - 100% Responsive Grid with zero horizontal scroll */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {periods.map((period) => {
              const entryKey = `${activeDay}_${period.id}`
              const entry = entryMap.get(entryKey) || null
              const isOccupied = Boolean(entry)
              const subjectName = entry?.subject?.name || "Subject"
              const teacherName = entry?.teacher?.name || "Unassigned"
              const hasTeacher = Boolean(entry?.teacher?.name)

              if (isOccupied) {
                return (
                  <div
                    key={period.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onEditEntry(entry, activeDay, period)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        onEditEntry(entry, activeDay, period)
                      }
                    }}
                    className="group relative flex flex-col justify-between p-4 rounded-xl border border-border/80 bg-card hover:bg-accent/30 hover:border-primary/40 shadow-xs transition-all duration-150 cursor-pointer text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {/* Period Header */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-bold">
                          Period {period.period_number}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3.5 text-muted-foreground/70" />
                          <span>
                            {period.start_time} - {period.end_time}
                          </span>
                        </div>
                      </div>

                      {/* Subject Name */}
                      <div className="text-base font-bold text-foreground group-hover:text-primary transition-colors tracking-tight line-clamp-2">
                        {subjectName}
                      </div>

                      {/* Teacher Row */}
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <UserIcon className="size-3.5 shrink-0 opacity-70" />
                        <span
                          className={cn(
                            "font-medium truncate",
                            !hasTeacher && "italic text-muted-foreground/60"
                          )}
                        >
                          {teacherName}
                        </span>
                      </div>
                    </div>

                    {/* Manage Buttons */}
                    {canManage && (
                      <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditEntry(entry, activeDay, period)
                          }}
                          className="h-7 px-2.5 rounded-md text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Pencil className="size-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteEntry?.(entry)
                          }}
                          className="h-7 px-2.5 rounded-md text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="size-3" />
                          <span>Remove</span>
                        </button>
                      </div>
                    )}
                  </div>
                )
              }

              // Empty slot card
              return (
                <div
                  key={period.id}
                  className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/10 flex flex-col justify-between text-left"
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground text-xs font-semibold">
                      Period {period.period_number}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3.5 text-muted-foreground/70" />
                      <span>
                        {period.start_time} - {period.end_time}
                      </span>
                    </div>
                  </div>

                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => onAddEntry(activeDay, period)}
                      className="mt-2 w-full py-3 rounded-lg border border-dashed border-border/70 hover:border-primary/50 bg-background/50 hover:bg-primary/5 text-muted-foreground hover:text-primary flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer"
                    >
                      <Plus className="size-4" />
                      <span>Assign Subject</span>
                    </button>
                  ) : (
                    <div className="mt-2 py-3 text-center text-xs text-muted-foreground/50 select-none">
                      No Class Scheduled
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ===================== WEEKLY MATRIX VIEW (FLUID TABLE FOR DESKTOP) ===================== */}
      {viewMode === "week" && (
        <div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full border-collapse text-left">
              {/* Table Header: Period times on X-Axis */}
              <thead>
                <tr className="border-b border-border/80 bg-muted/40">
                  {/* Sticky Day Column Header */}
                  <th className="sticky left-0 z-20 bg-muted/95 backdrop-blur-xs py-3 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider w-24 sm:w-28 border-r border-border/60 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <CalendarDays className="size-3.5 text-muted-foreground" />
                      <span>Day</span>
                    </div>
                  </th>

                  {/* Period Headers (X-Axis) */}
                  {periods.map((period) => (
                    <th
                      key={period.id}
                      className="py-2.5 px-2 sm:px-3 text-center text-xs font-bold border-r border-border/40 last:border-r-0 min-w-[120px] sm:min-w-[140px]"
                    >
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <div className="flex items-center justify-center gap-1">
                          <span className="inline-flex items-center justify-center size-5 rounded-md bg-primary/10 text-primary font-bold text-[10px]">
                            P{period.period_number}
                          </span>
                          <span className="text-xs font-bold text-foreground whitespace-nowrap">
                            Period {period.period_number}
                          </span>
                        </div>
                        <div className="flex items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground tracking-tight whitespace-nowrap">
                          <Clock className="size-2.5 text-muted-foreground/70" />
                          <span>
                            {period.start_time} - {period.end_time}
                          </span>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Table Body: 1 Row per Day (Y-Axis) */}
              <tbody className="divide-y divide-border/60">
                {DAYS.map((day) => (
                  <tr key={day.key} className="hover:bg-muted/10 transition-colors">
                    {/* Day Row Header (Sticky Left Y-Axis) */}
                    <td className="sticky left-0 z-10 bg-card py-2.5 px-2 border-r border-border/60 shadow-xs align-middle text-center">
                      <div className="flex flex-col items-center justify-center text-center gap-0.5">
                        <span className="text-xs sm:text-sm font-bold text-foreground whitespace-nowrap">
                          {day.label}
                        </span>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {day.short}
                        </span>
                      </div>
                    </td>

                    {/* Period Cells */}
                    {periods.map((period) => {
                      const entryKey = `${day.key}_${period.id}`
                      const entry = entryMap.get(entryKey) || null

                      return (
                        <td
                          key={period.id}
                          className="p-1.5 sm:p-2 border-r border-border/40 last:border-r-0 align-top"
                        >
                          <TimetableCell
                            entry={entry}
                            day={day.key}
                            period={period}
                            onAdd={onAddEntry}
                            onEdit={onEditEntry}
                            onDelete={onDeleteEntry}
                            canManage={canManage}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default TimetableGrid
