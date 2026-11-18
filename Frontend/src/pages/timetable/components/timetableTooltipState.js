export const tooltipListeners = new Set()
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
