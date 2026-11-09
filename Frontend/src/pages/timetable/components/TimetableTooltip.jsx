import React, { useState, useEffect, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

const tooltipListeners = new Set()
let activeTooltipState = null

export function showTimetableTooltip(text, targetEl) {
  if (!text || !targetEl) return
  activeTooltipState = { text, targetEl }
  tooltipListeners.forEach((fn) => fn(activeTooltipState))
}

export function hideTimetableTooltip() {
  if (!activeTooltipState) return
  activeTooltipState = null
  tooltipListeners.forEach((fn) => fn(null))
}

export function TimetableTooltip() {
  const [tooltipState, setTooltipState] = useState(null)
  const [pos, setPos] = useState({ left: 0, top: 0, opacity: 0 })
  const tooltipRef = useRef(null)
  const timerRef = useRef(null)
  const isWarmRef = useRef(false)
  const warmTimerRef = useRef(null)

  useEffect(() => {
    const handleUpdate = (state) => {
      clearTimeout(timerRef.current)
      if (!state) {
        clearTimeout(warmTimerRef.current)
        warmTimerRef.current = setTimeout(() => {
          isWarmRef.current = false
        }, 250)
        setTooltipState(null)
        setPos((prev) => ({ ...prev, opacity: 0 }))
        return
      }

      const show = () => {
        isWarmRef.current = true
        clearTimeout(warmTimerRef.current)
        try {
          const rect = state.targetEl.getBoundingClientRect()
          setTooltipState({
            text: state.text,
            targetRect: rect,
          })
        } catch {
          setTooltipState(null)
        }
      }

      if (isWarmRef.current) {
        show()
      } else {
        timerRef.current = setTimeout(show, 100)
      }
    }

    tooltipListeners.add(handleUpdate)
    return () => {
      tooltipListeners.delete(handleUpdate)
      clearTimeout(timerRef.current)
      clearTimeout(warmTimerRef.current)
    }
  }, [])

  // Auto-hide on scroll, window resize, or tab blur
  useEffect(() => {
    if (!tooltipState) return
    const handleDismiss = () => {
      setTooltipState(null)
      setPos((prev) => ({ ...prev, opacity: 0 }))
    }

    window.addEventListener("scroll", handleDismiss, { passive: true, capture: true })
    window.addEventListener("resize", handleDismiss, { passive: true })
    window.addEventListener("blur", handleDismiss)

    return () => {
      window.removeEventListener("scroll", handleDismiss, { capture: true })
      window.removeEventListener("resize", handleDismiss)
      window.removeEventListener("blur", handleDismiss)
    }
  }, [tooltipState])

  useLayoutEffect(() => {
    if (!tooltipState || !tooltipRef.current) return

    const el = tooltipRef.current
    const tooltipWidth = el.offsetWidth
    const tooltipHeight = el.offsetHeight
    const { targetRect } = tooltipState

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const padding = 16

    // Center horizontally over target element
    let left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2

    // Clamp horizontally so it stays within viewport boundaries
    if (left + tooltipWidth > viewportWidth - padding) {
      left = viewportWidth - padding - tooltipWidth
    }
    if (left < padding) {
      left = padding
    }

    // Position vertically: below by default, flip above if not enough room below
    let top = targetRect.bottom + 6
    if (top + tooltipHeight > viewportHeight - padding) {
      top = targetRect.top - 6 - tooltipHeight
    }
    if (top < padding) {
      top = padding
    }

    setPos({
      left: Math.round(left),
      top: Math.round(top),
      opacity: 1,
    })
  }, [tooltipState])

  if (!tooltipState) return null

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      style={{
        position: "fixed",
        left: `${pos.left}px`,
        top: `${pos.top}px`,
        opacity: pos.opacity,
        maxWidth: "calc(100vw - 32px)",
        width: "max-content",
        pointerEvents: "none",
      }}
      className={cn(
        "z-[9999] px-3 py-1.5 rounded-xl text-xs font-medium shadow-2xl transition-opacity duration-100",
        "bg-zinc-900/95 text-zinc-100 border border-zinc-700/60 backdrop-blur-md text-center",
        "break-words whitespace-normal"
      )}
    >
      {tooltipState.text}
    </div>,
    document.body
  )
}

