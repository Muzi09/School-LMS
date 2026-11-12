import {
  Edit3,
  Check,
  CheckCircle2,
  Loader2,
  FileSpreadsheet,
  Printer,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { TimetableSelector } from "./TimetableSelector"
import { WingSelector } from "./WingSelector"
import { SearchFilterBar } from "./SearchFilterBar"
import { ZoomControls } from "./ZoomDensityControls"
import { AssignModeBar } from "./AssignModeBar"
import { cn } from "@/lib/utils"

export function TimetableHeader({
  // Timetables
  timetables = [],
  selectedTimetableId,
  onSelectTimetable,
  onCreateNewTimetable,

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
  assignBarProps = null,
  saveStatus = "saved", // "saved" | "saving" | "unsaved"

  // Export & Print actions
  onOpenExport,
  onOpenPrint,

  // Zoom
  zoomLevel = 100,
  onZoomChange,
  className,
}) {
  return (
    <header
      className={cn(
        "sticky top-14 z-20 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-md overflow-hidden transition-all duration-300",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 flex-wrap lg:flex-nowrap">
        {/* Left Section: Timetable Selector, Wing, Search Bar */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap flex-1 min-w-0">
          {/* Timetable Selector */}
          <TimetableSelector
            timetables={timetables}
            selectedTimetableId={selectedTimetableId}
            onSelectTimetable={onSelectTimetable}
            onCreateNew={onCreateNewTimetable}
            canManage={canManage}
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

          {/* Export Timetable to Excel Button */}
          {onOpenExport && (
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={onOpenExport}
              className="h-9 px-3 rounded-xl border border-border/80 bg-background hover:bg-muted/60 text-foreground flex items-center gap-1.5 text-xs font-semibold shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
              title="Export Timetable to Excel (.xlsx)"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          )}

          {/* Print Timetable Schedules Button */}
          {onOpenPrint && (
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={onOpenPrint}
              className="h-9 px-3 rounded-xl border border-border/80 bg-background hover:bg-muted/60 text-foreground flex items-center gap-1.5 text-xs font-semibold shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
              title="Print Timetable Schedules"
            >
              <Printer className="size-3.5 text-primary" />
              <span className="hidden sm:inline">Print</span>
            </Button>
          )}

          {/* Zoom Controls (placed after Assign button) */}
          <ZoomControls
            zoomLevel={zoomLevel}
            onZoomChange={onZoomChange}
          />
        </div>
      </div>

      {/* Edit Mode Helper Strip: Embedded inside filter & search card with smooth gradual push animation */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out border-t",
          isAssignMode
            ? "grid-rows-[1fr] opacity-100 border-border/60"
            : "grid-rows-[0fr] opacity-0 border-transparent pointer-events-none"
        )}
      >
        <div className="overflow-hidden min-h-0">
          <div className="px-4 sm:px-6 py-2.5 flex justify-center items-center w-full">
            <AssignModeBar
              isActive={isAssignMode}
              unassignedCount={assignBarProps?.unassignedCount || 0}
              conflictsCount={assignBarProps?.conflictsCount || 0}
              completionPct={assignBarProps?.completionPct ?? 0}
              canUndo={assignBarProps?.canUndo || false}
              canRedo={assignBarProps?.canRedo || false}
              onUndo={assignBarProps?.onUndo}
              onRedo={assignBarProps?.onRedo}
              onExitMode={onToggleAssignMode}
              issuesList={assignBarProps?.issuesList || []}
              onResolveConflict={assignBarProps?.onResolveConflict}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
