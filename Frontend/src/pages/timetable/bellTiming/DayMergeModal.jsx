import React, { useState } from "react"
import { Calendar, Merge, Check, AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const DAY_FULL_NAMES = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
}

export function DayMergeModal({
  isOpen,
  onClose,
  sourceSchedule,
  allSchedules = [],
  day,
  onConfirmMerge,
}) {
  const otherSchedules = allSchedules.filter((s) => s.id !== sourceSchedule?.id)
  const [selectedTargetId, setSelectedTargetId] = useState(
    otherSchedules[0]?.id || null
  )

  if (!isOpen || !sourceSchedule) return null

  const dayFullName = DAY_FULL_NAMES[day?.toUpperCase()] || day

  const handleMerge = () => {
    if (!selectedTargetId) return
    onConfirmMerge({
      sourceScheduleId: sourceSchedule.id,
      targetScheduleId: selectedTargetId,
      day,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in-0 duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="merge-modal-title"
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
              <Merge className="size-5" />
            </div>
            <div>
              <h3 id="merge-modal-title" className="text-sm font-bold text-foreground">
                Schedule for {dayFullName}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {dayFullName} currently has unique timing.
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

        {/* Warning Callout */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-300 dark:border-amber-700/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <p>
            Merging {dayFullName} back into a shared schedule will discard its custom period timings. {dayFullName} will follow the target schedule's timings.
          </p>
        </div>

        {/* Target Schedule Selection List */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            MERGE BACK WITH:
          </label>
          <div className="space-y-1.5">
            {otherSchedules.map((target) => {
              const isSelected = selectedTargetId === target.id
              const daysList = target.days
                .map((d) => DAY_FULL_NAMES[d.toUpperCase()]?.slice(0, 3) || d)
                .join(", ")

              return (
                <div
                  key={target.id}
                  onClick={() => setSelectedTargetId(target.id)}
                  className={cn(
                    "p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all duration-150 select-none",
                    isSelected
                      ? "bg-primary/5 border-primary ring-1 ring-primary"
                      : "bg-muted/20 border-border/70 hover:bg-muted/40 hover:border-border"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">
                      {daysList} Schedule
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {target.periods?.length || 0} Periods ({target.periods?.[0]?.start_time || "08:30"} – {target.periods?.[target.periods.length - 1]?.end_time || "14:45"})
                    </p>
                  </div>

                  <div
                    className={cn(
                      "size-5 rounded-full border flex items-center justify-center transition-colors shrink-0",
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground/40 bg-background"
                    )}
                  >
                    {isSelected && <Check className="size-3 stroke-[3]" />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
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
            size="sm"
            disabled={!selectedTargetId}
            onClick={handleMerge}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-2xs gap-1.5"
          >
            <Merge className="size-3.5" />
            <span>Confirm & Merge</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

