import React, { useState } from "react"
import { Send, Plus, Check, Layers, AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function MoveScheduleModal({
  isOpen,
  onClose,
  targetType = "SECTION", // "SECTION" | "CLASS" | "WING" | "MULTI"
  targetInfo = null, // { name, wingName, className, sectionCount, sectionIds }
  currentSetupId,
  setups = [],
  sectionAssignments = {},
  onMoveToSetup,
  onCreateAndMove,
}) {
  const [selectedSetupId, setSelectedSetupId] = useState(null)

  if (!isOpen || !targetInfo) return null

  const count = targetInfo.sectionCount || targetInfo.sectionIds?.length || 1
  const pluralClasses = count === 1 ? "1 class" : `${count} classes`

  let modalTitle = `Send to Bell Setup`
  if (targetType === "WING") {
    modalTitle = `Send ${targetInfo.name} Wing (${pluralClasses}) to:`
  } else if (targetType === "CLASS") {
    modalTitle = `Send ${targetInfo.name} (${targetInfo.wingName || "Wing"}) (${pluralClasses}) to:`
  } else if (targetType === "SECTION") {
    modalTitle = `Send ${targetInfo.className || "Class"} - ${targetInfo.name} — ${targetInfo.wingName || "Wing"} (${pluralClasses}) to:`
  } else if (targetType === "MULTI") {
    modalTitle = `Send ${pluralClasses} to:`
  }

  const handleSelectSetup = (setupId) => {
    if (setupId === currentSetupId) return
    onMoveToSetup({
      sectionIds: targetInfo.sectionIds,
      targetSetupId: setupId,
      count,
    })
    onClose()
  }

  const handleCreateNew = () => {
    onCreateAndMove({
      sectionIds: targetInfo.sectionIds,
      sourceSetupId: currentSetupId,
      count,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in-0 duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-schedule-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-card border border-border shadow-2xl rounded-2xl z-10 overflow-hidden flex flex-col space-y-4 p-5 animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Send className="size-5" />
            </div>
            <div>
              <h3 id="move-schedule-title" className="text-sm font-bold text-foreground">
                Move Schedule
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                {modalTitle}
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

        {/* Setups List */}
        <div className="space-y-2 py-1 max-h-72 overflow-y-auto scrollbar-thin">
          {setups.map((setup, sIdx) => {
            const isCurrent = setup.id === currentSetupId
            // Compute classes count in this setup
            const assignedCount = Object.values(sectionAssignments).filter((sId) => sId === setup.id).length
            const isSelected = selectedSetupId === setup.id

            return (
              <div
                key={setup.id}
                onClick={() => {
                  if (!isCurrent) setSelectedSetupId(setup.id)
                }}
                className={cn(
                  "p-3 rounded-xl border flex items-center justify-between gap-3 transition-all duration-150 select-none",
                  isCurrent
                    ? "bg-muted/30 border-border/70 opacity-70 cursor-not-allowed"
                    : isSelected
                    ? "bg-primary/5 border-primary ring-1 ring-primary cursor-pointer"
                    : "bg-card border-border/70 hover:bg-muted/30 hover:border-border cursor-pointer"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "size-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0",
                      isCurrent
                        ? "bg-muted text-muted-foreground"
                        : "bg-indigo-600 text-white shadow-2xs"
                    )}
                  >
                    {sIdx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground truncate">
                        {setup.name}
                      </span>
                      {isCurrent && (
                        <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0">
                          CURRENT
                        </Badge>
                      )}
                      {assignedCount === 0 && !isCurrent && (
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-300">
                          Empty
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {assignedCount} {assignedCount === 1 ? "class" : "classes"} currently ·{" "}
                      {setup.schedules?.[0]?.periods?.length || 0} periods
                    </p>
                  </div>
                </div>

                {!isCurrent && (
                  <Button
                    type="button"
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelectSetup(setup.id)
                    }}
                    className="bg-primary text-primary-foreground font-semibold text-xs shadow-2xs"
                  >
                    Move Here
                  </Button>
                )}
              </div>
            )
          })}

          {/* "+ Create Setup N" Dashed Card */}
          <button
            type="button"
            onClick={handleCreateNew}
            className="w-full p-3.5 border-2 border-dashed border-border/80 hover:border-primary/50 hover:bg-primary/5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-primary transition-all cursor-pointer"
          >
            <Plus className="size-4" />
            <span>+ Create Setup {setups.length + 1} & Move</span>
          </button>
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
        </div>
      </div>
    </div>
  )
}

