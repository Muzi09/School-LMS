import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  CalendarDays,
  Layers,
  Search,
  AlertTriangle,
  Clock,
  Plus,
  RefreshCw,
  FolderOpen,
  FilterX,
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
import { TimetableTooltip } from "./TimetableTooltip"
import {
  useBulkAssignSlot,
  useCreateTimetableEntry,
  useDeleteTimetableEntry,
} from "@/hooks/useTimetable"
import { parseTimetableQuery, sectionMatchesQuery } from "../searchUtils"
import { isNonTeachingPeriod } from "../bellTiming/validators"
import { getIsMac, formatTime12 } from "../timetableUtils"
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
  onAssignBarPropsChange,
}) {
  const [selectedSlotKey, setSelectedSlotKey] = useState(null)
  const [selectedSlotData, setSelectedSlotData] = useState(null)
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    cellData: null,
  })
  const [copiedSlotData, setCopiedSlotData] = useState(null)

  // Undo / Redo history stacks
  const [historyStack, setHistoryStack] = useState([])
  const [futureStack, setFutureStack] = useState([])

  // Clear selection and close assignment dialog when edit mode is off
  useEffect(() => {
    if (!isAssignMode) {
      setSelectedSlotKey(null)
      setSelectedSlotData(null)
      setCopiedSlotData(null)
      setDialogState({ isOpen: false, cellData: null })
    }
  }, [isAssignMode])

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
      if (s.id) {
        map.set(s.id, s)
        map.set(String(s.id), s)
      }
    }
    return map
  }, [setups])

  // Map periods by ID across all setups
  const periodMap = useMemo(() => {
    const map = new Map()
    for (const s of setups) {
      for (const p of s.periods || []) {
        if (p.id) {
          map.set(p.id, p)
          map.set(String(p.id), p)
        }
      }
    }
    return map
  }, [setups])

  // Helper to determine the split days group for a specific section and day
  const getSplitDaysForSectionAndDay = useCallback(
    (sec, day) => {
      if (!sec) return ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
      const secSetupId = sec.setup_id || sec.setupId
      let setup = secSetupId ? setupMap.get(secSetupId) || setupMap.get(String(secSetupId)) : null
      if (!setup) {
        setup = setups.find((s) =>
          (s.assigned_section_ids || []).some(
            (id) => String(id) === String(sec.id)
          )
        )
      }
      if (!setup) {
        setup = setups?.[0]
      }
      if (!setup) return ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]

      let rawSchedules = setup.schedules
      if (!rawSchedules && setup.schedules_json) {
        try {
          rawSchedules = JSON.parse(setup.schedules_json)
        } catch {}
      } else if (typeof rawSchedules === "string") {
        try {
          rawSchedules = JSON.parse(rawSchedules)
        } catch {}
      }

      const rawAppDays = setup.applicable_days || [
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
      ]
      const appDays = (
        Array.isArray(rawAppDays)
          ? rawAppDays
          : typeof rawAppDays === "string"
          ? (() => {
              try {
                const p = JSON.parse(rawAppDays)
                return Array.isArray(p) ? p : ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
              } catch {
                return ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
              }
            })()
          : ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
      ).map((d) => String(d).toUpperCase())

      const dayUpper = day ? String(day).toUpperCase() : ""

      if (rawSchedules && Array.isArray(rawSchedules) && rawSchedules.length > 0) {
        const matchingSched = rawSchedules.find((s) =>
          (s.days || []).map((d) => String(d).toUpperCase()).includes(dayUpper)
        )
        if (matchingSched && matchingSched.days && matchingSched.days.length > 0) {
          const matched = matchingSched.days.map((d) => String(d).toUpperCase())
          const filtered = matched.filter((d) => appDays.length === 0 || appDays.includes(d))
          return filtered.length > 0 ? filtered : matched
        }
      }

      if (dayUpper === "SATURDAY") return ["SATURDAY"]
      return appDays.filter((d) => d !== "SATURDAY")
    },
    [setupMap, setups]
  )

  // Get all active schedule days for a section (e.g. Mon-Sat)
  const getAllDaysForSection = useCallback(
    (sec) => {
      let setup = null
      if (sec?.id && setupMap.has(sec.id)) {
        setup = setupMap.get(sec.id)
      } else if (sec) {
        setup = setups?.find((s) =>
          (s.assigned_section_ids || []).some(
            (id) => String(id) === String(sec.id)
          )
        )
      }
      if (!setup) setup = setups?.[0]
      const rawAppDays = setup?.applicable_days || [
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
      ]
      return (
        Array.isArray(rawAppDays)
          ? rawAppDays
          : typeof rawAppDays === "string"
          ? (() => {
              try {
                const p = JSON.parse(rawAppDays)
                return Array.isArray(p)
                  ? p
                  : ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
              } catch {
                return ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
              }
            })()
          : ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
      ).map((d) => String(d).toUpperCase())
    },
    [setupMap, setups]
  )

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

    const secLookup = new Map()
    for (const s of allFlattenedSections) {
      secLookup.set(s.id, `${s.class_name || ""} ${s.name || ""}`.trim())
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
              const sec1Name = secLookup.get(e1.section_id) || `Section ${e1.section_id?.slice?.(0, 4) || ""}`
              const sec2Name = secLookup.get(e2.section_id) || `Section ${e2.section_id?.slice?.(0, 4) || ""}`
              const t1Fmt = `${formatTime12(p1.start_time)} - ${formatTime12(p1.end_time)}`
              const t2Fmt = `${formatTime12(p2.start_time)} - ${formatTime12(p2.end_time)}`

              conflicts[e1.id] = `Conflict: Double-booked with ${sec2Name} (${t2Fmt})`
              conflicts[e2.id] = `Conflict: Double-booked with ${sec1Name} (${t1Fmt})`
            }
          }
        }
      }
    }

    return conflicts
  }, [entries, periodMap, allFlattenedSections])

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
    const sourceWings = (searchQuery || unassignedOnly || conflictsOnly) ? filteredWings : activeWings
    for (const w of sourceWings) {
      for (const c of w.classes || []) {
        if (!seen.has(c.id)) {
          seen.add(c.id)
          list.push(c)
        }
      }
    }
    return list
  }, [activeWings, filteredWings, searchQuery, unassignedOnly, conflictsOnly])

  // Visible sections list currently rendered on the page for keyboard navigation jumping
  const visibleSections = useMemo(() => {
    const list = []
    const sourceWings = (searchQuery || unassignedOnly || conflictsOnly) ? filteredWings : activeWings
    for (const w of sourceWings) {
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
  }, [activeWings, filteredWings, searchQuery, unassignedOnly, conflictsOnly])

  // Issues list for AssignModeBar & Drawer
  const issuesList = useMemo(() => {
    const list = []

    // 1. Conflicts
    for (const [entryId, msg] of Object.entries(conflictMap)) {
      const entry = entries.find((e) => e.id === entryId)
      if (entry) {
        const sec = allFlattenedSections.find((s) => s.id === entry.section_id)
        const periodObj = periodMap.get(entry.period_id) || {
          id: entry.period_id,
          period_number: entry.period_number,
          start_time: entry.period?.start_time,
          end_time: entry.period?.end_time,
        }

        const resolveConflict = () => {
          const el = document.getElementById(`class-section-${entry.section_id}`)
          el?.scrollIntoView({ behavior: "smooth", block: "center" })

          const slotKey = `${entry.section_id}_${entry.day_of_week}_${entry.period_id || entry.period_number}`
          setSelectedSlot(slotKey)

          setDialogState({
            isOpen: true,
            cellData: {
              section: sec,
              day: entry.day_of_week,
              period: periodObj,
              currentEntry: entry,
              scheduleDays: getSplitDaysForSectionAndDay(sec, entry.day_of_week),
              allDays: getAllDaysForSection(sec),
              timetableId: timetable?.id,
            },
          })
        }

        list.push({
          id: `conflict_${entryId}`,
          type: "conflict",
          title: msg,
          sectionName: `${sec?.class_name || ""} ${sec?.name || ""}`.trim(),
          day: entry.day_of_week,
          periodLabel: entry.period_number ? `P${entry.period_number}` : "Period",
          period: periodObj,
          section: sec,
          entry,
          onJump: () => {
            const el = document.getElementById(`class-section-${entry.section_id}`)
            el?.scrollIntoView({ behavior: "smooth", block: "center" })
          },
          onResolve: resolveConflict,
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
          sectionName: `${sec.class_name} ${sec.name}`.trim(),
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
  }, [conflictMap, entries, allFlattenedSections, periodMap, timetable?.id])

  // Total expected slots across all active sections
  const totalSlotsCount = useMemo(() => {
    let total = 0
    for (const sec of allFlattenedSections) {
      if (sec.total_slots) {
        total += sec.total_slots
      } else {
        const secSetupId = sec.setup_id || timetableData?.setups?.[0]?.id
        const secSetup = setupMap.get(secSetupId) || timetableData?.setups?.[0]
        if (secSetup) {
          const appDays = (secSetup.applicable_days || [
            "MONDAY",
            "TUESDAY",
            "WEDNESDAY",
            "THURSDAY",
            "FRIDAY",
            "SATURDAY",
          ]).filter((d) => !secSetup.break_days?.includes(d))
          const teachingCount = (secSetup.periods || []).filter((p) => !isNonTeachingPeriod(p)).length
          total += teachingCount * appDays.length
        }
      }
    }
    return total
  }, [allFlattenedSections, setupMap, timetableData])

  // Total unassigned count
  const totalUnassignedCount = useMemo(() => {
    return allFlattenedSections.reduce((acc, s) => acc + (s.unassigned_slots || 0), 0)
  }, [allFlattenedSections])

  const totalAssignedSlotsCount = useMemo(() => {
    const activeSectionIds = new Set(allFlattenedSections.map((s) => s.id))
    return entries.filter((e) => {
      if (!activeSectionIds.has(e.section_id)) return false
      if (!e.subject_id && !e.subject) return false
      const p = periodMap.get(e.period_id)
      if (p && isNonTeachingPeriod(p)) return false
      return true
    }).length
  }, [allFlattenedSections, entries, periodMap])

  const completionPct = useMemo(() => {
    if (totalAssignedSlotsCount === 0) return 0
    if (totalSlotsCount > 0) {
      return Math.min(100, Math.round((totalAssignedSlotsCount / totalSlotsCount) * 100))
    }
    const total = totalAssignedSlotsCount + totalUnassignedCount
    return total > 0 ? Math.min(100, Math.round((totalAssignedSlotsCount / total) * 100)) : 0
  }, [totalSlotsCount, totalAssignedSlotsCount, totalUnassignedCount])

  const totalConflictsCount = Object.keys(conflictMap).length

  // Conflict resolution handler to open SlotAssignmentDialog directly from popover or list
  const handleResolveConflict = useCallback(
    (conflict) => {
      if (conflict?.onResolve) {
        conflict.onResolve()
        return
      }
      if (conflict?.entry) {
        const sec = conflict.section || allFlattenedSections.find((s) => s.id === conflict.entry.section_id)
        const periodObj = conflict.period || periodMap.get(conflict.entry.period_id)
        const el = document.getElementById(`class-section-${conflict.entry.section_id}`)
        el?.scrollIntoView({ behavior: "smooth", block: "center" })
        setDialogState({
          isOpen: true,
          cellData: {
            section: sec,
            day: conflict.entry.day_of_week,
            period: periodObj,
            currentEntry: conflict.entry,
            scheduleDays: getSplitDaysForSectionAndDay(sec, conflict.entry.day_of_week),
            allDays: getAllDaysForSection(sec),
            timetableId: timetable?.id,
          },
        })
      }
    },
    [allFlattenedSections, periodMap, timetable?.id, getSplitDaysForSectionAndDay]
  )

  // Available subjects for the currently opened slot dialog
  const availableSubjectsForDialog = useMemo(() => {
    if (!dialogState.cellData?.section) return []
    const sec = dialogState.cellData.section
    const liveSec =
      allFlattenedSections.find((s) => String(s.id) === String(sec.id)) || sec
    const rawList = liveSec.subject_stats || liveSec.subjects || []
    return rawList.map((s) => ({
      id: s.subject_id || s.id,
      subject_id: s.subject_id || s.id,
      name: s.name,
      code: s.code,
      category: s.category || (s.is_academic ? "academic" : "non_academic"),
      is_academic: s.is_academic !== undefined ? s.is_academic : s.category === "academic",
      assigned: s.assigned ?? s.current_assigned ?? 0,
      target: s.target ?? s.target_weekly ?? (s.is_academic ? 6 : 3),
      target_weekly: s.target ?? s.target_weekly ?? (s.is_academic ? 6 : 3),
      current_assigned: s.assigned ?? s.current_assigned ?? 0,
      teacher_id: s.teacher_id || s.teacher?.id || null,
      teacher: s.teacher || null,
    }))
  }, [dialogState.cellData, allFlattenedSections])

  // Handle slot assignment
  const handleAssignSlot = useCallback(
    async (payload) => {
      if (!timetable?.id || !dialogState.cellData) return

      const cell = dialogState.cellData
      const targetDays =
        payload.apply_days ||
        cell.scheduleDays ||
        getSplitDaysForSectionAndDay(cell.section, cell.day)

      const requestPayload = {
        timetable_id: timetable.id,
        section_id: cell.section.id,
        day_of_week: cell.day,
        period_id: cell.period.id,
        subject_id: payload.subject_id,
        teacher_user_id: payload.teacher_user_id || null,
        scope: payload.scope || "SLOT",
        target_count: payload.target_count || null,
        apply_days:
          payload.apply_days && payload.apply_days.length > 0
            ? payload.apply_days
            : payload.scope === "ALL_DAYS"
            ? (cell.allDays || ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"])
            : payload.scope === "WEEKDAYS"
            ? targetDays
            : [cell.day],
        overwrite: payload.overwrite ?? true,
        _optimisticSubject: payload.subject || null,
        _optimisticTeacher: payload.teacher || null,
        _optimisticPeriod: cell.period,
        _section: cell.section,
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

      // Close dialog immediately for instant 0 ms feedback
      setDialogState({ isOpen: false, cellData: null })

      try {
        await bulkAssignMutation.mutateAsync(requestPayload)
        if (!payload.silent) {
          toast.success("Timetable slot assigned successfully")
        }
      } catch (err) {
        if (!payload.silent) {
          toast.error("Failed to assign slot: " + (err.message || "Unknown error"))
        }
      }
    },
    [timetable, dialogState.cellData, bulkAssignMutation, getSplitDaysForSectionAndDay]
  )

  // Handle any pending assign now slot assignment when returning from Manage School
  useEffect(() => {
    if (!timetable?.id || !entries) return
    const rawTarget = sessionStorage.getItem("timetable_assign_now_target")
    if (!rawTarget) return

    try {
      const target = JSON.parse(rawTarget)
      const hasSlot = entries.some(
        (e) =>
          String(e.section_id) === String(target.sectionId) &&
          String(e.day_of_week) === String(target.day) &&
          (String(e.period_id) === String(target.periodId) ||
            String(e.period_number) === String(target.periodNumber)) &&
          String(e.subject_id || e.subject?.id) === String(target.subjectId)
      )

      if (!hasSlot && target.subjectId && target.timetableId) {
        bulkAssignMutation.mutate({
          timetable_id: target.timetableId,
          section_id: target.sectionId,
          day_of_week: target.day,
          period_id: target.periodId,
          subject_id: target.subjectId,
          teacher_user_id: null,
          scope: "SLOT",
          overwrite: true,
        })
      }
      sessionStorage.removeItem("timetable_assign_now_target")
    } catch (e) {
      console.error("Error processing pending assign target:", e)
      sessionStorage.removeItem("timetable_assign_now_target")
    }
  }, [timetable, entries, bulkAssignMutation])

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

      // Close dialog immediately if open
      setDialogState({ isOpen: false, cellData: null })

      try {
        await deleteEntryMutation.mutateAsync({
          entryId,
          sectionId: entryToDelete.section_id,
        })
        toast.success("Slot unassigned")
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

  // Sync AssignModeBar props to parent (so it can render smoothly inside TimetableHeader)
  useEffect(() => {
    onAssignBarPropsChange?.({
      unassignedCount: totalUnassignedCount,
      conflictsCount: totalConflictsCount,
      completionPct,
      canUndo: historyStack.length > 0,
      canRedo: futureStack.length > 0,
      onUndo: handleUndo,
      onRedo: handleRedo,
      issuesList,
      onResolveConflict: handleResolveConflict,
    })
  }, [
    totalUnassignedCount,
    totalConflictsCount,
    completionPct,
    historyStack.length,
    futureStack.length,
    handleUndo,
    handleRedo,
    issuesList,
    handleResolveConflict,
    onAssignBarPropsChange,
  ])

  // Helper to get applicable days, sorted periods, and teaching-only periods (skipping non-teaching slots)
  const getSectionScheduleAndTeachingPeriods = useCallback(
    (sec, day) => {
      const secSetupId = sec.setup_id || timetableData?.setups?.[0]?.id
      const secSetup = setupMap.get(secSetupId) || timetableData?.setups?.[0]
      if (!secSetup) return { appDays: [], periods: [], teachingPeriods: [] }

      const appDays = secSetup.applicable_days || [
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
      ]

      let periods = []
      if (secSetup.schedules && secSetup.schedules.length > 0) {
        const matchedSched = secSetup.schedules.find((s) => s.days?.includes(day))
        if (matchedSched) {
          periods = [...(matchedSched.periods || [])].sort(
            (a, b) => a.period_number - b.period_number
          )
        }
      }

      if (periods.length === 0) {
        const isSat = day === "SATURDAY"
        const satSched = secSetup.schedules?.find(
          (s) => s.id === "saturday" || s.days?.includes("SATURDAY")
        )
        const wkSched = secSetup.schedules?.find(
          (s) => s.id !== "saturday" && !s.days?.every((d) => d === "SATURDAY")
        )
        const rawWeekdayPeriods = wkSched?.periods || secSetup.periods || []
        const rawSaturdayPeriods = satSched?.periods || secSetup.periods || []
        const sortedWeekday = [...rawWeekdayPeriods].sort(
          (a, b) => a.period_number - b.period_number
        )
        const sortedSaturday = [...rawSaturdayPeriods].sort(
          (a, b) => a.period_number - b.period_number
        )
        periods = isSat ? sortedSaturday : sortedWeekday
      }

      // Explicitly skip Recess, Activity, Extra-curricular, Assembly, Break
      const teachingPeriods = periods.filter((p) => !isNonTeachingPeriod(p))
      return { appDays, periods, teachingPeriods }
    },
    [setupMap, timetableData]
  )

  // Keyboard arrow and class jumping navigation between teaching slots
  const handleArrowNavigation = useCallback(
    (direction, isJumpClass = false) => {
      if (visibleSections.length === 0) return

      // If no slot is selected, select the first valid teaching slot of the first section
      if (!selectedSlotData?.section || !selectedSlotData?.period) {
        const firstSec = visibleSections[0]
        const firstDay = "MONDAY"
        const { teachingPeriods } = getSectionScheduleAndTeachingPeriods(firstSec, firstDay)
        if (teachingPeriods.length > 0) {
          const targetPeriod = teachingPeriods[0]
          const targetEntry =
            entries.find(
              (e) =>
                e.section_id === firstSec.id &&
                e.day_of_week === firstDay &&
                ((e.period_id && e.period_id === targetPeriod.id) ||
                  e.period_number === targetPeriod.period_number)
            ) || null
          const nextSlotKey = `${firstSec.id}_${firstDay}_${targetPeriod.id || targetPeriod.period_number}`
          setSelectedSlotKey(nextSlotKey)
          setSelectedSlotData({
            section: firstSec,
            day: firstDay,
            period: targetPeriod,
            entry: targetEntry,
          })
          requestAnimationFrame(() => {
            const cellEl = document.querySelector(`[data-slot-key="${nextSlotKey}"]`)
            cellEl?.scrollIntoView({ behavior: "smooth", block: "nearest" })
          })
        }
        return
      }

      const currentSec = selectedSlotData.section
      const currentDay = selectedSlotData.day
      const currentPeriod = selectedSlotData.period

      const secIdx = visibleSections.findIndex((s) => s.id === currentSec.id)
      if (secIdx === -1) return

      let targetSec = currentSec
      let targetDay = currentDay
      let targetPeriod = null

      const { appDays, teachingPeriods } = getSectionScheduleAndTeachingPeriods(currentSec, currentDay)
      const dayIdx = appDays.indexOf(currentDay)
      const currentPeriodNum = currentPeriod.period_number
      const tIdx = teachingPeriods.findIndex(
        (p) => (p.id && p.id === currentPeriod.id) || p.period_number === currentPeriodNum
      )

      // Direct class jumping (e.g. PageDown/PageUp or Cmd/Ctrl+Down/Up)
      if (isJumpClass) {
        if (direction === "ArrowDown" || direction === "PageDown") {
          if (secIdx < visibleSections.length - 1) {
            targetSec = visibleSections[secIdx + 1]
          }
        } else if (direction === "ArrowUp" || direction === "PageUp") {
          if (secIdx > 0) {
            targetSec = visibleSections[secIdx - 1]
          }
        }

        const targetSched = getSectionScheduleAndTeachingPeriods(targetSec, targetDay)
        targetDay = targetSched.appDays.includes(targetDay) ? targetDay : (targetSched.appDays[0] || targetDay)
        const targetTP = targetSched.teachingPeriods
        if (targetTP.length > 0) {
          targetPeriod =
            targetTP.find((p) => p.period_number === currentPeriodNum) ||
            targetTP.reduce((closest, curr) =>
              Math.abs(curr.period_number - currentPeriodNum) < Math.abs(closest.period_number - currentPeriodNum)
                ? curr
                : closest
            )
        }
      } else if (direction === "ArrowRight") {
        if (tIdx >= 0 && tIdx < teachingPeriods.length - 1) {
          // Next teaching period on the same day (skipping recess, activity, extra-curricular)
          targetPeriod = teachingPeriods[tIdx + 1]
        } else if (dayIdx >= 0 && dayIdx < appDays.length - 1) {
          // Wrap to next day's first teaching period
          targetDay = appDays[dayIdx + 1]
          const nextDaySched = getSectionScheduleAndTeachingPeriods(targetSec, targetDay)
          targetPeriod = nextDaySched.teachingPeriods[0] || null
        } else if (secIdx < visibleSections.length - 1) {
          // End of current class timetable -> JUMP to next class timetable's first day & first teaching period!
          targetSec = visibleSections[secIdx + 1]
          const nextSecSched = getSectionScheduleAndTeachingPeriods(targetSec, "MONDAY")
          targetDay = nextSecSched.appDays[0] || "MONDAY"
          targetPeriod = nextSecSched.teachingPeriods[0] || null
        }
      } else if (direction === "ArrowLeft") {
        if (tIdx > 0) {
          // Previous teaching period on the same day (skipping recess, activity, extra-curricular)
          targetPeriod = teachingPeriods[tIdx - 1]
        } else if (dayIdx > 0) {
          // Wrap to previous day's last teaching period
          targetDay = appDays[dayIdx - 1]
          const prevDaySched = getSectionScheduleAndTeachingPeriods(targetSec, targetDay)
          targetPeriod = prevDaySched.teachingPeriods[prevDaySched.teachingPeriods.length - 1] || null
        } else if (secIdx > 0) {
          // Start of current class timetable -> JUMP to previous class timetable's last day & last teaching period!
          targetSec = visibleSections[secIdx - 1]
          const prevSecDays = setupMap.get(targetSec.setup_id)?.applicable_days || [
            "MONDAY",
            "TUESDAY",
            "WEDNESDAY",
            "THURSDAY",
            "FRIDAY",
          ]
          targetDay = prevSecDays[prevSecDays.length - 1] || "FRIDAY"
          const prevSecSched = getSectionScheduleAndTeachingPeriods(targetSec, targetDay)
          targetPeriod = prevSecSched.teachingPeriods[prevSecSched.teachingPeriods.length - 1] || null
        }
      } else if (direction === "ArrowDown") {
        if (dayIdx >= 0 && dayIdx < appDays.length - 1) {
          // Move down to next day in same class
          targetDay = appDays[dayIdx + 1]
          const nextDaySched = getSectionScheduleAndTeachingPeriods(targetSec, targetDay)
          const targetTP = nextDaySched.teachingPeriods
          if (targetTP.length > 0) {
            targetPeriod =
              targetTP.find((p) => p.period_number === currentPeriodNum) ||
              targetTP.reduce((closest, curr) =>
                Math.abs(curr.period_number - currentPeriodNum) < Math.abs(closest.period_number - currentPeriodNum)
                  ? curr
                  : closest
              )
          }
        } else if (secIdx < visibleSections.length - 1) {
          // Last day of current class -> JUMP TO NEXT CLASS TIMETABLE!
          targetSec = visibleSections[secIdx + 1]
          const nextSecSched = getSectionScheduleAndTeachingPeriods(targetSec, "MONDAY")
          targetDay = nextSecSched.appDays[0] || "MONDAY"
          const targetTP = nextSecSched.teachingPeriods
          if (targetTP.length > 0) {
            targetPeriod =
              targetTP.find((p) => p.period_number === currentPeriodNum) ||
              targetTP[0]
          }
        }
      } else if (direction === "ArrowUp") {
        if (dayIdx > 0) {
          // Move up to previous day in same class
          targetDay = appDays[dayIdx - 1]
          const prevDaySched = getSectionScheduleAndTeachingPeriods(targetSec, targetDay)
          const targetTP = prevDaySched.teachingPeriods
          if (targetTP.length > 0) {
            targetPeriod =
              targetTP.find((p) => p.period_number === currentPeriodNum) ||
              targetTP.reduce((closest, curr) =>
                Math.abs(curr.period_number - currentPeriodNum) < Math.abs(closest.period_number - currentPeriodNum)
                  ? curr
                  : closest
              )
          }
        } else if (secIdx > 0) {
          // First day (Monday) of current class -> JUMP TO PREVIOUS CLASS TIMETABLE!
          targetSec = visibleSections[secIdx - 1]
          const prevSecDays = setupMap.get(targetSec.setup_id)?.applicable_days || [
            "MONDAY",
            "TUESDAY",
            "WEDNESDAY",
            "THURSDAY",
            "FRIDAY",
          ]
          targetDay = prevSecDays[prevSecDays.length - 1] || "FRIDAY"
          const prevSecSched = getSectionScheduleAndTeachingPeriods(targetSec, targetDay)
          const targetTP = prevSecSched.teachingPeriods
          if (targetTP.length > 0) {
            targetPeriod =
              targetTP.find((p) => p.period_number === currentPeriodNum) ||
              targetTP[targetTP.length - 1]
          }
        }
      }

      if (!targetPeriod) return

      const targetEntry =
        entries.find(
          (e) =>
            e.section_id === targetSec.id &&
            e.day_of_week === targetDay &&
            ((e.period_id && e.period_id === targetPeriod.id) ||
              e.period_number === targetPeriod.period_number)
        ) || null

      const nextSlotKey = `${targetSec.id}_${targetDay}_${targetPeriod.id || targetPeriod.period_number}`
      const nextSlotData = {
        section: targetSec,
        day: targetDay,
        period: targetPeriod,
        entry: targetEntry,
      }

      setSelectedSlotKey(nextSlotKey)
      setSelectedSlotData(nextSlotData)

      requestAnimationFrame(() => {
        const cellEl = document.querySelector(`[data-slot-key="${nextSlotKey}"]`)
        if (cellEl) {
          const isClassChange = targetSec.id !== currentSec.id
          cellEl.scrollIntoView({
            behavior: "smooth",
            block: isClassChange ? "center" : "nearest",
            inline: "nearest",
          })
        }
      })
    },
    [selectedSlotData, visibleSections, getSectionScheduleAndTeachingPeriods, entries, setupMap]
  )

  // Keyboard navigation & Shortcuts listener adhering to cross-OS standards (Windows & Mac)
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

      const isMac = getIsMac()
      const isAnyModifier = e.ctrlKey || e.metaKey

      // 1. Undo: Windows Ctrl+Z | Mac ⌘+Z
      if (isAnyModifier && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault()
        handleUndo()
        return
      }

      // 2. Redo: Windows Ctrl+Y (or Ctrl+Shift+Z) | Mac ⌘+Shift+Z (or ⌘+Y)
      if (
        (isAnyModifier && e.shiftKey && e.key.toLowerCase() === "z") ||
        (isAnyModifier && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault()
        handleRedo()
        return
      }

      // 3. Copy slot: Windows Ctrl+C | Mac ⌘+C
      if (isAnyModifier && !e.shiftKey && e.key.toLowerCase() === "c") {
        if (selectedSlotData?.entry) {
          e.preventDefault()
          setCopiedSlotData(selectedSlotData)
          toast.success(
            `Copied ${selectedSlotData.entry.subject?.name || "slot"}. Press ${isMac ? "⌘V" : "Ctrl+V"} to paste.`
          )
        }
        return
      }

      // 4. Paste slot: Windows Ctrl+V | Mac ⌘+V
      if (isAnyModifier && !e.shiftKey && e.key.toLowerCase() === "v") {
        if (copiedSlotData?.entry && selectedSlotData) {
          e.preventDefault()
          handleMoveSlot(copiedSlotData, selectedSlotData, true)
        }
        return
      }

      // 5. Clear slot: Windows Delete | Mac Delete (⌫ / Backspace)
      if (
        e.key === "Delete" ||
        (isMac && e.key === "Backspace" && !isAnyModifier)
      ) {
        if (selectedSlotData?.entry?.id) {
          e.preventDefault()
          handleUnassignSlot(selectedSlotData.entry.id)
        }
        return
      }

      // 6. Assign / Edit slot: Windows Enter | Mac Return
      if (e.key === "Enter") {
        if (selectedSlotData) {
          e.preventDefault()
          setDialogState({
            isOpen: true,
            cellData: {
              section: selectedSlotData.section,
              day: selectedSlotData.day,
              period: selectedSlotData.period,
              currentEntry: selectedSlotData.entry,
              scheduleDays:
                selectedSlotData.scheduleDays ||
                getSplitDaysForSectionAndDay(selectedSlotData.section, selectedSlotData.day),
              allDays: getAllDaysForSection(selectedSlotData.section),
              timetableId: timetable?.id,
            },
          })
        }
        return
      }

      // 7. Escape: deselect active slot
      if (e.key === "Escape") {
        setSelectedSlotKey(null)
        setSelectedSlotData(null)
        return
      }

      // 8. Tab navigation between teaching slots
      if (e.key === "Tab") {
        e.preventDefault()
        handleArrowNavigation(e.shiftKey ? "ArrowLeft" : "ArrowRight", false)
        return
      }

      // 9. Class jumping shortcut keys: PageDown / PageUp, Cmd/Ctrl+ArrowDown, Cmd/Ctrl+ArrowUp
      if (e.key === "PageDown" || (isAnyModifier && e.key === "ArrowDown")) {
        e.preventDefault()
        handleArrowNavigation("ArrowDown", true)
        return
      }

      if (e.key === "PageUp" || (isAnyModifier && e.key === "ArrowUp")) {
        e.preventDefault()
        handleArrowNavigation("ArrowUp", true)
        return
      }

      // 10. Arrow keys: navigate between teaching timetable slots (and wrap/jump between classes at edges)
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault()
        handleArrowNavigation(e.key, false)
        return
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    isAssignMode,
    dialogState.isOpen,
    handleUndo,
    handleRedo,
    handleUnassignSlot,
    handleMoveSlot,
    handleArrowNavigation,
    selectedSlotData,
    copiedSlotData,
    timetable,
  ])

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
    <div className="space-y-6 pb-20">
      {/* WING GROUPS */}
      {filteredWings.map((wing) => {
        return (
          <div key={wing.id} id={`wing-group-${wing.id}`} className="space-y-4">
            {/* CLASS CARDS IN WING (Wing section header removed completely) */}
            <div className="space-y-5">
              {wing.classes?.map((cls) => {
                return (
                  <div key={cls.id} id={`class-group-${cls.id}`} className="space-y-4 scroll-mt-32 sm:scroll-mt-36">
                    {cls.sections?.map((section) => {
                      const secSetup =
                        (section.setup_id && (setupMap.get(section.setup_id) || setupMap.get(String(section.setup_id)))) ||
                        setups.find((s) => (s.assigned_section_ids || []).some((id) => String(id) === String(section.id))) ||
                        setups[0]
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
                          onSelectSlot={(slotKey, slotData) => {
                            if (!isAssignMode) return
                            setSelectedSlotKey(slotKey)
                            setSelectedSlotData(slotData || null)
                          }}
                          onOpenAssignDialog={(cellInfo) => {
                            if (!isAssignMode) return
                            setDialogState({
                              isOpen: true,
                              cellData: {
                                ...cellInfo,
                                scheduleDays:
                                  cellInfo.scheduleDays ||
                                  getSplitDaysForSectionAndDay(cellInfo.section, cellInfo.day),
                                allDays: getAllDaysForSection(cellInfo.section),
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
          </div>
        )
      })}

      {/* JUMP TO CLASS RAIL */}
      <JumpToRail classes={flattenedClasses} />

      {/* SLOT ASSIGNMENT DIALOG */}
      {dialogState.isOpen && (
        <SlotAssignmentDialog
          isOpen={dialogState.isOpen}
          onClose={() => setDialogState({ isOpen: false, cellData: null })}
          cellData={dialogState.cellData}
          availableSubjects={availableSubjectsForDialog}
          eligibleTeachers={eligible_teachers}
          existingEntries={entries}
          onAssign={handleAssignSlot}
          onUnassign={handleUnassignSlot}
          isSubmitting={bulkAssignMutation.isPending || deleteEntryMutation.isPending}
        />
      )}

      {/* FLOATING TIMETABLE TOOLTIP */}
      <TimetableTooltip />
    </div>
  )
}

