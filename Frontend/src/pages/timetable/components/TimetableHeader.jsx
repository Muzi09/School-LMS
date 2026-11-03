import {
  Edit3,
  Check,
  CheckCircle2,
  Loader2,
} from "lucide-react"
import { PerspectiveSelector } from "./PerspectiveSelector"
import { WingSelector } from "./WingSelector"
import { SearchFilterBar } from "./SearchFilterBar"
import { ZoomControls } from "./ZoomDensityControls"
import { cn } from "@/lib/utils"

export function TimetableHeader({
  // Perspective
  perspective,
  onPerspectiveChange,

  // Wings
  wings = [],
  selectedWingIds = [],
  onSelectWingIds,

  // Search
  searchQuery,
  onSearchChange,

  // Assign mode
  canManage = false,
  isAssignMode,
  onToggleAssignMode,
  saveStatus = "saved", // "saved" | "saving" | "unsaved"

  // Zoom
  zoomLevel = 100,
  onZoomChange,
  className,
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-md",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 flex-wrap lg:flex-nowrap">
        {/* Left Section: Perspective, Wing, Search Bar */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap flex-1 min-w-0">
          {/* Perspective Selector */}
          <PerspectiveSelector
            currentPerspective={perspective}
            onChange={onPerspectiveChange}
          />

          {/* Wing Selector */}
          <WingSelector
            wings={wings}
            selectedWingIds={selectedWingIds}
            onSelectWingIds={onSelectWingIds}
          />

          {/* Search Bar with reduced width */}
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            className="w-48 sm:w-60 shrink-0"
          />
        </div>

        {/* Right Section: Autosave Status, Assign Button, Zoom Controls */}
        <div className="flex items-center gap-2.5 shrink-0 ml-auto">
          {/* Autosave Status Pill */}
          {isAssignMode && (
            <div
              className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground px-2.5 py-1 rounded-xl bg-muted/50 border border-border/50 font-medium"
              aria-live="polite"
            >
              {saveStatus === "saving" ? (
                <>
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                  <span>Saving…</span>
                </>
              ) : saveStatus === "unsaved" ? (
                <>
                  <span className="size-2 rounded-full bg-amber-500" />
                  <span>Unsaved</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span>All saved</span>
                </>
              )}
            </div>
          )}

          {/* Assign Mode Toggle Button */}
          {canManage && (
            <button
              type="button"
              onClick={onToggleAssignMode}
              className={cn(
                "h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs whitespace-nowrap",
                isAssignMode
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/40 shadow-sm"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              aria-pressed={isAssignMode}
            >
              {isAssignMode ? (
                <>
                  <Check className="size-4" />
                  <span>Done Editing</span>
                </>
              ) : (
                <>
                  <Edit3 className="size-3.5" />
                  <span>Assign</span>
                </>
              )}
            </button>
          )}

          {/* Zoom Controls (placed after Assign button) */}
          <ZoomControls
            zoomLevel={zoomLevel}
            onZoomChange={onZoomChange}
          />
        </div>
      </div>
    </header>
  )
}
