import { useLocation } from "react-router-dom"
import { Sun, Moon } from "lucide-react"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/context/ThemeContext"
import { getRouteMeta } from "@/constants/nav-items"

export function AppHeader() {
  const location = useLocation()
  const { resolvedTheme, toggleTheme } = useTheme()
  const currentRouteInfo = getRouteMeta(location.pathname)

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md transition-[width,height] ease-linear">
      {/* Left Area: Sidebar Trigger & Breadcrumb */}
      <div className="flex items-center gap-3">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />

        <Breadcrumb>
          <BreadcrumbList>
            {currentRouteInfo.groupLabel && (
              <BreadcrumbItem className="hidden md:inline-flex">
                <span className="text-sm text-muted-foreground font-medium">
                  {currentRouteInfo.groupLabel}
                </span>
              </BreadcrumbItem>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage className="text-sm text-foreground">
                {currentRouteInfo.title}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Right Area: Theme Toggle */}
      <div className="flex items-center gap-2 md:gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="size-9 p-0 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
        >
          {resolvedTheme === "dark" ? (
            <Sun className="size-4 text-amber-400" />
          ) : (
            <Moon className="size-4 text-slate-700" />
          )}
        </Button>
      </div>
    </header>
  )
}
