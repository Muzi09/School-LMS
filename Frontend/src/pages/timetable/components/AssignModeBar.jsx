import React, { useState, useRef, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
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
import { getIsMac, formatTimingsInText } from "../timetableUtils"
import { cn } from "@/lib/utils"

export function AssignModeBar({
  isActive = false,
  unassignedCount = 0,
  conflictsCount = 0,
  completionPct = 0,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onExitMode,
  issuesList = [], // [{ id, type: 'conflict'|'unassigned', title, sectionName, day, period, onJump, onResolve }]
  onResolveConflict,
  className,
}) {
  const [isIssuesOpen, setIsIssuesOpen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showConflictsPopover, setShowConflictsPopover] = useState(false)
  const [isMac, setIsMac] = useState(false)
  const [coords, setCoords] = useState(null)
  const [conflictsCoords, setConflictsCoords] = useState(null)
  const buttonRef = useRef(null)
  const hoverTimeoutRef = useRef(null)
  const conflictsButtonRef = useRef(null)
  const conflictsHoverTimeoutRef = useRef(null)

  useEffect(() => {
    setIsMac(getIsMac())
  }, [])

  const conflictsList = useMemo(() => {
    return (issuesList || []).filter((i) => i.type === "conflict")
  }, [issuesList])

  const shortcuts = useMemo(() => {
    if (isMac) {
      return [
        { label: "Move slot", keys: ["Arrow Keys"] },
        { label: "Assign / Edit slot", keys: ["Return"] },
        { label: "Clear slot", keys: ["Delete ⌫"] },
        { label: "Undo change", keys: ["⌘", "Z"] },
        { label: "Redo change", keys: ["⌘", "⇧", "Z"] },
        { label: "Copy slot", keys: ["⌘", "C"] },
        { label: "Paste slot", keys: ["⌘", "V"] },
        { label: "Duplicate slot", keys: ["⌥", "Drag"] },
      ]
    }
    return [
      { label: "Move slot", keys: ["Arrow Keys"] },
      { label: "Assign / Edit slot", keys: ["Enter"] },
      { label: "Clear slot", keys: ["Delete"] },
      { label: "Undo change", keys: ["Ctrl", "Z"] },
      { label: "Redo change", keys: ["Ctrl", "Y"] },
      { label: "Copy slot", keys: ["Ctrl", "C"] },
      { label: "Paste slot", keys: ["Ctrl", "V"] },
      { label: "Duplicate slot", keys: ["Alt", "Drag"] },
    ]
  }, [isMac])

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setCoords({
        top: rect.bottom + 8,
        right: Math.max(16, window.innerWidth - rect.right),
      })
    }
    setShowShortcuts(true)
  }

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setShowShortcuts(false)
    }, 180)
  }

  const handleConflictsMouseEnter = () => {
    if (conflictsHoverTimeoutRef.current) {
      clearTimeout(conflictsHoverTimeoutRef.current)
      conflictsHoverTimeoutRef.current = null
    }
    if (conflictsButtonRef.current) {
      const rect = conflictsButtonRef.current.getBoundingClientRect()
      setConflictsCoords({
        top: rect.bottom + 8,
        right: Math.max(16, window.innerWidth - rect.right),
      })
    }
    setShowConflictsPopover(true)
  }

  const handleConflictsMouseLeave = () => {
    if (conflictsHoverTimeoutRef.current) {
      clearTimeout(conflictsHoverTimeoutRef.current)
    }
    conflictsHoverTimeoutRef.current = setTimeout(() => {
      setShowConflictsPopover(false)
    }, 180)
  }

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
      if (conflictsHoverTimeoutRef.current) {
        clearTimeout(conflictsHoverTimeoutRef.current)
      }
    }
  }, [])

  // Close shortcuts popup & issues drawer when edit mode is toggled off
  useEffect(() => {
    if (!isActive) {
      setShowShortcuts(false)
      setShowConflictsPopover(false)
      setIsIssuesOpen(false)
    }
  }, [isActive])

  return (
    <>
      <div className={cn("inline-flex flex-col items-center w-full max-w-2xl", className)}>
        <div className="w-full flex flex-wrap items-center justify-between gap-2.5 sm:gap-4 px-3 sm:px-4 py-1.5 bg-background border border-border/80 rounded-xl shadow-2xs">
          {/* Left: Mode Title, Unassigned count chip, and Completion Percentage in empty space */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>

            <span className="font-semibold text-xs sm:text-sm text-foreground tracking-tight">
              Edit Mode
            </span>

            {/* Unassigned Count */}
            {unassignedCount > 0 ? (
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30 text-[11px] font-semibold px-2 py-0.5 rounded-lg cursor-pointer hover:bg-amber-500/20"
                onClick={() => setIsIssuesOpen(true)}
              >
                {unassignedCount} Unassigned
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 text-[11px] font-semibold px-2 py-0.5 rounded-lg"
              >
                All Assigned
              </Badge>
            )}

            {/* Percentage Completed in empty space after unassigned count chip */}
            <Badge
              variant="outline"
              className="bg-primary/5 text-primary border-primary/20 text-[11px] font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1.5 shadow-2xs"
            >
              <div className="w-12 h-1.5 rounded-full bg-primary/20 overflow-hidden hidden sm:block">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <span>{completionPct}% Completed</span>
            </Badge>
          </div>

          {/* Right: Center undo/redo, conflicts count chip, and keyboard shortcuts */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* History Undo / Redo */}
            <div className="flex items-center gap-1 border-x border-border/60 px-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={onUndo}
                disabled={!canUndo}
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
                title={isMac ? "Undo change (⌘Z)" : "Undo change (Ctrl+Z)"}
              >
                <Undo2 className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={onRedo}
                disabled={!canRedo}
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
                title={isMac ? "Redo change (⌘⇧Z)" : "Redo change (Ctrl+Y)"}
              >
                <Redo2 className="size-3.5" />
              </Button>
            </div>

            {/* Conflicts Count Chip (After undo redo button) */}
            <div className="relative">
              <button
                ref={conflictsButtonRef}
                type="button"
                onMouseEnter={handleConflictsMouseEnter}
                onMouseLeave={handleConflictsMouseLeave}
                onClick={() => {
                  if (conflictsCount > 0) {
                    if (conflictsList.length === 1) {
                      const c = conflictsList[0]
                      if (c.onResolve) c.onResolve()
                      else if (onResolveConflict) onResolveConflict(c)
                      else setIsIssuesOpen(true)
                    } else {
                      setIsIssuesOpen(true)
                    }
                  }
                }}
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg transition-all",
                  conflictsCount > 0
                    ? "bg-destructive text-destructive-foreground shadow-2xs hover:bg-destructive/90 cursor-pointer"
                    : "bg-muted/60 text-muted-foreground border border-border/70 cursor-default"
                )}
                aria-label={`${conflictsCount} Conflicts`}
              >
                <AlertTriangle className={cn("size-3", conflictsCount > 0 ? "text-destructive-foreground" : "text-muted-foreground")} />
                <span>{conflictsCount} {conflictsCount === 1 ? "Conflict" : "Conflicts"}</span>
              </button>
            </div>

            {/* Keyboard Shortcuts Button */}
            <button
              ref={buttonRef}
              type="button"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              className={cn(
                "size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 hidden sm:inline-flex items-center justify-center cursor-pointer transition-colors",
                showShortcuts && "bg-muted text-foreground"
              )}
              aria-label={isMac ? "Mac keyboard shortcuts" : "Windows keyboard shortcuts"}
              title={isMac ? "Mac keyboard shortcuts" : "Windows keyboard shortcuts"}
            >
              <Keyboard className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating OS Shortcuts Portal Overlay */}
      {showShortcuts && coords && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            top: coords.top,
            right: coords.right,
            zIndex: 9999,
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="p-3.5 w-72 rounded-2xl border border-border/80 bg-popover/95 backdrop-blur-md text-popover-foreground shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 pointer-events-auto select-none"
        >
          {/* Header */}
          <div className="flex items-center gap-2 pb-2 mb-2.5 border-b border-border/60">
            <Keyboard className="size-4 text-primary shrink-0" />
            <span className="text-xs font-bold text-foreground">
              {isMac ? "Mac Shortcuts" : "Windows Shortcuts"}
            </span>
          </div>

          {/* Vertical List: Label in Column 1, Button Chip in Column 2 */}
          <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 items-center">
            {shortcuts.map((sc) => (
              <div key={sc.label} className="contents">
                {/* Column 1: Label */}
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  {sc.label}
                </span>

                {/* Column 2: Button Chip */}
                <div className="flex items-center gap-1 justify-end">
                  {sc.keys.map((k, i) => (
                    <React.Fragment key={i}>
                      <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-muted border border-border/80 text-[10px] font-semibold font-mono text-foreground shadow-2xs">
                        {k}
                      </kbd>
                      {i < sc.keys.length - 1 && (
                        <span className="text-[10px] text-muted-foreground/60 font-medium">
                          {sc.separator || "+"}
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Floating Conflicts Popover Overlay */}
      {showConflictsPopover && conflictsCoords && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            top: conflictsCoords.top,
            right: conflictsCoords.right,
            zIndex: 9999,
          }}
          onMouseEnter={handleConflictsMouseEnter}
          onMouseLeave={handleConflictsMouseLeave}
          className="p-3 w-80 max-w-[calc(100vw-32px)] max-h-80 overflow-y-auto rounded-2xl border border-border/80 bg-popover/95 backdrop-blur-md text-popover-foreground shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 pointer-events-auto select-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
            <div className="flex items-center gap-1.5 font-bold text-xs text-destructive">
              <AlertTriangle className="size-3.5" />
              <span>{conflictsCount} {conflictsCount === 1 ? "Conflict" : "Conflicts"}</span>
            </div>
            {conflictsList.length > 0 && (
              <span className="text-[10px] text-muted-foreground font-normal">Click to resolve</span>
            )}
          </div>

          {/* List or Empty State */}
          {conflictsList.length === 0 ? (
            <div className="py-3 flex items-center gap-2 text-xs text-muted-foreground justify-center">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <span>No conflicts detected across classes.</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {conflictsList.map((conflict) => (
                <div
                  key={conflict.id}
                  onClick={() => {
                    setShowConflictsPopover(false)
                    if (conflict.onResolve) {
                      conflict.onResolve()
                    } else if (onResolveConflict) {
                      onResolveConflict(conflict)
                    } else if (conflict.onJump) {
                      conflict.onJump()
                    }
                  }}
                  className="p-2.5 rounded-xl bg-destructive/10 hover:bg-destructive/20 border border-destructive/25 text-xs cursor-pointer transition-colors space-y-1 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground group-hover:text-destructive transition-colors">
                      {conflict.sectionName}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {conflict.day} • {conflict.periodLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                    {formatTimingsInText(conflict.title)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}

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
                          setIsIssuesOpen(false)
                          if (issue.type === "conflict" && issue.onResolve) {
                            issue.onResolve()
                          } else if (issue.type === "conflict" && onResolveConflict) {
                            onResolveConflict(issue)
                          } else {
                            issue.onJump?.()
                          }
                        }}
                        className="h-6 text-[11px] font-semibold text-primary hover:bg-primary/10 gap-1 px-1.5"
                      >
                        {issue.type === "conflict" ? "Resolve" : "Jump"}
                        <ArrowRight className="size-3" />
                      </Button>
                    </div>

                    <p className="text-muted-foreground leading-snug">
                      {formatTimingsInText(issue.title)}
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

