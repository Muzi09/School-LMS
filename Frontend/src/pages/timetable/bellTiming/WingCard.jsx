import React from "react"
import { Send, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ClassSectionChip } from "./ClassSectionChip"
import { getWingTheme } from "./theme"
import { cn } from "@/lib/utils"

export function WingCard({
  wing,
  wingIndex = 0,
  assignedSectionIds = [],
  selectedSectionIds = [],
  readOnly = false,
  onWingClick,
  onClassClick,
  onSectionClick,
}) {
  const theme = getWingTheme(wing.name, wingIndex)

  // Filter wing's classes and sections to only those assigned to this setup
  const assignedClasses = (wing.classes || [])
    .map((c) => {
      const assignedSections = (c.sections || []).filter((s) => assignedSectionIds.includes(s.id))
      return {
        ...c,
        sections: assignedSections,
      }
    })
    .filter((c) => c.sections.length > 0)

  const totalAssignedInWing = assignedClasses.reduce((acc, c) => acc + c.sections.length, 0)

  if (totalAssignedInWing === 0) return null

  const wingSectionIds = assignedClasses.flatMap((c) => c.sections.map((s) => s.id))
  const displayWingName = wing.name?.toLowerCase().endsWith("wing") ? wing.name : `${wing.name} Wing`

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card overflow-hidden shadow-2xs transition-all duration-150 flex flex-col",
        theme.cardBorder
      )}
    >
      {/* Wing Card Header */}
      <div
        className={cn(
          "px-3.5 py-2.5 border-b flex items-center justify-between gap-2 transition-colors",
          theme.headerBg,
          readOnly ? "cursor-default" : "cursor-pointer group"
        )}
        onClick={() => !readOnly && onWingClick?.(wing, wingSectionIds)}
        title={readOnly ? undefined : "Click to move all classes in this wing"}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("size-2 rounded-full shrink-0", theme.dot)} />
          <h4 className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
            {displayWingName}
          </h4>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5", theme.badge)}>
            {totalAssignedInWing} {totalAssignedInWing === 1 ? "CLASS" : "CLASSES"}
          </Badge>
          {!readOnly && (
            <Send className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </div>

      {/* Classes & Sections Rows */}
      <div className="p-3 space-y-2 text-xs flex-1">
        {assignedClasses.map((cls) => {
          const classSectionIds = cls.sections.map((s) => s.id)

          return (
            <div
              key={cls.id}
              className="flex items-center justify-between gap-2 py-1 border-b border-border/40 last:border-0"
            >
              {/* Class Name (Clickable to move class) */}
              <button
                type="button"
                disabled={readOnly}
                onClick={() => !readOnly && onClassClick?.(cls, wing.name, classSectionIds)}
                className={cn(
                  "font-semibold text-foreground/90 transition-colors text-left truncate flex items-center gap-1 group",
                  readOnly ? "cursor-default" : "cursor-pointer hover:text-primary"
                )}
                title={readOnly ? undefined : `Move ${cls.name} (${cls.sections.length} ${cls.sections.length === 1 ? "class" : "classes"})`}
              >
                <span>{cls.name}:</span>
                {!readOnly && (
                  <Send className="size-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>

              {/* Section Chips */}
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {cls.sections.map((sec) => (
                  <ClassSectionChip
                    key={sec.id}
                    section={sec}
                    theme={theme}
                    isSelected={selectedSectionIds.includes(sec.id)}
                    onClick={(e) => !readOnly && onSectionClick?.(e, sec, cls.name, wing.name)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

