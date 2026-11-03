import React, { memo } from "react"
import { AlertTriangle, Clock, Copy, Plus, Sparkles, User } from "lucide-react"
import { getSubjectTheme } from "../subjectTheme"
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
          "h-full w-full flex flex-col items-center justify-center select-none border-x border-border/40",
          "bg-muted/40 dark:bg-muted/20 text-muted-foreground",
          density === "compact" ? "min-h-[52px] py-1" : "min-h-[72px] py-2"
        )}
        title={period?.label || "Break"}
      >
        <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 [writing-mode:vertical-lr] rotate-180">
          {period?.label || "RECESS"}
        </span>
      </div>
    )
  }

  // Occupied Slot
  if (isOccupied) {
    const subjectName = entry?.subject?.name || "Subject"
    const subjectCode = entry?.subject?.code || ""
    const teacherName = entry?.teacher?.name || "Unassigned"
    const hasTeacher = Boolean(entry?.teacher?.name)
    const theme = getSubjectTheme(subjectName, entry?.subject?.category)

    const tooltipText = `${subjectName}${subjectCode ? ` (${subjectCode})` : ""} • ${teacherName} • ${day} ${period?.label || `P${period?.period_number}`} (${period?.start_time || ""} - ${period?.end_time || ""})${conflictInfo ? ` • ${conflictInfo}` : ""}${isAssignMode ? " • Click to edit" : ""}`

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        draggable={isAssignMode && draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        title={tooltipText}
        className={cn(
          "group relative flex flex-col justify-between text-left transition-all duration-150 select-none",
          "rounded-lg border",
          density === "compact"
            ? "p-1.5 min-h-[56px] text-xs"
            : "p-2 sm:p-2.5 min-h-[72px] sm:min-h-[78px] text-xs sm:text-sm",
          // Theme colors
          theme.cellBg,
          theme.border,
          // Status borders / rings
          conflictInfo
            ? "border-destructive/80 bg-destructive/10 dark:bg-destructive/20 ring-1 ring-destructive/60"
            : isSelected
            ? "ring-2 ring-primary ring-offset-2 dark:ring-offset-card shadow-sm border-primary/70"
            : isCopied
            ? "ring-2 ring-dashed ring-amber-500/80"
            : "hover:border-foreground/30 hover:shadow-xs",
          // Today / Current period highlight
          isCurrentPeriod && "ring-2 ring-emerald-500/70",
          // Search match / dim
          isHighlighted && "ring-2 ring-amber-400 bg-amber-50/60 dark:bg-amber-950/40",
          isDimmed && "opacity-35 grayscale-30",
          // Cursor
          isAssignMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        )}
      >
        {/* Top Accent bar */}
        <div
          className={cn(
            "absolute top-0 left-2 right-2 h-0.5 rounded-full",
            conflictInfo ? "bg-destructive" : theme.cellAccent
          )}
        />

        {/* Subject Title & Code */}
        <div className="flex items-start justify-between gap-1 w-full pt-0.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span
              className={cn(
                "size-2 rounded-full shrink-0",
                conflictInfo ? "bg-destructive" : theme.dot
              )}
            />
            <span className="font-semibold text-foreground tracking-tight truncate leading-tight">
              {subjectName}
            </span>
          </div>

          {/* Conflict Warning Badge */}
          {conflictInfo && (
            <span className="size-4 flex items-center justify-center text-destructive shrink-0" title={conflictInfo}>
              <AlertTriangle className="size-3.5 fill-destructive/20" />
            </span>
          )}
        </div>

        {/* Teacher Info */}
        <div className="flex items-center justify-between gap-1 mt-1 text-[11px] sm:text-xs text-muted-foreground">
          <div className="flex items-center gap-1 min-w-0 truncate">
            <User className="size-3 shrink-0 opacity-60" />
            <span className={cn("truncate font-medium", !hasTeacher && "italic text-muted-foreground/60")}>
              {teacherName}
            </span>
          </div>

          {isAssignMode && (
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground font-medium shrink-0 bg-background/80 px-1 rounded">
              Edit
            </span>
          )}
        </div>
      </div>
    )
  }

  // Unassigned Slot
  const unassignedTooltip = `Unassigned • ${day} ${period?.label || `P${period?.period_number}`} (${period?.start_time || ""} - ${period?.end_time || ""})${isAssignMode ? " • Click to assign" : ""}`

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      title={unassignedTooltip}
      className={cn(
        "group relative flex flex-col items-center justify-center text-center transition-all duration-150 select-none",
        "rounded-lg border border-dashed border-border/70",
        // Hatched diagonal neutral pattern
        "bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,hsl(var(--muted)/0.4)_6px,hsl(var(--muted)/0.4)_12px)]",
        "hover:bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,hsl(var(--muted)/0.6)_6px,hsl(var(--muted)/0.6)_12px)]",
        density === "compact"
          ? "p-1.5 min-h-[56px] text-xs"
          : "p-2 sm:p-2.5 min-h-[72px] sm:min-h-[78px] text-xs sm:text-sm",
        isSelected
          ? "ring-2 ring-primary ring-offset-2 dark:ring-offset-card border-primary/70 shadow-sm"
          : "hover:border-primary/40",
        isHighlighted && "ring-2 ring-amber-400 bg-amber-50/40 dark:bg-amber-950/20",
        isDimmed && "opacity-35 grayscale-30",
        isAssignMode ? "cursor-pointer hover:border-primary" : "cursor-default"
      )}
    >
      <div className="flex flex-col items-center justify-center gap-0.5">
        <span className="text-[11px] sm:text-xs font-medium text-muted-foreground/75 tracking-tight group-hover:hidden">
          Unassigned
        </span>

        {isAssignMode ? (
          <div className="hidden group-hover:flex items-center gap-1 text-[11px] font-semibold text-primary">
            <Plus className="size-3" />
            <span>Assign</span>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground/50 tracking-wider">
            Empty
          </span>
        )}
      </div>
    </div>
  )
})
