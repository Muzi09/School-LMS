import React, { useState, useEffect } from "react"
import { ArrowUp, Navigation } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function JumpToRail({ classes = [], onJumpToClass, activeClassId = null }) {
  const [activeId, setActiveId] = useState(activeClassId)

  // Abbreviate class names for rail chips:
  // "Nursery" -> "NUR", "Lower Kindergarten" -> "LKG", "Upper Kindergarten" -> "UKG", "Class 1" -> "1"
  const getShortName = (name = "") => {
    const lower = name.toLowerCase().trim()
    if (lower.includes("nur")) return "NUR"
    if (lower.includes("lkg")) return "LKG"
    if (lower.includes("ukg")) return "UKG"
    const match = lower.match(/(?:class|grade)?\s*([0-9]{1,2})/)
    if (match) return match[1]
    return name.slice(0, 3).toUpperCase()
  }

  const handleJump = (cls) => {
    setActiveId(cls.id)
    onJumpToClass?.(cls)

    // Smooth scroll to the first section of this class or its container
    const el = document.getElementById(`class-group-${cls.id}`) || document.getElementById(`class-section-${cls.sections?.[0]?.id}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
      el.classList.add("ring-2", "ring-primary", "ring-offset-4", "transition-all")
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary", "ring-offset-4")
      }, 1500)
    }
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (!classes || classes.length === 0) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-[95vw] sm:max-w-fit">
      <div className="flex items-center gap-1 p-1.5 bg-card/90 dark:bg-card/95 backdrop-blur-md border border-border/80 rounded-full shadow-lg text-xs overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 px-2 text-muted-foreground font-semibold uppercase tracking-wider text-[10px] shrink-0 border-r border-border/60 mr-1">
          <Navigation className="size-3 text-primary" />
          <span className="hidden sm:inline">Jump to</span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
          {classes.map((cls) => {
            const shortName = getShortName(cls.name)
            const isActive = activeId === cls.id

            return (
              <button
                key={cls.id}
                type="button"
                onClick={() => handleJump(cls)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs scale-105"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
                title={cls.name}
              >
                {shortName}
              </button>
            )
          })}
        </div>

        <div className="border-l border-border/60 pl-1 ml-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={scrollToTop}
            className="rounded-full text-muted-foreground hover:text-foreground"
            title="Scroll to top"
            aria-label="Scroll to top"
          >
            <ArrowUp className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

