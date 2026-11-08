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
  bellTimingReducer,
  createDefaultSetup,
  validateSchedule,
  validateSetupDayInvariants,
  validateAssignments,
} from "../bellTiming"
import {
  useSetups,
  useBatchSaveSetups,
  timetableKeys,
} from "@/hooks/useTimetable"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function BellScheduleSetupModal({
  isOpen,
  onClose,
  timetableId,
  wings = [],
  onSaved,
  readOnly = false,
}) {
  // Query setups from API
  const {
    data: rawSetupsData = [],
    isLoading: isFetchingSetups,
    error: fetchError,
    refetch,
  } = useSetups(timetableId)

  const batchSaveMutation = useBatchSaveSetups()
  const queryClient = useQueryClient()
  const isSavingRef = useRef(false)
  const pendingSaveRef = useRef(false)

  // Flatten all sections in all wings
  const allSections = useMemo(() => {
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
  }, [wings])

  // Schedule Reducer State
  const [state, dispatch] = useReducer(bellTimingReducer, null, () => ({
    setups: [],
    sectionAssignments: {},
    activeSetupId: null,
    activeScheduleId: null,
    isDirty: false,
    revision: 0,
    history: { past: [], future: [] },
  }))

  const currentRevisionRef = useRef(0)
  currentRevisionRef.current = state?.revision || 0

  // Multi-select sections state
  const [selectedSectionIds, setSelectedSectionIds] = useState([])

  // Sub-modal state: null | { type: "PERIOD" | "SPLIT" | "MERGE" | "MOVE" | "DELETE", ...props }
  const [modalState, setModalState] = useState(null)
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    hasInitializedRef.current = false
  }, [timetableId, isOpen])

  // Initialize or re-sync reducer state when API data arrives
  useEffect(() => {
    if (!isOpen || hasInitializedRef.current) return
    if (isFetchingSetups) return

    // If state is not dirty, populate from API data or synthesize initial setup
    if (!state.isDirty) {
      if (rawSetupsData && rawSetupsData.length > 0) {
        const assignments = {}
        const mappedSetups = rawSetupsData.map((s, idx) => {
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

        hasInitializedRef.current = true
        dispatch({
          type: "SET_INITIAL_STATE",
          payload: {
            setups: mappedSetups,
            sectionAssignments: assignments,
          },
        })
      } else if (!isFetchingSetups) {
        // No setups exist yet: create initial default setup and assign all classes to it
        const defaultSetup = createDefaultSetup("Setup 1", 1)
        const assignments = {}
        allSections.forEach((sec) => {
          assignments[sec.id] = defaultSetup.id
        })

        hasInitializedRef.current = true
        dispatch({
          type: "SET_INITIAL_STATE",
          payload: {
            setups: [defaultSetup],
            sectionAssignments: assignments,
          },
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
    setModalState({
      type: "PERIOD",
      mode: "add",
      setupId,
      scheduleId,
      insertAfterIndex,
      schedule,
    })
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
      // Escape closes sub-modal first, then main modal
      if (e.key === "Escape") {
        if (modalState) {
          setModalState(null)
          return
        }
        handleRequestClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, modalState])

  const handleRequestClose = async () => {
    if (state.isDirty && !readOnly && validationErrors.length === 0) {
      await handleAutoSave()
    }
    onClose()
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

  // Autosave Flow: saves automatically on change
  const handleAutoSave = useCallback(async () => {
    if (state.setups.length === 0 || readOnly) return
    if (validationErrors.length > 0) return

    if (isSavingRef.current) {
      pendingSaveRef.current = true
      return
    }

    isSavingRef.current = true
    pendingSaveRef.current = false
    const revisionToSave = currentRevisionRef.current

    const assignmentsPayload = Object.entries(state.sectionAssignments).map(([secId, setupId]) => ({
      setup_id: setupId,
      target_type: "SECTION",
      target_id: secId,
    }))

    const payload = {
      timetable_id: timetableId,
      setups: state.setups.map((s, idx) => ({
        id: String(s.id).startsWith("setup-") ? null : s.id,
        name: s.name,
        description: s.description,
        is_default: idx === 0,
        order_index: idx,
        version: s.version,
        applicable_days: s.applicable_days,
        schedules: s.schedules,
      })),
      assignments: assignmentsPayload,
    }

    try {
      const res = await batchSaveMutation.mutateAsync(payload)
      const savedSetups = Array.isArray(res) ? res : (res?.data || [])
      dispatch({
        type: "SAVE_SUCCESS",
        payload: {
          savedSetups,
          revision: revisionToSave,
        },
      })
      if (onSaved) onSaved()
    } catch (err) {
      console.error("Autosave error:", err)
      const is409 =
        err?.status === 409 ||
        err?.data?.detail?.includes("modified by another user") ||
        err?.message?.includes("modified by another user")

      if (is409) {
        toast.error("Timetable setup was updated. Reloading latest setup...")
        hasInitializedRef.current = false
        queryClient.invalidateQueries({ queryKey: timetableKeys.setups(timetableId) })
        queryClient.invalidateQueries({ queryKey: timetableKeys.all })
        dispatch({ type: "DISCARD_CHANGES" })
      }
    } finally {
      isSavingRef.current = false
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false
        // Trigger subsequent save if modifications happened while in flight
        setTimeout(() => {
          handleAutoSaveRef.current?.()
        }, 150)
      }
    }
  }, [state.setups, state.sectionAssignments, readOnly, validationErrors, timetableId, batchSaveMutation, onSaved, queryClient])

  const handleAutoSaveRef = useRef(handleAutoSave)
  useEffect(() => {
    handleAutoSaveRef.current = handleAutoSave
  }, [handleAutoSave])

  // Automatically save on change whenever state is dirty
  useEffect(() => {
    if (!isOpen || !hasInitializedRef.current || !state.isDirty || readOnly) return
    if (validationErrors.length > 0) return

    const timer = setTimeout(() => {
      handleAutoSaveRef.current?.()
    }, 400)

    return () => clearTimeout(timer)
  }, [state.revision, state.isDirty, validationErrors.length, isOpen, readOnly])

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
        onClick={handleRequestClose}
      />

      {/* Main Large Modal Dialog */}
      <div className="relative w-[90vw] max-w-[90vw] max-h-[92vh] flex flex-col bg-card border border-border shadow-2xl rounded-2xl z-10 animate-in zoom-in-95 duration-150 overflow-hidden">
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
                className="h-8 px-3 text-xs font-semibold gap-1.5 shadow-2xs"
              >
                <Plus className="size-3.5 text-primary" />
                <span>Add Setup</span>
              </Button>
            )}
            <button
              type="button"
              onClick={handleRequestClose}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
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
      </div>

      {/* Sub-modals */}
      {modalState?.type === "PERIOD" && (
        <PeriodModal
          isOpen={true}
          onClose={() => setModalState(null)}
          mode={modalState.mode}
          periodData={modalState.periodData}
          periodIndex={modalState.periodIndex}
          insertAfterIndex={modalState.insertAfterIndex}
          schedule={modalState.schedule}
          onSave={(data) => {
            handleSavePeriod({
              ...data,
              mode: modalState.mode,
              setupId: modalState.setupId,
              scheduleId: modalState.scheduleId,
              insertAfterIndex: modalState.insertAfterIndex,
              periodIndex: modalState.periodIndex,
            })
            setModalState(null)
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
    </div>
  )
}
