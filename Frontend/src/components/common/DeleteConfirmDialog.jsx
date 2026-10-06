import { AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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
  className,
}) {
  if (!isOpen) return null

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center p-4", className)}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl p-6 space-y-5 z-10 animate-in zoom-in-95 duration-200"
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

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/80">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
            className="h-10 px-5 text-sm font-medium rounded-xl cursor-pointer"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
            className="h-10 px-6 text-sm font-semibold rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm gap-2 cursor-pointer"
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
