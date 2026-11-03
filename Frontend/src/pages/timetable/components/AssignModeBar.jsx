import React, { useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Undo2,
  Redo2,
  X,
  Keyboard,
  Info,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  ShieldAlert,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

export function AssignModeBar({
  isActive = false,
  unassignedCount = 0,
  conflictsCount = 0,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onExitMode,
  issuesList = [], // [{ id, type: 'conflict'|'unassigned', title, sectionName, day, period, onJump }]
}) {
  const [isIssuesOpen, setIsIssuesOpen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  if (!isActive) return null

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 max-w-[95vw] sm:max-w-2xl transition-all animate-in slide-in-from-bottom duration-200">
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-2 px-3 sm:px-4 bg-card/95 backdrop-blur-md border-2 border-primary/50 rounded-2xl shadow-xl">
          {/* Left: Mode Title & Issue Counts */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
            </span>

            <span className="font-bold text-xs sm:text-sm text-foreground tracking-tight">
              Edit Mode
            </span>

            {/* Conflicts Count */}
            {conflictsCount > 0 ? (
              <Badge
                variant="destructive"
                className="text-[11px] font-bold px-1.5 py-0.5 flex items-center gap-1 cursor-pointer"
                onClick={() => setIsIssuesOpen(true)}
              >
                <AlertTriangle className="size-3" />
                {conflictsCount} {conflictsCount === 1 ? "Conflict" : "Conflicts"}
              </Badge>
            ) : null}

            {/* Unassigned Count */}
            {unassignedCount > 0 ? (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 text-[11px] font-semibold px-1.5 py-0.5 cursor-pointer"
                onClick={() => setIsIssuesOpen(true)}
              >
                {unassignedCount} Unassigned
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 text-[11px] font-semibold px-1.5 py-0.5"
              >
                All Assigned
              </Badge>
            )}
          </div>

          {/* Center: History Undo / Redo */}
          <div className="flex items-center gap-1 border-x border-border/60 px-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onUndo}
              disabled={!canUndo}
              className="text-muted-foreground hover:text-foreground"
              title="Undo last change (Ctrl+Z)"
            >
              <Undo2 className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onRedo}
              disabled={!canRedo}
              className="text-muted-foreground hover:text-foreground"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="size-3.5" />
            </Button>
          </div>

          {/* Right: Review Issues, Shortcuts Hint, Exit */}
          <div className="flex items-center gap-1.5">
            {(conflictsCount > 0 || unassignedCount > 0) && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setIsIssuesOpen(true)}
                className="text-xs font-semibold border-amber-400/50 hover:bg-amber-500/10 text-amber-900 dark:text-amber-200"
              >
                Review Issues
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setShowShortcuts(!showShortcuts)}
              className="text-muted-foreground hover:text-foreground hidden sm:inline-flex"
              title="Keyboard shortcuts"
            >
              <Keyboard className="size-3.5" />
            </Button>

            <Button
              type="button"
              variant="default"
              size="xs"
              onClick={onExitMode}
              className="font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Done Editing
            </Button>
          </div>
        </div>

        {/* Shortcuts Popover Bar */}
        {showShortcuts && (
          <div className="mt-1.5 p-2 bg-popover/95 backdrop-blur-md border border-border/80 rounded-xl shadow-lg text-[11px] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <span><kbd className="px-1 py-0.5 bg-muted rounded border text-[10px]">Arrows</kbd> Move</span>
              <span><kbd className="px-1 py-0.5 bg-muted rounded border text-[10px]">Enter</kbd> Edit</span>
              <span><kbd className="px-1 py-0.5 bg-muted rounded border text-[10px]">Del</kbd> Clear</span>
              <span><kbd className="px-1 py-0.5 bg-muted rounded border text-[10px]">Ctrl+Z</kbd> Undo</span>
              <span><kbd className="px-1 py-0.5 bg-muted rounded border text-[10px]">Ctrl+C/V</kbd> Copy/Paste</span>
              <span><kbd className="px-1 py-0.5 bg-muted rounded border text-[10px]">Alt+Drag</kbd> Duplicate</span>
            </div>
            <button
              type="button"
              onClick={() => setShowShortcuts(false)}
              className="text-muted-foreground hover:text-foreground p-0.5"
            >
              <X className="size-3" />
            </button>
          </div>
        )}
      </div>

      {/* REVIEW ISSUES SHEET / DRAWER */}
      <Sheet open={isIssuesOpen} onOpenChange={setIsIssuesOpen}>
        <SheetContent side="right" className="sm:max-w-md w-full">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-base font-bold">
              <ShieldAlert className="size-5 text-destructive" />
              Timetable Issues & Conflicts
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Resolve teacher double-bookings and unassigned class slots before publishing.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4 max-h-[calc(100vh-140px)] overflow-y-auto pr-1">
            {/* Summary */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs">
              <div className="flex-1">
                <span className="font-semibold text-destructive">{conflictsCount} Conflicts</span>
                <span className="text-muted-foreground"> • </span>
                <span className="font-semibold text-amber-600">{unassignedCount} Unassigned</span>
              </div>
            </div>

            {/* List */}
            {issuesList.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                <CheckCircle2 className="size-8 text-emerald-500" />
                <span className="font-semibold text-foreground">No conflicts detected!</span>
                <span className="text-xs">All periods and teachers are consistently assigned.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {issuesList.map((issue, idx) => (
                  <div
                    key={issue.id || idx}
                    className={cn(
                      "p-3 rounded-xl border transition-all text-xs flex flex-col gap-1.5",
                      issue.type === "conflict"
                        ? "bg-destructive/10 border-destructive/40 text-foreground"
                        : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 text-foreground"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold">
                        {issue.type === "conflict" ? (
                          <AlertTriangle className="size-4 text-destructive shrink-0" />
                        ) : (
                          <div className="size-2 rounded-full bg-amber-500 shrink-0" />
                        )}
                        <span>{issue.sectionName}</span>
                        <span className="text-muted-foreground font-normal">
                          ({issue.day} • {issue.periodLabel})
                        </span>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          issue.onJump?.()
                          setIsIssuesOpen(false)
                        }}
                        className="h-6 text-[11px] font-semibold text-primary hover:bg-primary/10 gap-1 px-1.5"
                      >
                        Jump
                        <ArrowRight className="size-3" />
                      </Button>
                    </div>

                    <p className="text-muted-foreground leading-snug">
                      {issue.title}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

