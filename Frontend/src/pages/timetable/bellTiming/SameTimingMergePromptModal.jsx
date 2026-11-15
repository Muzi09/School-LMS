import React from "react"
import { Merge, AlertCircle, X, Check, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const DAY_FULL_NAMES = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
}

function formatDaysList(days = []) {
  if (!days || days.length === 0) return ""
  const names = days.map((d) => DAY_FULL_NAMES[d.toUpperCase()] || d)
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`
}

export function SameTimingMergePromptModal({
  isOpen,
  duplicateGroups = [],
  onConfirmMerge,
  onCancel,
  isMerging = false,
}) {
  if (!isOpen || duplicateGroups.length === 0) return null

  const isMultiple = duplicateGroups.length > 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in-0 duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="same-timing-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity"
        onClick={isMerging ? undefined : onCancel}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-card border border-border shadow-2xl rounded-2xl z-10 overflow-hidden flex flex-col space-y-4 p-5 sm:p-6 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-border/80">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Merge className="size-5" />
            </div>
            <div>
              <h3 id="same-timing-title" className="text-base font-bold text-foreground">
                Same Bell Timing Detected
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Merging identical schedules back together
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isMerging}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close modal"
          >
            {isMerging ? <Loader2 className="size-4 animate-spin text-primary" /> : <X className="size-4" />}
          </button>
        </div>

        {/* Informational Message */}
        <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs leading-relaxed space-y-2">
          <p className="text-foreground font-semibold">
            The following day {isMultiple ? "s have" : "is having"} the same bell timing therefore merging with the other days:
          </p>

          <div className="space-y-2 pt-1">
            {duplicateGroups.map((group, idx) => {
              const sourceLabel = formatDaysList(group.sourceDays)
              const targetLabel = formatDaysList(group.targetDays)

              return (
                <div
                  key={`${group.setupId}_${group.sourceScheduleId}_${idx}`}
                  className="p-3 rounded-lg bg-card border border-border/80 shadow-2xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-foreground">
                      {group.setupName || "Bell Setup"}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-semibold text-primary">
                      Identical Timings
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-xs flex-wrap font-medium">
                    <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary font-bold">
                      {sourceLabel}
                    </span>
                    <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">
                      Merging into <strong className="text-foreground">{targetLabel}</strong>
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Because {sourceLabel} has the same bell timings as {targetLabel}, it will be merged back into a single unified schedule.
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/80 flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isMerging}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onConfirmMerge}
            disabled={isMerging}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-2xs gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isMerging ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Merging & Saving...</span>
              </>
            ) : (
              <>
                <Merge className="size-3.5" />
                <span>Merge & Exit</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

