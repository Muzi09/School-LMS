import React, { useState, useRef } from "react"
import { Clock, User as UserIcon, BookOpen, GraduationCap, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { getSubjectColor, formatTime12, calculateDuration } from "../timetableUtils"

export function TimelineBlock({
  entry,
  style = {},
  onEdit,
  onDelete,
  canManage = false,
  showClass = false,
  compact = false,
}) {
  const [showTooltip, setShowTooltip] = useState(false)
  const hoverTimeoutRef = useRef(null)

  if (!entry) return null

  const subject = entry.subject || {}
  const teacher = entry.teacher || null
  const colors = getSubjectColor(subject.name, subject.id)

  const startTimeStr = formatTime12(entry.start_time)
  const endTimeStr = formatTime12(entry.end_time)
  const durationStr = calculateDuration(entry.start_time, entry.end_time)

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    setShowTooltip(true)
  }

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setShowTooltip(false)
    }, 120)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onEdit?.(entry)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onEdit?.(entry)
        }
      }}
      className={cn(
        "absolute top-1 bottom-1 rounded-xl border transition-all duration-150 text-left overflow-hidden cursor-pointer select-none group",
        "flex flex-col justify-between p-2 shadow-2xs hover:shadow-md hover:z-30",
        colors.bg,
        colors.border,
        colors.hover,
        compact ? "p-1.5" : "p-2 sm:p-2.5"
      )}
    >
      {/* Top row: Subject name & period/duration pill */}
      <div className="px-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span
            className={cn(
              "font-bold truncate tracking-tight text-foreground transition-colors",
              compact ? "text-[11px]" : "text-xs sm:text-sm"
            )}
          >
            {subject.name || "Subject"}
          </span>

          <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-background/80 text-muted-foreground border border-border/40">
            {durationStr}
          </span>
        </div>

        {/* Middle row: Class & section (if applicable) or Teacher */}
        {showClass && (entry.class_name || entry.section_name) && (
          <div className="flex items-center gap-1 mt-0.5 text-[10px] sm:text-[11px] font-semibold text-primary">
            <GraduationCap className="size-3 shrink-0" />
            <span className="truncate">
              {entry.class_name} {entry.section_name ? `- ${entry.section_name}` : ""}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1 mt-0.5 text-[10px] sm:text-[11px] text-muted-foreground">
          <UserIcon className="size-2.5 sm:size-3 shrink-0 opacity-70" />
          <span className={cn("truncate font-medium", !teacher && "italic text-muted-foreground/60")}>
            {teacher?.name || "Unassigned"}
          </span>
        </div>
      </div>

      {/* Bottom row: Time range */}
      <div className="px-1 flex items-center justify-between gap-1 text-[9px] sm:text-[10px] font-medium text-muted-foreground/80 mt-1">
        <div className="flex items-center gap-1 truncate">
          <Clock className="size-2.5 shrink-0 opacity-60" />
          <span className="truncate">
            {startTimeStr} - {endTimeStr}
          </span>
        </div>

        {canManage && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit?.(entry)
              }}
              className="size-5 rounded flex items-center justify-center hover:bg-background/80 text-foreground/80 transition-colors"
              title="Edit entry"
            >
              <Pencil className="size-2.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete?.(entry)
              }}
              className="size-5 rounded flex items-center justify-center hover:bg-destructive/10 text-destructive transition-colors"
              title="Delete entry"
            >
              <Trash2 className="size-2.5" />
            </button>
          </div>
        )}
      </div>

      {/* Rich Hover Tooltip */}
      {showTooltip && (
        <div
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-xl bg-popover text-popover-foreground border border-border shadow-xl text-left pointer-events-none animate-in fade-in-0 zoom-in-95 duration-100"
        >
          <div className="space-y-2">
            {/* Header: Subject & Code */}
            <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-1.5">
              <div>
                <h4 className="text-xs font-bold text-foreground leading-tight">{subject.name}</h4>
                {subject.code && (
                  <span className="text-[10px] text-muted-foreground font-mono">{subject.code}</span>
                )}
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                Period {entry.period_number}
              </span>
            </div>

            {/* Timings & Duration */}
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 p-1.5 rounded-lg border border-border/40">
              <div className="flex items-center gap-1 font-medium">
                <Clock className="size-3.5 text-primary" />
                <span>
                  {startTimeStr} – {endTimeStr}
                </span>
              </div>
              <span className="font-semibold text-foreground text-[11px]">{durationStr}</span>
            </div>

            {/* Teacher Details */}
            <div className="text-xs space-y-0.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Assigned Teacher
              </span>
              <div className="flex items-center gap-1.5 text-foreground font-semibold">
                <UserIcon className="size-3.5 text-muted-foreground" />
                <span>{teacher?.name || "Unassigned"}</span>
              </div>
              {teacher?.department && (
                <div className="text-[11px] text-muted-foreground pl-5">
                  Dept: {teacher.department} {teacher.designation ? `• ${teacher.designation}` : ""}
                </div>
              )}
            </div>

            {/* Class & Section (if present) */}
            {(entry.class_name || entry.section_name) && (
              <div className="text-xs space-y-0.5 border-t border-border/40 pt-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Target Class
                </span>
                <div className="flex items-center gap-1.5 text-foreground font-semibold">
                  <GraduationCap className="size-3.5 text-primary" />
                  <span>
                    {entry.class_name} {entry.section_name ? `(Section ${entry.section_name})` : ""}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
