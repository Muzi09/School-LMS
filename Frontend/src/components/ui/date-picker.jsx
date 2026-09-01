import * as React from "react"
import { createPortal } from "react-dom"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react"
import { cn } from "@/lib/utils"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

/**
 * Format a YYYY-MM-DD string into a human readable display format like "Oct 24, 2008"
 */
function formatDateDisplay(dateStr) {
  if (!dateStr) return ""
  const parts = dateStr.split("-")
  if (parts.length !== 3) return dateStr
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)

  if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr
  const monthName = MONTHS[month]?.slice(0, 3) || ""
  return `${monthName} ${day}, ${year}`
}

function parseDateString(dateStr) {
  if (!dateStr) return null
  const parts = dateStr.split("-")
  if (parts.length !== 3) return null
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null
  return { year, month, day }
}

function toDateString(year, month, day) {
  const y = String(year).padStart(4, "0")
  const m = String(month + 1).padStart(2, "0")
  const d = String(day).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function DatePicker({
  value = "",
  onChange,
  className,
  disabled = false,
  required = false,
  id,
  name,
  minYear = 1950,
  maxYear = new Date().getFullYear() + 5,
  ...props
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const triggerRef = React.useRef(null)
  const popoverRef = React.useRef(null)
  const [coords, setCoords] = React.useState(null)

  const parsed = React.useMemo(() => parseDateString(value), [value])

  const today = React.useMemo(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
  }, [])

  const [viewYear, setViewYear] = React.useState(parsed ? parsed.year : today.year)
  const [viewMonth, setViewMonth] = React.useState(parsed ? parsed.month : today.month)

  // Sync view when value changes externally
  React.useEffect(() => {
    if (parsed) {
      setViewYear(parsed.year)
      setViewMonth(parsed.month)
    }
  }, [value])

  // Calculate popover positioning relative to trigger
  const calculatePosition = React.useCallback(() => {
    if (!triggerRef.current) return null
    const rect = triggerRef.current.getBoundingClientRect()
    const popoverWidth = 288 // 18rem / 72
    const popoverHeight = 320

    let left = rect.left
    if (left + popoverWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - popoverWidth - 12)
    }

    let top = rect.bottom + 6
    // If not enough room below, open above
    if (top + popoverHeight > window.innerHeight - 12 && rect.top > popoverHeight + 12) {
      top = rect.top - popoverHeight - 6
    }

    return { top, left }
  }, [])

  const handleToggleOpen = () => {
    if (disabled) return
    if (!isOpen) {
      const pos = calculatePosition()
      if (pos) {
        setCoords(pos)
      }
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }
  }

  // Position updates and event listeners when open
  React.useLayoutEffect(() => {
    if (!isOpen) return

    const pos = calculatePosition()
    if (pos) {
      setCoords(pos)
    }

    const handleScrollOrResize = () => {
      const updatedPos = calculatePosition()
      if (updatedPos) {
        setCoords(updatedPos)
      }
    }

    const handleClickOutside = (e) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target)
      ) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false)
      }
    }

    window.addEventListener("scroll", handleScrollOrResize, true)
    window.addEventListener("resize", handleScrollOrResize)
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true)
      window.removeEventListener("resize", handleScrollOrResize)
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, calculatePosition])

  // Calendar calculations
  const daysInMonth = React.useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate()
  }, [viewYear, viewMonth])

  const firstDayOfWeek = React.useMemo(() => {
    return new Date(viewYear, viewMonth, 1).getDay()
  }, [viewYear, viewMonth])

  const handlePrevMonth = (e) => {
    e.stopPropagation()
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((prev) => prev - 1)
    } else {
      setViewMonth((prev) => prev - 1)
    }
  }

  const handleNextMonth = (e) => {
    e.stopPropagation()
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((prev) => prev + 1)
    } else {
      setViewMonth((prev) => prev + 1)
    }
  }

  const handleSelectDate = (day) => {
    const dateStr = toDateString(viewYear, viewMonth, day)
    onChange?.(dateStr)
    setIsOpen(false)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onChange?.("")
  }

  const handleSelectToday = (e) => {
    e.stopPropagation()
    const dateStr = toDateString(today.year, today.month, today.day)
    onChange?.(dateStr)
    setViewYear(today.year)
    setViewMonth(today.month)
    setIsOpen(false)
  }

  // Generate Year options
  const yearOptions = React.useMemo(() => {
    const years = []
    for (let y = maxYear; y >= minYear; y--) {
      years.push(y)
    }
    return years
  }, [minYear, maxYear])

  return (
    <div className="relative w-full">
      {/* Hidden native input for form submissions */}
      <input
        type="hidden"
        id={id}
        name={name}
        value={value || ""}
        required={required}
      />

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggleOpen}
        className={cn(
          "h-10 w-full min-w-0 rounded-xl border border-transparent bg-input/50 px-3.5 py-2 text-sm transition-[color,box-shadow] duration-200 outline-none flex items-center justify-between gap-2 text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 text-left cursor-pointer",
          !value && "text-muted-foreground",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-2.5 truncate">
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{value ? formatDateDisplay(value) : "Select date"}</span>
        </div>

        {value && !disabled && (
          <span
            onClick={handleClear}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Clear date"
          >
            <X className="size-3.5" />
          </span>
        )}
      </button>

      {/* Popover Calendar rendered into Body via React Portal */}
      {isOpen &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 9999,
            }}
            className="w-72 rounded-2xl border border-border bg-popover p-3.5 text-popover-foreground shadow-2xl ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95 duration-150 select-none"
          >
            {/* Header Controls */}
            <div className="flex items-center justify-between gap-1 mb-2.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="size-4" />
              </button>

              <div className="flex items-center gap-1.5">
                {/* Month Select */}
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                  className="h-7 rounded-lg bg-muted/60 px-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                >
                  {MONTHS.map((m, idx) => (
                    <option key={m} value={idx} className="bg-popover text-popover-foreground">
                      {m.slice(0, 3)}
                    </option>
                  ))}
                </select>

                {/* Year Select */}
                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                  className="h-7 rounded-lg bg-muted/60 px-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y} className="bg-popover text-popover-foreground">
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
              {DAYS_OF_WEEK.map((d) => (
                <span key={d} className="text-[11px] font-semibold text-muted-foreground py-0.5">
                  {d}
                </span>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {/* Empty slots for offset */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <span key={`empty-${i}`} className="size-8" />
              ))}

              {/* Days of Month */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1
                const isSelected =
                  parsed &&
                  parsed.year === viewYear &&
                  parsed.month === viewMonth &&
                  parsed.day === dayNum
                const isToday =
                  today.year === viewYear &&
                  today.month === viewMonth &&
                  today.day === dayNum

                return (
                  <button
                    key={dayNum}
                    type="button"
                    onClick={() => handleSelectDate(dayNum)}
                    className={cn(
                      "size-8 rounded-xl text-xs font-medium flex items-center justify-center transition-colors cursor-pointer",
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : isToday
                        ? "bg-accent text-accent-foreground font-semibold border border-primary/40 hover:bg-primary/20"
                        : "text-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {dayNum}
                  </button>
                )
              })}
            </div>

            {/* Quick Action Footer */}
            <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleSelectToday}
                className="font-medium text-primary hover:underline cursor-pointer"
              >
                Today
              </button>
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="font-medium text-muted-foreground hover:text-destructive cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default DatePicker
