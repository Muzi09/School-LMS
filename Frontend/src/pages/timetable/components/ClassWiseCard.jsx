import { scheduleGroups as groupsForSetup, lessonPeriod } from "../sectionSchedule"
import React, { useLayoutEffect, useMemo, useRef, useState, memo } from "react"
import {
  User,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { classLessonRoomLabel } from "../rooms"
import { ClassWiseCell } from "./ClassWiseCell"
import { getSubjectTheme } from "../subjectTheme"
import { getShortSubjectName, isAcademicSubject } from "../subjectShortName"
import { parseTimetableQuery, cellMatchesHighlight } from "../searchUtils"
import { format12h } from "../bellTiming/timeUtils"
import { formatPeriodShortLabel, isNonTeachingPeriod } from "../bellTiming/validators"
import { cn } from "@/lib/utils"

const DAY_LABELS = {
  MONDAY: "MON",
  TUESDAY: "TUE",
  WEDNESDAY: "WED",
  THURSDAY: "THU",
  FRIDAY: "FRI",
  SATURDAY: "SAT",
}

function SubjectAllocations({ stats }) {
  const { academic, nonAcademic } = useMemo(() => ({
    academic: (stats || []).filter(isAcademicSubject),
    nonAcademic: (stats || []).filter(item => !isAcademicSubject(item)),
  }), [stats])
  const allocationsRef = useRef(null)
  const [firstRowCount, setFirstRowCount] = useState(Infinity)
  const visibleCount = Math.min(firstRowCount, academic.length)

  useLayoutEffect(() => {
    const allocations = allocationsRef.current
    if (!allocations || !academic.length) return

    const firstRow = allocations.firstElementChild
    const label = firstRow.firstElementChild
    const tokens = allocations.querySelectorAll("[data-academic-allocation]")
    const fitAcademicSubjects = () => {
      const gap = parseFloat(getComputedStyle(firstRow).columnGap) || 0
      let width = label.getBoundingClientRect().width
      let count = 0
      for (const token of tokens) {
        width += gap + token.getBoundingClientRect().width
        if (count > 0 && width > firstRow.clientWidth) break
        count += 1
      }
      setFirstRowCount(count)
    }

    fitAcademicSubjects()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(fitAcademicSubjects)
    observer.observe(allocations)
    observer.observe(label)
    tokens.forEach(token => observer.observe(token))
    return () => observer.disconnect()
  }, [academic, visibleCount])

  const labelClass = "shrink-0 select-none text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70"
  const rowClass = "flex min-h-3 items-center gap-3 overflow-x-auto scrollbar-none"

  return (
    <div ref={allocationsRef} className="col-span-2 col-start-1 row-start-2 flex min-w-0 flex-col gap-1 md:col-span-1 md:col-start-2 md:row-start-1 md:border-l md:border-border/50 md:pl-2">
      {(academic.length > 0 || nonAcademic.length > 0) && (
        <div className={rowClass}>
          {academic.length > 0 && <span className={labelClass}>Acad :</span>}
          {academic.slice(0, visibleCount).map(item => (
            <AllocationToken key={item.subject_id} item={item} academic />
          ))}
        </div>
      )}
      {(visibleCount < academic.length || nonAcademic.length > 0) && (
        <div className={rowClass}>
          {academic.slice(visibleCount).map(item => (
            <AllocationToken key={item.subject_id} item={item} academic />
          ))}
          {nonAcademic.length > 0 && (
            <span className={cn(labelClass, visibleCount < academic.length && "ml-1 border-l border-border/50 pl-3")}>
              Non Acad :
            </span>
          )}
          {nonAcademic.map(item => (
            <AllocationToken key={item.subject_id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function AllocationToken({ item, academic = false }) {
  const isOver = item.assigned > item.target
  const isMet = item.assigned === item.target

  return (
    <span
      data-academic-allocation={academic || undefined}
      className="inline-flex shrink-0 select-none items-center gap-1 whitespace-nowrap text-[11px] leading-none"
    >
      {academic ? (
        <span className={cn("size-1.5 shrink-0 rounded-full", isOver ? "bg-amber-500" : isMet ? "bg-emerald-500" : getSubjectTheme(item.name).dot)} />
      ) : (
        <span className={cn("shrink-0 text-[9px] font-bold leading-none", isOver ? "text-amber-500" : isMet ? "text-emerald-500" : "text-amber-600/90 dark:text-amber-400/90")}>✦</span>
      )}
      <span className={cn("font-normal text-muted-foreground/90 transition-colors hover:text-foreground/90", isOver && "font-medium text-amber-700 dark:text-amber-300")}>
        {getShortSubjectName(item.name, item.code)}
      </span>
      <span className={cn("font-mono text-[10px] text-muted-foreground/75", isOver && "font-semibold text-amber-700 dark:text-amber-300")}>
        {item.assigned || 0}/{item.target || 0}
      </span>
    </span>
  )
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

/** @param {{ times: string[], atStart?: boolean }} props */
function PeriodBoundary({ times, atStart = false }) {
  const labels = [...new Set(times.filter(Boolean))]
  if (!labels.length) return null

  return (
    <div className={cn(
      "pointer-events-none absolute top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-0.5",
      atStart ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"
    )}>
      {labels.map(label => (
        <span key={label} className="whitespace-nowrap rounded-full border border-border/80 bg-background px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground shadow-2xs">
          {label}
        </span>
      ))}
    </div>
  )
}

/** @typedef {import("./ClassWiseCell").TimetableSection} TimetableSection */
/** @typedef {import("./ClassWiseCell").TimetableSetup} TimetableSetup */
/** @typedef {import("./ClassWiseCell").TimetableEntry} TimetableEntry */
/** @typedef {import("./ClassWiseCell").TimetableSlot} TimetableSlot */

/**
 * @typedef {object} ClassWiseCardProps
 * @property {TimetableSection} section
 * @property {TimetableSetup | null} setup
 * @property {TimetableEntry[]} [entries]
 * @property {Record<string, string>} [conflictMap]
 * @property {boolean} [isAssignMode]
 * @property {string | null} [selectedSlot]
 * @property {TimetableSlot | null} [copiedSlot]
 * @property {(slotKey: string, slot: TimetableSlot) => void} [onSelectSlot]
 * @property {(slot: Omit<TimetableSlot, 'entry'> & { currentEntry?: TimetableEntry | null }) => void} [onOpenAssignDialog]
 * @property {(source: TimetableSlot, target: TimetableSlot, isCopy: boolean) => void} [onMoveSlot]
 * @property {(entryId: string) => void} [onClearSlot]
 * @property {(entry: TimetableEntry, section: TimetableSection, slot?: Pick<TimetableSlot, 'day' | 'period'>) => void} [onQuickUnassign]
 * @property {string} [density]
 * @property {number} [zoom]
 * @property {string} [searchQuery]
 * @property {boolean} [unassignedOnly]
 * @property {boolean} [conflictsOnly]
 */

export const ClassWiseCard = memo(function ClassWiseCard(/** @type {ClassWiseCardProps} */ {
  section,
  setup,
  entries = [],
  conflictMap = {},
  isAssignMode = false,
  selectedSlot = null,
  copiedSlot = null,
  onSelectSlot,
  placements,
  onOpenAssignDialog,
  onMoveSlot,
  onClearSlot,
  onQuickUnassign,
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
  const scheduleGroups = useMemo(() => groupsForSetup(setup), [setup])
  const totalSlotsCount = scheduleGroups.reduce((n, g) => n + g.days.length * g.periods.filter(p => !isNonTeachingPeriod(p)).length, 0)
  const review = entries.filter(e => !lessonPeriod(e, scheduleGroups))
  const entryLookup = useMemo(() => new Map(entries.map(e => [e.day_of_week + "_" + e.period_id, e])), [entries])

  // Map same-day subject frequency for soft pedagogical indicators
  const daySubjectCounts = useMemo(() => {
    const map = {}
    for (const e of entries) {
      if (e.day_of_week && (e.subject_id || e.subject?.id)) {
        const subId = String(e.subject_id || e.subject?.id)
        const k = `${e.day_of_week}_${subId}`
        map[k] = (map[k] || 0) + 1
      }
    }
    return map
  }, [entries])

  // Aggregate stats
  const slotGroups = useMemo(() => {
    const map = new Map()
    for (const entry of entries) {
      if (!entry.placement_id) continue
      const key = entry.day_of_week + "_" + entry.period_id
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(entry)
    }
    return map
  },[entries])
  const assignedSlotsCount = entryLookup.size
  const completionPct = (totalSlotsCount > 0 && assignedSlotsCount > 0) ? Math.round((assignedSlotsCount / totalSlotsCount) * 100) : 0

  const isDraggingRef = useRef(false)
  const dragStartTimeRef = useRef(0)

  const handleDragStart = (e, slotData) => {
    if (!isAssignMode || !slotData.entry) return
    isDraggingRef.current = true
    dragStartTimeRef.current = e.timeStamp
    e.dataTransfer.setData("application/json", JSON.stringify(slotData))
    e.dataTransfer.effectAllowed = e.altKey ? "copy" : "move"
  }

  const handleDragEnd = () => {
    setTimeout(() => {
      isDraggingRef.current = false
    }, 150)
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
    } finally {
      setTimeout(() => {
        isDraggingRef.current = false
      }, 150)
    }
  }

  const handleCellClick = (event, slotKey, slotData) => {
    if (!isAssignMode) return
    if (isDraggingRef.current || (dragStartTimeRef.current && event.timeStamp - dragStartTimeRef.current < 250)) {
      return
    }
    // Always put focus on the cell (green outline)
    onSelectSlot?.(slotKey, slotData)

    // For unassigned/striped cells, clicking on the striped area only puts focus on the cell.
    // Opening the assignment modal for unassigned cells is triggered by clicking the "Assign" button or double-clicking.
    // For occupied cells, clicking opens the assignment modal to edit the existing entry.
    if (slotData?.entry) {
      onOpenAssignDialog?.({
        section: slotData.section,
        day: slotData.day,
        period: slotData.period,
        currentEntry: slotData.entry,
        scheduleDays: slotData.scheduleDays,
      })
    }
  }

  const handleAssignClick = (slotKey, slotData) => {
    if (!isAssignMode) return
    onSelectSlot?.(slotKey, slotData)
    onOpenAssignDialog?.({
      section: slotData.section,
      day: slotData.day,
      period: slotData.period,
      currentEntry: slotData.entry,
      scheduleDays: slotData.scheduleDays,
    })
  }

  // Maximum periods count across all schedule groups so every group renders equal columns and aligns time chips
  const maxPeriodsCount = useMemo(() => {
    if (!scheduleGroups || scheduleGroups.length === 0) return 0
    return Math.max(...scheduleGroups.map((g) => g.periods?.length || 0), 1)
  }, [scheduleGroups])

  // Compact Day column width (48px) to eliminate dead space in the starting of the timetable
  const dayColumnWidth = 48

  // Uniform base period column width (equal width across every period on the timetable)
  const basePeriodWidth = 140

  // Rigid CSS Grid column tracks guaranteeing 100% pixel-perfect alignment across all split day groups
  const commonGridTemplate = useMemo(() => {
    return `${dayColumnWidth}px repeat(${maxPeriodsCount}, minmax(${basePeriodWidth}px, 1fr)) 48px`
  }, [dayColumnWidth, maxPeriodsCount, basePeriodWidth])

  const cardMinWidth = useMemo(() => {
    return dayColumnWidth + 48 + maxPeriodsCount * basePeriodWidth
  }, [dayColumnWidth, maxPeriodsCount, basePeriodWidth])

  // Resolve Class Teacher Name
  const classTeacherName = useMemo(() => {
    if (section.class_teacher_name) return section.class_teacher_name
    if (section.class_teacher?.name) return section.class_teacher.name
    if (section.class_teacher && typeof section.class_teacher === "object") {
      const fn = section.class_teacher.first_name || ""
      const ln = section.class_teacher.last_name || ""
      const full = `${fn} ${ln}`.trim()
      if (full) return full
    }
    return null
  }, [section.class_teacher_name, section.class_teacher])

  return (
    <div
      id={`class-section-${section.id}`}
      className={cn(
        "bg-card text-card-foreground rounded-2xl border border-primary/25 shadow-xs transition-all overflow-hidden scroll-mt-32 sm:scroll-mt-36",
        "hover:shadow-sm"
      )}
    >
      {review.map(e => <div key={e.id} className="flex items-center justify-between gap-2 border-b p-2 text-sm">
        <span>Review {e.day_of_week.toLowerCase()} · {e.subject?.name} — its period is outside this section’s bell schedule.</span>
        {isAssignMode && <button type="button" className="underline" onClick={() => onQuickUnassign?.(e, section)}>Remove lesson</button>}
      </div>)}
      {/* CARD HEADER: Compact 3-Zone x 2-Line Architecture (~48px height) */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 px-4 py-2 bg-muted/20 border-b border-border/60 min-h-[48px] md:grid-cols-[auto_minmax(0,1fr)_auto]">
        {/* Left Zone: Identity Stack (Class & Section on Line 1, CT on Line 2) */}
        <div className="flex flex-col justify-center min-w-0 md:min-w-[150px] max-w-[240px] leading-tight gap-0.5">
          {/* Line 1: Class Name & Section Badge */}
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-sm sm:text-base font-bold text-foreground tracking-tight truncate">
              {section.class_name}
            </span>
            <Badge
              variant="outline"
              className="bg-primary/90 text-primary-foreground font-bold px-1.5 py-0.2 text-[11px] rounded-md shadow-xs shrink-0"
            >
              {section.name}
            </Badge>
            {section.room_number && (
              <span className="min-w-0 truncate text-[11px] font-medium text-muted-foreground" title={`Room ${section.room_number}`}>
                Room {section.room_number}
              </span>
            )}
          </div>

          {/* Class teacher assignment */}
          <div
            className="flex items-start gap-1 text-xs text-muted-foreground"
            title={classTeacherName ? `Class Teacher: ${classTeacherName}` : "Class Teacher: Not assigned"}
          >
            <User className="mt-0.5 size-3 text-primary/70 shrink-0" />
            <span className="min-w-0 break-words">
              <span>Class teacher: </span>
              <strong className={cn("font-medium", classTeacherName ? "text-foreground/90 font-semibold" : "text-muted-foreground/60 font-normal italic")}>
                {classTeacherName || "Not assigned"}
              </strong>
            </span>
          </div>
        </div>

        <SubjectAllocations stats={section.subject_stats} />

        {/* Right Zone: Progress Stack (Assigned Count on Line 1, Progress Bar on Line 2) */}
        <div className="col-start-2 row-start-1 flex flex-col items-end justify-center leading-tight gap-1 border-l border-border/50 pl-2 md:col-start-3">
          {/* Line 1: Monospace Assigned Ratio */}
          <div className="text-[11px] font-mono text-muted-foreground font-medium">
            Assigned:{" "}
            <strong className="text-foreground font-semibold">
              {assignedSlotsCount}/{totalSlotsCount}
            </strong>
          </div>

          {/* Line 2: Slim Progress Bar + Percentage */}
          <div className="flex items-center gap-1.5">
            <div className="w-16 sm:w-20 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <span className="text-[10px] font-mono font-medium text-muted-foreground">
              {completionPct}%
            </span>
          </div>
        </div>
      </div>

      {/* CARD BODY: Timetable Grid */}
      <div className="relative overflow-x-auto scrollbar-thin">
        <div
          className="w-full origin-top-left transition-transform duration-150"
          style={{
            zoom: zoom / 100,
            minWidth: `${cardMinWidth}px`,
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
                    gridTemplateColumns: commonGridTemplate,
                  }}
                >
                  {/* First Column First Row: Day column header spacer (no text) */}
                  <div className="w-full h-10 border-r border-b border-border/70 bg-primary/5 dark:bg-primary/10" />

                  {/* Period Columns Header padded to maxPeriodsCount so all split day columns and time chips align */}
                  {Array.from({ length: maxPeriodsCount }).map((_, index) => {
                    const period = group.periods[index]
                    if (!period) {
                      return (
                        <div
                          key={`filler-hdr-${index}`}
                          className="w-full min-w-0 h-10 border-b border-border/70 border-r border-border/70 bg-primary/5 dark:bg-primary/10"
                        />
                      )
                    }

                    const isNonTeaching = isNonTeachingPeriod(period)
                    const duration = calculateDuration(period.start_time, period.end_time)
                    const periodHeaderLabel = formatPeriodShortLabel(period, group.periods)
                    const startTime = format12h(period.start_time)
                    const endTime = format12h(period.end_time)
                    const nextStartTime = format12h(group.periods[index + 1]?.start_time)

                    return (
                      <div
                        key={period.id || period.period_number || index}
                        className={cn(
                          "relative w-full min-w-0 h-10 flex items-center justify-center border-b border-border/70 border-r border-border/70 px-1 overflow-visible",
                          isNonTeaching
                            ? "bg-primary/10 dark:bg-primary/15"
                            : "bg-primary/5 dark:bg-primary/10"
                        )}
                      >
                        <div className="w-full min-w-0 px-7 text-center text-xs leading-tight">
                          <strong className="block truncate" title={periodHeaderLabel}>{periodHeaderLabel}</strong>
                          {duration && <div className="text-[10px] text-muted-foreground">{duration}</div>}
                        </div>
                        {index === 0 && <PeriodBoundary atStart times={[startTime]} />}
                        <PeriodBoundary times={[endTime, nextStartTime]} />
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
                        gridTemplateColumns: commonGridTemplate,
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

                      {/* Period Cells padded to maxPeriodsCount */}
                      {Array.from({ length: maxPeriodsCount }).map((_, index) => {
                        const period = group.periods[index]
                        if (!period) {
                          return (
                            <div
                              key={`filler-cell-${day}-${index}`}
                              className={cn(
                                "w-full min-w-0 h-full border-r border-border/70 bg-muted/10",
                                !isLastRow && "border-b border-border/70"
                              )}
                            />
                          )
                        }

                        const entry =
                          entryLookup.get(`${day}_${period.id}`) ||
                          null

                        const grouped = slotGroups.get(day + "_" + period.id)
                        if (grouped) {
                          const expected = placements?.[entry.placement_id]?.expected.filter(r => r.section_ids.includes(section.id)).length || grouped.length
                          const openGroup = () => onOpenAssignDialog?.({section,day,period,currentEntry:entry})
                          return <div key={period.id} data-slot-key={section.id + "_" + day + "_" + period.id} className="relative border-b border-r bg-card p-1.5 text-xs">
                            <button disabled={!isAssignMode} onClick={openGroup} className="w-full pr-3 text-left">
                              {grouped.map(e => <span key={e.id} className="block"><strong>{e.subject?.name}</strong> · {e.teacher?.name}{classLessonRoomLabel(e, section) && <span className="block text-[11px] text-muted-foreground">{classLessonRoomLabel(e, section)}</span>}</span>)}
                              {grouped.length < expected && <span className="text-primary">{grouped.length} of {expected} options scheduled</span>}
                            </button>
                            {isAssignMode && <button className="absolute right-1 top-1" aria-label="Unassign group" onClick={() => onQuickUnassign?.(entry,section,{day,period})}>×</button>}
                          </div>
                        }
                        const isBreak = Boolean(period.is_break)
                        const conflictInfo = entry ? (conflictMap[entry.id] || conflictMap[String(entry.id)]) : null
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
                          if (isNonTeachingPeriod(period) || entry) isDimmed = true
                          else isHighlighted = true
                        }
                        if (conflictsOnly) {
                          if (conflictInfo) isHighlighted = true
                          else isDimmed = true
                        }

                        const subId = entry ? String(entry.subject_id || entry.subject?.id || "") : ""
                        const sameDayRepeatCount = subId ? (daySubjectCounts[`${day}_${subId}`] || 1) : 1

                        return (
                          <div
                            key={period.id || period.period_number || index}
                            data-slot-key={slotKey}
                            className={cn(
                              "relative w-full min-w-0 overflow-hidden border-r border-border/70",
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
                              sameDayRepeatCount={sameDayRepeatCount}
                              isHighlighted={isHighlighted}
                              isDimmed={isDimmed}
                              density={density}
                              isCurrentPeriod={isCurrentPeriod}
                              onClick={event => {
                                handleCellClick(event, slotKey, {
                                  section,
                                  day,
                                  period,
                                  entry,
                                  scheduleDays: group.days,
                                })
                              }}
                              onAssignClick={() => {
                                handleAssignClick(slotKey, {
                                  section,
                                  day,
                                  period,
                                  entry,
                                  scheduleDays: group.days,
                                })
                              }}
                              onDoubleClick={() => {
                                handleAssignClick(slotKey, {
                                  section,
                                  day,
                                  period,
                                  entry,
                                  scheduleDays: group.days,
                                })
                              }}
                              onQuickUnassign={(ent, sec) => {
                                if (onQuickUnassign) {
                                  onQuickUnassign(ent, sec || section, { day, period })
                                } else if (onClearSlot) {
                                  onClearSlot(ent?.id)
                                }
                              }}
                              draggable={Boolean(entry)}
                              onDragStart={(e) =>
                                handleDragStart(e, {
                                  section,
                                  day,
                                  period,
                                  entry,
                                  scheduleDays: group.days,
                                })
                              }
                              onDragEnd={handleDragEnd}
                              onDragOver={handleDragOver}
                              onDrop={(e) =>
                                handleDrop(e, {
                                  section,
                                  day,
                                  period,
                                  entry,
                                  scheduleDays: group.days,
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
