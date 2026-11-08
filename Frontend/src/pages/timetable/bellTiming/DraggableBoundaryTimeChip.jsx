import React, { useState, useRef, useEffect } from "react"
import { MoveHorizontal } from "lucide-react"
import { parseTime, format12h, formatMinutes } from "./timeUtils"
import { cn } from "@/lib/utils"

/**
 * Draggable boundary time chip.
 * Replaces click popup behavior with direct left/right drag-to-adjust in 5-minute intervals.
 * Reports live updates via onDragUpdate to allow real-time shifting of subsequent periods and + icons.
 */
export function DraggableBoundaryTimeChip({
  timeStr,
  onSaveTime,
  onDragUpdate,
  onDragEnd,
  boundaryIndex,
  isFirst = false,
  isLast = false,
  minLimitMinutes = 0,
  maxLimitMinutes = 1435, // 23:55
  disabled = false,
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [previewMinutes, setPreviewMinutes] = useState(null)

  const startXRef = useRef(0)
  const startMinsRef = useRef(0)
  const currentMinsRef = useRef(0)

  const currentMinutes = React.useMemo(() => {
    return parseTime(timeStr)?.totalMinutes ?? 0
  }, [timeStr])

  const onDragUpdateRef = useRef(onDragUpdate)
  onDragUpdateRef.current = onDragUpdate
  const onDragEndRef = useRef(onDragEnd)
  onDragEndRef.current = onDragEnd
  const onSaveTimeRef = useRef(onSaveTime)
  onSaveTimeRef.current = onSaveTime

  const handlePointerDown = (e) => {
    if (disabled || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    startXRef.current = e.clientX
    startMinsRef.current = currentMinutes
    currentMinsRef.current = currentMinutes
    setPreviewMinutes(currentMinutes)
    setIsDragging(true)
  }

  useEffect(() => {
    if (!isDragging) return

    const handlePointerMove = (e) => {
      const deltaX = e.clientX - startXRef.current
      // 10 pixels displacement equals one 5-minute interval (2px per minute)
      const stepTicks = Math.round(deltaX / 10)
      const rawMins = startMinsRef.current + stepTicks * 5
      const clampedMins = Math.max(minLimitMinutes, Math.min(maxLimitMinutes, rawMins))

      if (clampedMins !== currentMinsRef.current) {
        currentMinsRef.current = clampedMins
        setPreviewMinutes(clampedMins)
        onDragUpdateRef.current?.(formatMinutes(clampedMins))
      }
    }

    const handlePointerUp = () => {
      setIsDragging(false)
      const finalMins = currentMinsRef.current
      setPreviewMinutes(null)

      if (finalMins != null && finalMins !== startMinsRef.current) {
        onSaveTimeRef.current?.(formatMinutes(finalMins))
      }
      onDragEndRef.current?.()
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("pointercancel", handlePointerUp)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("pointercancel", handlePointerUp)
    }
  }, [isDragging, minLimitMinutes, maxLimitMinutes])

  // Keyboard navigation support: left/right arrows adjust by 5 minutes
  const handleKeyDown = (e) => {
    if (disabled) return
    if (e.key === "ArrowLeft") {
      e.preventDefault()
      const newMins = Math.max(minLimitMinutes, currentMinutes - 5)
      if (newMins !== currentMinutes) {
        onSaveTimeRef.current?.(formatMinutes(newMins))
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault()
      const newMins = Math.min(maxLimitMinutes, currentMinutes + 5)
      if (newMins !== currentMinutes) {
        onSaveTimeRef.current?.(formatMinutes(newMins))
      }
    }
  }

  const displayTime = previewMinutes != null ? formatMinutes(previewMinutes) : timeStr

  return (
    <div
      role="slider"
      aria-label={`Boundary time: ${format12h(displayTime)}`}
      aria-valuenow={previewMinutes ?? currentMinutes}
      aria-valuemin={minLimitMinutes}
      aria-valuemax={maxLimitMinutes}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border shadow-2xs whitespace-nowrap select-none touch-none transition-colors",
        disabled
          ? "cursor-default opacity-60 border-border/80 bg-background text-muted-foreground"
          : "cursor-ew-resize border-border/80 bg-background text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-105 active:scale-110",
        isDragging &&
          "bg-primary text-primary-foreground font-bold shadow-lg scale-105 z-30 ring-2 ring-primary/40 border-primary cursor-ew-resize"
      )}
      title={
        disabled
          ? format12h(timeStr)
          : "Drag left/right or use arrow keys to adjust time (5-min intervals)"
      }
    >
      <span>{format12h(displayTime)}</span>
      {!disabled && (
        <MoveHorizontal className="size-2.5 opacity-60 shrink-0" />
      )}
    </div>
  )
}

export default DraggableBoundaryTimeChip
