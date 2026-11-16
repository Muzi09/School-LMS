import React, { useReducer, useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  Clock,
  Plus,
  X,
  Layers,
  Send,
  Loader2,
  AlertTriangle,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  SetupCard,
  PeriodModal,
  DaySplitModal,
  DayMergeModal,
  MoveScheduleModal,
  DeleteSetupModal,
  SameTimingMergePromptModal,
  bellTimingReducer,
  createDefaultSetup,
  validateSchedule,
  validateSetupDayInvariants,
  validateAssignments,
  findIdenticalSchedulesInSetups,
  sortDays,
  sortSchedules,
  PERIOD_TYPES,
  MIN_PERIOD_DURATION_MINUTES,
  calculateDuration,
  addMinutesToTime,
} from "../bellTiming"
import {
  useSetups,
  useBatchSaveSetups,
  timetableKeys,
} from "@/hooks/useTimetable"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ErrorBoundary } from "@/components/common/ErrorBoundary"

function extractSectionsFromWings(wings = []) {
  const list = []
  wings.forEach((w) => {
    (w.classes || []).forEach((c) => {
      (c.sections || []).forEach((s) => {
        list.push({
          id: s.id,
          name: s.name,
          className: c.name,
          wingName: w.name,
        })
      })
    })
  })
  return list
}

export function mapSetupsToState(rawSetups, allSections = []) {
  if (!rawSetups || rawSetups.length === 0) {
    const defaultSetup = createDefaultSetup("Setup 1", 1)
    const assignments = {}
    allSections.forEach((sec) => {
      assignments[sec.id] = defaultSetup.id
    })
    return {
      setups: [defaultSetup],
      sectionAssignments: assignments,
    }
  }

  const assignments = {}
  const mappedSetups = rawSetups.map((s, idx) => {
    (s.assigned_section_ids || []).forEach((secId) => {
      assignments[secId] = s.id
    })

    const appDays = s.applicable_days || ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
    let schedules = s.schedules || []

    if (!schedules || schedules.length === 0) {
      const rawPeriods = s.periods || []
      schedules = [
        {
          id: "regular",
          days: appDays.filter((d) => d !== "SATURDAY"),
          periods: rawPeriods.map((p) => ({
            ...p,
            type: p.period_type || (p.is_break ? "RECESS" : "CLASS"),
          })),
        },
      ]
      if (appDays.includes("SATURDAY")) {
        schedules.push({
          id: "saturday",
          days: ["SATURDAY"],
          periods: rawPeriods.map((p) => ({
            ...p,
            type: p.period_type || (p.is_break ? "RECESS" : "CLASS"),
          })),
        })
      }
    }

    return {
      id: s.id,
      name: s.name,
      description: s.description,
      is_default: Boolean(s.is_default),
      order_index: s.order_index ?? idx,
      version: s.version ?? 1,
      applicable_days: appDays,
      schedules,
    }
  })

  // Assign any orphan sections to the first setup by default
  const firstSetupId = mappedSetups[0]?.id
  allSections.forEach((sec) => {
    if (!assignments[sec.id] && firstSetupId) {
      assignments[sec.id] = firstSetupId
    }
  })

  return {
    setups: mappedSetups,
    sectionAssignments: assignments,
  }
}

export function BellScheduleSetupModal({
  isOpen,
  onClose,
  timetableId,
  wings = [],
  initialSetups = null,
  onSaved,
  readOnly = false,
}) {
  // Query setups from API (pre-populated with initialSetups if provided from parent)
  const {
    data: rawSetupsData = [],
    isLoading: isFetchingSetups,
    error: fetchError,
    refetch,
  } = useSetups(timetableId, {
    initialData: initialSetups && initialSetups.length > 0 ? initialSetups : undefined,
  })

  const batchSaveMutation = useBatchSaveSetups()
  const queryClient = useQueryClient()

  // Flatten all sections in all wings
  const allSections = useMemo(() => extractSectionsFromWings(wings), [wings])

  // Schedule Reducer State: initialized on frame 0 using initialSetups if present
  const [state, dispatch] = useReducer(bellTimingReducer, null, () => {
    const sections = extractSectionsFromWings(wings)
    if (initialSetups && initialSetups.length > 0) {
      const mapped = mapSetupsToState(initialSetups, sections)
      return {
        setups: mapped.setups,
        sectionAssignments: mapped.sectionAssignments,
        activeSetupId: null,
        activeScheduleId: null,
        isDirty: false,
        revision: 0,
        history: { past: [], future: [] },
      }
    }
    return {
      setups: [],
      sectionAssignments: {},
      activeSetupId: null,
      activeScheduleId: null,
      isDirty: false,
      revision: 0,
      history: { past: [], future: [] },
    }
  })

  const currentRevisionRef = useRef(0)
  currentRevisionRef.current = state?.revision || 0

  // Multi-select sections state
  const [selectedSectionIds, setSelectedSectionIds] = useState([])

  // Sub-modal state: null | { type: "PERIOD" | "SPLIT" | "MERGE" | "MOVE" | "DELETE", ...props }
  const [modalState, setModalState] = useState(null)
  const [duplicateGroupsToMerge, setDuplicateGroupsToMerge] = useState(null)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const initialPayloadRef = useRef(
    initialSetups && initialSetups.length > 0
      ? JSON.parse(JSON.stringify(mapSetupsToState(initialSetups, extractSectionsFromWings(wings))))
      : null
  )
  const hasInitializedRef = useRef(Boolean(initialSetups && initialSetups.length > 0))
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (isOpen) {
      setIsSaving(false)
      setShowDiscardConfirm(false)
      // Only refetch if initial data was completely absent
      if (!initialSetups || initialSetups.length === 0) {
        hasInitializedRef.current = false
        refetch()
      }
    }
  }, [timetableId, isOpen, initialSetups, refetch])

  // Initialize or re-sync reducer state when API data arrives (only if not pre-populated)
  useEffect(() => {
    if (!isOpen || hasInitializedRef.current) return
    if (isFetchingSetups) return

    // If state is not dirty, populate from API data or synthesize initial setup
    if (!state.isDirty) {
      if (rawSetupsData && rawSetupsData.length > 0) {
        const initialPayload = mapSetupsToState(rawSetupsData, allSections)
        initialPayloadRef.current = JSON.parse(JSON.stringify(initialPayload))
        hasInitializedRef.current = true
        dispatch({
          type: "SET_INITIAL_STATE",
          payload: initialPayload,
        })
      } else if (!isFetchingSetups) {
        // No setups exist yet: create initial default setup and assign all classes to it
        const initialPayload = mapSetupsToState([], allSections)
        initialPayloadRef.current = JSON.parse(JSON.stringify(initialPayload))
        hasInitializedRef.current = true
        dispatch({
          type: "SET_INITIAL_STATE",
          payload: initialPayload,
        })
      }
    }
  }, [isOpen, rawSetupsData, isFetchingSetups, allSections, state.isDirty])

  // Setup Actions
  const handleRenameSetup = (setupId, name) => {
    dispatch({ type: "RENAME_SETUP", payload: { setupId, name } })
  }

  const handleDuplicateSetup = (setupId) => {
    dispatch({ type: "DUPLICATE_SETUP", payload: { setupId } })
    toast.success("Setup duplicated with empty class assignments.")
  }

  const handleDeleteSetup = (setupId) => {
    const targetSetup = state.setups.find((s) => s.id === setupId)
    if (!targetSetup) return

    const assignedSectionIds = Object.entries(state.sectionAssignments)
      .filter(([_, sId]) => sId === setupId)
      .map(([secId]) => secId)

    setModalState({
      type: "DELETE",
      setupToDelete: targetSetup,
      assignedCount: assignedSectionIds.length,
      assignedSectionIds,
      otherSetups: state.setups.filter((s) => s.id !== setupId),
    })
  }

  const handleConfirmDeleteSetup = ({ setupId, targetSetupId }) => {
    const targetSetup = state.setups.find((s) => s.id === setupId)
    const assignedSectionIds = Object.entries(state.sectionAssignments)
      .filter(([_, sId]) => sId === setupId)
      .map(([secId]) => secId)

    if (assignedSectionIds.length > 0 && targetSetupId) {
      dispatch({
        type: "MOVE_CLASSES",
        payload: { sectionIds: assignedSectionIds, targetSetupId },
      })
    }

    dispatch({ type: "DELETE_SETUP", payload: { setupId } })

    const otherSetup = state.setups.find((s) => s.id === targetSetupId)
    if (assignedSectionIds.length > 0 && otherSetup) {
      toast.success(
        `Reassigned ${assignedSectionIds.length} ${assignedSectionIds.length === 1 ? "class" : "classes"} to ${otherSetup.name} and deleted ${targetSetup?.name || "Setup"}`
      )
    } else {
      toast.info(`Deleted ${targetSetup?.name || "Setup"}`)
    }
  }

  const handleCreateSetup = () => {
    const nextIdx = state.setups.length + 1
    dispatch({ type: "CREATE_SETUP", payload: { name: `Setup ${nextIdx}` } })
  }

  // Day Schedule Split & Merge
  const handleOpenSplitModal = (setupId, schedule, days) => {
    setModalState({
      type: "SPLIT",
      setupId,
      schedule,
      daysToSplit: days,
    })
  }

  const handleConfirmSplit = (setupId, scheduleId, daysToSplit) => {
    dispatch({
      type: "SPLIT_DAYS",
      payload: { setupId, scheduleId, daysToSplit },
    })
    toast.success(`Split ${daysToSplit.join(", ")} into an independent schedule.`)
  }

  const handleOpenMergeModal = (setupId, sourceSchedule, day) => {
    const targetSetup = state.setups.find((s) => s.id === setupId)
    setModalState({
      type: "MERGE",
      setupId,
      sourceSchedule,
      allSchedules: targetSetup?.schedules || [],
      day,
    })
  }

  const handleConfirmMerge = (setupId, { sourceScheduleId, targetScheduleId, day }) => {
    dispatch({
      type: "MERGE_DAYS",
      payload: { setupId, sourceScheduleId, targetScheduleId },
    })
    toast.info(`Merged ${day} back into shared schedule.`)
  }

  // Period Actions
  const handleOpenPeriodModal = (setupId, scheduleId, period, periodIndex) => {
    const setup = state.setups.find((s) => s.id === setupId)
    const schedule = setup?.schedules?.find((sch) => sch.id === scheduleId)
    setModalState({
      type: "PERIOD",
      mode: "edit",
      setupId,
      scheduleId,
      periodData: period,
      periodIndex,
      schedule,
    })
  }

  const handleInsertPeriodAtBoundary = (setupId, scheduleId, insertAfterIndex) => {
    const setup = state.setups.find((s) => s.id === setupId)
    const schedule = setup?.schedules?.find((sch) => sch.id === scheduleId)
    if (!setup || !schedule) return

    const periods = schedule.periods || []
    const prevPeriod = insertAfterIndex >= 0 && periods[insertAfterIndex] ? periods[insertAfterIndex] : null
    const nextPeriod = insertAfterIndex === -1 && periods[0] ? periods[0] : null

    let startTime = "08:30"
    let endTime = "09:15"

    if (prevPeriod) {
      startTime = prevPeriod.end_time
      const dur = calculateDuration(prevPeriod.start_time, prevPeriod.end_time) || 45
      endTime = addMinutesToTime(startTime, Math.max(MIN_PERIOD_DURATION_MINUTES, dur))
    } else if (nextPeriod) {
      const dur = calculateDuration(nextPeriod.start_time, nextPeriod.end_time) || 45
      endTime = nextPeriod.start_time
      startTime = addMinutesToTime(endTime, -Math.max(MIN_PERIOD_DURATION_MINUTES, dur))
    }

    dispatch({
      type: "INSERT_PERIOD",
      payload: {
        setupId,
        scheduleId,
        insertAfterIndex,
        periodData: {
          type: PERIOD_TYPES.CLASS,
          start_time: startTime,
          end_time: endTime,
        },
        cascadeMode: "shift",
      },
    })
    toast.success("Period added.")
  }

  const handleSavePeriod = (payload) => {
    if (payload.mode === "add") {
      dispatch({
        type: "INSERT_PERIOD",
        payload: {
          setupId: payload.setupId,
          scheduleId: payload.scheduleId,
          insertAfterIndex: payload.insertAfterIndex,
          periodData: payload.periodData,
          cascadeMode: payload.cascadeMode,
        },
      })
    } else {
      dispatch({
        type: "EDIT_PERIOD",
        payload: {
          setupId: payload.setupId,
          scheduleId: payload.scheduleId,
          periodIndex: payload.periodIndex,
          periodData: payload.periodData,
          cascadeMode: payload.cascadeMode,
          shiftEntireDay: payload.shiftEntireDay,
        },
      })
    }
  }

  const handleDeletePeriod = (setupId, scheduleId, periodIndex) => {
    dispatch({
      type: "DELETE_PERIOD",
      payload: { setupId, scheduleId, periodIndex },
    })
  }

  const handleEditBoundaryTime = (setupId, scheduleId, boundaryIndex, newTime, isFirst) => {
    dispatch({
      type: "EDIT_BOUNDARY_TIME",
      payload: { setupId, scheduleId, boundaryIndex, newTime, isFirst },
    })
  }

  const handleApplyTemplate = (setupId, scheduleId, templateType = "standard") => {
    dispatch({
      type: "APPLY_TEMPLATE",
      payload: { setupId, scheduleId, templateType },
    })
    toast.success("Applied standard 8-period template.")
  }

  // Class Movement Actions
  const handleWingClick = (wing, sectionIds, currentSetupId) => {
    setModalState({
      type: "MOVE",
      targetType: "WING",
      targetInfo: {
        name: wing.name,
        wingName: wing.name,
        sectionCount: sectionIds.length,
        sectionIds,
      },
      currentSetupId,
    })
  }

  const handleClassClick = (cls, wingName, sectionIds, currentSetupId) => {
    setModalState({
      type: "MOVE",
      targetType: "CLASS",
      targetInfo: {
        name: cls.name,
        className: cls.name,
        wingName,
        sectionCount: sectionIds.length,
        sectionIds,
      },
      currentSetupId,
    })
  }

  const handleSectionClick = (e, sec, className, wingName, currentSetupId) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      // Toggle selection for multi-select
      setSelectedSectionIds((prev) =>
        prev.includes(sec.id) ? prev.filter((id) => id !== sec.id) : [...prev, sec.id]
      )
      return
    }

    setModalState({
      type: "MOVE",
      targetType: "SECTION",
      targetInfo: {
        name: sec.name,
        className,
        wingName,
        sectionCount: 1,
        sectionIds: [sec.id],
      },
      currentSetupId,
    })
  }

  const handleOpenMultiMove = () => {
    if (selectedSectionIds.length === 0) return
    const firstAssignedSetupId = state.sectionAssignments[selectedSectionIds[0]] || state.setups[0]?.id

    setModalState({
      type: "MOVE",
      targetType: "MULTI",
      targetInfo: {
        sectionCount: selectedSectionIds.length,
        sectionIds: selectedSectionIds,
      },
      currentSetupId: firstAssignedSetupId,
    })
  }

  const handleMoveToSetup = ({ sectionIds, targetSetupId, count }) => {
    const targetSetup = state.setups.find((s) => s.id === targetSetupId)
    dispatch({
      type: "MOVE_CLASSES",
      payload: { sectionIds, targetSetupId },
    })
    setSelectedSectionIds([])
    const label = count === 1 ? "1 class" : `${count} classes`
    toast.success(`Moved ${label} to ${targetSetup?.name || "Setup"}`)
  }

  const handleCreateAndMove = ({ sectionIds, sourceSetupId, count }) => {
    const nextIdx = state.setups.length + 1
    const newName = `Setup ${nextIdx}`

    dispatch({
      type: "CREATE_AND_MOVE",
      payload: { sectionIds, sourceSetupId, name: newName },
    })
    setSelectedSectionIds([])
    const label = count === 1 ? "1 class" : `${count} classes`
    toast.success(`Created ${newName} and moved ${label}`)
  }

  // Keyboard Shortcuts & Escape Key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (isSaving) return
      // Escape closes sub-modal first, then merge prompt, then main modal
      if (e.key === "Escape") {
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false)
          return
        }
        if (duplicateGroupsToMerge) {
          setDuplicateGroupsToMerge(null)
          return
        }
        if (modalState) {
          setModalState(null)
          return
        }
        handleRequestClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, modalState, duplicateGroupsToMerge, isSaving, showDiscardConfirm])

  // Request close: if dirty, prompt to confirm discard; if clean, close immediately
  const handleRequestClose = () => {
    if (isSaving) return

    // If there is an active sub-modal, close that first
    if (modalState) {
      setModalState(null)
      return
    }

    // If duplicate merge prompt is open, close that first
    if (duplicateGroupsToMerge) {
      setDuplicateGroupsToMerge(null)
      return
    }

    // If user has unsaved changes, prompt before discarding!
    if (state.isDirty) {
      setShowDiscardConfirm(true)
      return
    }

    onClose()
  }

  // Discard all changes made in this session and restore initial state
  const handleDiscard = () => {
    if (isSaving || !state.isDirty) return
    if (initialPayloadRef.current) {
      dispatch({
        type: "SET_INITIAL_STATE",
        payload: JSON.parse(JSON.stringify(initialPayloadRef.current)),
      })
      toast.info("All changes discarded.")
    }
  }

  // Centralized robust save function
  const performSave = useCallback(
    async (stateToSave) => {
      if (!stateToSave || !stateToSave.setups || stateToSave.setups.length === 0 || readOnly) {
        return null
      }

      const revisionToSave = stateToSave.revision
      const assignmentsPayload = Object.entries(stateToSave.sectionAssignments || {}).map(([secId, setupId]) => ({
        setup_id: setupId,
        target_type: "SECTION",
        target_id: secId,
      }))

      const payload = {
        timetable_id: timetableId,
        setups: stateToSave.setups.map((s, idx) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          is_default: idx === 0,
          order_index: idx,
          version: s.version ?? 1,
          applicable_days: s.applicable_days,
          schedules: s.schedules,
        })),
        assignments: assignmentsPayload,
      }

      const res = await batchSaveMutation.mutateAsync(payload)
      const savedSetups = Array.isArray(res) ? res : (res?.data || [])
      dispatch({
        type: "SAVE_SUCCESS",
        payload: {
          savedSetups,
          revision: revisionToSave,
        },
      })

      const setupsToCache = savedSetups && savedSetups.length > 0 ? savedSetups : stateToSave.setups
      queryClient.setQueriesData(
        { queryKey: ["timetable", "class-wise"] },
        (oldData) => {
          if (!oldData) return oldData
          return {
            ...oldData,
            setups: setupsToCache,
          }
        }
      )
      queryClient.invalidateQueries({ queryKey: timetableKeys.setups(timetableId) })
      queryClient.invalidateQueries({ queryKey: ["timetable", "class-wise"] })

      return setupsToCache
    },
    [batchSaveMutation, queryClient, readOnly, timetableId]
  )

  const executeSaveAndClose = async (stateToSave) => {
    setIsSaving(true)
    try {
      const savedSetups = await performSave(stateToSave)
      if (onSaved) {
        onSaved(savedSetups)
      } else {
        toast.success("Bell schedule saved successfully.")
      }
      onClose()
    } catch (err) {
      console.error("Save error:", err)
      const is409 =
        err?.status === 409 ||
        err?.data?.detail?.includes("modified by another user") ||
        err?.message?.includes("modified by another user")

      if (is409) {
        toast.error("Bell setup was modified in another session. Please reload.")
      } else {
        const msg = err?.response?.data?.message || err?.message || "Failed to save bell schedule changes."
        toast.error(msg)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleExplicitSave = async () => {
    if (isSaving || !state.isDirty || readOnly) return
    if (validationErrors.length > 0) {
      toast.error(validationErrors[0] || "Please resolve validation errors before saving.")
      return
    }

    const duplicateGroups = findIdenticalSchedulesInSetups(state.setups)
    if (duplicateGroups.length > 0) {
      setDuplicateGroupsToMerge(duplicateGroups)
      return
    }

    await executeSaveAndClose(state)
  }

  const handleConfirmDuplicateMerge = async () => {
    if (!duplicateGroupsToMerge || duplicateGroupsToMerge.length === 0) {
      await executeSaveAndClose(state)
      return
    }

    let mergedSetups = stateRef.current.setups
    duplicateGroupsToMerge.forEach((group) => {
      dispatch({
        type: "MERGE_DAYS",
        payload: {
          setupId: group.setupId,
          sourceScheduleId: group.sourceScheduleId,
          targetScheduleId: group.targetScheduleId,
        },
      })

      mergedSetups = mergedSetups.map((setup) => {
        if (setup.id !== group.setupId) return setup
        const targetSched = setup.schedules.find((s) => s.id === group.targetScheduleId)
        const sourceSched = setup.schedules.find((s) => s.id === group.sourceScheduleId)
        if (!targetSched || !sourceSched) return setup

        const mergedDays = sortDays([...new Set([...targetSched.days, ...sourceSched.days])])
        const nextSchedules = setup.schedules
          .filter((s) => s.id !== group.sourceScheduleId)
          .map((s) => (s.id === group.targetScheduleId ? { ...s, days: mergedDays } : s))

        return { ...setup, schedules: sortSchedules(nextSchedules) }
      })
    })

    setDuplicateGroupsToMerge(null)
    const mergedStateToSave = {
      ...stateRef.current,
      setups: mergedSetups,
    }
    await executeSaveAndClose(mergedStateToSave)
  }

  const handleCancelDuplicateMerge = () => {
    setDuplicateGroupsToMerge(null)
  }

  // Validation checks across setups and assignments
  const validationErrors = useMemo(() => {
    const errors = []

    state.setups.forEach((setup) => {
      // Day invariant check
      const dayInv = validateSetupDayInvariants(setup)
      if (!dayInv.isValid) {
        errors.push(...dayInv.errors)
      }

      // Period sequence check
      setup.schedules?.forEach((sch, sIdx) => {
        const valRes = validateSchedule(sch)
        if (!valRes.isValid) {
          valRes.errors.forEach((err) => {
            errors.push(`${setup.name} Schedule ${sIdx + 1}: ${err}`)
          })
        }
      })
    })

    // Class assignments completeness check
    const assignVal = validateAssignments(allSections, state.sectionAssignments, state.setups)
    if (!assignVal.isValid) {
      errors.push(...assignVal.errors)
    }

    return errors
  }, [state.setups, state.sectionAssignments, allSections])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in-0 duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bell-setup-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity"
        onClick={isSaving ? undefined : handleRequestClose}
      />

      {/* Main Large Modal Dialog */}
      <div className="relative w-[90vw] max-w-[90vw] max-h-[92vh] flex flex-col bg-card border border-border shadow-2xl rounded-2xl z-10 animate-in zoom-in-95 duration-150 overflow-hidden">
        {/* Animated Progress Line across the top of modal during save */}
        {isSaving && (
          <div className="absolute top-0 inset-x-0 h-1 z-30 bg-primary/10 overflow-hidden">
            <div className="h-full bg-primary/80 animate-pulse w-full bg-gradient-to-r from-primary/30 via-primary to-primary/30" />
          </div>
        )}

        {/* Top Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-muted/15 shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Clock className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="bell-setup-title" className="text-base font-bold text-foreground">
                  Timetable Frame & Bell Schedule Setup
                </h2>
                <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5">
                  {state.setups.length} {state.setups.length === 1 ? "SETUP" : "SETUPS"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure period frames, independent day timings, and class wing allocations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCreateSetup}
                disabled={isSaving}
                className="h-8 px-3 text-xs font-semibold gap-1.5 shadow-2xs cursor-pointer"
              >
                <Plus className="size-3.5 text-primary" />
                <span>Add Setup</span>
              </Button>
            )}
            <button
              type="button"
              onClick={handleRequestClose}
              disabled={isSaving}
              className={cn(
                "p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer",
                isSaving && "opacity-50 cursor-not-allowed"
              )}
              aria-label="Close modal"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Loading / Error States */}
        {isFetchingSetups && state.setups.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-3">
            <Loader2 className="size-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground font-medium">Loading bell schedules and classes...</p>
          </div>
        ) : fetchError && state.setups.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-3 text-center">
            <AlertTriangle className="size-8 text-destructive" />
            <p className="text-sm font-bold text-foreground">Failed to load bell setups</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          /* Scrollable Body: Vertical List of Setup Cards */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* Validation Alerts Banner */}
            {validationErrors.length > 0 && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Validation Invariants Violated ({validationErrors.length})</span>
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-[11px] opacity-90">
                  {validationErrors.slice(0, 3).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {validationErrors.length > 3 && (
                    <li>...and {validationErrors.length - 3} more issue(s)</li>
                  )}
                </ul>
              </div>
            )}

            {/* List of Setups */}
            {state.setups.map((setup, sIdx) => (
              <SetupCard
                key={setup.id}
                setup={setup}
                setupIndex={sIdx}
                isOnlySetup={state.setups.length <= 1}
                wings={wings}
                sectionAssignments={state.sectionAssignments}
                selectedSectionIds={selectedSectionIds}
                activeScheduleId={state.activeScheduleId}
                readOnly={readOnly}
                onSelectSchedule={(schedId) => dispatch({ type: "SELECT_SCHEDULE", payload: { scheduleId: schedId } })}
                onRenameSetup={handleRenameSetup}
                onDuplicateSetup={handleDuplicateSetup}
                onDeleteSetup={handleDeleteSetup}
                onOpenSplitModal={handleOpenSplitModal}
                onOpenMergeModal={handleOpenMergeModal}
                onOpenPeriodModal={handleOpenPeriodModal}
                onInsertPeriodAtBoundary={handleInsertPeriodAtBoundary}
                onEditBoundaryTime={handleEditBoundaryTime}
                onApplyTemplate={handleApplyTemplate}
                onWingClick={handleWingClick}
                onClassClick={handleClassClick}
                onSectionClick={handleSectionClick}
                otherSetups={state.setups.filter((s) => s.id !== setup.id)}
              />
            ))}

            {/* Bottom Dashed "+ Create Setup N" Card */}
            {!readOnly && (
              <button
                type="button"
                onClick={handleCreateSetup}
                className="w-full p-6 border-2 border-dashed border-border/80 hover:border-primary/60 hover:bg-primary/5 rounded-2xl flex items-center justify-center gap-2.5 text-sm font-bold text-primary transition-all cursor-pointer shadow-2xs group"
              >
                <div className="size-8 rounded-xl bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center transition-colors">
                  <Plus className="size-4" />
                </div>
                <span>Create Setup {state.setups.length + 1}</span>
              </button>
            )}
          </div>
        )}

        {/* Floating Multi-Select Action Bar */}
        {selectedSectionIds.length > 0 && !readOnly && (
          <div className="sticky bottom-14 inset-x-0 mx-auto w-max max-w-[90vw] z-40 p-2.5 px-4 bg-foreground text-background shadow-2xl rounded-2xl flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-150">
            <span className="text-xs font-bold">
              {selectedSectionIds.length} {selectedSectionIds.length === 1 ? "class" : "classes"} selected
            </span>
            <Button
              type="button"
              size="xs"
              onClick={handleOpenMultiMove}
              className="bg-primary text-primary-foreground font-semibold text-xs h-7 px-3 shadow-2xs gap-1.5"
            >
              <Send className="size-3" />
              <span>Move {selectedSectionIds.length} Classes</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setSelectedSectionIds([])}
              className="text-background/80 hover:text-background h-7 px-2 text-xs"
            >
              Clear
            </Button>
          </div>
        )}

        {/* Sticky Action Footer Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-card/95 backdrop-blur-xs shrink-0 z-20">
          <div className="flex items-center gap-3 flex-wrap">
            {state.isDirty ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Unsaved changes</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Check className="size-3.5 text-emerald-500" />
                <span>All changes saved</span>
              </div>
            )}

            {validationErrors.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-destructive bg-destructive/10 px-2.5 py-1 rounded-md max-w-md truncate">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span className="truncate">{validationErrors[0]}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              disabled={isSaving || !state.isDirty}
              className="h-9 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Discard Changes
            </Button>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleExplicitSave}
              disabled={isSaving || !state.isDirty || validationErrors.length > 0}
              className="h-9 px-5 text-xs font-semibold gap-2 shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  <span>Save Bell Schedule</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Sub-modals */}
      <ErrorBoundary onReset={() => setModalState(null)}>
        {modalState?.type === "PERIOD" && (
          <PeriodModal
            isOpen={true}
            onClose={() => setModalState(null)}
            mode={modalState.mode}
            periodData={modalState.periodData}
            periodIndex={modalState.periodIndex}
            insertAfterIndex={modalState.insertAfterIndex}
            schedule={
              state.setups
                .find((s) => s.id === modalState.setupId)
                ?.schedules?.find((sch) => sch.id === modalState.scheduleId) || modalState.schedule
            }
            onSave={(data, options = {}) => {
              handleSavePeriod({
                ...data,
                mode: data.mode || modalState.mode,
                setupId: modalState.setupId,
                scheduleId: modalState.scheduleId,
                insertAfterIndex: modalState.insertAfterIndex,
                periodIndex: data.periodIndex ?? modalState.periodIndex,
              })
              if (!options.stayOpen) {
                setModalState(null)
              } else {
                setModalState((prev) => ({
                  ...prev,
                  mode: "edit",
                  periodIndex: data.nextPeriodIndex ?? prev.periodIndex,
                  periodData:
                    state.setups
                      .find((s) => s.id === modalState.setupId)
                      ?.schedules?.find((sch) => sch.id === modalState.scheduleId)
                      ?.periods?.[data.nextPeriodIndex] || prev.periodData,
                }))
              }
            }}
            onDelete={(idx) => {
              handleDeletePeriod(modalState.setupId, modalState.scheduleId, idx)
              setModalState(null)
            }}
          />
        )}

        {modalState?.type === "SPLIT" && (
          <DaySplitModal
            isOpen={true}
            onClose={() => setModalState(null)}
            schedule={modalState.schedule}
            daysToSplit={modalState.daysToSplit}
            onConfirmSplit={(days) => {
              handleConfirmSplit(modalState.setupId, modalState.schedule.id, days)
              setModalState(null)
            }}
          />
        )}

        {modalState?.type === "MERGE" && (
          <DayMergeModal
            isOpen={true}
            onClose={() => setModalState(null)}
            sourceSchedule={modalState.sourceSchedule}
            allSchedules={modalState.allSchedules}
            day={modalState.day}
            onConfirmMerge={(args) => {
              handleConfirmMerge(modalState.setupId, args)
              setModalState(null)
            }}
          />
        )}

        {modalState?.type === "MOVE" && (
          <MoveScheduleModal
            isOpen={true}
            onClose={() => setModalState(null)}
            targetType={modalState.targetType}
            targetInfo={modalState.targetInfo}
            currentSetupId={modalState.currentSetupId}
            setups={state.setups}
            sectionAssignments={state.sectionAssignments}
            onMoveToSetup={handleMoveToSetup}
            onCreateAndMove={handleCreateAndMove}
          />
        )}

        {modalState?.type === "DELETE" && (
          <DeleteSetupModal
            isOpen={true}
            onClose={() => setModalState(null)}
            setupToDelete={modalState.setupToDelete}
            assignedCount={modalState.assignedCount}
            otherSetups={modalState.otherSetups}
            sectionAssignments={state.sectionAssignments}
            onConfirmDelete={handleConfirmDeleteSetup}
          />
        )}
      </ErrorBoundary>

      {/* Same Timing Auto-Merge Prompt Modal on Exit */}
      {duplicateGroupsToMerge && (
        <SameTimingMergePromptModal
          isOpen={true}
          duplicateGroups={duplicateGroupsToMerge}
          onConfirmMerge={handleConfirmDuplicateMerge}
          onCancel={isSaving ? undefined : handleCancelDuplicateMerge}
          isMerging={isSaving}
        />
      )}

      {/* Unsaved Changes Discard Confirmation Dialog */}
      {showDiscardConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in-0 duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity"
            onClick={() => setShowDiscardConfirm(false)}
          />
          <div className="relative w-full max-w-sm bg-card border border-border shadow-2xl rounded-2xl z-10 overflow-hidden flex flex-col space-y-4 p-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">Discard Unsaved Changes?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You have unsaved changes to bell timings or class allocations. If you exit now, your changes will be discarded.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDiscardConfirm(false)}
                className="text-xs h-8 px-3.5 cursor-pointer font-medium"
              >
                Keep Editing
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  setShowDiscardConfirm(false)
                  onClose()
                }}
                className="text-xs h-8 px-3.5 cursor-pointer font-semibold shadow-2xs"
              >
                Discard & Exit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
