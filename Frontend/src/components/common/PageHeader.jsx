import React from "react"
import { useLocation } from "react-router-dom"
import { getRouteMeta } from "@/constants/nav-items"
import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  children,
  className,
  ...props
}) {
  const location = useLocation()
  const meta = getRouteMeta(location.pathname)

  const finalTitle = title ?? meta.title
  const finalDescription = description ?? meta.description

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-4",
        className
      )}
      {...props}
    >
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {finalTitle}
        </h1>
        {finalDescription && (
          <p className="text-xs text-muted-foreground">
            {finalDescription}
          </p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {children}
        </div>
      )}
    </div>
  )
}

export default PageHeader
