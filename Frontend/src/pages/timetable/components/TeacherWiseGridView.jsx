import { useState, useMemo, useCallback, useRef, useEffect, Fragment } from "react"
import {
  User,
  GraduationCap,
} from "lucide-react"
import { getSubjectTheme } from "../subjectTheme"
import { getShortSubjectName, buildRowGroups } from "../subjectShortName"
import { cn } from "@/lib/utils"
import { teacherWeek } from "../sectionSchedule"
import { TeacherSchedule } from "./TeacherSchedule"
import { TeacherSlotAssignmentDialog } from "./TeacherSlotAssignmentDialog"
import { TimetableTooltip } from "./TimetableTooltip"
import { useBulkAssignSlot, useDeleteTimetableEntry } from "@/hooks/useTimetable"
import { toast } from "sonner"

export function TeacherWiseGridView({
  timetableData,
  isLoading = false,
  isError = false,
  searchQuery = "",
  selectedWingId = "ALL",
  zoom = 100,
  density = "comfortable",
  isAssignMode = false,
  onAssignBarPropsChange,
  onRetry,
}) {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    cellData: null,
  })

  const bulkAssignMutation = useBulkAssignSlot()
  const deleteEntryMutation = useDeleteTimetableEntry()
  const inFlightSlotMutationsRef = useRef(new Map())

  const makeSlotMutationKey = useCallback((secId, day, periodId) => {
    return `${secId || ""}_${String(day || "").toUpperCase()}_${periodId || ""}`
  }, [])

  if (!isAssignMode && dialogState.isOpen) {
    setDialogState({ isOpen: false, cellData: null })
  }

  const {
    timetable,
    wings = [],
    setups = [],
    entries = [],
    eligible_teachers = [],
  } = timetableData || {}

  const allFlattenedSections = useMemo(() => {
    const list = []
    for (const w of wings || []) {
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
  }, [wings])

  // Section Map & Section-Subject-to-Teacher Fallback Map
  const { sectionMap, secSubToTeacherMap } = useMemo(() => {
    const sMap = new Map()
    const tMap = new Map()
    for (const sec of allFlattenedSections) {
      sMap.set(String(sec.id), sec)
      for (const stat of sec.subject_stats || []) {
        const tId = stat.teacher_id || stat.teacher?.id
        if (tId) {
          const subId = stat.subject_id || stat.id
          tMap.set(`${sec.id}_${subId}`, String(tId))
        }
      }
    }
    return { sectionMap: sMap, secSubToTeacherMap: tMap }
  }, [allFlattenedSections])

  // Map teacher subject allocations derived from Manage School (sections' subject_stats)
  const teacherAllocationsMap = useMemo(() => {
    const map = new Map() // teacherId -> Array of allocation objects

    for (const t of eligible_teachers) {
      map.set(String(t.id), [])
    }

    // 1. Sourced directly from Manage School (ClassSubject allocations linked in section.subject_stats)
    for (const sec of allFlattenedSections) {
      for (const stat of sec.subject_stats || []) {
        const tId = stat.teacher_id || stat.teacher?.id
        if (tId) {
          const tKey = String(tId)
          if (!map.has(tKey)) map.set(tKey, [])
          const list = map.get(tKey)

          // Avoid duplicate (section_id, subject_id) pairs
          const subId = stat.subject_id || stat.id
          if (!list.some((item) => String(item.section?.id) === String(sec.id) && String(item.subject_id) === String(subId))) {
            list.push({
              section: sec,
              subject_id: subId,
              subject_name: stat.name,
              subject_code: stat.code,
              category: stat.category || (stat.is_academic ? "academic" : "non_academic"),
              is_academic: stat.is_academic !== undefined ? stat.is_academic : true,
              assigned: stat.assigned || 0,
              target: stat.target || (stat.is_academic ? 6 : 3),
            })
          }
        }
      }
    }

    // 2. Also incorporate any existing entries where teacher is assigned to a section & subject
    for (const e of entries) {
      const entryTid = String(e.teacher_user_id || e.teacher_id || e.teacher?.id || secSubToTeacherMap.get(`${e.section_id}_${e.subject_id || e.subject?.id}`) || "")
      if (entryTid && e.section && e.subject) {
        const tKey = entryTid
        if (!map.has(tKey)) map.set(tKey, [])
        const list = map.get(tKey)
        const subId = e.subject.id
        const secId = e.section.id

        if (!list.some((item) => String(item.section?.id) === String(secId) && String(item.subject_id) === String(subId))) {
          const secMatch = allFlattenedSections.find((s) => String(s.id) === String(secId)) || {
            ...e.section,
            class_name: e.section.school_class?.name || "Class",
          }
          list.push({
            section: secMatch,
            subject_id: subId,
            subject_name: e.subject.name,
            subject_code: e.subject.code,
            category: e.subject.category || (e.subject.is_academic ? "academic" : "non_academic"),
            is_academic: e.subject.is_academic !== undefined ? e.subject.is_academic : true,
            assigned: 1,
            target: e.subject.is_academic ? 6 : 3,
          })
        }
      }
    }

    return map
  }, [eligible_teachers, allFlattenedSections, entries, secSubToTeacherMap])

  const { weeks, conflictsCount } = useMemo(() => {
    const byTeacher = new Map()
    for (const e of entries) {
      const id = String(e.teacher_user_id || e.teacher_id || e.teacher?.id ||
        secSubToTeacherMap.get(e.section_id + "_" + (e.subject_id || e.subject?.id)) || "")
      if (!id) continue
      if (!byTeacher.has(id)) byTeacher.set(id, [])
      byTeacher.get(id).push({ ...e, section: sectionMap.get(String(e.section_id)) || e.section })
    }
    const weeks = new Map()
    let conflictsCount = 0
    for (const t of eligible_teachers) {
      const id = String(t.id)
      const week = teacherWeek(teacherAllocationsMap.get(id) || [], byTeacher.get(id) || [], setups)
      weeks.set(id, week)
      conflictsCount += week.conflicts.size + week.review.length
    }
    return { weeks, conflictsCount }
  }, [entries, setups, eligible_teachers, teacherAllocationsMap, sectionMap, secSubToTeacherMap])

  // Report assign bar metrics to parent Timetable header
  useEffect(() => {
    if (onAssignBarPropsChange) {
      onAssignBarPropsChange({
        conflictsCount,
        hasConflicts: conflictsCount > 0,
      })
    }
  }, [conflictsCount, onAssignBarPropsChange])

  // Filter teachers by search query
  const filteredTeachers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return eligible_teachers.filter((t) => {
      if (selectedWingId !== "ALL" && !(teacherAllocationsMap.get(String(t.id)) || []).some(a => a.section?.wing_id === selectedWingId)) return false
      const name = `${t.first_name || ""} ${t.last_name || ""}`.toLowerCase()
      const dept = (t.department || t.designation || "").toLowerCase()
      const subj = (t.primary_subject || "").toLowerCase()
      return name.includes(q) || dept.includes(q) || subj.includes(q)
    })
  }, [eligible_teachers, searchQuery, selectedWingId, teacherAllocationsMap])

  // Slot assignment handler
  const handleAssignSlot = useCallback(
    async (payload) => {
      if (!timetable?.id || !dialogState.cellData) return
      const cell = dialogState.cellData

      const requestPayload = {
        timetable_id: timetable.id,
        section_id: payload.section_id,
        teacher_user_id: payload.teacher_user_id,
        period_id: payload.period.id,
        day_of_week: cell.day,
        subject_id: payload.subject_id,
        scope: payload.scope || "SLOT",
        apply_days: payload.apply_days || [cell.day],
        overwrite: true,
        _section: payload.section,
        _optimisticSubject: payload.subject,
        _optimisticTeacher: payload.teacher,
        _optimisticPeriod: payload.period,
      }

      setDialogState({ isOpen: false, cellData: null })

      const slotKey = makeSlotMutationKey(payload.section_id, cell.day, payload.period.id)
      const previousPromise = inFlightSlotMutationsRef.current.get(slotKey) || Promise.resolve()

      const mutationPromise = previousPromise
        .catch(() => {})
        .then(() => bulkAssignMutation.mutateAsync(requestPayload))
        .finally(() => {
          if (inFlightSlotMutationsRef.current.get(slotKey) === mutationPromise) {
            inFlightSlotMutationsRef.current.delete(slotKey)
          }
        })

      inFlightSlotMutationsRef.current.set(slotKey, mutationPromise)

      try {
        await mutationPromise
        toast.success("Timetable slot assigned successfully")
      } catch (err) {
        toast.error("Failed to assign slot: " + (err.message || "Unknown error"))
      }
    },
    [timetable, dialogState.cellData, bulkAssignMutation, makeSlotMutationKey]
  )

  // Slot unassign handler
  const handleUnassignSlot = useCallback(
    async (entryId, sectionIdOpt, slotContext) => {
      const entryToDelete =
        entries.find((e) => String(e.id) === String(entryId)) ||
        (String(dialogState.cellData?.currentEntry?.id) === String(entryId)
          ? dialogState.cellData.currentEntry
          : null)

      const secId =
        entryToDelete?.section_id ||
        sectionIdOpt ||
        dialogState.cellData?.currentEntry?.section_id ||
        null

      const targetDay =
        slotContext?.day ||
        entryToDelete?.day_of_week ||
        dialogState.cellData?.day

      const targetPeriodId =
        slotContext?.period?.id ||
        slotContext?.periodId ||
        entryToDelete?.period_id ||
        dialogState.cellData?.period?.id

      setDialogState({ isOpen: false, cellData: null })

      const slotKey = makeSlotMutationKey(secId, targetDay, targetPeriodId)
      const previousPromise = inFlightSlotMutationsRef.current.get(slotKey) || Promise.resolve()

      const unassignPromise = previousPromise
        .catch(() => {})
        .then(async () => {
          if (entryId && !String(entryId).startsWith("opt_")) {
            return deleteEntryMutation.mutateAsync({ entryId, sectionId: secId })
          }
          if (timetable?.id && secId && targetDay && targetPeriodId) {
            return bulkAssignMutation.mutateAsync({
              timetable_id: timetable.id, section_id: secId, day_of_week: targetDay,
              period_id: targetPeriodId, subject_id: null, scope: "SLOT",
            })
          }
        })
        .finally(() => {
          if (inFlightSlotMutationsRef.current.get(slotKey) === unassignPromise) {
            inFlightSlotMutationsRef.current.delete(slotKey)
          }
        })

      inFlightSlotMutationsRef.current.set(slotKey, unassignPromise)

      try {
        await unassignPromise
        toast.success("Slot unassigned")
      } catch (err) {
        toast.error("Failed to unassign slot: " + (err.message || "Unknown error"))
      }
    },
    [timetable, entries, dialogState.cellData, bulkAssignMutation, deleteEntryMutation, makeSlotMutationKey]
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 rounded-2xl bg-muted/40 animate-pulse border border-border/60" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-sm font-semibold text-destructive">Failed to load teacher schedules.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-primary font-bold hover:underline"
          >
            Retry Loading
          </button>
        )}
      </div>
    )
  }

  if (filteredTeachers.length === 0) {
    return (
      <div className="py-16 text-center space-y-3 border border-dashed rounded-2xl bg-muted/20">
        <User className="size-8 mx-auto text-muted-foreground opacity-60" />
        <p className="text-sm font-semibold text-foreground">No faculty members found</p>
        <p className="text-xs text-muted-foreground">
          {searchQuery ? "Try refining your search terms." : "No active staff members are enrolled in the school."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      {filteredTeachers.map((teacher) => {
        const tId = String(teacher.id)
        const tName = `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim() || teacher.email
        const dept = teacher.tag || teacher.designation || teacher.department || "Teacher"
        const week = weeks.get(tId)
        const assignedCount = week.count
        const initials = `${teacher.first_name?.[0] || ""}${teacher.last_name?.[0] || ""}`.toUpperCase() || "T"

        // Teacher's subject allocations from Manage School
        const rawAllocations = teacherAllocationsMap.get(tId) || []

        // Compute current assigned counts per allocated subject + section
        const subjectStatsList = rawAllocations.map((alloc) => {
          const secId = String(alloc.section?.id)
          const subId = String(alloc.subject_id)
          // Count periods taught by this teacher in this section for this subject
          let currentAssigned = 0
          for (const e of entries) {
            const entryTid = String(
              e.teacher_user_id ||
              e.teacher_id ||
              e.teacher?.id ||
              secSubToTeacherMap.get(`${e.section_id}_${e.subject_id || e.subject?.id}`) ||
              ""
            )
            if (
              entryTid === tId &&
              String(e.section_id) === secId &&
              String(e.subject_id || e.subject?.id) === subId &&
              !e.period?.is_break
            ) {
              currentAssigned += 1
            }
          }

          const clsName = alloc.section?.school_class?.name || alloc.section?.class_name || "Class"
          const secName = alloc.section?.name || ""
          const classSecLabel = `${clsName} ${secName}`.trim()

          return {
            ...alloc,
            assigned: currentAssigned,
            class_section_label: classSecLabel,
          }
        })

        // Class Teacher resolution
        const ctSections = (teacher.class_teacher_of && teacher.class_teacher_of.length > 0)
          ? teacher.class_teacher_of
          : allFlattenedSections.filter((s) => String(s.class_teacher_id) === String(teacher.id))
        const isClassTeacher = ctSections.length > 0
        const ctLabel = ctSections
          .map((s) => s.label || `${s.class_name || ""} ${s.name || ""}`.trim())
          .join(", ")

        // 2-Row Micro-Tokens distribution with "Acad :" and "Non Acad :" headers
        const { row1Groups, row2Groups } = buildRowGroups(subjectStatsList || [])

        return (
          <div
            key={teacher.id}
            id={`teacher-card-${teacher.id}`}
            className="bg-card text-card-foreground rounded-2xl border border-primary/25 shadow-xs overflow-hidden transition-all hover:shadow-sm"
          >
            {/* TEACHER CARD HEADER: Compact 3-Zone x 2-Line Architecture (~48px height) */}
            <div className="flex items-center justify-between gap-3 px-4 py-2 bg-muted/20 border-b border-border/60 min-h-[48px] max-h-[52px]">
              {/* Left: Avatar & Teacher Name & Designation */}
              <div className="flex items-center gap-2.5 min-w-[170px] max-w-[260px] shrink-0">
                <div className="size-8 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                  {initials}
                </div>
                <div className="flex flex-col justify-center min-w-0 leading-tight gap-0.5">
                  {/* Line 1: Teacher Name */}
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-sm sm:text-base font-bold text-foreground tracking-tight truncate">
                      {tName}
                    </span>
                  </div>

                  {/* Line 2: Class Teacher Info (Compact CT: <ctLabel>, tooltip gives full Class Teacher) */}
                  <div
                    className="flex items-center gap-1 text-[11px] truncate font-medium cursor-default"
                    title={
                      isClassTeacher
                        ? `Class Teacher: ${ctLabel}${dept ? ` • ${dept}` : ""}`
                        : (dept || teacher.designation || "Faculty")
                    }
                  >
                    {isClassTeacher ? (
                      <>
                        <GraduationCap className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-emerald-700 dark:text-emerald-300 font-medium truncate">
                          <span className="font-semibold">CT:</span> {ctLabel}
                        </span>
                        {dept && (
                          <>
                            <span className="text-muted-foreground/40 font-normal">•</span>
                            <span className="text-muted-foreground truncate">{dept}</span>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground truncate">
                        {dept || teacher.designation || "Faculty"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Center Zone: 2-Row Micro-Tokens Matrix (Acad : and Non Acad : headers, subtle subject names) */}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1 px-3 border-x border-border/50 overflow-x-auto scrollbar-none">
                {/* Row 1 */}
                <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-none">
                  {row1Groups.map((group, gIdx) => (
                    <Fragment key={`t-r1-group-${gIdx}`}>
                      {gIdx > 0 && (
                        <span className="text-border/80 select-none text-xs font-light px-0.5">
                          │
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider shrink-0 select-none pr-0.5">
                        {group.label}
                      </span>
                      {group.items.map((item, idx) => {
                        const theme = getSubjectTheme(item.subject_name)
                        const shortName = getShortSubjectName(item.subject_name, item.subject_code)

                        const isOver = item.assigned > item.target
                        const isMet = item.assigned === item.target

                        return (
                          <span
                            key={`t-r1-${item.section?.id}_${item.subject_id || idx}`}
                            className="inline-flex items-center gap-1 text-[11px] leading-none whitespace-nowrap shrink-0 select-none"
                          >
                            {group.isAcademic ? (
                              <span
                                className={cn(
                                  "size-1.5 rounded-full shrink-0",
                                  isOver ? "bg-amber-500" : isMet ? "bg-emerald-500" : theme.dot
                                )}
                              />
                            ) : (
                              <span
                                className={cn(
                                  "text-[9px] leading-none shrink-0 font-bold",
                                  isOver
                                    ? "text-amber-500"
                                    : isMet
                                    ? "text-emerald-500"
                                    : "text-amber-600/90 dark:text-amber-400/90"
                                )}
                              >
                                ✦
                              </span>
                            )}
                            <span
                              className={cn(
                                "font-normal text-muted-foreground/90 hover:text-foreground/90 transition-colors",
                                isOver && "text-amber-700 dark:text-amber-300 font-medium"
                              )}
                            >
                              {shortName}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60 font-normal">
                              ({item.class_section_label})
                            </span>
                            <span
                              className={cn(
                                "text-[10px] font-mono text-muted-foreground/75",
                                isOver && "font-semibold text-amber-700 dark:text-amber-300"
                              )}
                            >
                              {item.assigned || 0}/{item.target || 0}
                            </span>
                          </span>
                        )
                      })}
                    </Fragment>
                  ))}
                </div>

                {/* Row 2 */}
                <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-none">
                  {row2Groups.map((group, gIdx) => (
                    <Fragment key={`t-r2-group-${gIdx}`}>
                      {gIdx > 0 && (
                        <span className="text-border/80 select-none text-xs font-light px-0.5">
                          │
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider shrink-0 select-none pr-0.5">
                        {group.label}
                      </span>
                      {group.items.map((item, idx) => {
                        const theme = getSubjectTheme(item.subject_name)
                        const shortName = getShortSubjectName(item.subject_name, item.subject_code)

                        const isOver = item.assigned > item.target
                        const isMet = item.assigned === item.target

                        return (
                          <span
                            key={`t-r2-${item.section?.id}_${item.subject_id || idx}`}
                            className="inline-flex items-center gap-1 text-[11px] leading-none whitespace-nowrap shrink-0 select-none"
                          >
                            {group.isAcademic ? (
                              <span
                                className={cn(
                                  "size-1.5 rounded-full shrink-0",
                                  isOver ? "bg-amber-500" : isMet ? "bg-emerald-500" : theme.dot
                                )}
                              />
                            ) : (
                              <span
                                className={cn(
                                  "text-[9px] leading-none shrink-0 font-bold",
                                  isOver
                                    ? "text-amber-500"
                                    : isMet
                                    ? "text-emerald-500"
                                    : "text-amber-600/90 dark:text-amber-400/90"
                                )}
                              >
                                ✦
                              </span>
                            )}
                            <span
                              className={cn(
                                "font-normal text-muted-foreground/90 hover:text-foreground/90 transition-colors",
                                isOver && "text-amber-700 dark:text-amber-300 font-medium"
                              )}
                            >
                              {shortName}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60 font-normal">
                              ({item.class_section_label})
                            </span>
                            <span
                              className={cn(
                                "text-[10px] font-mono text-muted-foreground/75",
                                isOver && "font-semibold text-amber-700 dark:text-amber-300"
                              )}
                            >
                              {item.assigned || 0}/{item.target || 0}
                            </span>
                          </span>
                        )
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>

              <div className="text-right text-xs text-muted-foreground">
                <strong>{assignedCount} lessons</strong><div>{week.minutes} teaching minutes</div>
              </div>
            </div>
            <TeacherSchedule week={week} teacher={teacher} density={density} zoom={zoom} edit={isAssignMode}
              open={(day, period, currentEntry) => setDialogState({ isOpen: true, cellData: { teacher, day, period, currentEntry } })}
              remove={handleUnassignSlot} />
          </div>
        )
      })}

      {/* TEACHER SLOT ASSIGNMENT DIALOG */}
      {dialogState.isOpen && (
        <TeacherSlotAssignmentDialog
          isOpen={dialogState.isOpen}
          onClose={() => setDialogState({ isOpen: false, cellData: null })}
          cellData={dialogState.cellData}
          teacherAllocations={
            dialogState.cellData?.teacher?.id
              ? (teacherAllocationsMap.get(String(dialogState.cellData.teacher.id)) || []).filter(a => !dialogState.cellData.currentEntry || String(a.section.id) === String(dialogState.cellData.currentEntry.section_id))
              : []
          }
          setups={setups}
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
