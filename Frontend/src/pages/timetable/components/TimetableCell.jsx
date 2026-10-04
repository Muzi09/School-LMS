import React from "react"
import { Plus, User as UserIcon, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Timetable Cell Component
 * Renders an occupied subject/teacher card or an interactive empty slot.
 */
export function TimetableCell({
  entry = null,
  day,
  period,
  onAdd,
  onEdit,
  onDelete,
  canManage = false,
}) {
  const isOccupied = Boolean(entry)

  if (isOccupied) {
    const subjectName = entry.subject?.name || "Subject"
    const teacherName = entry.teacher?.name || "Teacher"

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onEdit(entry, day, period)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onEdit(entry, day, period)
          }
        }}
        className={cn(
          "group relative flex flex-col justify-between p-3.5 rounded-xl border transition-all duration-150 text-left min-h-[92px] h-full",
          "bg-card hover:bg-accent/40 border-border/70 hover:border-primary/40 shadow-xs hover:shadow-sm cursor-pointer",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        )}
      >
        <div>
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-sm font-bold text-foreground tracking-tight group-hover:text-primary transition-colors line-clamp-2">
              {subjectName}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground group-hover:text-foreground/90 transition-colors">
            <UserIcon className="size-3.5 shrink-0 opacity-70" />
            <span className="truncate font-medium">{teacherName}</span>
          </div>
        </div>

        {canManage && (
          <div className="mt-2 pt-1 flex items-center justify-end">
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(entry, day, period)
                }}
                className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                title="Edit entry"
                aria-label="Edit entry"
              >
                <Pencil className="size-3" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete?.(entry)
                }}
                className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                title="Delete entry (make slot empty)"
                aria-label="Delete entry"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Empty cell
  if (!canManage) {
    return (
      <div className="flex items-center justify-center p-3 rounded-xl border border-dashed border-border/40 bg-muted/10 min-h-[92px] h-full text-muted-foreground/40 text-xs select-none">
        —
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onAdd(day, period)}
      className={cn(
        "group flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-dashed border-border/60 transition-all duration-150 min-h-[92px] h-full w-full",
        "bg-card/40 hover:bg-primary/5 hover:border-primary/50 text-muted-foreground hover:text-primary cursor-pointer",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
      )}
      aria-label={`Add timetable entry for ${day} Period ${period.period_number}`}
    >
      <div className="size-7 rounded-lg bg-muted group-hover:bg-primary/10 border border-border/40 group-hover:border-primary/30 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-all">
        <Plus className="size-4" />
      </div>
      <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
        Add
      </span>
    </button>
  )
}

export default TimetableCell
