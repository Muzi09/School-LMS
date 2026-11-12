import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getTimetableApi,
  createTimetableEntryApi,
  updateTimetableEntryApi,
  deleteTimetableEntryApi,
  getPeriodsApi,
  createPeriodApi,
  updatePeriodApi,
  deletePeriodApi,
  getEligibleTeachersApi,
  getSchoolClassesApi,
  getTeacherScheduleApi,
  getFreeTeachersApi,
  getMasterTimetableApi,
  getTimetableInsightsApi,
  // Redeveloped multi-timetable & setups
  listTimetablesApi,
  getActiveTimetableApi,
  createTimetableApi,
  updateTimetableApi,
  activateTimetableApi,
  duplicateTimetableApi,
  deleteTimetableApi,
  listSetupsApi,
  createSetupApi,
  updateSetupApi,
  duplicateSetupApi,
  deleteSetupApi,
  previewSetupsImpactApi,
  batchSaveSetupsApi,
  getClassWiseTimetableApi,
  checkConflictApi,
  bulkAssignSlotApi,
  exportTimetableExcelApi,
} from "@/api/timetableService"

export const timetableKeys = {
  all: ["timetable"],
  classes: () => ["school-classes"],
  periods: () => ["timetable-periods"],
  teachers: () => ["timetable-teachers"],
  grid: (sectionId) => ["timetable", "grid", sectionId],
  teacherSchedule: (teacherId) => ["timetable", "teacher", teacherId],
  freeTeachers: (day) => ["timetable", "free-teachers", day || "all"],
  master: () => ["timetable", "master"],
  insights: () => ["timetable", "insights"],

  // New keys
  timetables: () => ["timetable", "list"],
  activeTimetable: () => ["timetable", "active"],
  setups: (timetableId) => ["timetable", "setups", timetableId],
  classWise: (timetableId, wingId) => ["timetable", "class-wise", timetableId || "active", wingId || "all"],
}

/**
 * Fetch all configured classes with sections for the school.
 */
export function useSchoolClasses() {
  return useQuery({
    queryKey: timetableKeys.classes(),
    queryFn: getSchoolClassesApi,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Fetch school periods sorted by period_number.
 */
export function usePeriods() {
  return useQuery({
    queryKey: timetableKeys.periods(),
    queryFn: getPeriodsApi,
    staleTime: 60 * 1000,
  })
}

/**
 * Fetch eligible active teaching staff.
 */
export function useEligibleTeachers() {
  return useQuery({
    queryKey: timetableKeys.teachers(),
    queryFn: getEligibleTeachersApi,
    staleTime: 60 * 1000,
  })
}

/**
 * Fetch weekly timetable grid for a specific section.
 */
export function useTimetable(sectionId) {
  return useQuery({
    queryKey: timetableKeys.grid(sectionId),
    queryFn: () => getTimetableApi(sectionId),
    enabled: Boolean(sectionId),
  })
}

/**
 * Fetch weekly timetable schedule for a specific teacher.
 */
export function useTeacherSchedule(teacherId) {
  return useQuery({
    queryKey: timetableKeys.teacherSchedule(teacherId),
    queryFn: () => getTeacherScheduleApi(teacherId),
    enabled: Boolean(teacherId),
    staleTime: 30 * 1000,
  })
}

/**
 * Fetch free vs occupied teacher availability across intervals.
 */
export function useFreeTeachers(dayOfWeek = null) {
  return useQuery({
    queryKey: timetableKeys.freeTeachers(dayOfWeek),
    queryFn: () => getFreeTeachersApi(dayOfWeek),
    staleTime: 30 * 1000,
  })
}

/**
 * Fetch master timetable for all classes and sections.
 */
export function useMasterTimetable() {
  return useQuery({
    queryKey: timetableKeys.master(),
    queryFn: getMasterTimetableApi,
    staleTime: 30 * 1000,
  })
}

/**
 * Fetch timetable status & insights metrics.
 */
export function useTimetableInsights() {
  return useQuery({
    queryKey: timetableKeys.insights(),
    queryFn: getTimetableInsightsApi,
    staleTime: 30 * 1000,
  })
}

// =========================================================================
// Multi-Timetable Hooks
// =========================================================================

export function useTimetables() {
  return useQuery({
    queryKey: timetableKeys.timetables(),
    queryFn: listTimetablesApi,
    staleTime: 30 * 1000,
  })
}

export function useActiveTimetable() {
  return useQuery({
    queryKey: timetableKeys.activeTimetable(),
    queryFn: getActiveTimetableApi,
    staleTime: 30 * 1000,
  })
}

export function useCreateTimetable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => createTimetableApi(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timetableKeys.timetables() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.activeTimetable() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.all })
    },
  })
}

export function useUpdateTimetable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ timetableId, payload }) => updateTimetableApi(timetableId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timetableKeys.timetables() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.activeTimetable() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.all })
    },
  })
}

export function useActivateTimetable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (timetableId) => activateTimetableApi(timetableId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timetableKeys.timetables() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.activeTimetable() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.all })
    },
  })
}

export function useDuplicateTimetable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ timetableId, name }) => duplicateTimetableApi(timetableId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timetableKeys.timetables() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.all })
    },
  })
}

export function useDeleteTimetable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (timetableId) => deleteTimetableApi(timetableId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timetableKeys.timetables() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.activeTimetable() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.all })
    },
  })
}

// =========================================================================
// Setups & Bell Schedule Hooks
// =========================================================================

export function useSetups(timetableId) {
  return useQuery({
    queryKey: timetableKeys.setups(timetableId),
    queryFn: () => listSetupsApi(timetableId),
    enabled: Boolean(timetableId),
    staleTime: 30 * 1000,
  })
}

export function useBatchSaveSetups() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => batchSaveSetupsApi(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: timetableKeys.setups(variables.timetable_id) })
      queryClient.invalidateQueries({ queryKey: timetableKeys.all })
    },
  })
}

// =========================================================================
// Class-Wise Perspective Hooks
// =========================================================================

export function useClassWiseTimetable({ timetableId = null, wingId = null } = {}) {
  return useQuery({
    queryKey: timetableKeys.classWise(timetableId, wingId),
    queryFn: () => getClassWiseTimetableApi({ timetableId, wingId }),
    staleTime: 5 * 1000,
    refetchOnMount: "always",
  })
}

export function useCheckConflict() {
  return useMutation({
    mutationFn: (payload) => checkConflictApi(payload),
  })
}

// Helper for optimistic bulk assignment in class-wise timetable
function applyOptimisticBulkAssign(oldData, payload) {
  if (!oldData || !Array.isArray(oldData.entries)) return oldData

  const applyDays = new Set(
    (payload.apply_days && payload.apply_days.length > 0
      ? payload.apply_days
      : [payload.day_of_week]
    ).map((d) => String(d).toUpperCase())
  )

  const targetSectionIds = new Set()
  if (payload.scope === "CLASS_SECTIONS" && payload._section?.class_id) {
    for (const w of oldData.wings || []) {
      for (const c of w.classes || []) {
        if (String(c.id) === String(payload._section.class_id)) {
          for (const s of c.sections || []) {
            targetSectionIds.add(String(s.id))
          }
        }
      }
    }
  }
  if (targetSectionIds.size === 0 && payload.section_id) {
    targetSectionIds.add(String(payload.section_id))
  }

  const isUnassign = !payload.subject_id

  // 1. Filter out existing entries that match (section_id, day, period_id)
  const updatedEntries = oldData.entries.filter((e) => {
    const isTargetSection = targetSectionIds.has(String(e.section_id))
    const isTargetDay = applyDays.has(String(e.day_of_week).toUpperCase())
    const isTargetPeriod = String(e.period_id) === String(payload.period_id)
    return !(isTargetSection && isTargetDay && isTargetPeriod)
  })

  // 2. If assigning, append optimistic entries
  if (!isUnassign) {
    for (const secId of targetSectionIds) {
      for (const day of applyDays) {
        updatedEntries.push({
          id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          school_id: oldData.timetable?.school_id,
          timetable_id: payload.timetable_id,
          section_id: secId,
          period_id: payload.period_id,
          period_number: payload._optimisticPeriod?.period_number || 0,
          day_of_week: day,
          subject_id: payload.subject_id,
          teacher_user_id: payload.teacher_user_id || payload._optimisticTeacher?.id || null,
          subject: payload._optimisticSubject || null,
          teacher: payload._optimisticTeacher || null,
          period: payload._optimisticPeriod || null,
        })
      }
    }
  }

  // 3. Recalculate section assigned_slots, unassigned_slots & subject_stats in wings
  const updatedWings = (oldData.wings || []).map((wing) => ({
    ...wing,
    classes: (wing.classes || []).map((cls) => ({
      ...cls,
      sections: (cls.sections || []).map((sec) => {
        if (!targetSectionIds.has(String(sec.id))) return sec

        const secEntries = updatedEntries.filter((e) => String(e.section_id) === String(sec.id))
        const assignedSlots = secEntries.length
        const totalSlots = sec.total_slots || 30
        const unassignedSlots = Math.max(0, totalSlots - assignedSlots)

        const subCounts = new Map()
        for (const e of secEntries) {
          if (e.subject_id) {
            subCounts.set(String(e.subject_id), (subCounts.get(String(e.subject_id)) || 0) + 1)
          }
        }

        const updatedSubjectStats = (sec.subject_stats || []).map((stat) => {
          const cnt = subCounts.get(String(stat.subject_id)) || 0
          const target = stat.target || (stat.is_academic ? 6 : 3)
          return {
            ...stat,
            assigned: cnt,
            status: cnt === target ? "normal" : cnt < target ? "under" : "over",
          }
        })

        return {
          ...sec,
          assigned_slots: assignedSlots,
          unassigned_slots: unassignedSlots,
          subject_stats: updatedSubjectStats,
        }
      }),
    })),
  }))

  return {
    ...oldData,
    entries: updatedEntries,
    wings: updatedWings,
  }
}

// Helper for optimistic delete in class-wise timetable
function applyOptimisticDelete(oldData, { entryId, sectionId }) {
  if (!oldData || !Array.isArray(oldData.entries)) return oldData

  const deletedEntry = oldData.entries.find((e) => String(e.id) === String(entryId))
  const secId = sectionId || deletedEntry?.section_id
  const updatedEntries = oldData.entries.filter((e) => String(e.id) !== String(entryId))

  if (!secId) {
    return { ...oldData, entries: updatedEntries }
  }

  const updatedWings = (oldData.wings || []).map((wing) => ({
    ...wing,
    classes: (wing.classes || []).map((cls) => ({
      ...cls,
      sections: (cls.sections || []).map((sec) => {
        if (String(sec.id) !== String(secId)) return sec

        const secEntries = updatedEntries.filter((e) => String(e.section_id) === String(sec.id))
        const assignedSlots = secEntries.length
        const totalSlots = sec.total_slots || 30
        const unassignedSlots = Math.max(0, totalSlots - assignedSlots)

        const subCounts = new Map()
        for (const e of secEntries) {
          if (e.subject_id) {
            subCounts.set(String(e.subject_id), (subCounts.get(String(e.subject_id)) || 0) + 1)
          }
        }

        const updatedSubjectStats = (sec.subject_stats || []).map((stat) => {
          const cnt = subCounts.get(String(stat.subject_id)) || 0
          const target = stat.target || (stat.is_academic ? 6 : 3)
          return {
            ...stat,
            assigned: cnt,
            status: cnt === target ? "normal" : cnt < target ? "under" : "over",
          }
        })

        return {
          ...sec,
          assigned_slots: assignedSlots,
          unassigned_slots: unassignedSlots,
          subject_stats: updatedSubjectStats,
        }
      }),
    })),
  }))

  return {
    ...oldData,
    entries: updatedEntries,
    wings: updatedWings,
  }
}

export function useBulkAssignSlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => bulkAssignSlotApi(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["timetable", "class-wise"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["timetable", "class-wise"] })

      queryClient.setQueriesData({ queryKey: ["timetable", "class-wise"] }, (oldData) =>
        applyOptimisticBulkAssign(oldData, payload)
      )

      return { previousData }
    },
    onError: (err, payload, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([key, data]) => {
          queryClient.setQueryData(key, data)
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timetableKeys.timetables(), refetchType: "none" })
      queryClient.invalidateQueries({ queryKey: timetableKeys.activeTimetable(), refetchType: "none" })
      queryClient.invalidateQueries({ queryKey: timetableKeys.insights(), refetchType: "none" })
      queryClient.invalidateQueries({ queryKey: timetableKeys.all, refetchType: "none" })
    },
  })
}

// =========================================================================
// Slot Mutations
// =========================================================================

export function useCreateTimetableEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload) => createTimetableEntryApi(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: timetableKeys.grid(variables.section_id), refetchType: "none" })
      queryClient.invalidateQueries({ queryKey: timetableKeys.timetables(), refetchType: "none" })
      queryClient.invalidateQueries({ queryKey: timetableKeys.activeTimetable(), refetchType: "none" })
      queryClient.invalidateQueries({ queryKey: timetableKeys.all, refetchType: "none" })
    },
  })
}

export function useUpdateTimetableEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ entryId, payload, sectionId }) => updateTimetableEntryApi(entryId, payload),
    onSuccess: (_, variables) => {
      if (variables?.sectionId) {
        queryClient.invalidateQueries({ queryKey: timetableKeys.grid(variables.sectionId), refetchType: "none" })
      }
      queryClient.invalidateQueries({ queryKey: timetableKeys.timetables(), refetchType: "none" })
      queryClient.invalidateQueries({ queryKey: timetableKeys.activeTimetable(), refetchType: "none" })
      queryClient.invalidateQueries({ queryKey: timetableKeys.all, refetchType: "none" })
    },
  })
}

export function useDeleteTimetableEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ entryId, sectionId }) => deleteTimetableEntryApi(entryId),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["timetable", "class-wise"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["timetable", "class-wise"] })

      queryClient.setQueriesData({ queryKey: ["timetable", "class-wise"] }, (oldData) =>
        applyOptimisticDelete(oldData, variables)
      )

      return { previousData }
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([key, data]) => {
          queryClient.setQueryData(key, data)
        })
      }
    },
    onSuccess: (_, variables) => {
      if (variables?.sectionId) {
        queryClient.invalidateQueries({ queryKey: timetableKeys.grid(variables.sectionId), refetchType: "none" })
      }
      queryClient.invalidateQueries({ queryKey: timetableKeys.timetables(), refetchType: "none" })
      queryClient.invalidateQueries({ queryKey: timetableKeys.activeTimetable(), refetchType: "none" })
      queryClient.invalidateQueries({ queryKey: timetableKeys.insights(), refetchType: "none" })
      queryClient.invalidateQueries({ queryKey: timetableKeys.all, refetchType: "none" })
    },
  })
}

export function useCreatePeriod() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload) => createPeriodApi(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timetableKeys.periods() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.all })
    },
  })
}

export function useUpdatePeriod() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ periodId, payload }) => updatePeriodApi(periodId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timetableKeys.periods() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.all })
    },
  })
}

export function useDeletePeriod() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (periodId) => deletePeriodApi(periodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timetableKeys.periods() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.all })
    },
  })
}

export function useExportTimetableExcel() {
  return useMutation({
    mutationFn: ({ timetableId, payload }) => exportTimetableExcelApi({ timetableId, payload }),
  })
}

