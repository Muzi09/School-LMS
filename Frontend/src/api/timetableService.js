import apiClient from "./client"

/**
 * Timetable API Service
 * Handles multi-timetable management, bell schedule setups, class-wise aggregated data,
 * conflict detection, and slot assignment.
 */

// Core section grid & entry APIs
export const getTimetableApi = async (sectionId) => {
  return await apiClient.get(`/timetable?section_id=${sectionId}`)
}

export const createTimetableEntryApi = async (payload) => {
  return await apiClient.post("/timetable", payload)
}

export const updateTimetableEntryApi = async (entryId, payload) => {
  return await apiClient.put(`/timetable/${entryId}`, payload)
}

export const deleteTimetableEntryApi = async (entryId) => {
  return await apiClient.delete(`/timetable/${entryId}`)
}

export const getPeriodsApi = async () => {
  return await apiClient.get("/timetable/periods")
}

export const createPeriodApi = async (payload) => {
  return await apiClient.post("/timetable/periods", payload)
}

export const updatePeriodApi = async (periodId, payload) => {
  return await apiClient.put(`/timetable/periods/${periodId}`, payload)
}

export const deletePeriodApi = async (periodId) => {
  return await apiClient.delete(`/timetable/periods/${periodId}`)
}

export const getEligibleTeachersApi = async () => {
  return await apiClient.get("/timetable/teachers")
}

export const getSchoolClassesApi = async () => {
  return await apiClient.get("/school/classes")
}

export const getTeacherScheduleApi = async (teacherId) => {
  return await apiClient.get(`/timetable/teacher/${teacherId}`)
}

export const getFreeTeachersApi = async (dayOfWeek) => {
  const query = dayOfWeek ? `?day_of_week=${encodeURIComponent(dayOfWeek)}` : ""
  return await apiClient.get(`/timetable/free-teachers${query}`)
}

export const getMasterTimetableApi = async () => {
  return await apiClient.get("/timetable/master")
}

export const getTimetableInsightsApi = async () => {
  return await apiClient.get("/timetable/insights")
}

// Multi-Timetable Management APIs
export const listTimetablesApi = async () => {
  return await apiClient.get("/timetable/timetables")
}

export const getActiveTimetableApi = async () => {
  return await apiClient.get("/timetable/timetables/active")
}

export const createTimetableApi = async (payload) => {
  return await apiClient.post("/timetable/timetables", payload)
}

export const getTimetableByIdApi = async (timetableId) => {
  return await apiClient.get(`/timetable/timetables/${timetableId}`)
}

export const updateTimetableApi = async (timetableId, payload) => {
  return await apiClient.put(`/timetable/timetables/${timetableId}`, payload)
}

export const activateTimetableApi = async (timetableId) => {
  return await apiClient.post(`/timetable/timetables/${timetableId}/activate`)
}

export const duplicateTimetableApi = async (timetableId, name = null) => {
  const query = name ? `?name=${encodeURIComponent(name)}` : ""
  return await apiClient.post(`/timetable/timetables/${timetableId}/duplicate${query}`)
}

export const deleteTimetableApi = async (timetableId) => {
  return await apiClient.delete(`/timetable/timetables/${timetableId}`)
}

// Multi-Setup Bell Schedule APIs
export const listSetupsApi = async (timetableId) => {
  return await apiClient.get(`/timetable/setups?timetable_id=${timetableId}`)
}

export const createSetupApi = async (payload) => {
  return await apiClient.post("/timetable/setups", payload)
}

export const updateSetupApi = async (setupId, payload) => {
  return await apiClient.put(`/timetable/setups/${setupId}`, payload)
}

export const duplicateSetupApi = async (setupId) => {
  return await apiClient.post(`/timetable/setups/${setupId}/duplicate`)
}

export const deleteSetupApi = async (setupId) => {
  return await apiClient.delete(`/timetable/setups/${setupId}`)
}

export const previewSetupsImpactApi = async (payload) => {
  return await apiClient.post("/timetable/setups/preview-impact", payload)
}

export const batchSaveSetupsApi = async (payload) => {
  return await apiClient.post("/timetable/setups/batch-save", payload)
}

export const splitDaysApi = async (payload) => {
  return await apiClient.post("/timetable/setups/split-days", payload)
}

export const mergeDaysApi = async (payload) => {
  return await apiClient.post("/timetable/setups/merge-days", payload)
}

export const moveClassesApi = async (payload) => {
  return await apiClient.post("/timetable/setups/move-classes", payload)
}

// Class-Wise Aggregated Perspective APIs
export const getClassWiseTimetableApi = async ({ timetableId = null, wingId = null } = {}) => {
  const params = new URLSearchParams()
  if (timetableId) params.append("timetable_id", timetableId)
  if (wingId) params.append("wing_id", wingId)
  const qs = params.toString() ? `?${params.toString()}` : ""
  return await apiClient.get(`/timetable/class-wise${qs}`)
}

export const checkConflictApi = async (payload) => {
  return await apiClient.post("/timetable/check-conflict", payload)
}

export const bulkAssignSlotApi = async (payload) => {
  return await apiClient.post("/timetable/entries/bulk", payload)
}

export const exportTimetableExcelApi = async ({ timetableId, payload }) => {
  const response = await apiClient.post(
    `/timetable/${timetableId}/export-excel`,
    payload,
    { responseType: "blob" }
  )
  return response.data
}

export const timetableService = {
  getTimetable: getTimetableApi,
  createEntry: createTimetableEntryApi,
  updateEntry: updateTimetableEntryApi,
  deleteEntry: deleteTimetableEntryApi,
  getPeriods: getPeriodsApi,
  createPeriod: createPeriodApi,
  updatePeriod: updatePeriodApi,
  deletePeriod: deletePeriodApi,
  getTeachers: getEligibleTeachersApi,
  getClasses: getSchoolClassesApi,
  getTeacherSchedule: getTeacherScheduleApi,
  getFreeTeachers: getFreeTeachersApi,
  getMasterTimetable: getMasterTimetableApi,
  getTimetableInsights: getTimetableInsightsApi,

  // Multi-Timetable
  listTimetables: listTimetablesApi,
  getActiveTimetable: getActiveTimetableApi,
  createTimetable: createTimetableApi,
  getTimetableById: getTimetableByIdApi,
  updateTimetable: updateTimetableApi,
  activateTimetable: activateTimetableApi,
  duplicateTimetable: duplicateTimetableApi,
  deleteTimetable: deleteTimetableApi,

  // Multi-Setup Bell Schedule
  listSetups: listSetupsApi,
  createSetup: createSetupApi,
  updateSetup: updateSetupApi,
  duplicateSetup: duplicateSetupApi,
  deleteSetup: deleteSetupApi,
  previewSetupsImpact: previewSetupsImpactApi,
  batchSaveSetups: batchSaveSetupsApi,

  // Class-Wise Perspective
  getClassWiseTimetable: getClassWiseTimetableApi,
  checkConflict: checkConflictApi,
  bulkAssignSlot: bulkAssignSlotApi,
  exportTimetableExcel: exportTimetableExcelApi,
}

export default timetableService
