import React, { useState, useEffect, useMemo } from "react"
import {
  Clock,
  Plus,
  Trash2,
  Copy,
  AlertTriangle,
  Check,
  ChevronRight,
  Coffee,
  Calendar,
  Layers,
  Sparkles,
  Info,
  Loader2,
  X,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  useBatchSaveSetups,
  useSetups,
} from "@/hooks/useTimetable"
import { previewSetupsImpactApi } from "@/api/timetableService"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const ALL_DAYS = [
  { id: "MONDAY", short: "Mon", full: "Monday" },
  { id: "TUESDAY", short: "Tue", full: "Tuesday" },
  { id: "WEDNESDAY", short: "Wed", full: "Wednesday" },
  { id: "THURSDAY", short: "Thu", full: "Thursday" },
  { id: "FRIDAY", short: "Fri", full: "Friday" },
  { id: "SATURDAY", short: "Sat", full: "Saturday" },
]

function parseMinutes(timeStr = "08:30") {
  const [h, m] = timeStr.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

function formatMinutes(minutes) {
  const norm = ((minutes % 1440) + 1440) % 1440
  const h = Math.floor(norm / 60)
  const m = norm % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function format12h(timeStr = "08:30") {
  const [hStr, mStr] = timeStr.split(":")
  let h = parseInt(hStr, 10) || 0
  const m = mStr || "00"
  const ampm = h >= 12 ? "PM" : "AM"
  h = h % 12 || 12
  return `${h}:${m} ${ampm}`
}

export function BellScheduleSetupModal({
  isOpen,
  onClose,
  timetableId,
  schoolId,
  wings = [],
  onSaved,
}) {
  const { data: initialSetups = [], isLoading } = useSetups(timetableId)
  const batchSaveMutation = useBatchSaveSetups()

  // Setups state
  const [setups, setSetups] = useState([])
  // Mapping of sectionId -> setupId
  const [sectionAssignments, setSectionAssignments] = useState({})

  // Impact dialog state
  const [impactModalData, setImpactModalData] = useState(null)
  const [isCheckingImpact, setIsCheckingImpact] = useState(false)

  // Shift downstream periods toggle state
  const [autoShift, setAutoShift] = useState(true)

  // Extract all sections across all wings
  const allSections = useMemo(() => {
    const list = []
    wings.forEach((w) => {
      w.classes?.forEach((c) => {
        c.sections?.forEach((s) => {
          list.push({
            id: s.id,
            name: s.name,
            classId: c.id,
            className: c.name,
            wingId: w.id,
            wingName: w.name,
          })
        })
      })
    })
    return list
  }, [wings])

  // Initialize setups and assignments when modal opens or initialSetups load
  useEffect(() => {
    if (!isOpen) return

    if (initialSetups.length > 0) {
      // Deep clone initial setups
      const cloned = initialSetups.map((s, idx) => ({
        id: s.id,
        name: s.name || `Setup ${idx + 1}`,
        description: s.description || "",
        is_default: Boolean(s.is_default),
        applicable_days: s.applicable_days || ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
        periods: (s.periods || []).map((p) => ({
          id: p.id,
          period_number: p.period_number,
          start_time: p.start_time,
          end_time: p.end_time,
          is_break: Boolean(p.is_break),
          label: p.label || (p.is_break ? "RECESS" : `Period ${p.period_number}`),
        })),
        saturdayPeriods: (s.schedules?.find((sch) => sch.days?.includes("SATURDAY"))?.periods || []).map((p) => ({
          id: p.id,
          period_number: p.period_number,
          start_time: p.start_time,
          end_time: p.end_time,
          is_break: Boolean(p.is_break),
          label: p.label || (p.is_break ? "RECESS" : `Period ${p.period_number}`),
        })),
      }))

      setSetups(cloned)

      // Initialize section assignments
      const map = {}
      const defaultSetupId = cloned.find((s) => s.is_default)?.id || cloned[0]?.id

      allSections.forEach((sec) => {
        // Find which setup contains this section ID
        const matched = initialSetups.find((st) => st.assigned_section_ids?.includes(sec.id))
        map[sec.id] = matched ? matched.id : defaultSetupId
      })
      setSectionAssignments(map)
    } else {
      // Default initial Setup 1
      const defaultSetupId = "temp-setup-1"
      const defaultPeriods = [
        { period_number: 1, start_time: "08:30", end_time: "09:15", is_break: false, label: "P1" },
        { period_number: 2, start_time: "09:15", end_time: "10:00", is_break: false, label: "P2" },
        { period_number: 3, start_time: "10:00", end_time: "10:45", is_break: false, label: "P3" },
        { period_number: 4, start_time: "10:45", end_time: "11:30", is_break: false, label: "P4" },
        { period_number: 5, start_time: "11:30", end_time: "11:45", is_break: true, label: "RECESS" },
        { period_number: 6, start_time: "11:45", end_time: "12:30", is_break: false, label: "P5" },
        { period_number: 7, start_time: "12:30", end_time: "13:15", is_break: false, label: "P6" },
        { period_number: 8, start_time: "13:15", end_time: "14:00", is_break: false, label: "P7" },
        { period_number: 9, start_time: "14:00", end_time: "14:45", is_break: false, label: "P8" },
      ]
      const defaultSatPeriods = [
        { period_number: 1, start_time: "08:30", end_time: "09:05", is_break: false, label: "P1" },
        { period_number: 2, start_time: "09:05", end_time: "09:40", is_break: false, label: "P2" },
        { period_number: 3, start_time: "09:40", end_time: "10:15", is_break: false, label: "P3" },
        { period_number: 4, start_time: "10:15", end_time: "10:50", is_break: false, label: "P4" },
        { period_number: 5, start_time: "10:50", end_time: "11:25", is_break: false, label: "P5" },
        { period_number: 6, start_time: "11:25", end_time: "12:00", is_break: false, label: "P6" },
        { period_number: 7, start_time: "12:00", end_time: "12:35", is_break: false, label: "P7" },
        { period_number: 8, start_time: "12:35", end_time: "13:10", is_break: false, label: "P8" },
      ]

      setSetups([
        {
          id: defaultSetupId,
          name: "Setup 1",
          description: "Main Regular Bell Schedule",
          is_default: true,
          applicable_days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"],
          periods: defaultPeriods,
          saturdayPeriods: defaultSatPeriods,
        },
      ])

      const map = {}
      allSections.forEach((sec) => {
        map[sec.id] = defaultSetupId
      })
      setSectionAssignments(map)
    }
  }, [isOpen, initialSetups, allSections])

  if (!isOpen) return null

  // ---------------------------------------------------------------------------
  // Setup Actions (Add, Duplicate, Delete)
  // ---------------------------------------------------------------------------

  const handleAddSetup = () => {
    const nextIndex = setups.length + 1
    const newId = `temp-setup-${Date.now()}`
    const basePeriods = setups[0]?.periods?.map((p) => ({ ...p, id: undefined })) || [
      { period_number: 1, start_time: "08:30", end_time: "09:15", is_break: false, label: "P1" },
      { period_number: 2, start_time: "09:15", end_time: "10:00", is_break: false, label: "P2" },
      { period_number: 3, start_time: "10:00", end_time: "10:45", is_break: false, label: "P3" },
      { period_number: 4, start_time: "10:45", end_time: "11:30", is_break: false, label: "P4" },
    ]

    setSetups([
      ...setups,
      {
        id: newId,
        name: `Setup ${nextIndex}`,
        description: `Alternative Bell Schedule ${nextIndex}`,
        is_default: false,
        applicable_days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
        periods: basePeriods,
        saturdayPeriods: setups[0]?.saturdayPeriods || [],
      },
    ])
  }

  const handleDuplicateSetup = (setupToDuplicate) => {
    const nextIndex = setups.length + 1
    const newId = `temp-setup-${Date.now()}`
    const duplicated = {
      ...setupToDuplicate,
      id: newId,
      name: `Copy of ${setupToDuplicate.name}`,
      is_default: false,
      periods: setupToDuplicate.periods.map((p) => ({ ...p, id: undefined })),
      saturdayPeriods: setupToDuplicate.saturdayPeriods?.map((p) => ({ ...p, id: undefined })) || [],
    }
    setSetups([...setups, duplicated])
  }

  const handleDeleteSetup = (setupIdToDelete) => {
    if (setups.length <= 1) {
      toast.error("You must have at least one bell setup.")
      return
    }

    const remainingSetups = setups.filter((s) => s.id !== setupIdToDelete)
    // Make sure one is default
    const fallbackSetupId = remainingSetups.find((s) => s.is_default)?.id || remainingSetups[0].id

    // Reassign sections from the deleted setup to the fallback setup
    const nextMap = { ...sectionAssignments }
    Object.keys(nextMap).forEach((secId) => {
      if (nextMap[secId] === setupIdToDelete) {
        nextMap[secId] = fallbackSetupId
      }
    })

    setSetups(remainingSetups)
    setSectionAssignments(nextMap)
  }

  // ---------------------------------------------------------------------------
  // Period Operations (Edit time, shift downstream, insert, delete, toggle break)
  // ---------------------------------------------------------------------------

  const handlePeriodChange = (setupIdx, periodIdx, field, value) => {
    const nextSetups = [...setups]
    const setup = { ...nextSetups[setupIdx] }
    const periods = [...setup.periods]
    const currentPeriod = { ...periods[periodIdx] }

    if (field === "start_time" || field === "end_time") {
      const oldStartMin = parseMinutes(currentPeriod.start_time)
      const oldEndMin = parseMinutes(currentPeriod.end_time)
      const oldDuration = oldEndMin - oldStartMin

      currentPeriod[field] = value

      if (field === "start_time" && autoShift) {
        // Keep duration constant by shifting end time
        const newStartMin = parseMinutes(value)
        const newEndMin = newStartMin + Math.max(15, oldDuration)
        currentPeriod.end_time = formatMinutes(newEndMin)

        // Shift subsequent periods
        let lastEndMin = newEndMin
        for (let i = periodIdx + 1; i < periods.length; i++) {
          const p = { ...periods[i] }
          const pDuration = parseMinutes(p.end_time) - parseMinutes(p.start_time)
          p.start_time = formatMinutes(lastEndMin)
          lastEndMin += Math.max(15, pDuration)
          p.end_time = formatMinutes(lastEndMin)
          periods[i] = p
        }
      } else if (field === "end_time" && autoShift) {
        // Shift subsequent periods start from this new end time
        let lastEndMin = parseMinutes(value)
        for (let i = periodIdx + 1; i < periods.length; i++) {
          const p = { ...periods[i] }
          const pDuration = parseMinutes(p.end_time) - parseMinutes(p.start_time)
          p.start_time = formatMinutes(lastEndMin)
          lastEndMin += Math.max(15, pDuration)
          p.end_time = formatMinutes(lastEndMin)
          periods[i] = p
        }
      }
    } else {
      currentPeriod[field] = value
    }

    periods[periodIdx] = currentPeriod
    setup.periods = periods
    nextSetups[setupIdx] = setup
    setSetups(nextSetups)
  }

  const handleInsertPeriod = (setupIdx, insertAfterIdx) => {
    const nextSetups = [...setups]
    const setup = { ...nextSetups[setupIdx] }
    const periods = [...setup.periods]

    const prevPeriod = periods[insertAfterIdx]
    const prevEndMin = parseMinutes(prevPeriod.end_time)
    const newStartMin = prevEndMin
    const newEndMin = prevEndMin + 45

    const newPeriod = {
      period_number: insertAfterIdx + 2,
      start_time: formatMinutes(newStartMin),
      end_time: formatMinutes(newEndMin),
      is_break: false,
      label: `P${insertAfterIdx + 2}`,
    }

    // Insert into array
    periods.splice(insertAfterIdx + 1, 0, newPeriod)

    // Re-index period numbers and auto-shift following
    let lastEnd = newEndMin
    for (let i = insertAfterIdx + 1; i < periods.length; i++) {
      const p = { ...periods[i] }
      p.period_number = i + 1
      if (i > insertAfterIdx + 1 && autoShift) {
        const dur = parseMinutes(p.end_time) - parseMinutes(p.start_time)
        p.start_time = formatMinutes(lastEnd)
        lastEnd += Math.max(15, dur)
        p.end_time = formatMinutes(lastEnd)
      } else {
        lastEnd = parseMinutes(p.end_time)
      }
      if (!p.is_break) {
        p.label = `P${p.period_number}`
      }
      periods[i] = p
    }

    setup.periods = periods
    nextSetups[setupIdx] = setup
    setSetups(nextSetups)
  }

  const handleDeletePeriod = (setupIdx, periodIdx) => {
    const nextSetups = [...setups]
    const setup = { ...nextSetups[setupIdx] }
    if (setup.periods.length <= 1) {
      toast.error("A setup must have at least one period.")
      return
    }

    const periods = setup.periods.filter((_, idx) => idx !== periodIdx)
    // Re-index period numbers
    const reindexed = periods.map((p, i) => ({
      ...p,
      period_number: i + 1,
      label: p.is_break ? p.label : `P${i + 1}`,
    }))

    setup.periods = reindexed
    nextSetups[setupIdx] = setup
    setSetups(nextSetups)
  }

  // ---------------------------------------------------------------------------
  // Applicability Tree Handling
  // ---------------------------------------------------------------------------

  const handleAssignSection = (secId, targetSetupId) => {
    setSectionAssignments((prev) => ({
      ...prev,
      [secId]: targetSetupId,
    }))
  }

  const handleAssignClass = (classId, targetSetupId) => {
    const targetClass = wings.flatMap((w) => w.classes || []).find((c) => c.id === classId)
    if (!targetClass) return

    setSectionAssignments((prev) => {
      const next = { ...prev }
      targetClass.sections?.forEach((s) => {
        next[s.id] = targetSetupId
      })
      return next
    })
  }

  const handleAssignWing = (wingId, targetSetupId) => {
    const targetWing = wings.find((w) => w.id === wingId)
    if (!targetWing) return

    setSectionAssignments((prev) => {
      const next = { ...prev }
      targetWing.classes?.forEach((c) => {
        c.sections?.forEach((s) => {
          next[s.id] = targetSetupId
        })
      })
      return next
    })
  }

  const handleAssignAllRemaining = (targetSetupId) => {
    setSectionAssignments((prev) => {
      const next = { ...prev }
      allSections.forEach((s) => {
        if (!next[s.id]) {
          next[s.id] = targetSetupId
        }
      })
      return next
    })
  }

  // Validation
  const validationErrors = useMemo(() => {
    const errors = []

    setups.forEach((s, sIdx) => {
      s.periods.forEach((p, pIdx) => {
        const startMin = parseMinutes(p.start_time)
        const endMin = parseMinutes(p.end_time)

        if (startMin >= endMin) {
          errors.push(`${s.name} ${p.label || `Period ${p.period_number}`}: Start time must be before end time.`)
        }

        // Check overlap with next period
        if (pIdx < s.periods.length - 1) {
          const nextP = s.periods[pIdx + 1]
          const nextStart = parseMinutes(nextP.start_time)
          if (endMin > nextStart) {
            errors.push(`${s.name} ${p.label} overlaps with ${nextP.label}.`)
          }
        }
      })
    })

    // Check orphaned sections
    const orphanedCount = allSections.filter((s) => !sectionAssignments[s.id]).length
    if (orphanedCount > 0) {
      errors.push(`${orphanedCount} section(s) do not have a bell setup assigned. Every section must have a setup.`)
    }

    return errors
  }, [setups, allSections, sectionAssignments])

  // ---------------------------------------------------------------------------
  // Save Flow with Impact Preview
  // ---------------------------------------------------------------------------

  const handleCheckAndSave = async () => {
    if (validationErrors.length > 0) {
      toast.error(validationErrors[0])
      return
    }

    // Build batch payload
    const assignmentsPayload = []
    Object.entries(sectionAssignments).forEach(([secId, setupId]) => {
      assignmentsPayload.push({
        setup_id: setupId,
        target_type: "SECTION",
        target_id: secId,
      })
    })

    const payload = {
      timetable_id: timetableId,
      setups: setups.map((s) => ({
        id: s.id.startsWith("temp-") ? null : s.id,
        name: s.name,
        description: s.description,
        is_default: s.is_default,
        applicable_days: s.applicable_days,
        periods: s.periods,
      })),
      assignments: assignmentsPayload,
    }

    // Check impact
    setIsCheckingImpact(true)
    try {
      const impact = await previewSetupsImpactApi(payload)
      if (impact.affected_slots_count > 0) {
        setImpactModalData({
          impact,
          payload,
        })
      } else {
        await executeSave(payload)
      }
    } catch (err) {
      // Fallback directly to save if preview unavailable
      await executeSave(payload)
    } finally {
      setIsCheckingImpact(false)
    }
  }

  const executeSave = async (payload) => {
    try {
      await batchSaveMutation.mutateAsync(payload)
      toast.success("Bell schedule setups and class applicability saved successfully.")
      if (onSaved) onSaved()
      onClose()
    } catch (err) {
      toast.error(err?.data?.detail || err?.message || "Failed to save bell setup.")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200"
        onClick={onClose}
      />

      {/* Main Large Modal Dialog */}
      <div
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-card border border-border shadow-2xl rounded-2xl z-10 animate-in zoom-in-95 duration-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bell-setup-title"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-muted/15 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Clock className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="bell-setup-title" className="text-base font-bold text-foreground">
                  Timetable Frame & Bell Schedule Setup
                </h2>
                <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5">
                  {setups.length} {setups.length === 1 ? "SETUP" : "SETUPS"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Define timing schedules, periods, and class applicability across your school wings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddSetup}
              className="h-8 px-3 text-xs font-semibold gap-1.5 shadow-2xs"
            >
              <Plus className="size-3.5 text-primary" />
              <span>Add Setup</span>
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Global Controls & Notices */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/80 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Info className="size-4 text-primary shrink-0" />
              <span>
                Each section is mapped to exactly one bell setup. Zero orphans allowed.
              </span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer font-medium select-none">
              <input
                type="checkbox"
                checked={autoShift}
                onChange={(e) => setAutoShift(e.target.checked)}
                className="size-4 rounded text-primary border-input focus:ring-primary"
              />
              <span className="text-xs text-foreground">Shift following periods when editing</span>
            </label>
          </div>

          {/* List of Setups */}
          {setups.map((setup, sIdx) => {
            const assignedCount = allSections.filter((s) => sectionAssignments[s.id] === setup.id).length
            const isOnlySetup = setups.length <= 1

            return (
              <div
                key={setup.id}
                className="rounded-2xl border border-border/90 bg-card shadow-xs overflow-hidden space-y-4 p-4 sm:p-5"
              >
                {/* Setup Card Header */}
                <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className="size-6 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
                      {sIdx + 1}
                    </span>
                    <Input
                      value={setup.name}
                      onChange={(e) => {
                        const next = [...setups]
                        next[sIdx].name = e.target.value
                        setSetups(next)
                      }}
                      className="h-8 w-44 font-bold text-xs"
                      placeholder="Setup Name"
                    />
                    <Badge variant="secondary" className="text-[11px] font-bold px-2 py-0.5">
                      {assignedCount} {assignedCount === 1 ? "Class" : "Classes"}
                    </Badge>
                  </div>

                  {/* Duplicate & Delete Actions */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicateSetup(setup)}
                      className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                    >
                      <Copy className="size-3.5" />
                      <span>Duplicate</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSetup(setup.id)}
                      disabled={isOnlySetup}
                      className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10 gap-1.5 disabled:opacity-40"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Delete</span>
                    </Button>
                  </div>
                </div>

                {/* 1. BELL TIMINGS & VISUAL TIMELINE TRACK */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">
                      <Clock className="size-3.5 text-primary" />
                      <span>Bell Timings Schedule</span>
                    </div>
                    {/* Day selector chips for this setup */}
                    <div className="flex items-center gap-1">
                      {ALL_DAYS.map((d) => {
                        const active = setup.applicable_days?.includes(d.id)
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              const days = setup.applicable_days || []
                              const nextDays = active
                                ? days.filter((x) => x !== d.id)
                                : [...days, d.id]
                              const next = [...setups]
                              next[sIdx].applicable_days = nextDays
                              setSetups(next)
                            }}
                            className={cn(
                              "px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer border",
                              active
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted"
                            )}
                          >
                            {d.short}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Visual Period Track Container */}
                  <div className="p-3 rounded-xl bg-muted/20 border border-border/70 overflow-x-auto [scrollbar-gutter:stable]">
                    <div className="flex items-center gap-1.5 min-w-max py-2">
                      {setup.periods.map((period, pIdx) => {
                        const duration = parseMinutes(period.end_time) - parseMinutes(period.start_time)
                        const isBreak = period.is_break

                        return (
                          <React.Fragment key={pIdx}>
                            {/* Period Box */}
                            <div
                              className={cn(
                                "relative flex flex-col justify-between p-2 rounded-xl border text-center transition-all min-w-[105px]",
                                isBreak
                                  ? "bg-amber-100/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200"
                                  : "bg-background border-border/90 shadow-2xs hover:border-primary/50"
                              )}
                            >
                              {/* Top Bar: Start Time & Delete */}
                              <div className="flex items-center justify-between gap-1 pb-1 border-b border-border/40">
                                <input
                                  type="time"
                                  value={period.start_time}
                                  onChange={(e) => handlePeriodChange(sIdx, pIdx, "start_time", e.target.value)}
                                  className="text-[11px] font-mono font-bold bg-transparent border-0 p-0 text-foreground cursor-pointer focus:ring-1 focus:ring-primary rounded-xs"
                                  title="Edit start time"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleDeletePeriod(sIdx, pIdx)}
                                  className="text-muted-foreground hover:text-destructive p-0.5 rounded-xs transition-colors cursor-pointer"
                                  title="Delete period"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>

                              {/* Center Label & Recess toggle */}
                              <div className="py-1.5 flex flex-col items-center justify-center">
                                <div className="flex items-center gap-1 font-bold text-xs">
                                  {isBreak && <Coffee className="size-3 text-amber-600 dark:text-amber-400" />}
                                  <input
                                    type="text"
                                    value={period.label || ""}
                                    onChange={(e) => handlePeriodChange(sIdx, pIdx, "label", e.target.value)}
                                    className="w-16 text-center text-xs font-bold bg-transparent border-0 p-0 text-foreground focus:ring-1 focus:ring-primary rounded-xs truncate"
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  {duration}m
                                </span>
                              </div>

                              {/* Bottom Bar: End Time & Break Toggle */}
                              <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40">
                                <input
                                  type="time"
                                  value={period.end_time}
                                  onChange={(e) => handlePeriodChange(sIdx, pIdx, "end_time", e.target.value)}
                                  className="text-[11px] font-mono font-bold bg-transparent border-0 p-0 text-foreground cursor-pointer focus:ring-1 focus:ring-primary rounded-xs"
                                  title="Edit end time"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextBreak = !isBreak
                                    const nextLabel = nextBreak ? "RECESS" : `P${period.period_number}`
                                    handlePeriodChange(sIdx, pIdx, "is_break", nextBreak)
                                    handlePeriodChange(sIdx, pIdx, "label", nextLabel)
                                  }}
                                  className={cn(
                                    "p-0.5 rounded-xs text-[10px] font-bold cursor-pointer transition-colors",
                                    isBreak ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground hover:text-foreground"
                                  )}
                                  title={isBreak ? "Convert to Teaching Period" : "Convert to Break / Recess"}
                                >
                                  <Coffee className="size-3" />
                                </button>
                              </div>
                            </div>

                            {/* + Affordance to Insert Period */}
                            <button
                              type="button"
                              onClick={() => handleInsertPeriod(sIdx, pIdx)}
                              className="size-5 rounded-full border border-dashed border-border/80 bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary text-muted-foreground flex items-center justify-center transition-all cursor-pointer shadow-2xs shrink-0"
                              title="Insert slot here"
                            >
                              <Plus className="size-3" />
                            </button>
                          </React.Fragment>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* 2. CLASS APPLICABILITY PICKER (Wing -> Class -> Section Tree) */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <Check className="size-3.5 text-emerald-500" />
                      <span>The above bell timings are applicable to these classes:</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAssignAllRemaining(setup.id)}
                      className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
                    >
                      Select all unassigned
                    </button>
                  </div>

                  {/* Wings Boxes Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
                    {wings.map((w) => {
                      const wingSecs = w.classes?.flatMap((c) => c.sections || []) || []
                      const assignedInThisWing = wingSecs.filter((s) => sectionAssignments[s.id] === setup.id)
                      const isAllWingAssigned = wingSecs.length > 0 && assignedInThisWing.length === wingSecs.length

                      return (
                        <div
                          key={w.id}
                          className="rounded-xl border border-border/80 bg-background p-2.5 space-y-2 text-xs flex flex-col justify-between"
                        >
                          {/* Wing Header with quick toggle */}
                          <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
                            <span className="font-bold text-foreground truncate">{w.name}</span>
                            <button
                              type="button"
                              onClick={() => handleAssignWing(w.id, setup.id)}
                              className={cn(
                                "size-5 rounded-md text-[10px] font-bold flex items-center justify-center transition-colors cursor-pointer",
                                isAllWingAssigned
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              )}
                              title="Assign entire wing"
                            >
                              {assignedInThisWing.length}
                            </button>
                          </div>

                          {/* Classes & Sections list */}
                          <div className="space-y-1.5 overflow-y-auto max-h-32 pr-0.5">
                            {w.classes?.map((c) => (
                              <div key={c.id} className="flex items-center justify-between gap-1 text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => handleAssignClass(c.id, setup.id)}
                                  className="text-left font-semibold text-muted-foreground hover:text-foreground truncate cursor-pointer"
                                  title="Click to toggle entire class"
                                >
                                  {c.name}:
                                </button>
                                <div className="flex items-center gap-1 shrink-0">
                                  {c.sections?.map((sec) => {
                                    const isAssigned = sectionAssignments[sec.id] === setup.id
                                    return (
                                      <button
                                        key={sec.id}
                                        type="button"
                                        onClick={() => handleAssignSection(sec.id, setup.id)}
                                        className={cn(
                                          "size-5 rounded-md text-[10px] font-bold flex items-center justify-center transition-all cursor-pointer border",
                                          isAssigned
                                            ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                                            : "bg-muted/30 text-muted-foreground/70 border-border/60 hover:bg-muted hover:text-foreground"
                                        )}
                                        title={`${c.name} ${sec.name}`}
                                      >
                                        {sec.name}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Validation Errors Notice */}
        {validationErrors.length > 0 && (
          <div className="mx-4 mb-2 p-2.5 rounded-xl bg-destructive/10 border border-destructive/25 text-destructive text-xs flex items-center gap-2 animate-in fade-in-0 duration-150">
            <AlertTriangle className="size-4 shrink-0 text-destructive" />
            <span className="font-medium text-[11px] leading-tight">{validationErrors[0]}</span>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/20 shrink-0">
          <div className="text-xs text-muted-foreground">
            <strong className="text-foreground font-bold">{allSections.length}</strong> sections total ·{" "}
            <strong className="text-foreground font-bold">{setups.length}</strong> {setups.length === 1 ? "setup" : "setups"} ·{" "}
            {allSections.filter((s) => !sectionAssignments[s.id]).length === 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">0 unassigned</span>
            ) : (
              <span className="text-destructive font-semibold">
                {allSections.filter((s) => !sectionAssignments[s.id]).length} unassigned
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-9 px-4 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCheckAndSave}
              disabled={batchSaveMutation.isPending || isCheckingImpact || validationErrors.length > 0}
              className="h-9 px-4 text-xs font-bold gap-1.5 bg-primary text-primary-foreground"
            >
              {(batchSaveMutation.isPending || isCheckingImpact) && (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              <Check className="size-4" />
              <span>Apply & Save Timetable Frame</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Impact Confirmation Dialog */}
      {impactModalData && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-xs"
            onClick={() => setImpactModalData(null)}
          />
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4 z-10 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  Confirm Schedule Timing Changes
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {impactModalData.impact.message}
                </p>
              </div>
            </div>

            {impactModalData.impact.affected_entries?.length > 0 && (
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border text-[11px] max-h-36 overflow-y-auto space-y-1">
                <div className="font-bold text-foreground">Affected scheduled slots:</div>
                {impactModalData.impact.affected_entries.slice(0, 10).map((e, idx) => (
                  <div key={idx} className="text-muted-foreground">
                    • {e.subject} on {e.day} Period {e.period_number}
                  </div>
                ))}
                {impactModalData.impact.affected_entries.length > 10 && (
                  <div className="text-muted-foreground italic">
                    ...and {impactModalData.impact.affected_entries.length - 10} more.
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImpactModalData(null)}
                className="h-8 text-xs"
              >
                Cancel & Review
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const p = impactModalData.payload
                  setImpactModalData(null)
                  executeSave(p)
                }}
                className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
              >
                Proceed & Apply Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

