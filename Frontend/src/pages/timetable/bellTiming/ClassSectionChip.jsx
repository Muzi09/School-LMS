import React from "react"
import { cn } from "@/lib/utils"

export function ClassSectionChip({
  section,
  theme,
  isSelected = false,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-w-6 h-6 px-2 rounded-md text-[11px] font-bold border transition-all cursor-pointer select-none inline-flex items-center justify-center shadow-2xs",
        isSelected
          ? theme.chipActive
          : theme.chip
      )}
      title={`Section ${section.name} (Click to move)`}
      aria-label={`Section ${section.name}`}
    >
      {section.name}
    </button>
  )
}

