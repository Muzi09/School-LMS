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
      <div className="space-y-1">
        <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
          {Icon && (
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Icon className="size-5" />
            </div>
          )}
          <span>{title}</span>
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 leading-normal">
            {description}
          </p>
        )}
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
