import React from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Common Page Header Component with title, icon, descriptive subtitle, and action buttons.
 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  badge,
  iconClassName,
  titleClassName,
  descriptionClassName,
  onRefresh,
  isRefreshing = false,
  onCreate,
  createLabel,
  createIcon: CreateIcon,
  actions,
  children,
  className,
  ...props
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 sm:p-6 rounded-2xl border border-border/80 shadow-xs",
        className
      )}
      {...props}
    >
      {/* Title and Subheading */}
      <div className="flex items-center gap-3.5 min-w-0">
        {Icon && (
          <div
            className={cn(
              "size-10 sm:size-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs shrink-0",
              iconClassName
            )}
          >
            {React.isValidElement(Icon) ? Icon : <Icon className="size-5 sm:size-5.5" />}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2
              className={cn(
                "text-lg sm:text-xl font-bold text-foreground tracking-tight",
                titleClassName
              )}
            >
              {title}
            </h2>
            {badge}
          </div>
          {description && (
            <p
              className={cn(
                "text-sm text-muted-foreground mt-0.5 leading-normal",
                descriptionClassName
              )}
            >
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto flex-wrap">
        {onRefresh && (
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-9 px-4 text-sm font-medium gap-2 shadow-2xs"
          >
            <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
            <span>Refresh</span>
          </Button>
        )}

        {onCreate && (
          <Button
            type="button"
            size="default"
            onClick={onCreate}
            className="h-9 px-4 text-sm font-medium gap-2 shadow-xs"
          >
            {CreateIcon && <CreateIcon className="size-4" />}
            <span>{createLabel || "Create"}</span>
          </Button>
        )}

        {actions}
        {children}
      </div>
    </div>
  )
}

export default PageHeader
