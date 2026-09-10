import React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Common Modal Header Component for modal dialogs (Add, Edit, Config modals).
 * Provides a standardized layout with an icon badge, title, description, and close action.
 */
export function ModalHeader({
  icon: Icon,
  title,
  description,
  onClose,
  iconClassName,
  titleClassName,
  descriptionClassName,
  badge,
  children,
  className,
  closeButtonTitle = "Close",
  ...props
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-6 py-5 border-b border-border/70 bg-muted/30 shrink-0",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div
            className={cn(
              "size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs shrink-0",
              iconClassName
            )}
          >
            {React.isValidElement(Icon) ? Icon : <Icon className="size-5" />}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className={cn(
                "text-lg font-bold text-foreground tracking-tight",
                titleClassName
              )}
            >
              {title}
            </h3>
            {badge}
          </div>
          {description && (
            <p
              className={cn(
                "text-sm text-muted-foreground mt-0.5",
                descriptionClassName
              )}
            >
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {children}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
            title={closeButtonTitle}
          >
            <X className="size-4.5" />
          </button>
        )}
      </div>
    </div>
  )
}

export default ModalHeader
