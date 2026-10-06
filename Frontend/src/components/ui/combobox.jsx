import * as React from "react"
import { createPortal } from "react-dom"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Shadcn-style Portaled Combobox component with type-to-search.
 *
 * Features:
 * - Rendered in document.body via React Portal with z-index 99999 (never clipped by modals or scroll containers).
 * - No visible search input field taking up space.
 * - Keyboard type-to-search (typeahead filtering): typing letters/numbers actively filters and highlights options.
 * - ArrowUp/ArrowDown navigation, Enter to select, Backspace to edit search, Escape to close.
 * - Auto-scrolls highlighted item into view.
 * - Fixed positioning anchored to trigger button, flips upward if near screen bottom.
 */
export function Combobox({
  options = [],
  value,
  onValueChange,
  onChange,
  placeholder = "Select an option...",
  emptyText = "No results found.",
  searchable = true,
  clearable = false,
  disabled = false,
  showDescriptionInTrigger = true,
  anchorRef,
  anchorSelector,
  className,
  popoverClassName,
  id,
  name,
}) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
  const [coords, setCoords] = React.useState({
    top: undefined,
    bottom: undefined,
    left: 0,
    width: 0,
    openUpwards: false,
    maxHeight: 260,
  })

  const containerRef = React.useRef(null)
  const triggerButtonRef = React.useRef(null)
  const popoverRef = React.useRef(null)
  const listRef = React.useRef(null)
  const lastKeyTimeRef = React.useRef(0)

  // Normalize options to { value, label, description, disabled }
  const normalizedOptions = React.useMemo(() => {
    return options.map((opt) => {
      if (opt && typeof opt === "object") {
        const val = opt.value !== undefined ? opt.value : opt.id
        const lbl = opt.label !== undefined ? opt.label : (opt.name || String(val))
        return {
          value: val,
          label: String(lbl),
          description: opt.description || opt.code || opt.department || null,
          disabled: Boolean(opt.disabled),
        }
      }
      return {
        value: opt,
        label: String(opt),
        description: null,
        disabled: false,
      }
    })
  }, [options])

  // Filter options based on typed search query
  const filteredOptions = React.useMemo(() => {
    if (!searchable) return normalizedOptions
    const q = searchQuery.trim().toLowerCase()
    if (!q) return normalizedOptions
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q)) ||
        String(opt.value).toLowerCase().includes(q)
    )
  }, [normalizedOptions, searchQuery, searchable])

  // Find currently selected option
  const selectedOption = React.useMemo(() => {
    if (value === undefined || value === null || value === "") return null
    return normalizedOptions.find((opt) => String(opt.value) === String(value)) || null
  }, [normalizedOptions, value])

  // Calculate coordinates for portaled fixed positioning
  const updatePosition = React.useCallback(() => {
    if (!triggerButtonRef.current) return
    const rect = triggerButtonRef.current.getBoundingClientRect()

    // If trigger button is out of viewport, close
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setOpen(false)
      return
    }

    // Determine anchor element for width and horizontal positioning
    let anchorEl = triggerButtonRef.current
    if (anchorRef && anchorRef.current) {
      anchorEl = anchorRef.current
    } else if (anchorSelector) {
      anchorEl = triggerButtonRef.current.closest(anchorSelector) || triggerButtonRef.current
    }
    const anchorRect = anchorEl.getBoundingClientRect()

    const spaceBelow = window.innerHeight - anchorRect.bottom
    const spaceAbove = anchorRect.top
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow
    const availableHeight = openUp ? spaceAbove - 16 : spaceBelow - 16
    const maxHeight = Math.min(260, Math.max(120, availableHeight))

    let left = anchorRect.left
    let width = anchorRect.width

    // Guard against horizontal viewport overflow
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8)
    }
    if (left < 8) {
      left = 8
      width = Math.min(width, window.innerWidth - 16)
    }

    setCoords({
      top: openUp ? undefined : anchorRect.bottom + 4,
      bottom: openUp ? window.innerHeight - anchorRect.top + 4 : undefined,
      left,
      width,
      openUpwards: openUp,
      maxHeight,
    })
  }, [anchorRef, anchorSelector])

  // Open / Close toggle
  const handleOpenToggle = () => {
    if (disabled) return
    if (!open) {
      updatePosition()
      setSearchQuery("")
      const curIdx = normalizedOptions.findIndex((opt) => String(opt.value) === String(value))
      setHighlightedIndex(curIdx >= 0 ? curIdx : 0)
    }
    setOpen((prev) => !prev)
  }

  // Update position on scroll / resize
  React.useEffect(() => {
    if (!open) return
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
  }, [open, updatePosition])

  // Close on outside click
  React.useEffect(() => {
    if (!open) return

    const handleClickOutside = (e) => {
      const target = e.target
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setOpen(false)
        setSearchQuery("")
      }
    }

    document.addEventListener("mousedown", handleClickOutside, true)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true)
    }
  }, [open])

  // Auto-scroll highlighted option into view
  React.useEffect(() => {
    if (!open || highlightedIndex < 0 || !listRef.current) return
    const el = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`)
    if (el) {
      el.scrollIntoView({ block: "nearest" })
    }
  }, [open, highlightedIndex])

  // Handle selection
  const handleSelect = (optionValue) => {
    const curVal = value === undefined || value === null ? "" : String(value)
    const optVal = optionValue === undefined || optionValue === null ? "" : String(optionValue)
    const finalValue = clearable && curVal === optVal && optVal !== "" ? "" : optionValue
    onValueChange?.(finalValue)

    if (onChange) {
      const syntheticEvent = {
        target: { name: name || id, id, value: finalValue },
        currentTarget: { name: name || id, id, value: finalValue },
      }
      onChange(syntheticEvent, finalValue)
    }

    setOpen(false)
    setSearchQuery("")
    triggerButtonRef.current?.focus()
  }

  // Handle clear button
  const handleClear = (e) => {
    e?.stopPropagation()
    onValueChange?.("")
    if (onChange) {
      const syntheticEvent = {
        target: { name: name || id, id, value: "" },
        currentTarget: { name: name || id, id, value: "" },
      }
      onChange(syntheticEvent, "")
    }
    setOpen(false)
  }

  // Keyboard navigation & Type-to-search (no search field needed)
  const handleKeyDown = (e) => {
    if (disabled) return

    // 1. When closed
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleOpenToggle()
        return
      }

      // If user types a character while focused on button, open and search immediately
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && e.key !== " ") {
        e.preventDefault()
        setOpen(true)
        updatePosition()
        setSearchQuery(e.key.toLowerCase())
        lastKeyTimeRef.current = e.timeStamp
        setHighlightedIndex(0)
        return
      }
      return
    }

    // 2. When open
    if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      setSearchQuery("")
      triggerButtonRef.current?.focus()
      return
    }

    if (e.key === "Tab") {
      setOpen(false)
      setSearchQuery("")
      return
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      )
      return
    }

    if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      )
      return
    }

    if (e.key === "Enter") {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        const targetOpt = filteredOptions[highlightedIndex]
        if (!targetOpt.disabled) {
          handleSelect(targetOpt.value)
        }
      } else if (filteredOptions.length > 0 && !filteredOptions[0].disabled) {
        handleSelect(filteredOptions[0].value)
      }
      return
    }

    if (e.key === "Backspace") {
      if (searchable && searchQuery.length > 0) {
        e.preventDefault()
        setSearchQuery((prev) => prev.slice(0, -1))
        lastKeyTimeRef.current = e.timeStamp
        setHighlightedIndex(0)
      }
      return
    }

    // Printable character: append to search buffer
    if (searchable && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (e.key === " " && !searchQuery) {
        e.preventDefault()
        return
      }

      e.preventDefault()
      const now = e.timeStamp
      // If user paused for > 1.2 seconds, start fresh query
      if (now - (lastKeyTimeRef.current || 0) > 1200) {
        setSearchQuery(e.key.toLowerCase())
      } else {
        setSearchQuery((prev) => prev + e.key.toLowerCase())
      }
      lastKeyTimeRef.current = now
      setHighlightedIndex(0)
    }
  }

  return (
    <div className="relative w-full" ref={containerRef} onKeyDown={handleKeyDown}>
      {/* Trigger Button */}
      <button
        ref={triggerButtonRef}
        type="button"
        id={id}
        name={name}
        onClick={handleOpenToggle}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "w-full h-10 rounded-xl border border-transparent bg-input/50 px-3.5 py-2 text-sm text-foreground transition-[color,box-shadow] outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 flex items-center justify-between text-left cursor-pointer",
          open && "border-ring ring-3 ring-ring/30",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <span className="truncate mr-2">
          {selectedOption ? (
            <span className="font-medium text-foreground">
              {selectedOption.label}
              {showDescriptionInTrigger && selectedOption.description && (
                <span className="text-muted-foreground ml-1.5 font-normal text-xs">
                  ({selectedOption.description})
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground font-normal">{placeholder}</span>
          )}
        </span>

        <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
          {clearable && selectedOption && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onPointerDown={(e) => {
                e.stopPropagation()
                e.preventDefault()
                handleClear(e)
              }}
              onClick={handleClear}
              className="p-0.5 rounded-sm hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              title="Clear"
            >
              <X className="size-3.5" />
            </span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-70" />
        </div>
      </button>

      {/* Popover Menu - Rendered in Portal with High Z-Index so it appears above modals */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            role="listbox"
            tabIndex={-1}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            style={{
              position: "fixed",
              top: coords.top !== undefined ? `${coords.top}px` : undefined,
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 99999,
              maxHeight: `${coords.maxHeight}px`,
            }}
            className={cn(
              "rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden flex flex-col animate-in fade-in-0 zoom-in-95 duration-100",
              popoverClassName
            )}
          >
            {/* Options list */}
            <div ref={listRef} className="overflow-y-auto p-1 space-y-0.5 flex-1">
              {clearable && selectedOption && (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    handleClear(e)
                  }}
                  onClick={handleClear}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 text-destructive hover:bg-destructive/10 transition-colors cursor-pointer border-b border-border/50 mb-1 font-medium"
                >
                  <X className="size-3.5 shrink-0" />
                  <span>Clear selection / Unassign</span>
                </button>
              )}
              {filteredOptions.length === 0 ? (
                <div className="py-6 px-3 text-center text-xs text-muted-foreground">
                  {searchQuery ? `No results for "${searchQuery}"` : emptyText}
                </div>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = selectedOption && String(selectedOption.value) === String(opt.value)
                  const isHighlighted = idx === highlightedIndex
                  return (
                    <button
                      key={`${opt.value}-${idx}`}
                      type="button"
                      role="option"
                      data-index={idx}
                      data-highlighted={isHighlighted}
                      aria-selected={isSelected}
                      disabled={opt.disabled}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        if (!opt.disabled) handleSelect(opt.value)
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!opt.disabled) handleSelect(opt.value)
                      }}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg text-xs sm:text-sm flex items-center justify-between text-left transition-colors cursor-pointer",
                        isSelected
                          ? "bg-primary/10 text-primary font-medium"
                          : isHighlighted
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent hover:text-accent-foreground text-foreground",
                        opt.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
                      )}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="truncate">{opt.label}</span>
                        {opt.description && (
                          <span className="text-[11px] text-muted-foreground truncate">
                            {opt.description}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="size-4 text-primary shrink-0" />
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default Combobox
