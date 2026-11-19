import { memo } from "react"
import { AlertTriangle, Plus, X, Coffee } from "lucide-react"
import { cn } from "@/lib/utils"
import { getSubjectTheme } from "../subjectTheme"
import { showTimetableTooltip, hideTimetableTooltip } from "./timetableTooltipState"

function formatTime12h(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return ""
  const parts = timeStr.split(":")
  if (parts.length < 2) return timeStr
  const [h, m] = parts.map(Number)
  if (isNaN(h)) return timeStr
  const ampm = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour12} ${ampm}` : `${hour12}:${String(m || 0).padStart(2, "0")} ${ampm}`
}

function getRoomNumber(entry) {
  if (!entry) return ""
  if (entry.room_number) return `Room ${entry.room_number}`
  if (entry.room) return `Room ${entry.room}`
  if (entry.section?.room_number) return `Room ${entry.section.room_number}`
  if (entry.section?.room) return `Room ${entry.section.room}`
  const secName = entry.section?.name || ""
  const clsName = entry.section?.school_class?.name || entry.section?.class_name || ""
  const clsNum = clsName.replace(/[^0-9]/g, "")
  if (clsNum && secName) return `Rm ${clsNum}-${secName}`
  if (secName) return `Rm ${secName}`
  return "Room --"
}

export const TeacherWiseCell = memo(function TeacherWiseCell(
  /** @type {{
   * entry?: import("./ClassWiseCell").TimetableEntry,
   * slotEntries?: import("./ClassWiseCell").TimetableEntry[],
   * day: string, period: import("./ClassWiseCell").TimetablePeriod,
   * teacher: import("./ClassWiseCell").TimetableTeacher, isAssignMode?: boolean,
   * isSelected?: boolean, density?: string, onClick?: React.MouseEventHandler,
   * onAssignClick?: React.MouseEventHandler, onDoubleClick?: React.MouseEventHandler,
   * onQuickUnassign?: (entry: import("./ClassWiseCell").TimetableEntry, teacher: import("./ClassWiseCell").TimetableTeacher) => void
   * }} */ {
  entry = null,
  slotEntries = [],
  day,
  period,
  teacher,
  isAssignMode = false,
  isSelected = false,
  density = "comfortable",
  onClick,
  onAssignClick,
  onDoubleClick,
  onQuickUnassign,
}) {
  const isBreak = Boolean(period?.is_break)
  const isConflict = Array.isArray(slotEntries) && slotEntries.length > 1
  const activeEntry = entry || (Array.isArray(slotEntries) && slotEntries.length === 1 ? slotEntries[0] : null)
  const isOccupied = Boolean(activeEntry)

  const startTimeFmt = formatTime12h(period?.start_time)
  const endTimeFmt = formatTime12h(period?.end_time)
  const timePart = startTimeFmt && endTimeFmt ? ` (${startTimeFmt} - ${endTimeFmt})` : ""
  const periodLabel = period?.name || (period?.period_number != null ? `P${period.period_number}` : "Period")

  // Non-teaching / Recess slot
  if (isBreak) {
    const breakTooltip = `${period?.name || "Recess"} • ${day}${timePart}`
    return (
      <div
        className={cn(
          "h-full w-full min-w-0 flex items-center justify-center select-none bg-muted/30 border-r border-border/70 text-muted-foreground/80 italic",
          density === "compact" ? "min-h-[42px] py-1 px-1 text-[10px]" : "min-h-[56px] py-1.5 px-1.5 text-[11px]"
        )}
        onMouseEnter={(e) => showTimetableTooltip(breakTooltip, e.currentTarget)}
        onMouseLeave={hideTimetableTooltip}
        aria-label={breakTooltip}
      >
        <span className="font-semibold uppercase tracking-wider opacity-80 truncate">
          {period?.name || "RECESS"}
        </span>
      </div>
    )
  }

  // Conflict / Double-booked Slot
  if (isConflict) {
    const conflictClasses = slotEntries
      .map((se) => {
        const cls = se.section?.school_class?.name || se.section?.class_name || ""
        const sec = se.section?.name || ""
        const sub = se.subject?.name || ""
        return `${cls} ${sec} (${sub})`.trim()
      })
      .join(", ")

    const conflictTooltip = `Schedule Conflict! Double-booked in ${slotEntries.length} classes: ${conflictClasses} on ${day} ${periodLabel}${timePart}`

    return (
      <div
        role={isAssignMode ? "button" : undefined}
        tabIndex={isAssignMode ? 0 : undefined}
        onClick={(e) => {
          hideTimetableTooltip()
          if (isAssignMode) onClick?.(e)
        }}
        onMouseEnter={(e) => showTimetableTooltip(conflictTooltip, e.currentTarget)}
        onMouseLeave={hideTimetableTooltip}
        className={cn(
          "h-full w-full min-w-0 border-r border-destructive/50 bg-destructive/15 text-destructive p-1.5 flex flex-col items-center justify-center text-center ring-1 ring-inset ring-destructive/60 transition-all",
          density === "compact" ? "min-h-[42px]" : "min-h-[56px]",
          isAssignMode ? "cursor-pointer hover:bg-destructive/20" : "cursor-default"
        )}
      >
        <div className="flex items-center gap-1 text-[11px] font-black leading-tight text-destructive">
          <AlertTriangle className="size-3.5 text-destructive shrink-0" />
          <span>Conflict ({slotEntries.length})</span>
        </div>
        <span className="text-[10px] font-bold text-destructive/90 truncate max-w-full mt-0.5">
          {slotEntries
            .map((se) => {
              const cls = se.section?.school_class?.name || se.section?.class_name || ""
              const sec = se.section?.name || ""
              return `${cls} ${sec}`.trim()
            })
            .join(" & ")}
        </span>
      </div>
    )
  }

  // Occupied Slot
  if (isOccupied) {
    const sec = activeEntry.section
    const clsName = sec?.school_class?.name || sec?.class_name || activeEntry.class_name || ""
    const secName = sec?.name || activeEntry.section_name || ""
    const classSectionLabel = `${clsName} ${secName}`.trim() || "Class"
    const subjectName = activeEntry.subject?.name || "Subject"
    const roomLabel = getRoomNumber(activeEntry)
    const theme = getSubjectTheme(subjectName)

    const tooltipText = `${classSectionLabel} • ${subjectName} • ${roomLabel} • ${day} ${periodLabel}${timePart}${isAssignMode ? " • Click to edit" : ""}`

    return (
      <div
        role={isAssignMode ? "button" : undefined}
        tabIndex={isAssignMode ? 0 : undefined}
        onClick={(e) => {
          hideTimetableTooltip()
          if (isAssignMode) onClick?.(e)
        }}
        onDoubleClick={(e) => {
          hideTimetableTooltip()
          if (isAssignMode) onDoubleClick?.(e)
        }}
        onMouseEnter={(e) => showTimetableTooltip(tooltipText, e.currentTarget)}
        onMouseLeave={hideTimetableTooltip}
        aria-label={tooltipText}
        className={cn(
          "group relative flex items-center justify-start h-full w-full min-w-0 select-none text-left border-r border-border/70 transition-all",
          density === "compact" ? "min-h-[42px] py-1 px-2 text-[11px]" : "min-h-[56px] py-1.5 px-2.5 text-xs",
          theme.cellBg || "bg-card",
          isAssignMode ? "hover:bg-muted/40 cursor-pointer transition-colors" : "cursor-default",
          isAssignMode && isSelected && "ring-2 ring-primary ring-inset bg-primary/5"
        )}
      >
        <div className="flex flex-col items-start justify-center min-w-0 w-full text-left leading-tight py-0.5">
          {/* Class and Section */}
          <span className="font-bold text-foreground text-xs truncate w-full">
            {classSectionLabel}
          </span>

          {/* Subject */}
          <div className="flex items-center gap-1.5 w-full min-w-0 mt-0.5">
            <span className={cn("size-1.5 rounded-full shrink-0", theme.dot || "bg-primary")} />
            <span className="text-[11px] font-semibold text-foreground/90 truncate">
              {subjectName}
            </span>
          </div>

          {/* Room Number */}
          <span className="text-[9.5px] font-mono text-muted-foreground/75 truncate mt-0.5">
            {roomLabel}
          </span>
        </div>

        {/* Quick Unassign 'X' button on hover (in Edit/Assign mode) */}
        {isAssignMode && (
          <button
            type="button"
            title="Unassign slot"
            onClick={(e) => {
              e.stopPropagation()
              hideTimetableTooltip()
              onQuickUnassign?.(activeEntry, teacher)
            }}
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-all p-0.5 rounded-full bg-background/95 hover:bg-destructive text-muted-foreground hover:text-destructive-foreground border border-border/80 hover:border-destructive shadow-xs size-4 flex items-center justify-center cursor-pointer z-10"
          >
            <X className="size-2.5" />
          </button>
        )}
      </div>
    )
  }

  // Free / Unassigned Slot
  const unassignedTooltip = `Free Period • ${day} ${periodLabel}${timePart}${isAssignMode ? " • Click to assign" : ""}`

  return (
    <div
      role={isAssignMode ? "button" : undefined}
      tabIndex={isAssignMode ? 0 : undefined}
      onClick={(e) => {
        hideTimetableTooltip()
        if (isAssignMode) onClick?.(e)
      }}
      onDoubleClick={(e) => {
        hideTimetableTooltip()
        if (isAssignMode) (onAssignClick || onDoubleClick)?.(e)
      }}
      onMouseEnter={(e) => showTimetableTooltip(unassignedTooltip, e.currentTarget)}
      onMouseLeave={hideTimetableTooltip}
      aria-label={unassignedTooltip}
      className={cn(
        "group relative flex items-center justify-center h-full w-full min-w-0 select-none border-r border-border/70",
        density === "compact" ? "min-h-[42px] py-1 px-1 text-[11px]" : "min-h-[56px] py-1.5 px-1.5 text-xs",
        // Diagonal hatch pattern matching ClassWiseCell
        "[background-image:repeating-linear-gradient(45deg,transparent,transparent_6px,color-mix(in_oklch,var(--foreground)_6%,transparent)_6px,color-mix(in_oklch,var(--foreground)_6%,transparent)_12px)]",
        isAssignMode
          ? "hover:[background-image:repeating-linear-gradient(45deg,transparent,transparent_6px,color-mix(in_oklch,var(--foreground)_10%,transparent)_6px,color-mix(in_oklch,var(--foreground)_10%,transparent)_12px)] cursor-pointer hover:border-primary/50 transition-colors"
          : "cursor-default",
        isAssignMode && isSelected && "ring-2 ring-primary ring-inset"
      )}
    >
      {/* Free Pill Badge matching ClassWiseCell */}
      <span
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border border-border/70 bg-background text-muted-foreground/80 shadow-2xs whitespace-nowrap",
          isAssignMode && "group-hover:hidden",
          isAssignMode && isSelected && "hidden"
        )}
      >
        <Coffee className="size-2.5 opacity-65 text-muted-foreground" />
        <span>Free</span>
      </span>

      {/* Assign button revealed on hover or selection in Edit Mode */}
      {isAssignMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            hideTimetableTooltip()
            onAssignClick?.(e)
          }}
          className={cn(
            "items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-primary/70 bg-background text-primary shadow-xs hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer z-10",
            isSelected ? "inline-flex" : "hidden group-hover:inline-flex"
          )}
        >
          <Plus className="size-3" />
          <span>Assign</span>
        </button>
      )}
    </div>
  )
})
