import React, { useState } from "react"
import { Trash2, AlertTriangle, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function DeleteSetupModal({
  isOpen,
  onClose,
  setupToDelete,
  assignedCount = 0,
  otherSetups = [],
  sectionAssignments = {},
  onConfirmDelete,
}) {
  const [selectedTargetId, setSelectedTargetId] = useState(() => otherSetups[0]?.id || "")

  if (!isOpen || !setupToDelete) return null

  const hasAssignedClasses = assignedCount > 0

  const handleConfirm = () => {
    onConfirmDelete({
      setupId: setupToDelete.id,
      targetSetupId: hasAssignedClasses ? selectedTargetId : null,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in-0 duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-setup-title"
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
            <div className="size-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <Trash2 className="size-5" />
            </div>
            <div>
              <h3 id="delete-setup-title" className="text-sm font-bold text-foreground">
                Delete {setupToDelete.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {hasAssignedClasses
                  ? "Reassign classes before deleting"
                  : "Confirm setup deletion"}
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

        {hasAssignedClasses ? (
          <>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>{setupToDelete.name}</strong> currently has <strong>{assignedCount} {assignedCount === 1 ? "class" : "classes"}</strong> assigned. Select another setup to receive these classes before deleting:
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                REASSIGN ALL CLASSES TO:
              </label>
              <div className="space-y-1.5 max-h-52 overflow-y-auto scrollbar-thin">
                {otherSetups.map((setup) => {
                  const isSelected = selectedTargetId === setup.id
                  const targetClassesCount = Object.values(sectionAssignments).filter(
                    (sId) => sId === setup.id
                  ).length

                  return (
                    <div
                      key={setup.id}
                      onClick={() => setSelectedTargetId(setup.id)}
                      className={cn(
                        "p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all duration-150 select-none",
                        isSelected
                          ? "bg-primary/5 border-primary ring-1 ring-primary"
                          : "bg-muted/20 border-border/70 hover:bg-muted/40 hover:border-border"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground">
                          {setup.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {targetClassesCount} {targetClassesCount === 1 ? "class" : "classes"} currently assigned
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
          </>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to delete <strong>{setupToDelete.name}</strong>? This setup has 0 classes assigned. This action cannot be undone.
          </p>
        )}

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
            disabled={hasAssignedClasses && !selectedTargetId}
            onClick={handleConfirm}
            className="font-semibold text-xs shadow-2xs gap-1.5 bg-destructive text-white hover:bg-destructive/90"
          >
            <Trash2 className="size-3.5 text-white" />
            <span className="text-white">{hasAssignedClasses ? "Reassign & Delete" : "Delete Setup"}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

