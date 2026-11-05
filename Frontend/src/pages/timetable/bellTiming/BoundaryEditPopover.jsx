import React, { useState, useRef, useEffect } from "react"
import { Clock, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { parseTime, format12h } from "./timeUtils"

export function BoundaryEditPopover({
  timeStr,
  onSaveTime,
  boundaryIndex,
  isFirst = false,
  isLast = false,
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [val, setVal] = useState(timeStr)
  const [error, setError] = useState("")
  const popoverRef = useRef(null)

  const handleOpen = () => {
    if (disabled) return
    setVal(timeStr)
    setError("")
    setOpen(true)
  }

  // Click outside to close
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const handleSave = () => {
    const parsed = parseTime(val)
    if (!parsed) {
      setError("Invalid time")
      return
    }
    onSaveTime(parsed.normalized)
    setOpen(false)
  }

  return (
    <div className="relative inline-flex items-center justify-center" ref={popoverRef}>
      <button
        type="button"
        onClick={handleOpen}
        className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-muted/80 hover:bg-muted text-foreground/90 border border-border/70 shadow-2xs hover:border-primary/50 transition-colors cursor-pointer select-none"
        title="Click to edit boundary time"
      >
        {format12h(timeStr)}
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 p-3 shadow-2xl border border-border bg-card rounded-xl space-y-2.5 z-50 animate-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between text-xs font-bold text-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-primary" />
              <span>Edit Boundary Time</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            <Input
              value={val}
              onChange={(e) => {
                setVal(e.target.value)
                setError("")
              }}
              placeholder="e.g. 9:15, 09:15, 9:15 am"
              className="h-8 text-xs font-mono"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave()
                if (e.key === "Escape") setOpen(false)
              }}
            />
            {error && <p className="text-[11px] text-destructive font-medium">{error}</p>}
          </div>
          <div className="flex items-center justify-end gap-1.5 pt-1">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="xs"
              onClick={handleSave}
              className="h-7 text-xs bg-primary text-primary-foreground font-semibold"
            >
              Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
