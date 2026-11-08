import * as React from "react"
import { createPortal } from "react-dom"
import { Clock, Check } from "lucide-react"
import { cn } from "@/lib/utils"

const HOURS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"]
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

  // Snap to nearest 5-minute step
  const roundedM = Math.round(m / 5) * 5
  if (roundedM >= 60) {
    h = (h + 1) % 24
    m = 0
  } else {
    m = roundedM
  }

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

function toTotalMinutes(hour12, minute, period) {
  let h = parseInt(hour12, 10)
  const m = parseInt(minute, 10)
  if (period === "PM" && h < 12) h += 12
  if (period === "AM" && h === 12) h = 0
  return h * 60 + m
}

function parseTimeToTotalMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null
  const parts = timeStr.trim().split(":")
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

function checkTimeDisabled(h12, mStr, pStr, minTime, maxTime) {
  const totalM = toTotalMinutes(h12, mStr, pStr)
  if (minTime) {
    const minM = parseTimeToTotalMinutes(minTime)
    if (minM != null && totalM <= minM) return true
  }
  if (maxTime) {
    const maxM = parseTimeToTotalMinutes(maxTime)
    if (maxM != null && totalM >= maxM) return true
  }
  return false
}

/**
 * Theme-aware Shadcn-styled TimePicker Component.
 * Supports light & dark modes with application design tokens.
 * Features:
 * - Dropdown width expands dynamically to match trigger field's width
 * - Uses the app's default font family (font-sans) with tabular-nums
 * - Ultra-thin scrollbar thumbs without native arrow buttons
 * - Portaled with high z-index to avoid clipping by modal edges
 * - Disables invalid times based on minTime and maxTime constraints
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
  minTime = null,
  maxTime = null,
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
    width: 160,
    openUpwards: false,
  })

  const { hour12, minute, period } = React.useMemo(() => {
    return parseTimeTo12Hour(value)
  }, [value])

  // Draft selection state while time selector is open: { hour12, minute, period }
  const [draft, setDraft] = React.useState(() => parseTimeTo12Hour(value))

  const isMinuteDisabled = React.useCallback(
    (m, h = draft.hour12, p = draft.period) => {
      return checkTimeDisabled(h, m, p, minTime, maxTime)
    },
    [draft.hour12, draft.period, minTime, maxTime]
  )

  const isHourDisabled = React.useCallback(
    (h, p = draft.period) => {
      return MINUTES.every((m) => checkTimeDisabled(h, m, p, minTime, maxTime))
    },
    [draft.period, minTime, maxTime]
  )

  const isPeriodDisabled = React.useCallback(
    (p) => {
      return HOURS.every((h) => isHourDisabled(h, p))
    },
    [isHourDisabled]
  )

  // Sync draft whenever value changes while closed
  React.useEffect(() => {
    if (!isOpen) {
      setDraft(parseTimeTo12Hour(value))
    }
  }, [value, isOpen])

  // Calculate position relative to trigger button, matching field's width
  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()

    // If trigger button is scrolled out of viewport, close
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false)
      return
    }

    const popoverHeight = 230
    // Dropdown width matches the trigger field width (min 160px)
    const popoverWidth = Math.max(160, Math.round(rect.width))

    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const openUp = spaceBelow < popoverHeight && spaceAbove > spaceBelow

    // Keep within horizontal screen bounds & align properly
    let left = rect.left
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
      let initial = parseTimeTo12Hour(value)
      if (checkTimeDisabled(initial.hour12, initial.minute, initial.period, minTime, maxTime)) {
        const validPeriod = ["AM", "PM"].find((p) => !isPeriodDisabled(p)) || initial.period
        const validHour = HOURS.find((h) => !isHourDisabled(h, validPeriod)) || initial.hour12
        const validMin =
          MINUTES.find((m) => !checkTimeDisabled(validHour, m, validPeriod, minTime, maxTime)) || initial.minute
        initial = { hour12: validHour, minute: validMin, period: validPeriod }
      }
      setDraft(initial)
      updatePosition()
    }
    setIsOpen((prev) => !prev)
  }

  const isDraftDisabled = checkTimeDisabled(draft.hour12, draft.minute, draft.period, minTime, maxTime)

  // Confirm selection and commit changes on Done
  const handleDone = () => {
    if (isDraftDisabled) return
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

            {/* 3-Column Time Selector: Hours | Minutes | AM/PM spanning full trigger field width */}
            <div className="flex divide-x divide-border/60 w-full">
              {/* Hours Column */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="text-[10px] uppercase font-bold text-muted-foreground/80 text-center py-1 bg-muted/20 border-b border-border/50 font-sans tracking-wide">
                  Hour
                </div>
                <div
                  ref={hourColRef}
                  className="h-40 overflow-y-auto px-1 py-0.5 space-y-0.5 ultra-thin-scrollbar"
                >
                  {HOURS.map((h) => {
                    const isSelected = h === draft.hour12
                    const isDisabled = isHourDisabled(h)
                    return (
                      <button
                        key={h}
                        type="button"
                        disabled={isDisabled}
                        data-selected={isSelected}
                        onClick={() => handleSelectHour(h)}
                        className={cn(
                          "w-full py-1 px-0.5 rounded-md text-xs font-sans text-center font-medium tabular-nums transition-colors cursor-pointer",
                          isDisabled
                            ? "opacity-25 cursor-not-allowed pointer-events-none text-muted-foreground/50"
                            : isSelected
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
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="text-[10px] uppercase font-bold text-muted-foreground/80 text-center py-1 bg-muted/20 border-b border-border/50 font-sans tracking-wide">
                  Min
                </div>
                <div
                  ref={minColRef}
                  className="h-40 overflow-y-auto px-1 py-0.5 space-y-0.5 ultra-thin-scrollbar"
                >
                  {MINUTES.map((m) => {
                    const isSelected = m === draft.minute
                    const isDisabled = isMinuteDisabled(m)
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={isDisabled}
                        data-selected={isSelected}
                        onClick={() => handleSelectMinute(m)}
                        className={cn(
                          "w-full py-1 px-0.5 rounded-md text-xs font-sans text-center font-medium tabular-nums transition-colors cursor-pointer",
                          isDisabled
                            ? "opacity-25 cursor-not-allowed pointer-events-none text-muted-foreground/50"
                            : isSelected
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
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="text-[10px] uppercase font-bold text-muted-foreground/80 text-center py-1 bg-muted/20 border-b border-border/50 font-sans tracking-wide">
                  AM/PM
                </div>
                <div className="h-40 p-1 flex flex-col justify-center gap-1.5">
                  {PERIODS.map((p) => {
                    const isSelected = p === draft.period
                    const isDisabled = isPeriodDisabled(p)
                    return (
                      <button
                        key={p}
                        type="button"
                        disabled={isDisabled}
                        data-selected={isSelected}
                        onClick={() => handleSelectPeriod(p)}
                        className={cn(
                          "w-full py-2 px-0.5 rounded-md text-xs font-sans font-bold text-center transition-colors cursor-pointer",
                          isDisabled
                            ? "opacity-25 cursor-not-allowed pointer-events-none text-muted-foreground/50"
                            : isSelected
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
                disabled={isDraftDisabled}
                onClick={handleDone}
                className={cn(
                  "w-full h-7 text-xs font-sans font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs",
                  isDraftDisabled && "opacity-40 cursor-not-allowed pointer-events-none"
                )}
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
