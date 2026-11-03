import { useState, useMemo, memo } from "react"
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ClassWiseCell } from "./ClassWiseCell"
import { getSubjectTheme } from "../subjectTheme"
import { parseTimetableQuery, cellMatchesHighlight } from "../searchUtils"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
const DAY_LABELS = {
  MONDAY: "MON",
  TUESDAY: "TUE",
  WEDNESDAY: "WED",
  THURSDAY: "THU",
  FRIDAY: "FRI",
  SATURDAY: "SAT",
}

function formatTime12h(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return ""
  const parts = timeStr.split(":")
  if (parts.length < 2) return timeStr
  const [h, m] = parts.map(Number)
  if (isNaN(h)) return timeStr
  const period = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m || 0).padStart(2, "0")} ${period}`
}

function calculateDuration(startTime, endTime) {
  if (!startTime || !endTime || typeof startTime !== "string" || typeof endTime !== "string") return ""
  if (!startTime.includes(":") || !endTime.includes(":")) return ""
  const [h1, m1] = startTime.split(":").map(Number)
  const [h2, m2] = endTime.split(":").map(Number)
  if (isNaN(h1) || isNaN(h2)) return ""
  const diff = h2 * 60 + (m2 || 0) - (h1 * 60 + (m1 || 0))
  return diff > 0 ? `${diff}m` : ""
}

export const ClassWiseCard = memo(function ClassWiseCard({
  section,
  setup,
  entries = [],
  conflictMap = {},
  isAssignMode = false,
  selectedSlot = null,
  copiedSlot = null,
  onSelectSlot,
  onOpenAssignDialog,
  onMoveSlot,
  density = "comfortable",
  zoom = 100,
  searchQuery = "",
  unassignedOnly = false,
  conflictsOnly = false,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Current day and time check
  const now = new Date()
  const todayWeekday = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  // Parsed search query
  const parsedQuery = useMemo(() => parseTimetableQuery(searchQuery), [searchQuery])

  // Setup periods: split weekday vs saturday if schedules exist
  const { weekdayPeriods, saturdayPeriods, hasSaturday } = useMemo(() => {
    if (!setup) {
      return { weekdayPeriods: [], saturdayPeriods: [], hasSaturday: false }
    }
    const appDays = setup.applicable_days || []
    const hasSat = appDays.includes("SATURDAY")

    // Check if separate saturday schedule exists
    const satSched = setup.schedules?.find((s) => s.id === "saturday" || s.days?.includes("SATURDAY"))
    const wkSched = setup.schedules?.find((s) => s.id !== "saturday" && !s.days?.every((d) => d === "SATURDAY"))

    const rawWeekdayPeriods = wkSched?.periods || setup.periods || []
    const rawSaturdayPeriods = satSched?.periods || setup.periods || []

    const sortedWeekday = [...rawWeekdayPeriods].sort((a, b) => a.period_number - b.period_number)
    const sortedSaturday = [...rawSaturdayPeriods].sort((a, b) => a.period_number - b.period_number)

    return {
      weekdayPeriods: sortedWeekday,
      saturdayPeriods: sortedSaturday,
      hasSaturday: hasSat,
    }
  }, [setup])

  // Entry lookup table: key = `${day}_${periodId}` or `${day}_${periodNumber}`
  const entryLookup = useMemo(() => {
    const map = new Map()
    for (const e of entries) {
      if (e.period_id) {
        map.set(`${e.day_of_week}_${e.period_id}`, e)
      }
      if (e.period_number) {
        map.set(`${e.day_of_week}_p${e.period_number}`, e)
      }
    }
    return map
  }, [entries])

  // Aggregate stats
  const teachingPeriodsCount = weekdayPeriods.filter((p) => !p.is_break).length
  const satTeachingCount = saturdayPeriods.filter((p) => !p.is_break).length
  const totalSlotsCount = teachingPeriodsCount * 5 + (hasSaturday ? satTeachingCount : 0)
  const assignedSlotsCount = entries.length
  const unassignedSlotsCount = Math.max(0, totalSlotsCount - assignedSlotsCount)
  const completionPct = totalSlotsCount > 0 ? Math.round((assignedSlotsCount / totalSlotsCount) * 100) : 100

  const handleDragStart = (e, slotData) => {
    if (!isAssignMode || !slotData.entry) return
    e.dataTransfer.setData("application/json", JSON.stringify(slotData))
    e.dataTransfer.effectAllowed = e.altKey ? "copy" : "move"
  }

  const handleDragOver = (e) => {
    if (!isAssignMode) return
    e.preventDefault()
    e.dataTransfer.dropEffect = e.altKey ? "copy" : "move"
  }

  const handleDrop = (e, targetSlot) => {
    if (!isAssignMode) return
    e.preventDefault()
    try {
      const raw = e.dataTransfer.getData("application/json")
      if (!raw) return
      const sourceSlot = JSON.parse(raw)
      const isCopy = e.altKey || false
      onMoveSlot?.(sourceSlot, targetSlot, isCopy)
    } catch (err) {
      console.error("Drop error", err)
    }
  }

  // Standard base cell dimensions (scaled proportionally via zoom container)
  const minCellWidth = 132
  const breakCellWidth = 48

  return (
    <div
      id={`class-section-${section.id}`}
      className={cn(
        "bg-card text-card-foreground rounded-2xl border border-border/80 shadow-xs transition-all overflow-hidden",
        "hover:shadow-sm"
      )}
    >
      {/* CARD HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-muted/20 border-b border-border/60">
        {/* Left: Class Section & Wing Title */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              {section.class_name}
            </span>
            <Badge
              variant="default"
              className="bg-primary/90 text-primary-foreground font-bold px-2 py-0.5 text-xs rounded-md shadow-xs"
            >
              {section.name}
            </Badge>
          </div>

          <Badge
            variant="outline"
            className="text-[11px] font-medium text-muted-foreground border-border/80 hidden sm:inline-flex"
          >
            {section.wing_name || "General Wing"}
          </Badge>
        </div>

        {/* Middle: Subject Targets Comparison Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full sm:max-w-xl py-0.5 scrollbar-none">
          {section.subject_stats?.map((stat) => {
            const theme = getSubjectTheme(stat.name, stat.category)
            const isUnder = stat.assigned < stat.target
            const isOver = stat.assigned > stat.target

            return (
              <span
                key={stat.subject_id}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 transition-colors",
                  theme.chip,
                  isUnder && "ring-1 ring-amber-500/40",
                  isOver && "ring-1 ring-blue-500/40"
                )}
                title={`${stat.name}: ${stat.assigned} assigned / ${stat.target} target weekly periods`}
              >
                <span className={cn("size-1.5 rounded-full", theme.dot)} />
                <span className="font-semibold">{(stat?.name || "Subject").split(" ")[0]}</span>
                <span className="opacity-80">
                  {stat?.assigned || 0}/{stat?.target || 0}
                </span>
              </span>
            )
          })}
        </div>

        {/* Right: Unassigned Chip, Completion, Collapse Button */}
        <div className="flex items-center gap-3">
          {unassignedSlotsCount > 0 ? (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 text-xs font-semibold flex items-center gap-1"
            >
              <AlertTriangle className="size-3 text-amber-600 dark:text-amber-400" />
              Unassigned: {unassignedSlotsCount}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 text-xs font-semibold flex items-center gap-1"
            >
              <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
              Complete
            </Badge>
          )}

          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <span>{assignedSlotsCount}/{totalSlotsCount} Total</span>
            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={isCollapsed ? "Expand class timetable" : "Collapse class timetable"}
          >
            {isCollapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </Button>
        </div>
      </div>

      {/* CARD BODY: Timetable Grid */}
      {!isCollapsed && (
        <div className="relative overflow-x-auto scrollbar-thin">
          <div
            className="min-w-fit p-3 origin-top-left transition-transform duration-150"
            style={{
              zoom: zoom / 100,
            }}
          >
            {/* WEEKDAY TIME HEADER (Rendered cleanly once per schedule) */}
            <div className="flex items-center mb-1.5 pb-1 border-b border-border/50 text-muted-foreground">
              {/* Sticky day header placeholder */}
              <div className="w-16 sm:w-20 shrink-0 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80 pl-2">
                Day
              </div>

              {/* Periods Time Header */}
              <div className="flex items-center gap-1.5">
                {weekdayPeriods.map((period) => {
                  const isBreak = Boolean(period.is_break)
                  const startFmt = formatTime12h(period.start_time)
                  const duration = calculateDuration(period.start_time, period.end_time)

                  if (isBreak) {
                    return (
                      <div
                        key={period.id || period.period_number}
                        style={{ width: `${breakCellWidth}px` }}
                        className="flex flex-col items-center justify-center shrink-0 text-center py-1 bg-muted/40 dark:bg-muted/20 rounded-md border border-border/40"
                      >
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 tracking-wider">
                          {period.label || "BREAK"}
                        </span>
                        <span className="text-[9px] text-muted-foreground">{duration}</span>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={period.id || period.period_number}
                      style={{ width: `${minCellWidth}px` }}
                      className="flex items-center justify-between px-2.5 py-1 bg-muted/30 dark:bg-muted/15 rounded-md border border-border/40 shrink-0 text-xs"
                    >
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-foreground">
                          {period.label || `P${period.period_number}`}
                        </span>
                        <span className="text-[10px] text-muted-foreground/80 font-normal">
                          {startFmt}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {duration}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* WEEKDAYS ROWS (Mon - Fri) */}
            <div className="space-y-1.5">
              {WEEKDAYS.map((day) => {
                const isToday = day === todayWeekday

                return (
                  <div key={day} className="flex items-center gap-1.5">
                    {/* Sticky Day Label */}
                    <div
                      className={cn(
                        "w-16 sm:w-20 shrink-0 flex items-center justify-center rounded-lg border font-bold text-xs py-2 transition-colors",
                        isToday
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted/30 dark:bg-muted/10 text-foreground/80 border-border/60"
                      )}
                    >
                      {DAY_LABELS[day]}
                    </div>

                    {/* Period Cells */}
                    <div className="flex items-center gap-1.5">
                      {weekdayPeriods.map((period) => {
                        const entry =
                          entryLookup.get(`${day}_${period.id}`) ||
                          entryLookup.get(`${day}_p${period.period_number}`) ||
                          null

                        const isBreak = Boolean(period.is_break)
                        const conflictInfo = entry ? conflictMap[entry.id] : null
                        const slotKey = `${section.id}_${day}_${period.id || period.period_number}`
                        const isSelected = selectedSlot === slotKey
                        const isCopied = copiedSlot?.entry?.id === entry?.id

                        // Current period calculation
                        let isCurrentPeriod = false
                        if (isToday && !isBreak && period.start_time && period.end_time) {
                          const [sh, sm] = period.start_time.split(":").map(Number)
                          const [eh, em] = period.end_time.split(":").map(Number)
                          const startM = sh * 60 + sm
                          const endM = eh * 60 + em
                          if (currentMinutes >= startM && currentMinutes <= endM) {
                            isCurrentPeriod = true
                          }
                        }

                        // Search highlights
                        const { isHighlighted: isSearchHighlighted, isDimmed: isSearchDimmed } =
                          cellMatchesHighlight(entry, parsedQuery)
                        let isHighlighted = isSearchHighlighted
                        let isDimmed = isSearchDimmed

                        if (unassignedOnly) {
                          if (entry) isDimmed = true
                          else isHighlighted = true
                        }
                        if (conflictsOnly) {
                          if (conflictInfo) isHighlighted = true
                          else isDimmed = true
                        }

                        return (
                          <div
                            key={period.id || period.period_number}
                            style={{
                              width: isBreak ? `${breakCellWidth}px` : `${minCellWidth}px`,
                            }}
                            className="shrink-0"
                          >
                            <ClassWiseCell
                              entry={entry}
                              day={day}
                              period={period}
                              section={section}
                              isAssignMode={isAssignMode}
                              isSelected={isSelected}
                              isCopied={isCopied}
                              conflictInfo={conflictInfo}
                              isHighlighted={isHighlighted}
                              isDimmed={isDimmed}
                              density={density}
                              isToday={isToday}
                              isCurrentPeriod={isCurrentPeriod}
                              onClick={() => {
                                onSelectSlot?.(slotKey)
                                if (isAssignMode) {
                                  onOpenAssignDialog?.({
                                    section,
                                    day,
                                    period,
                                    currentEntry: entry,
                                  })
                                }
                              }}
                              onDoubleClick={() => {
                                onOpenAssignDialog?.({
                                  section,
                                  day,
                                  period,
                                  currentEntry: entry,
                                })
                              }}
                              draggable={Boolean(entry)}
                              onDragStart={(e) =>
                                handleDragStart(e, {
                                  section,
                                  day,
                                  period,
                                  entry,
                                })
                              }
                              onDragOver={handleDragOver}
                              onDrop={(e) =>
                                handleDrop(e, {
                                  section,
                                  day,
                                  period,
                                  entry,
                                })
                              }
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* SATURDAY SCHEDULE (Separated row group with its own bell schedule header) */}
            {hasSaturday && (
              <div className="mt-3 pt-2.5 border-t-2 border-dashed border-border/80">
                {/* Saturday Time Header */}
                <div className="flex items-center mb-1.5 pb-1 border-b border-amber-300/40 text-amber-900 dark:text-amber-200">
                  <div className="w-16 sm:w-20 shrink-0 font-bold text-[11px] uppercase tracking-wider text-amber-800 dark:text-amber-400 pl-2">
                    Sat Bell
                  </div>

                  <div className="flex items-center gap-1.5">
                    {saturdayPeriods.map((period) => {
                      const isBreak = Boolean(period.is_break)
                      const startFmt = formatTime12h(period.start_time)
                      const duration = calculateDuration(period.start_time, period.end_time)

                      if (isBreak) {
                        return (
                          <div
                            key={period.id || period.period_number}
                            style={{ width: `${breakCellWidth}px` }}
                            className="flex flex-col items-center justify-center shrink-0 text-center py-1 bg-amber-100/60 dark:bg-amber-950/40 rounded-md border border-amber-300/50"
                          >
                            <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">
                              {period.label || "BREAK"}
                            </span>
                            <span className="text-[9px] text-amber-700/80 dark:text-amber-400">
                              {duration}
                            </span>
                          </div>
                        )
                      }

                      return (
                        <div
                          key={period.id || period.period_number}
                          style={{ width: `${minCellWidth}px` }}
                          className="flex items-center justify-between px-2.5 py-1 bg-amber-50/80 dark:bg-amber-950/30 rounded-md border border-amber-300/40 shrink-0 text-xs"
                        >
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-amber-900 dark:text-amber-200">
                              {period.label || `P${period.period_number}`}
                            </span>
                            <span className="text-[10px] text-amber-800/80 dark:text-amber-400">
                              {startFmt}
                            </span>
                          </div>
                          <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                            {duration}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Saturday Row */}
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "w-16 sm:w-20 shrink-0 flex items-center justify-center rounded-lg border font-bold text-xs py-2 transition-colors",
                      todayWeekday === "SATURDAY"
                        ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                        : "bg-amber-100/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 border-amber-300/50"
                    )}
                  >
                    SAT
                  </div>

                  <div className="flex items-center gap-1.5">
                    {saturdayPeriods.map((period) => {
                      const entry =
                        entryLookup.get(`SATURDAY_${period.id}`) ||
                        entryLookup.get(`SATURDAY_p${period.period_number}`) ||
                        null

                      const isBreak = Boolean(period.is_break)
                      const conflictInfo = entry ? conflictMap[entry.id] : null
                      const slotKey = `${section.id}_SATURDAY_${period.id || period.period_number}`
                      const isSelected = selectedSlot === slotKey
                      const isCopied = copiedSlot?.entry?.id === entry?.id

                      return (
                        <div
                          key={period.id || period.period_number}
                          style={{
                            width: isBreak ? `${breakCellWidth}px` : `${minCellWidth}px`,
                          }}
                          className="shrink-0"
                        >
                          <ClassWiseCell
                            entry={entry}
                            day="SATURDAY"
                            period={period}
                            section={section}
                            isAssignMode={isAssignMode}
                            isSelected={isSelected}
                            isCopied={isCopied}
                            conflictInfo={conflictInfo}
                            density={density}
                            isToday={todayWeekday === "SATURDAY"}
                            onClick={() => {
                              onSelectSlot?.(slotKey)
                              if (isAssignMode) {
                                onOpenAssignDialog?.({
                                  section,
                                  day: "SATURDAY",
                                  period,
                                  currentEntry: entry,
                                })
                              }
                            }}
                            onDoubleClick={() => {
                              onOpenAssignDialog?.({
                                section,
                                day: "SATURDAY",
                                period,
                                currentEntry: entry,
                              })
                            }}
                            draggable={Boolean(entry)}
                            onDragStart={(e) =>
                              handleDragStart(e, {
                                section,
                                day: "SATURDAY",
                                period,
                                entry,
                              })
                            }
                            onDragOver={handleDragOver}
                            onDrop={(e) =>
                              handleDrop(e, {
                                section,
                                day: "SATURDAY",
                                period,
                                entry,
                              })
                            }
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
})
