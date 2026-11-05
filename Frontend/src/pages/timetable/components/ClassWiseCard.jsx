import React, { useMemo, memo, Fragment } from "react"
import {
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

function formatPeriodShortLabel(period) {
  if (!period) return ""
  if (period.is_break) return period.label || "BREAK"
  if (period.period_number != null) {
    return `P${period.period_number}`
  }
  if (typeof period.label === "string") {
    const match = period.label.match(/\d+/)
    if (match) return `P${match[0]}`
    return period.label
  }
  return "P"
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
  // Current day and time check
  const now = new Date()
  const todayWeekday = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  // Parsed search query
  const parsedQuery = useMemo(() => parseTimetableQuery(searchQuery), [searchQuery])

  // Setup schedules & period groups (supports arbitrary day schedule splits)
  const { scheduleGroups, weekdayPeriods, saturdayPeriods, hasSaturday, totalSlotsCount } = useMemo(() => {
    if (!setup) {
      return { scheduleGroups: [], weekdayPeriods: [], saturdayPeriods: [], hasSaturday: false, totalSlotsCount: 0 }
    }
    const appDays = setup.applicable_days || ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
    const hasSat = appDays.includes("SATURDAY")

    let groups = []
    if (setup.schedules && setup.schedules.length > 0) {
      groups = setup.schedules.map((sch) => {
        const daysInSched = (sch.days || []).filter((d) => appDays.includes(d))
        const periods = [...(sch.periods || [])].sort((a, b) => a.period_number - b.period_number)
        const isAmber = sch.id === "saturday" || sch.days?.includes("SATURDAY") || sch.days?.length === 1
        return {
          id: sch.id,
          days: daysInSched,
          periods,
          isAmber,
          gridTemplate: `minmax(56px, 64px) repeat(${periods.length}, minmax(130px, 1fr)) 48px`,
        }
      }).filter((g) => g.days.length > 0)
    }

    if (groups.length === 0) {
      // Fallback
      const satSched = setup.schedules?.find((s) => s.id === "saturday" || s.days?.includes("SATURDAY"))
      const wkSched = setup.schedules?.find((s) => s.id !== "saturday" && !s.days?.every((d) => d === "SATURDAY"))
      const rawWeekdayPeriods = wkSched?.periods || setup.periods || []
      const rawSaturdayPeriods = satSched?.periods || setup.periods || []
      const sortedWeekday = [...rawWeekdayPeriods].sort((a, b) => a.period_number - b.period_number)
      const sortedSaturday = [...rawSaturdayPeriods].sort((a, b) => a.period_number - b.period_number)

      groups = [
        {
          id: "weekdays",
          days: appDays.filter((d) => d !== "SATURDAY"),
          periods: sortedWeekday,
          isAmber: false,
          gridTemplate: `minmax(56px, 64px) repeat(${sortedWeekday.length}, minmax(130px, 1fr)) 48px`,
        },
      ]
      if (hasSat) {
        groups.push({
          id: "saturday",
          days: ["SATURDAY"],
          periods: sortedSaturday,
          isAmber: true,
          gridTemplate: `minmax(56px, 64px) repeat(${sortedSaturday.length}, minmax(130px, 1fr)) 48px`,
        })
      }
    }

    const wkGroup = groups.find((g) => !g.isAmber) || groups[0]
    const satGroup = groups.find((g) => g.days.includes("SATURDAY"))

    let totalSlots = 0
    groups.forEach((g) => {
      const teachingCount = g.periods.filter((p) => !p.is_break).length
      totalSlots += teachingCount * g.days.length
    })

    return {
      scheduleGroups: groups,
      weekdayPeriods: wkGroup?.periods || [],
      saturdayPeriods: satGroup?.periods || [],
      hasSaturday: hasSat,
      totalSlotsCount: totalSlots,
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
  const minCellWidth = 130

  // Rigid CSS Grid column tracks guaranteeing 100% pixel-perfect alignment across all rows
  const weekdayGridTemplate = `minmax(56px, 64px) repeat(${weekdayPeriods.length}, minmax(130px, 1fr)) 48px`
  const saturdayGridTemplate = `minmax(56px, 64px) repeat(${saturdayPeriods.length}, minmax(130px, 1fr)) 48px`

  return (
    <div
      id={`class-section-${section.id}`}
      className={cn(
        "bg-card text-card-foreground rounded-2xl border border-primary/25 shadow-xs transition-all overflow-hidden scroll-mt-32 sm:scroll-mt-36",
        "hover:shadow-sm"
      )}
    >
      {/* CARD HEADER */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 bg-muted/20 border-b border-border/60">
        {/* Left: Class Section & Wing Title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              {section.class_name}
            </span>
            <Badge
              variant="outlined"
              className="bg-primary/90 text-primary-foreground font-bold px-2 py-0.5 text-xs rounded-md shadow-xs"
            >
              {section.name}
            </Badge>
          </div>
        </div>

        {/* Right: Subjects Targets Strip (Right-aligned, expands to take available width) */}
        <div className="flex-1 min-w-0 flex items-center justify-end gap-1.5 overflow-x-auto py-0.5 ml-auto scrollbar-none">
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

          {/* Completion Progress Bar */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground font-medium ml-2 shrink-0 border-l border-border/60 pl-3">
            <span>{assignedSlotsCount}/{totalSlotsCount}</span>
            <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* CARD BODY: Timetable Grid */}
      <div className="relative overflow-x-auto scrollbar-thin">
        <div
          className="w-max min-w-full origin-top-left transition-transform duration-150"
          style={{
            zoom: zoom / 100,
          }}
        >
          {/* Render Schedule Groups (Weekdays, Split Days, Saturday) */}
          {scheduleGroups.map((group, gIdx) => {
            return (
              <React.Fragment key={group.id || gIdx}>
                {/* BELL SCHEDULE TIME HEADER FOR THIS GROUP */}
                <div
                  className={cn(
                    "w-full bg-primary/5 dark:bg-primary/10",
                    gIdx > 0 && "border-t border-border/70"
                  )}
                  style={{
                    display: "grid",
                    gridTemplateColumns: group.gridTemplate,
                  }}
                >
                  {/* First Column First Row: Empty cell */}
                  <div
                    className="w-full h-10 border-r border-b border-border/70 bg-primary/5 dark:bg-primary/10"
                  />

                  {/* Period Columns Header */}
                  {group.periods.map((period, index) => {
                    const isBreak = Boolean(period.is_break)
                    const startFmt = formatTime12h(period.start_time)
                    const endFmt = formatTime12h(period.end_time)
                    const duration = calculateDuration(period.start_time, period.end_time)

                    return (
                      <div
                        key={period.id || period.period_number}
                        className={cn(
                          "relative min-w-[130px] h-10 flex items-center justify-center border-b border-border/70 border-r border-border/70",
                          isBreak
                            ? "bg-primary/10 dark:bg-primary/15"
                            : "bg-primary/5 dark:bg-primary/10"
                        )}
                      >
                        {/* Period label & duration */}
                        <div className="flex items-center justify-center">
                          <span
                            className={cn(
                              "text-xs font-semibold text-muted-foreground",
                              isBreak && "font-bold tracking-wider"
                            )}
                          >
                            {isBreak ? (period.label || "BREAK") : formatPeriodShortLabel(period)}
                          </span>
                          {duration && (
                            <span className="text-[10px] ml-1.5 font-normal text-muted-foreground">
                              {duration}
                            </span>
                          )}
                        </div>

                        {/* Start time pill for first column */}
                        {index === 0 && startFmt && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 pointer-events-none">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium border border-border/80 bg-background shadow-2xs whitespace-nowrap text-muted-foreground">
                              {startFmt}
                            </span>
                          </div>
                        )}

                        {/* End time pill on divider */}
                        {endFmt && (
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 pointer-events-none">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium border border-border/80 bg-background shadow-2xs whitespace-nowrap text-muted-foreground">
                              {endFmt}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Empty space trailing cell to compensate last time badge & provide breathing room */}
                  <div className="w-full h-10 border-b border-border/70 bg-primary/5 dark:bg-primary/10" />
                </div>

                {/* DAY ROWS FOR THIS GROUP */}
                {group.days.map((day, dIdx) => {
                  const isToday = day === todayWeekday
                  const isLastRow = dIdx === group.days.length - 1

                  return (
                    <div
                      key={day}
                      className="w-full"
                      style={{
                        display: "grid",
                        gridTemplateColumns: group.gridTemplate,
                      }}
                    >
                      {/* Day Label Cell */}
                      <div
                        className={cn(
                          "w-full h-full flex items-center justify-center border-r border-border/70 font-bold text-xs tracking-wider",
                          !isLastRow && "border-b border-border/70",
                          isToday
                            ? "bg-primary/15 dark:bg-primary/20 text-foreground font-extrabold"
                            : "bg-primary/5 dark:bg-primary/10 text-muted-foreground"
                        )}
                      >
                        {DAY_LABELS[day]}
                      </div>

                      {/* Period Cells */}
                      {group.periods.map((period, index) => {
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
                            data-slot-key={slotKey}
                            className={cn(
                              "relative min-w-[130px] overflow-hidden border-r border-border/70",
                              !isLastRow && "border-b border-border/70"
                            )}
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
                                if (!isAssignMode) return
                                onSelectSlot?.(slotKey, {
                                  section,
                                  day,
                                  period,
                                  entry,
                                })
                                onOpenAssignDialog?.({
                                  section,
                                  day,
                                  period,
                                  currentEntry: entry,
                                })
                              }}
                              onDoubleClick={() => {
                                if (!isAssignMode) return
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

                      {/* Empty space trailing cell */}
                      <div
                        className={cn(
                          "w-full bg-muted/5 dark:bg-muted/10",
                          !isLastRow && "border-b border-border/70"
                        )}
                      />
                    </div>
                  )
                })}
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
})
