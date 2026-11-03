import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  CalendarDays,
  Layers,
  Sparkles,
  Search,
  AlertTriangle,
  Clock,
  Plus,
  RefreshCw,
  FolderOpen,
  FilterX,
  ChevronDown,
  ChevronRight,
  BookOpen,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ClassWiseCard } from "./ClassWiseCard"
import { JumpToRail } from "./JumpToRail"
import { AssignModeBar } from "./AssignModeBar"
import { SlotAssignmentDialog } from "./SlotAssignmentDialog"
import {
  useBulkAssignSlot,
  useCreateTimetableEntry,
  useDeleteTimetableEntry,
} from "@/hooks/useTimetable"
import { parseTimetableQuery, sectionMatchesQuery } from "../searchUtils"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function ClassWiseGridView({
  timetableData,
  isLoading = false,
  isError = false,
  onRetry,
  selectedWingId = "ALL", // "ALL" or array of wing IDs
  searchQuery = "",
  searchTokens = {},
  unassignedOnly = false,
  conflictsOnly = false,
  isAssignMode = false,
  onToggleAssignMode,
  density = "comfortable",
  zoom = 100,
  onOpenBellSetup,
  onCreateNewTimetable,
}) {
  const [collapsedWings, setCollapsedWings] = useState({})
  const [selectedSlotKey, setSelectedSlotKey] = useState(null)
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    cellData: null,
  })
  const [copiedSlotData, setCopiedSlotData] = useState(null)

  // Undo / Redo history stacks
  const [historyStack, setHistoryStack] = useState([])
  const [futureStack, setFutureStack] = useState([])

  const bulkAssignMutation = useBulkAssignSlot()
  const deleteEntryMutation = useDeleteTimetableEntry()
  const createEntryMutation = useCreateTimetableEntry()

  const {
    timetable,
    wings = [],
    setups = [],
    entries = [],
    eligible_teachers = [],
  } = timetableData || {}

  // Map setups by ID
  const setupMap = useMemo(() => {
    const map = new Map()
    for (const s of setups) {
      map.set(s.id, s)
    }
    return map
  }, [setups])

  // Map periods by ID across all setups
  const periodMap = useMemo(() => {
    const map = new Map()
    for (const s of setups) {
      for (const p of s.periods || []) {
        map.set(p.id, p)
      }
    }
    return map
  }, [setups])

  // Filter wings according to selectedWingId (when actively searching, search across all wings)
  const activeWings = useMemo(() => {
    if (searchQuery && searchQuery.trim()) return wings
    if (!selectedWingId || selectedWingId === "ALL") return wings
    if (Array.isArray(selectedWingId)) {
      if (selectedWingId.length === 0) return wings
      const filtered = wings.filter((w) => selectedWingId.includes(w.id))
      return filtered.length > 0 ? filtered : wings
    }
    const single = wings.filter((w) => w.id === selectedWingId)
    return single.length > 0 ? single : wings
  }, [wings, selectedWingId, searchQuery])

  // Real-time teacher conflict detection
  const conflictMap = useMemo(() => {
    const conflicts = {}
    const teacherDayMap = new Map() // key: `${teacher_user_id}_${day_of_week}` -> array of entries

    for (const e of entries) {
      if (!e.teacher?.id) continue
      const key = `${e.teacher.id}_${e.day_of_week}`
      if (!teacherDayMap.has(key)) {
        teacherDayMap.set(key, [])
      }
      teacherDayMap.get(key).push(e)
    }

    for (const [key, tEntries] of teacherDayMap.entries()) {
      if (tEntries.length < 2) continue

      for (let i = 0; i < tEntries.length; i++) {
        for (let j = i + 1; j < tEntries.length; j++) {
          const e1 = tEntries[i]
          const e2 = tEntries[j]
          const p1 = periodMap.get(e1.period_id)
          const p2 = periodMap.get(e2.period_id)

          if (p1 && p2 && p1.start_time && p1.end_time && p2.start_time && p2.end_time) {
            // Overlapping time interval condition: max(start1, start2) < min(end1, end2)
            if (p1.start_time < p2.end_time && p2.start_time < p1.end_time) {
              const msg = `Conflict: Double-booked with Section ${e2.section_id?.slice?.(0, 4) || ""} (${p2.start_time} - ${p2.end_time})`
              conflicts[e1.id] = msg
              conflicts[e2.id] = `Conflict: Double-booked with Section ${e1.section_id?.slice?.(0, 4) || ""} (${p1.start_time} - ${p1.end_time})`
            }
          }
        }
      }
    }

    return conflicts
  }, [entries, periodMap])

  // Group entries by section
  const entriesBySection = useMemo(() => {
    const map = new Map()
    for (const e of entries) {
      if (!map.has(e.section_id)) {
        map.set(e.section_id, [])
      }
      map.get(e.section_id).push(e)
    }
    return map
  }, [entries])

  // Flattened sections for search, jumping, and keyboard navigation
  const allFlattenedSections = useMemo(() => {
    const list = []
    for (const w of activeWings) {
      for (const c of w.classes || []) {
        for (const s of c.sections || []) {
          list.push({
            ...s,
            class_id: c.id,
            class_name: c.name,
            wing_id: w.id,
            wing_name: w.name,
          })
        }
      }
    }
    return list
  }, [activeWings])

  // Filter classes & sections based on search query
  const filteredWings = useMemo(() => {
    if (!searchQuery && !unassignedOnly && !conflictsOnly) {
      return activeWings
    }

    const parsedQuery = parseTimetableQuery(searchQuery)

    return activeWings
      .map((wing) => {
        const matchingClasses = (wing.classes || [])
          .map((cls) => {
            const matchingSections = (cls.sections || []).filter((sec) => {
              if (unassignedOnly && sec.unassigned_slots === 0) return false

              if (conflictsOnly) {
                const secEntries = entriesBySection.get(sec.id) || []
                const hasConflict = secEntries.some((e) => conflictMap[e.id])
                if (!hasConflict) return false
              }

              if (!parsedQuery) return true

              const secEntries = entriesBySection.get(sec.id) || []
              return sectionMatchesQuery(cls, sec, parsedQuery, wing, secEntries)
            })

            if (matchingSections.length > 0) {
              return { ...cls, sections: matchingSections }
            }
            return null
          })
          .filter(Boolean)

        if (matchingClasses.length > 0) {
          return { ...wing, classes: matchingClasses }
        }
        return null
      })
      .filter(Boolean)
  }, [activeWings, searchQuery, unassignedOnly, conflictsOnly, entriesBySection, conflictMap])

  // Flattened classes for JumpToRail
  const flattenedClasses = useMemo(() => {
    const list = []
    const seen = new Set()
    for (const w of activeWings) {
      for (const c of w.classes || []) {
        if (!seen.has(c.id)) {
          seen.add(c.id)
          list.push(c)
        }
      }
    }
    return list
  }, [activeWings])

  // Issues list for AssignModeBar & Drawer
  const issuesList = useMemo(() => {
    const list = []

    // 1. Conflicts
    for (const [entryId, msg] of Object.entries(conflictMap)) {
      const entry = entries.find((e) => e.id === entryId)
      if (entry) {
        const sec = allFlattenedSections.find((s) => s.id === entry.section_id)
        list.push({
          id: `conflict_${entryId}`,
          type: "conflict",
          title: msg,
          sectionName: `${sec?.class_name || ""} ${sec?.name || ""}`,
          day: entry.day_of_week,
          periodLabel: entry.period_number ? `P${entry.period_number}` : "Period",
          onJump: () => {
            const el = document.getElementById(`class-section-${entry.section_id}`)
            el?.scrollIntoView({ behavior: "smooth", block: "center" })
          },
        })
      }
    }

    // 2. Unassigned
    for (const sec of allFlattenedSections) {
      if (sec.unassigned_slots > 0) {
        list.push({
          id: `unassigned_${sec.id}`,
          type: "unassigned",
          title: `${sec.unassigned_slots} period slots unassigned`,
          sectionName: `${sec.class_name} ${sec.name}`,
          day: "Weekly",
          periodLabel: "Slots",
          onJump: () => {
            const el = document.getElementById(`class-section-${sec.id}`)
            el?.scrollIntoView({ behavior: "smooth", block: "center" })
          },
        })
      }
    }

    return list
  }, [conflictMap, entries, allFlattenedSections])

  // Total unassigned count
  const totalUnassignedCount = useMemo(() => {
    return allFlattenedSections.reduce((acc, s) => acc + (s.unassigned_slots || 0), 0)
  }, [allFlattenedSections])

  const totalConflictsCount = Object.keys(conflictMap).length

  // Available subjects for the currently opened slot dialog
  const availableSubjectsForDialog = useMemo(() => {
    if (!dialogState.cellData?.section) return []
    const sec = dialogState.cellData.section
    return (sec.subject_stats || []).map((s) => ({
      id: s.subject_id,
      name: s.name,
      code: s.code,
      category: s.category,
      is_academic: s.is_academic,
      target_weekly: s.target,
      current_assigned: s.assigned,
    }))
  }, [dialogState.cellData])

  // Toggle Wing Collapse
  const toggleWingCollapse = (wingId) => {
    setCollapsedWings((prev) => ({
      ...prev,
      [wingId]: !prev[wingId],
    }))
  }

  // Handle slot assignment
  const handleAssignSlot = useCallback(
    async (payload) => {
      if (!timetable?.id || !dialogState.cellData) return

      const cell = dialogState.cellData
      const requestPayload = {
        timetable_id: timetable.id,
        section_id: cell.section.id,
        day_of_week: cell.day,
        period_id: cell.period.id,
        subject_id: payload.subject_id,
        teacher_user_id: payload.teacher_user_id || null,
        scope: payload.scope || "SLOT",
        target_count: payload.target_count || null,
      }

      // Record for undo
      const prevEntry = cell.currentEntry
      setHistoryStack((prev) => [
        ...prev,
        {
          type: "ASSIGN",
          prevEntry,
          payload: requestPayload,
        },
      ])
      setFutureStack([])

      try {
        await bulkAssignMutation.mutateAsync(requestPayload)
        toast.success("Timetable slot assigned successfully")
        setDialogState({ isOpen: false, cellData: null })
      } catch (err) {
        toast.error("Failed to assign slot: " + (err.message || "Unknown error"))
      }
    },
    [timetable, dialogState.cellData, bulkAssignMutation]
  )

  // Handle slot unassign
  const handleUnassignSlot = useCallback(
    async (entryId) => {
      if (!entryId) return
      const entryToDelete = entries.find((e) => e.id === entryId)
      if (!entryToDelete) return

      // Record for undo
      setHistoryStack((prev) => [
        ...prev,
        {
          type: "UNASSIGN",
          entry: entryToDelete,
        },
      ])
      setFutureStack([])

      try {
        await deleteEntryMutation.mutateAsync({
          entryId,
          sectionId: entryToDelete.section_id,
        })
        toast.success("Slot unassigned")
        setDialogState({ isOpen: false, cellData: null })
      } catch (err) {
        toast.error("Failed to unassign slot")
      }
    },
    [entries, deleteEntryMutation]
  )

  // Handle moving / swapping slots via drag and drop
  const handleMoveSlot = useCallback(
    async (sourceSlot, targetSlot, isCopy = false) => {
      if (!timetable?.id) return
      if (
        sourceSlot.section.id === targetSlot.section.id &&
        sourceSlot.day === targetSlot.day &&
        sourceSlot.period.id === targetSlot.period.id
      ) {
        return // Dropped on self
      }

      const srcEntry = sourceSlot.entry
      const tgtEntry = targetSlot.entry
      if (!srcEntry) return

      try {
        if (isCopy) {
          // Copy source entry to target
          await bulkAssignMutation.mutateAsync({
            timetable_id: timetable.id,
            section_id: targetSlot.section.id,
            day_of_week: targetSlot.day,
            period_id: targetSlot.period.id,
            subject_id: srcEntry.subject.id,
            teacher_user_id: srcEntry.teacher?.id || null,
            scope: "SLOT",
          })
          toast.success("Slot copied")
        } else {
          // Move or Swap
          // 1. Assign source subject & teacher to target slot
          await bulkAssignMutation.mutateAsync({
            timetable_id: timetable.id,
            section_id: targetSlot.section.id,
            day_of_week: targetSlot.day,
            period_id: targetSlot.period.id,
            subject_id: srcEntry.subject.id,
            teacher_user_id: srcEntry.teacher?.id || null,
            scope: "SLOT",
          })

          if (tgtEntry) {
            // Swap: assign target's old subject & teacher to source slot
            await bulkAssignMutation.mutateAsync({
              timetable_id: timetable.id,
              section_id: sourceSlot.section.id,
              day_of_week: sourceSlot.day,
              period_id: sourceSlot.period.id,
              subject_id: tgtEntry.subject.id,
              teacher_user_id: tgtEntry.teacher?.id || null,
              scope: "SLOT",
            })
            toast.success("Slots swapped")
          } else {
            // Delete original source entry
            await deleteEntryMutation.mutateAsync({
              entryId: srcEntry.id,
              sectionId: sourceSlot.section.id,
            })
            toast.success("Slot moved")
          }
        }
      } catch (err) {
        toast.error("Failed to move slot: " + (err.message || ""))
      }
    },
    [timetable, bulkAssignMutation, deleteEntryMutation]
  )

  // Undo action
  const handleUndo = useCallback(async () => {
    if (historyStack.length === 0) return
    const lastAction = historyStack[historyStack.length - 1]
    const remaining = historyStack.slice(0, -1)
    setHistoryStack(remaining)
    setFutureStack((prev) => [...prev, lastAction])

    try {
      if (lastAction.type === "ASSIGN") {
        if (lastAction.prevEntry) {
          // Restore previous entry
          await bulkAssignMutation.mutateAsync({
            timetable_id: timetable.id,
            section_id: lastAction.prevEntry.section_id,
            day_of_week: lastAction.prevEntry.day_of_week,
            period_id: lastAction.prevEntry.period_id,
            subject_id: lastAction.prevEntry.subject.id,
            teacher_user_id: lastAction.prevEntry.teacher?.id || null,
            scope: "SLOT",
          })
        } else {
          // It was previously empty, clear it
          const currentE = entries.find(
            (e) =>
              e.section_id === lastAction.payload.section_id &&
              e.day_of_week === lastAction.payload.day_of_week &&
              e.period_id === lastAction.payload.period_id
          )
          if (currentE) {
            await deleteEntryMutation.mutateAsync({
              entryId: currentE.id,
              sectionId: currentE.section_id,
            })
          }
        }
        toast.success("Undone")
      } else if (lastAction.type === "UNASSIGN") {
        // Re-create the deleted entry
        await bulkAssignMutation.mutateAsync({
          timetable_id: timetable.id,
          section_id: lastAction.entry.section_id,
          day_of_week: lastAction.entry.day_of_week,
          period_id: lastAction.entry.period_id,
          subject_id: lastAction.entry.subject.id,
          teacher_user_id: lastAction.entry.teacher?.id || null,
          scope: "SLOT",
        })
        toast.success("Undone unassign")
      }
    } catch (err) {
      toast.error("Undo failed")
    }
  }, [historyStack, timetable, entries, bulkAssignMutation, deleteEntryMutation])

  // Redo action
  const handleRedo = useCallback(async () => {
    if (futureStack.length === 0) return
    const nextAction = futureStack[futureStack.length - 1]
    const remaining = futureStack.slice(0, -1)
    setFutureStack(remaining)
    setHistoryStack((prev) => [...prev, nextAction])

    try {
      if (nextAction.type === "ASSIGN") {
        await bulkAssignMutation.mutateAsync(nextAction.payload)
        toast.success("Redone")
      }
    } catch (err) {
      toast.error("Redo failed")
    }
  }, [futureStack, bulkAssignMutation])

  // Keyboard navigation & Shortcuts listener
  useEffect(() => {
    if (!isAssignMode) return

    const handleKeyDown = (e) => {
      // Don't intercept if an input / textarea is focused or dialog is open
      if (
        dialogState.isOpen ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)
      ) {
        return
      }

      // Undo: Ctrl/Cmd + Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault()
        handleUndo()
        return
      }

      // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z") ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault()
        handleRedo()
        return
      }

      // Escape: deselect or close
      if (e.key === "Escape") {
        setSelectedSlotKey(null)
        return
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isAssignMode, dialogState.isOpen, handleUndo, handleRedo])

  // LOADING SKELETON
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-8 w-60 rounded-xl" />
            <div className="space-y-4">
              <Skeleton className="h-64 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ERROR STATE
  if (isError) {
    return (
      <div className="py-16 text-center space-y-4 max-w-md mx-auto">
        <div className="size-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertTriangle className="size-7" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Failed to load timetable</h3>
        <p className="text-xs text-muted-foreground">
          There was an error communicating with the server. Please check your connection and retry.
        </p>
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RefreshCw className="size-4" />
          Retry
        </Button>
      </div>
    )
  }

  // EMPTY STATE: NO TIMETABLE
  if (!timetable) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <div className="size-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <CalendarDays className="size-8" />
        </div>
        <h3 className="text-xl font-bold text-foreground">No Timetable Found</h3>
        <p className="text-sm text-muted-foreground">
          Get started by creating your first timetable draft or copying from an existing schedule.
        </p>
        <Button onClick={onCreateNewTimetable} className="gap-2">
          <Plus className="size-4" />
          Create New Timetable
        </Button>
      </div>
    )
  }

  // EMPTY STATE: NO BELL SETUPS CONFIGURED
  if (setups.length === 0) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <div className="size-16 rounded-3xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
          <Clock className="size-8" />
        </div>
        <h3 className="text-xl font-bold text-foreground">No Bell Schedule Configured</h3>
        <p className="text-sm text-muted-foreground">
          Before classes can be scheduled, define your school's period timings, durations, and break schedules.
        </p>
        <Button onClick={onOpenBellSetup} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
          <Clock className="size-4" />
          Set Bell Timings
        </Button>
      </div>
    )
  }

  // EMPTY STATE: SEARCH / FILTER RETURNED 0 MATCHES
  if (filteredWings.length === 0) {
    return (
      <div className="py-20 text-center space-y-3 max-w-sm mx-auto">
        <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
          <FilterX className="size-6" />
        </div>
        <h4 className="font-bold text-base text-foreground">No matching classes or slots</h4>
        <p className="text-xs text-muted-foreground">
          No classes match your search "{searchQuery}" or active filters. Try broadening your criteria.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20">
      {/* WING GROUPS */}
      {filteredWings.map((wing) => {
        const isCollapsed = Boolean(collapsedWings[wing.id])
        const wingClassesCount = wing.classes?.length || 0
        const wingSectionsCount = wing.classes?.reduce((acc, c) => acc + (c.sections?.length || 0), 0) || 0

        return (
          <div key={wing.id} id={`wing-group-${wing.id}`} className="space-y-4">
            {/* WING SECTION HEADER */}
            <div className="flex items-center justify-between gap-3 px-1">
              <button
                type="button"
                onClick={() => toggleWingCollapse(wing.id)}
                className="flex items-center gap-2 text-left group cursor-pointer"
              >
                <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center transition-transform group-hover:scale-105">
                  {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                </div>

                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider text-foreground">
                    {wing.name}
                  </h2>
                  <Badge
                    variant="outline"
                    className="font-semibold text-xs border-border/70 text-muted-foreground"
                  >
                    {wingClassesCount} Classes • {wingSectionsCount} Sections
                  </Badge>
                </div>
              </button>
            </div>

            {/* CLASS CARDS IN WING */}
            {!isCollapsed && (
              <div className="space-y-5">
                {wing.classes?.map((cls) => {
                  return (
                    <div key={cls.id} id={`class-group-${cls.id}`} className="space-y-4">
                      {cls.sections?.map((section) => {
                        const secSetup = setupMap.get(section.setup_id) || setups[0]
                        const secEntries = entriesBySection.get(section.id) || []

                        return (
                          <ClassWiseCard
                            key={section.id}
                            section={{
                              ...section,
                              class_name: cls.name,
                              wing_name: wing.name,
                            }}
                            setup={secSetup}
                            entries={secEntries}
                            conflictMap={conflictMap}
                            isAssignMode={isAssignMode}
                            selectedSlot={selectedSlotKey}
                            copiedSlot={copiedSlotData}
                            onSelectSlot={(slotKey) => setSelectedSlotKey(slotKey)}
                            onOpenAssignDialog={(cellInfo) => {
                              setDialogState({
                                isOpen: true,
                                cellData: {
                                  ...cellInfo,
                                  timetableId: timetable.id,
                                },
                              })
                            }}
                            onClearSlot={(entryId) => handleUnassignSlot(entryId)}
                            onMoveSlot={(src, tgt, isCopy) => handleMoveSlot(src, tgt, isCopy)}
                            density={density}
                            zoom={zoom}
                            searchQuery={searchQuery}
                            searchTokens={searchTokens}
                            unassignedOnly={unassignedOnly}
                            conflictsOnly={conflictsOnly}
                          />
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* JUMP TO CLASS RAIL */}
      <JumpToRail classes={flattenedClasses} />

      {/* ASSIGN MODE FLOATING STATUS BAR & ISSUES DRAWER */}
      <AssignModeBar
        isActive={isAssignMode}
        unassignedCount={totalUnassignedCount}
        conflictsCount={totalConflictsCount}
        canUndo={historyStack.length > 0}
        canRedo={futureStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExitMode={onToggleAssignMode}
        issuesList={issuesList}
      />

      {/* SLOT ASSIGNMENT DIALOG */}
      {dialogState.isOpen && (
        <SlotAssignmentDialog
          isOpen={dialogState.isOpen}
          onClose={() => setDialogState({ isOpen: false, cellData: null })}
          cellData={dialogState.cellData}
          availableSubjects={availableSubjectsForDialog}
          eligibleTeachers={eligible_teachers}
          onAssign={handleAssignSlot}
          onUnassign={handleUnassignSlot}
          isSubmitting={bulkAssignMutation.isPending || deleteEntryMutation.isPending}
        />
      )}
    </div>
  )
}

