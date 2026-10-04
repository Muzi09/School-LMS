import * as React from "react"
import { createPortal } from "react-dom"
import { Clock, Check } from "lucide-react"
import { cn } from "@/lib/utils"

const HOURS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))
const PERIODS = ["AM", "PM"]

/**
 * Parse "HH:mm" (24-hour) string into 12-hour components: { hour12, minute, period }
 */
function parseTimeTo12Hour(timeStr) {
  if (!timeStr || typeof timeStr !== "string") {
    return { hour12: "08", minute: "00", period: "AM" }
  }
  const parts = timeStr.trim().split(":")
  let h = parseInt(parts[0], 10)
  let m = parseInt(parts[1], 10)

  if (isNaN(h)) h = 8
  if (isNaN(m)) m = 0

  const period = h >= 12 ? "PM" : "AM"
  let h12 = h % 12
  if (h12 === 0) h12 = 12

  return {
    hour12: String(h12).padStart(2, "0"),
    minute: String(m).padStart(2, "0"),
    period,
  }
}

/**
 * Format 12-hour components into "HH:mm" (24-hour) string
 */
function formatTo24Hour(hour12, minute, period) {
  let h = parseInt(hour12, 10)
  if (period === "PM" && h < 12) h += 12
  if (period === "AM" && h === 12) h = 0
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

/**
 * Format "HH:mm" to user-friendly display "08:00 AM"
 */
function formatDisplayTime(timeStr) {
  if (!timeStr) return ""
  const { hour12, minute, period } = parseTimeTo12Hour(timeStr)
  return `${hour12}:${minute} ${period}`
}

/**
 * Theme-aware Shadcn-styled TimePicker Component.
 * Supports light & dark modes with application design tokens.
 * Features:
 * - Reduced column widths for a sleek, compact popover
 * - Uses the app's default font family (font-sans) with tabular-nums
 * - Ultra-thin scrollbar thumbs without native arrow buttons
 * - Portaled with high z-index to avoid clipping by modal edges
 */
export function TimePicker({
  value = "",
  onChange,
  className,
  disabled = false,
  id,
  name,
  placeholder = "Select Time",
  required = false,
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const triggerRef = React.useRef(null)
  const popoverRef = React.useRef(null)
  const hourColRef = React.useRef(null)
  const minColRef = React.useRef(null)

  const [coords, setCoords] = React.useState({
    top: undefined,
    bottom: undefined,
    left: 0,
    width: 142,
    openUpwards: false,
  })

  const { hour12, minute, period } = React.useMemo(() => {
    return parseTimeTo12Hour(value)
  }, [value])

  // Draft selection state while time selector is open: { hour12, minute, period }
  const [draft, setDraft] = React.useState(() => parseTimeTo12Hour(value))

  // Sync draft whenever value changes while closed
  React.useEffect(() => {
    if (!isOpen) {
      setDraft(parseTimeTo12Hour(value))
    }
  }, [value, isOpen])

  // Calculate position relative to trigger button
  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()

    // If trigger button is scrolled out of viewport, close
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false)
      return
    }

    const popoverHeight = 230
    const popoverWidth = 142 // Compact column width: 46px + 46px + 48px + borders = 142px

    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const openUp = spaceBelow < popoverHeight && spaceAbove > spaceBelow

    // Keep within horizontal screen bounds & align properly
    let left = rect.left
    if (rect.right < rect.left + popoverWidth || rect.right > window.innerWidth - 100) {
      const rightAlignedLeft = rect.right - popoverWidth
      if (rightAlignedLeft >= 12) {
        left = rightAlignedLeft
      }
    }
    if (left + popoverWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - popoverWidth - 12)
    }
    if (left < 12) left = 12

    setCoords({
      top: openUp ? undefined : rect.bottom + 4,
      bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
      left,
      width: popoverWidth,
      openUpwards: openUp,
    })
  }, [])

  const handleOpenToggle = () => {
    if (disabled) return
    if (!isOpen) {
      // Initialize draft from current value when opening
      setDraft(parseTimeTo12Hour(value))
      updatePosition()
    }
    setIsOpen((prev) => !prev)
  }

  // Confirm selection and commit changes on Done
  const handleDone = () => {
    const final24 = formatTo24Hour(draft.hour12, draft.minute, draft.period)
    if (final24 !== value) {
      onChange?.(final24)
    }
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  // Handle outside click (close without saving, previous time remains)
  React.useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e) => {
      const target = e.target
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside, true)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true)
    }
  }, [isOpen])

  // Handle scroll & resize
  React.useEffect(() => {
    if (!isOpen) return
    updatePosition()

    const handleScroll = (e) => {
      if (popoverRef.current && popoverRef.current.contains(e.target)) {
        return
      }
      updatePosition()
    }

    const handleResize = () => {
      updatePosition()
    }

    window.addEventListener("scroll", handleScroll, true)
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("scroll", handleScroll, true)
      window.removeEventListener("resize", handleResize)
    }
  }, [isOpen, updatePosition])

  // Auto-scroll selected hour & minute into center view when opened
  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const hourEl = hourColRef.current?.querySelector('[data-selected="true"]')
        if (hourEl) {
          hourEl.scrollIntoView({ block: "center" })
        }
        const minEl = minColRef.current?.querySelector('[data-selected="true"]')
        if (minEl) {
          minEl.scrollIntoView({ block: "center" })
        }
      }, 20)
    }
  }, [isOpen])

  // Handle draft selection updates (does NOT trigger onChange)
  const handleSelectHour = (newHour) => {
    setDraft((prev) => ({ ...prev, hour12: newHour }))
  }

  const handleSelectMinute = (newMin) => {
    setDraft((prev) => ({ ...prev, minute: newMin }))
  }

  const handleSelectPeriod = (newPeriod) => {
    setDraft((prev) => ({ ...prev, period: newPeriod }))
  }

  const handleKeyDown = (e) => {
    if (disabled) return
    if (e.key === "Escape" && isOpen) {
      e.preventDefault()
      setIsOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === "Enter" && isOpen) {
      e.preventDefault()
      handleDone()
    } else if ((e.key === "Enter" || e.key === " ") && !isOpen) {
      e.preventDefault()
      handleOpenToggle()
    }
  }

  return (
    <div className="relative w-full" onKeyDown={handleKeyDown}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={name}
        onClick={handleOpenToggle}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={cn(
          "w-full h-9 rounded-xl border border-transparent bg-input/50 px-3 py-1.5 text-xs font-sans text-foreground transition-[color,box-shadow] outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 flex items-center justify-between text-left cursor-pointer",
          isOpen && "border-ring ring-3 ring-ring/30",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <span className="truncate font-semibold tracking-wide tabular-nums font-sans">
          {value ? formatDisplayTime(value) : (
            <span className="text-muted-foreground font-normal font-sans">{placeholder}</span>
          )}
        </span>

        <Clock className="size-3.5 text-muted-foreground shrink-0 ml-1 opacity-70" />
      </button>

      {/* Popover Menu - Rendered in Portal to escape modal overflow & adhere to theme */}
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Time Selector"
            style={{
              position: "fixed",
              top: coords.top !== undefined ? `${coords.top}px` : undefined,
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 99999,
            }}
            className="rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden flex flex-col animate-in fade-in-0 zoom-in-95 duration-100 select-none font-sans"
          >
            {/* Header Preview */}
            <div className="p-2 border-b border-border/80 bg-muted/30 text-center">
              <span className="text-xs font-bold text-foreground tracking-tight font-sans tabular-nums">
                {`${draft.hour12}:${draft.minute} ${draft.period}`}
              </span>
            </div>

            {/* Scoped CSS for time selector ultra-thin scrollbar & hidden arrows */}
            <style>{`
              .ultra-thin-scrollbar {
                scrollbar-width: auto !important;
                scrollbar-color: auto !important;
                -webkit-overflow-scrolling: touch;
              }
              .ultra-thin-scrollbar::-webkit-scrollbar {
                width: 2px !important;
                height: 2px !important;
                display: block !important;
              }
              .ultra-thin-scrollbar::-webkit-scrollbar-track {
                background: transparent !important;
              }
              .ultra-thin-scrollbar::-webkit-scrollbar-thumb {
                background-color: color-mix(in oklch, var(--foreground) 25%, transparent) !important;
                border-radius: 9999px !important;
              }
              .ultra-thin-scrollbar::-webkit-scrollbar-thumb:hover {
                background-color: color-mix(in oklch, var(--foreground) 45%, transparent) !important;
              }
              .ultra-thin-scrollbar::-webkit-scrollbar-button,
              .ultra-thin-scrollbar::-webkit-scrollbar-button:single-button,
              .ultra-thin-scrollbar::-webkit-scrollbar-button:vertical:decrement,
              .ultra-thin-scrollbar::-webkit-scrollbar-button:vertical:increment {
                display: none !important;
                width: 0 !important;
                height: 0 !important;
              }
              @supports (-moz-appearance: none) {
                .ultra-thin-scrollbar {
                  scrollbar-width: thin !important;
                  scrollbar-color: color-mix(in oklch, var(--foreground) 25%, transparent) transparent !important;
                }
              }
            `}</style>

            {/* 3-Column Time Selector: Hours (46px) | Minutes (46px) | AM/PM (48px) */}
            <div className="flex divide-x divide-border/60">
              {/* Hours Column */}
              <div
                style={{ width: "46px", minWidth: "46px", maxWidth: "46px" }}
                className="shrink-0 flex flex-col min-w-0"
              >
                <div className="text-[10px] uppercase font-bold text-muted-foreground/80 text-center py-1 bg-muted/20 border-b border-border/50 font-sans tracking-wide">
                  Hour
                </div>
                <div
                  ref={hourColRef}
                  className="h-40 overflow-y-auto px-0.5 py-0.5 space-y-0.5 ultra-thin-scrollbar"
                >
                  {HOURS.map((h) => {
                    const isSelected = h === draft.hour12
                    return (
                      <button
                        key={h}
                        type="button"
                        data-selected={isSelected}
                        onClick={() => handleSelectHour(h)}
                        className={cn(
                          "w-full py-1 px-0.5 rounded-md text-xs font-sans text-center font-medium tabular-nums transition-colors cursor-pointer",
                          isSelected
                            ? "bg-primary text-primary-foreground font-bold shadow-xs"
                            : "hover:bg-accent hover:text-accent-foreground text-foreground/85"
                        )}
                      >
                        {h}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Minutes Column */}
              <div
                style={{ width: "46px", minWidth: "46px", maxWidth: "46px" }}
                className="shrink-0 flex flex-col min-w-0"
              >
                <div className="text-[10px] uppercase font-bold text-muted-foreground/80 text-center py-1 bg-muted/20 border-b border-border/50 font-sans tracking-wide">
                  Min
                </div>
                <div
                  ref={minColRef}
                  className="h-40 overflow-y-auto px-0.5 py-0.5 space-y-0.5 ultra-thin-scrollbar"
                >
                  {MINUTES.map((m) => {
                    const isSelected = m === draft.minute
                    return (
                      <button
                        key={m}
                        type="button"
                        data-selected={isSelected}
                        onClick={() => handleSelectMinute(m)}
                        className={cn(
                          "w-full py-1 px-0.5 rounded-md text-xs font-sans text-center font-medium tabular-nums transition-colors cursor-pointer",
                          isSelected
                            ? "bg-primary text-primary-foreground font-bold shadow-xs"
                            : "hover:bg-accent hover:text-accent-foreground text-foreground/85"
                        )}
                      >
                        {m}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* AM / PM Column */}
              <div
                style={{ width: "48px", minWidth: "48px", maxWidth: "48px" }}
                className="shrink-0 flex flex-col min-w-0"
              >
                <div className="text-[10px] uppercase font-bold text-muted-foreground/80 text-center py-1 bg-muted/20 border-b border-border/50 font-sans tracking-wide">
                  AM/PM
                </div>
                <div className="h-40 p-1 flex flex-col justify-center gap-1.5">
                  {PERIODS.map((p) => {
                    const isSelected = p === draft.period
                    return (
                      <button
                        key={p}
                        type="button"
                        data-selected={isSelected}
                        onClick={() => handleSelectPeriod(p)}
                        className={cn(
                          "w-full py-2 px-0.5 rounded-md text-xs font-sans font-bold text-center transition-colors cursor-pointer",
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "hover:bg-accent hover:text-accent-foreground text-foreground/85"
                        )}
                      >
                        {p}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Done / Confirm Footer */}
            <div className="p-1.5 border-t border-border/80 bg-muted/20">
              <button
                type="button"
                onClick={handleDone}
                className="w-full h-7 text-xs font-sans font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs"
              >
                <Check className="size-3.5" />
                <span>Done</span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default TimePicker
