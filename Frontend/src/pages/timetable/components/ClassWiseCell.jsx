import React, { memo } from "react"
import { AlertTriangle, Plus, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

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
  onDoubleClick,
  onContextMenu,
  draggable = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  const isOccupied = Boolean(entry)
  const isBreak = Boolean(period?.is_break)

  // Break slot rendering (recess, lunch, etc.)
  if (isBreak) {
    return (
      <div
        className={cn(
          "h-full w-full flex items-center justify-center select-none",
          "bg-muted/30 dark:bg-muted/15 text-muted-foreground",
          density === "compact" ? "min-h-[32px] py-1" : "min-h-[38px] py-1.5"
        )}
        title={period?.label || "Break"}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {period?.label || "RECESS"}
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

    const tooltipText = `${subjectName}${subjectCode ? ` (${subjectCode})` : ""} • ${teacherName} • ${day} ${period?.label || `P${period?.period_number}`} (${period?.start_time || ""} - ${period?.end_time || ""})${conflictInfo ? ` • ${conflictInfo}` : ""}${isAssignMode ? " • Click to edit" : ""}`

    return (
      <div
        role={isAssignMode ? "button" : undefined}
        tabIndex={isAssignMode ? 0 : undefined}
        onClick={isAssignMode ? onClick : undefined}
        onDoubleClick={isAssignMode ? onDoubleClick : undefined}
        onContextMenu={isAssignMode ? onContextMenu : undefined}
        draggable={isAssignMode && draggable}
        onDragStart={isAssignMode ? onDragStart : undefined}
        onDragOver={isAssignMode ? onDragOver : undefined}
        onDragLeave={isAssignMode ? onDragLeave : undefined}
        onDrop={isAssignMode ? onDrop : undefined}
        title={tooltipText}
        className={cn(
          "group relative flex items-center justify-center h-full w-full px-2 sm:px-2.5 select-none text-center",
          density === "compact" ? "min-h-[32px] py-1 text-[11px]" : "min-h-[38px] py-1.5 text-xs",
          // Clean card cell background
          "bg-card",
          // Only show hover effects and interactive cursor when edit mode is ON
          isAssignMode ? "hover:bg-muted/40 cursor-grab active:cursor-grabbing transition-colors" : "cursor-default",
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
        <div className="flex items-center justify-center gap-1.5 min-w-0 w-full text-center">
          <span className="font-semibold text-foreground truncate shrink-0 max-w-[55%]">
            {subjectName}
          </span>
          <span className="text-muted-foreground/60 shrink-0 font-medium">·</span>
          <span className={cn("text-muted-foreground font-normal truncate max-w-[40%]", !hasTeacher && "italic opacity-60")}>
            {teacherName}
          </span>
          {conflictInfo && (
            <AlertTriangle className="size-3.5 text-destructive shrink-0 ml-1" title={conflictInfo} />
          )}
        </div>
      </div>
    )
  }

  // Unassigned Slot
  const unassignedTooltip = `Unassigned • ${day} ${period?.label || `P${period?.period_number}`} (${period?.start_time || ""} - ${period?.end_time || ""})${isAssignMode ? " • Click to assign" : ""}`

  return (
    <div
      role={isAssignMode ? "button" : undefined}
      tabIndex={isAssignMode ? 0 : undefined}
      onClick={isAssignMode ? onClick : undefined}
      onDoubleClick={isAssignMode ? onDoubleClick : undefined}
      onContextMenu={isAssignMode ? onContextMenu : undefined}
      onDragOver={isAssignMode ? onDragOver : undefined}
      onDragLeave={isAssignMode ? onDragLeave : undefined}
      onDrop={isAssignMode ? onDrop : undefined}
      title={unassignedTooltip}
      className={cn(
        "group relative flex items-center justify-center h-full w-full px-2 select-none",
        density === "compact" ? "min-h-[32px] py-1 text-[11px]" : "min-h-[38px] py-1.5 text-xs",
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
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-border/70 bg-background/85 text-muted-foreground/80 shadow-2xs whitespace-nowrap",
          isAssignMode && "group-hover:hidden"
        )}
      >
        <Sparkles className="size-2.5 opacity-60 text-muted-foreground" />
        <span>Unassigned</span>
      </span>

      {isAssignMode && (
        <span className="hidden group-hover:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-primary/40 bg-primary/10 text-primary shadow-2xs">
          <Plus className="size-3" />
          <span>Assign</span>
        </span>
      )}
    </div>
  )
})
