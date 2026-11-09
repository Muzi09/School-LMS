import React, { memo } from "react"
import { AlertTriangle, Plus, CircleDashed } from "lucide-react"
import { cn } from "@/lib/utils"
import { format12h } from "../bellTiming/timeUtils"
import { getTimetablePeriodLabel, isNonTeachingPeriod } from "../bellTiming/validators"
import { showTimetableTooltip, hideTimetableTooltip } from "./TimetableTooltip"

export const ClassWiseCell = memo(function ClassWiseCell({
  entry = null,
  day,
  period,
  section,
  isAssignMode = false,
  isSelected = false,
  isCopied = false,
  conflictInfo = null,
  isHighlighted = false,
  isDimmed = false,
  density = "comfortable", // 'comfortable' | 'compact'
  isToday = false,
  isCurrentPeriod = false,
  onClick,
  onAssignClick,
  onDoubleClick,
  onContextMenu,
  draggable = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  const isOccupied = Boolean(entry)
  const isBreak = Boolean(period?.is_break)

  const startTimeFmt = period?.start_time ? format12h(period.start_time) : ""
  const endTimeFmt = period?.end_time ? format12h(period.end_time) : ""
  const timeRange = startTimeFmt && endTimeFmt ? `${startTimeFmt} – ${endTimeFmt}` : ""
  const timePart = timeRange ? ` (${timeRange})` : ""

  const rawLabel = typeof period?.label === "string" ? period.label.trim() : ""
  const pType = (period?.type || period?.period_type || (period?.is_break ? "RECESS" : "CLASS")).toUpperCase()

  const isRecessType =
    pType === "RECESS" ||
    pType === "BREAK" ||
    pType.includes("RECESS") ||
    pType.includes("BREAK") ||
    isBreak ||
    /^recess/i.test(rawLabel) ||
    /^break/i.test(rawLabel) ||
    /^r\d*$/i.test(rawLabel)

  const isActivityType =
    pType === "ACTIVITY" ||
    pType === "EXTRA_CURRICULAR" ||
    pType === "EXTRA-CURRICULAR" ||
    pType.includes("ACTIV") ||
    pType.includes("EXTRA") ||
    pType.includes("CURRICUL") ||
    /^(activity|extra-curricular|extracurricular)/i.test(rawLabel) ||
    /^e\d*$/i.test(rawLabel)

  const isAssemblyType =
    pType === "ASSEMBLY" ||
    pType.includes("ASSEMBL") ||
    /^assembly/i.test(rawLabel) ||
    /^a\d*$/i.test(rawLabel)

  // Full label for non-class periods in the body cells
  const fullBodyLabel = getTimetablePeriodLabel(period)
  const periodLabel = fullBodyLabel || (period?.period_number != null ? `P${period.period_number}` : "Period")

  // Non-teaching slots (Recess, Assembly, Extra-curricular) are not assignable; show them like RECESS in body cells
  const isNonTeachingSlot = isBreak || isNonTeachingPeriod(period) || isRecessType || isActivityType || isAssemblyType

  if (isNonTeachingSlot) {
    const slotLabel = isRecessType
      ? (fullBodyLabel || "Recess")
      : isActivityType
      ? (fullBodyLabel || "Extra-curricular")
      : isAssemblyType
      ? (fullBodyLabel || "Assembly")
      : (fullBodyLabel || "Break")

    const slotTooltip = `${slotLabel} • ${day}${timePart}`
    return (
      <div
        className={cn(
          "h-full w-full min-w-0 flex items-center justify-center select-none",
          "bg-muted/30 dark:bg-muted/15 text-muted-foreground",
          density === "compact" ? "min-h-[38px] py-1 px-1" : "min-h-[44px] py-1.5 px-1.5"
        )}
        onMouseEnter={(e) => showTimetableTooltip(slotTooltip, e.currentTarget)}
        onMouseLeave={hideTimetableTooltip}
        aria-label={slotTooltip}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 truncate px-1">
          {slotLabel}
        </span>
      </div>
    )
  }

  // Occupied Slot
  if (isOccupied) {
    const subjectName = entry?.subject?.name || "Subject"
    const subjectCode = entry?.subject?.code || ""
    const fallbackTeacherName = !entry?.teacher?.name && section?.subject_stats && entry?.subject?.id
      ? section.subject_stats.find((s) => s.subject_id === entry.subject.id || s.id === entry.subject.id)?.teacher?.name
      : null
    const teacherName = entry?.teacher?.name || fallbackTeacherName || "Unassigned"
    const hasTeacher = Boolean(entry?.teacher?.name || fallbackTeacherName)

    const tooltipText = `${subjectName}${subjectCode ? ` (${subjectCode})` : ""} • ${teacherName} • ${day} ${periodLabel}${timePart}${conflictInfo ? ` • ${conflictInfo}` : ""}${isAssignMode ? " • Click to edit" : ""}`

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
        onContextMenu={isAssignMode ? onContextMenu : undefined}
        draggable={isAssignMode && draggable}
        onDragStart={(e) => {
          hideTimetableTooltip()
          if (isAssignMode) onDragStart?.(e)
        }}
        onDragEnd={(e) => {
          if (isAssignMode) onDragEnd?.(e)
        }}
        onDragOver={isAssignMode ? onDragOver : undefined}
        onDragLeave={isAssignMode ? onDragLeave : undefined}
        onDrop={isAssignMode ? onDrop : undefined}
        onMouseEnter={(e) => showTimetableTooltip(tooltipText, e.currentTarget)}
        onMouseLeave={hideTimetableTooltip}
        aria-label={tooltipText}
        className={cn(
          "group relative flex items-center justify-start h-full w-full min-w-0 select-none text-left",
          density === "compact" ? "min-h-[38px] py-1 px-2 text-[11px]" : "min-h-[44px] py-1.5 px-2.5 text-xs",
          // Clean card cell background
          "bg-card",
          // Only show hover effects and interactive cursor when edit mode is ON
          isAssignMode ? "hover:bg-muted/40 cursor-pointer active:cursor-grab transition-colors" : "cursor-default",
          // Status rings / borders (only active when edit mode is ON, except current period/conflict)
          conflictInfo
            ? "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/60"
            : (isAssignMode && isSelected)
            ? "ring-2 ring-primary ring-inset bg-primary/5"
            : (isAssignMode && isCopied)
            ? "ring-2 ring-dashed ring-amber-500 ring-inset"
            : "",
          isCurrentPeriod && "ring-2 ring-emerald-500/80 ring-inset",
          isHighlighted && "ring-2 ring-amber-400 ring-inset bg-amber-50/70 dark:bg-amber-950/40",
          isDimmed && "opacity-35 grayscale-30"
        )}
      >
        <div className="flex flex-col items-start justify-center min-w-0 w-full text-left leading-tight">
          <div className="flex items-center justify-between gap-1 w-full min-w-0">
            <span className="font-semibold text-foreground truncate">
              {subjectName}
            </span>
            {conflictInfo && (
              <AlertTriangle className="size-3.5 text-destructive shrink-0 ml-1" title={conflictInfo} />
            )}
          </div>
          <span className={cn("text-muted-foreground font-normal truncate w-full mt-0.5", !hasTeacher && "italic opacity-60")}>
            {teacherName}
          </span>
        </div>
      </div>
    )
  }

  // Unassigned Slot (Only for teaching Class periods)
  const unassignedTooltip = `Unassigned • ${day} ${periodLabel}${timePart}${isAssignMode ? " • Click to assign" : ""}`

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
      onContextMenu={isAssignMode ? onContextMenu : undefined}
      onDragOver={isAssignMode ? onDragOver : undefined}
      onDragLeave={isAssignMode ? onDragLeave : undefined}
      onDrop={isAssignMode ? onDrop : undefined}
      onMouseEnter={(e) => showTimetableTooltip(unassignedTooltip, e.currentTarget)}
      onMouseLeave={hideTimetableTooltip}
      aria-label={unassignedTooltip}
      className={cn(
        "group relative flex items-center justify-center h-full w-full min-w-0 select-none",
        density === "compact" ? "min-h-[38px] py-1 px-1 text-[11px]" : "min-h-[44px] py-1.5 px-1.5 text-xs",
        // Diagonal hatch pattern matching screenshot
        "[background-image:repeating-linear-gradient(45deg,transparent,transparent_6px,color-mix(in_oklch,var(--foreground)_6%,transparent)_6px,color-mix(in_oklch,var(--foreground)_6%,transparent)_12px)]",
        // Only show hover effect and pointer when edit mode is ON
        isAssignMode
          ? "hover:[background-image:repeating-linear-gradient(45deg,transparent,transparent_6px,color-mix(in_oklch,var(--foreground)_10%,transparent)_6px,color-mix(in_oklch,var(--foreground)_10%,transparent)_12px)] cursor-pointer hover:border-primary/50 transition-colors"
          : "cursor-default",
        isAssignMode && isSelected && "ring-2 ring-primary ring-inset",
        isHighlighted && "ring-2 ring-amber-400 ring-inset bg-amber-50/40 dark:bg-amber-950/20",
        isDimmed && "opacity-35 grayscale-30"
      )}
    >
      {/* Unassigned Pill Badge matching screenshot */}
      <span
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border border-border/70 bg-background text-muted-foreground/80 shadow-2xs whitespace-nowrap",
          isAssignMode && "group-hover:hidden",
          isAssignMode && isSelected && "hidden"
        )}
      >
        <CircleDashed className="size-2.5 opacity-65 text-muted-foreground" />
        <span>Unassigned</span>
      </span>

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
