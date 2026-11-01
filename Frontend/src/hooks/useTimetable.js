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

/**
 * Create timetable entry mutation with automatic grid and insights cache invalidation.
 */
export function useCreateTimetableEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload) => createTimetableEntryApi(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: timetableKeys.grid(variables.section_id) })
      queryClient.invalidateQueries({ queryKey: timetableKeys.all })
    },
  })
}

/**
 * Update timetable entry mutation.
 */
export function useUpdateTimetableEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ entryId, payload, sectionId }) => updateTimetableEntryApi(entryId, payload),
    onSuccess: (_, variables) => {
      if (variables.sectionId) {
        queryClient.invalidateQueries({ queryKey: timetableKeys.grid(variables.sectionId) })
      }
      queryClient.invalidateQueries({ queryKey: timetableKeys.all })
    },
  })
}

/**
 * Delete timetable entry mutation.
 */
export function useDeleteTimetableEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ entryId, sectionId }) => deleteTimetableEntryApi(entryId),
    onSuccess: (_, variables) => {
      if (variables.sectionId) {
        queryClient.invalidateQueries({ queryKey: timetableKeys.grid(variables.sectionId) })
      }
      queryClient.invalidateQueries({ queryKey: timetableKeys.all })
    },
  })
}

/**
 * Period Mutations: Create, Update, Delete.
 * Invalidates periods and all timetable queries.
 */
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
