import React from "react"
import { AlertTriangle, Clock, X, Check, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function ImpactWarningDialog({
  isOpen,
  onClose,
  impactData = null,
  onConfirmSave,
}) {
  if (!isOpen || !impactData) return null

  const { affected_slots_count, affected_entries = [], message } = impactData

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in-0 duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="impact-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-card border border-destructive/40 shadow-2xl rounded-2xl z-10 overflow-hidden flex flex-col space-y-4 p-5 animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h3 id="impact-dialog-title" className="text-base font-bold text-foreground">
                Timetable Slots Will Be Affected
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Modifying bell timings impacts existing scheduled lessons.
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

        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive font-medium leading-relaxed">
          {message || `This change directly affects ${affected_slots_count} scheduled lesson slot(s). Removing or renumbering periods will unlink or delete these slots.`}
        </div>

        {/* Affected entries list */}
        {affected_entries.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto border border-border/80 rounded-xl p-2 bg-muted/20 text-xs scrollbar-thin">
            {affected_entries.slice(0, 15).map((e, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/60"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-bold">
                    {e.day} P{e.period_number}
                  </Badge>
                  <span className="font-semibold text-foreground truncate max-w-[200px]">
                    {e.subject || "Subject"}
                  </span>
                </div>
              </div>
            ))}
            {affected_entries.length > 15 && (
              <p className="text-[11px] text-muted-foreground text-center py-1">
                ...and {affected_entries.length - 15} more affected slots
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Cancel & Keep Timings
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onConfirmSave()
              onClose()
            }}
            className="bg-destructive hover:bg-destructive/90 text-white font-semibold text-xs shadow-2xs gap-1.5"
          >
            <Check className="size-3.5" />
            <span>Confirm & Update Timetable</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

