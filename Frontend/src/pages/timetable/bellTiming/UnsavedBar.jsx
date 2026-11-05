import React from "react"
import { AlertCircle, RotateCcw, RotateCw, Check, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function UnsavedBar({
  isDirty,
  isSaving = false,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onDiscard,
  onSave,
}) {
  if (!isDirty && !isSaving) return null

  return (
    <div className="sticky bottom-0 inset-x-0 z-30 p-3 bg-card/95 backdrop-blur-md border-t border-border shadow-xl flex items-center justify-between gap-3 flex-wrap animate-in slide-in-from-bottom-2 duration-150">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-primary animate-pulse shrink-0" />
        <span className="text-xs font-bold text-foreground">
          You have unsaved changes
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Undo & Redo */}
        <div className="flex items-center gap-1 border-r border-border/70 pr-2">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={!canUndo || isSaving}
            onClick={onUndo}
            className="size-7 p-0 text-muted-foreground hover:text-foreground"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={!canRedo || isSaving}
            onClick={onRedo}
            className="size-7 p-0 text-muted-foreground hover:text-foreground"
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
          >
            <RotateCw className="size-3.5" />
          </Button>
        </div>

        {/* Discard & Save */}
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={isSaving}
          onClick={onDiscard}
          className="text-xs h-8"
        >
          Discard
        </Button>
        <Button
          type="button"
          size="xs"
          disabled={isSaving}
          onClick={onSave}
          className="bg-primary text-primary-foreground font-semibold text-xs h-8 px-3 shadow-2xs gap-1.5"
        >
          {isSaving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
          <span>{isSaving ? "Saving..." : "Save Changes"}</span>
        </Button>
      </div>
    </div>
  )
}

