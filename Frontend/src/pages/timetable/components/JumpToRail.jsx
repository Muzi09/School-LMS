import React, { useState, useEffect, useRef } from "react"
import { ArrowUp, Navigation } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function JumpToRail({
  classes = [],
  onJumpToClass,
  onJumpToSection,
  activeClassId = null,
}) {
  const [activeId, setActiveId] = useState(activeClassId)
  const [activeSectionId, setActiveSectionId] = useState(null)
  const [hoveredClass, setHoveredClass] = useState(null)
  const lastHoveredClassRef = useRef(null)

  const hoverTimerRef = useRef(null)
  const leaveTimerRef = useRef(null)

  // Keep track of the last hovered class so exit animation still renders its sections smoothly
  if (hoveredClass) {
    lastHoveredClassRef.current = hoveredClass
  }
  const displayClass = hoveredClass || lastHoveredClassRef.current

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    }
  }, [])

  // Sync activeClassId if changed externally
  useEffect(() => {
    if (activeClassId) {
      setActiveId(activeClassId)
    }
  }, [activeClassId])

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

  const handleClassMouseEnter = (cls) => {
    // Clear any pending leave timer so the strip doesn't close
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }

    // If this class is already the hovered class, keep it
    if (hoveredClass?.id === cls.id) {
      return
    }

    // Clear any pending hover timer from another class
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }

    // Start 500ms (half a second) timer
    hoverTimerRef.current = setTimeout(() => {
      if (cls.sections && cls.sections.length > 0) {
        setHoveredClass(cls)
      } else {
        setHoveredClass(null)
      }
    }, 500)
  }

  const handleClassMouseLeave = () => {
    // If hover was less than 500ms, cancel opening
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }

    // Set grace period to allow cursor to move to section strip
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    leaveTimerRef.current = setTimeout(() => {
      setHoveredClass(null)
    }, 250)
  }

  const handleStripMouseEnter = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
  }

  const handleStripMouseLeave = () => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    leaveTimerRef.current = setTimeout(() => {
      setHoveredClass(null)
    }, 250)
  }

  const scrollToTargetWithOffset = (el) => {
    if (!el) return

    // Find the scroll container (typically AppLayout <main> or window)
    const scrollContainer = el.closest("main") || document.scrollingElement || document.documentElement

    // Dynamic header height measurement (AppHeader + TimetableHeader)
    const stickyHeader = document.querySelector("header.sticky") || document.querySelector("header")
    const headerHeight = stickyHeader ? stickyHeader.offsetHeight : 72
    // Comfortable padding buffer above the target element so the card header is fully visible
    const buffer = 24
    const totalOffset = headerHeight + buffer

    if (
      scrollContainer &&
      scrollContainer !== document.documentElement &&
      scrollContainer !== document.body &&
      scrollContainer.scrollHeight > scrollContainer.clientHeight
    ) {
      const containerRect = scrollContainer.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      const targetScroll = scrollContainer.scrollTop + (elRect.top - containerRect.top) - totalOffset
      scrollContainer.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: "smooth",
      })
    } else {
      // Window scroll fallback
      const elRect = el.getBoundingClientRect()
      const targetScroll = window.scrollY + elRect.top - totalOffset
      window.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: "smooth",
      })
    }

    // Visual pulse highlight
    el.classList.add("ring-2", "ring-primary", "ring-offset-4", "transition-all")
    setTimeout(() => {
      el.classList.remove("ring-2", "ring-primary", "ring-offset-4")
    }, 1500)
  }

  const handleJump = (cls) => {
    setActiveId(cls.id)
    onJumpToClass?.(cls)

    // Smooth scroll to the first section of this class or its container with sticky header offset
    const el =
      document.getElementById(`class-group-${cls.id}`) ||
      document.getElementById(`class-section-${cls.sections?.[0]?.id}`)
    scrollToTargetWithOffset(el)
  }

  const handleJumpToSection = (cls, section) => {
    setActiveId(cls.id)
    setActiveSectionId(section.id)
    onJumpToSection?.(cls, section)

    // Smooth scroll directly to that class's section with sticky header offset
    const el = document.getElementById(`class-section-${section.id}`)
    scrollToTargetWithOffset(el)
  }

  const scrollToTop = () => {
    const scrollContainer = document.querySelector("main")
    if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
      scrollContainer.scrollTo({ top: 0, behavior: "smooth" })
    }
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (!classes || classes.length === 0) return null

  const isSectionStripOpen = Boolean(hoveredClass && displayClass?.sections?.length > 0)

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-[95vw] sm:max-w-fit flex flex-col items-center">
      {/* SECTION STRIP POPUP (Appears directly above Jump to rail when class is hovered > 500ms) */}
      <div
        onMouseEnter={handleStripMouseEnter}
        onMouseLeave={handleStripMouseLeave}
        className={cn(
          "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex items-center gap-1.5 p-1.5 px-3",
          "bg-card/95 dark:bg-card/95 backdrop-blur-md border border-border/80 rounded-full shadow-xl text-xs",
          "overflow-x-auto scrollbar-none max-w-[90vw] whitespace-nowrap z-40",
          "transition-all duration-200 ease-out origin-bottom",
          "after:absolute after:left-0 after:right-0 after:-bottom-2 after:h-2 after:content-['']",
          isSectionStripOpen
            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
            : "opacity-0 scale-95 translate-y-2 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-1 px-1.5 text-muted-foreground font-semibold text-[10px] shrink-0 border-r border-border/60 mr-0.5">
          <span className="font-bold text-foreground">{displayClass?.name}</span>
          <span className="text-[9px] text-muted-foreground/80 font-medium uppercase tracking-wider">
            Sections
          </span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
          {displayClass?.sections?.map((sec) => {
            const isSectionActive =
              activeId === displayClass.id && activeSectionId === sec.id

            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => handleJumpToSection(displayClass, sec)}
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95",
                  isSectionActive
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "bg-muted/50 hover:bg-primary hover:text-primary-foreground text-foreground"
                )}
                title={`Jump to ${displayClass.name} - Section ${sec.name}`}
              >
                {sec.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* MAIN JUMP TO RAIL */}
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
                onMouseEnter={() => handleClassMouseEnter(cls)}
                onMouseLeave={handleClassMouseLeave}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs scale-105"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
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
