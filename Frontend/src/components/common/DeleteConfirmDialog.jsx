import React from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Common Delete / Destructive Confirmation Dialog
 * Used across the app for confirming item deletion (Staff, Students, Classes, etc.)
 */
export function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete Record",
  description,
  itemName,
  subText = "This action cannot be undone and will revoke associated permissions.",
  confirmText = "Delete",
  cancelText = "Cancel",
  isPending = false,
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200">
      <div
        className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-4">
          <div className="size-11 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0 border border-destructive/20 shadow-xs">
            <AlertTriangle className="size-5.5" />
          </div>
          <div className="space-y-1.5 flex-1">
            <h3 className="text-base sm:text-lg font-semibold text-foreground tracking-tight">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description ? (
                description
              ) : itemName ? (
                <>
                  Are you sure you want to delete{" "}
                  <strong className="text-foreground font-semibold">
                    {itemName}
                  </strong>
                  ? {subText}
                </>
              ) : (
                subText
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onClose}
            disabled={isPending}
            className="h-9 px-4 text-sm font-medium"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="default"
            onClick={onConfirm}
            disabled={isPending}
            className="h-9 px-4 text-sm font-medium gap-2 shadow-xs"
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            <span>{confirmText}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmDialog
