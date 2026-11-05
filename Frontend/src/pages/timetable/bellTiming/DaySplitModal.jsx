import React from "react"
import { Calendar, Split, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const DAY_FULL_NAMES = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
}

export function DaySplitModal({
  isOpen,
  onClose,
  schedule,
  daysToSplit = [],
  onConfirmSplit,
}) {
  if (!isOpen || daysToSplit.length === 0) return null

  const dayLabels = daysToSplit.map((d) => DAY_FULL_NAMES[d.toUpperCase()] || d)
  const daysFormatted = dayLabels.join(dayLabels.length === 2 ? " and " : ", ")
  const isPlural = daysToSplit.length > 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in-0 duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="split-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl z-10 overflow-hidden flex flex-col space-y-4 p-5 animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Split className="size-5" />
            </div>
            <div>
              <h3 id="split-modal-title" className="text-sm font-bold text-foreground">
                Schedule for {daysFormatted}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure distinct timings for specific weekdays.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-muted/30 border border-border/80 text-xs leading-relaxed space-y-1.5">
          <p className="text-foreground font-semibold">
            {isPlural
              ? `Do ${daysFormatted} have different bell timings than the rest of the days?`
              : `Does ${daysFormatted} have different bell timings than the rest of the days?`}
          </p>
          <p className="text-muted-foreground">
            Splitting will create an independent schedule for {daysFormatted} pre-filled with a copy of the current periods. You can customize period counts and durations without affecting other days.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs text-muted-foreground"
          >
            No (Keep Shared)
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onConfirmSplit(daysToSplit)
              onClose()
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-2xs gap-1.5"
          >
            <Split className="size-3.5" />
            <span>Yes, Split Off</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

