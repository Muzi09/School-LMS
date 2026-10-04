import apiClient from "./client"

/**
 * Timetable API Service
 * Handles periods, timetable entries, active teacher fetching, and grid data.
 */

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
}

export default timetableService
