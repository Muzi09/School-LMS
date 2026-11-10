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

export function useBulkAssignSlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => bulkAssignSlotApi(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timetableKeys.timetables() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.activeTimetable() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.all })
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
      queryClient.invalidateQueries({ queryKey: timetableKeys.grid(variables.section_id) })
      queryClient.invalidateQueries({ queryKey: timetableKeys.timetables() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.activeTimetable() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.all })
    },
  })
}

export function useUpdateTimetableEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ entryId, payload, sectionId }) => updateTimetableEntryApi(entryId, payload),
    onSuccess: (_, variables) => {
      if (variables?.sectionId) {
        queryClient.invalidateQueries({ queryKey: timetableKeys.grid(variables.sectionId) })
      }
      queryClient.invalidateQueries({ queryKey: timetableKeys.timetables() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.activeTimetable() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.all })
    },
  })
}

export function useDeleteTimetableEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ entryId, sectionId }) => deleteTimetableEntryApi(entryId),
    onSuccess: (_, variables) => {
      if (variables?.sectionId) {
        queryClient.invalidateQueries({ queryKey: timetableKeys.grid(variables.sectionId) })
      }
      queryClient.invalidateQueries({ queryKey: timetableKeys.timetables() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.activeTimetable() })
      queryClient.invalidateQueries({ queryKey: timetableKeys.all })
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
