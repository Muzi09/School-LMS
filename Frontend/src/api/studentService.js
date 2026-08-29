import apiClient from "./client"

/**
 * Fetch paginated and filtered students list.
 */
export async function getStudentsListApi({ isActive, className, section, search, page = 1, pageSize = 10 } = {}) {
  const params = {}
  if (isActive !== undefined && isActive !== null && isActive !== "") params.is_active = isActive
  if (className) params.class_name = className
  if (section) params.section = section
  if (search) params.search = search
  params.page = page
  params.page_size = pageSize

  return apiClient.get("/students", { params })
}

/**
 * Fetch single student by ID.
 */
export async function getStudentByIdApi(studentId) {
  return apiClient.get(`/students/${studentId}`)
}

/**
 * Create Student.
 */
export async function createStudentApi(data) {
  return apiClient.post("/students", data)
}

/**
 * Update Student.
 */
export async function updateStudentApi(studentId, data) {
  return apiClient.put(`/students/${studentId}`, data)
}

/**
 * Change Student active status.
 */
export async function updateStudentStatusApi(studentId, isActive) {
  return apiClient.patch(`/students/${studentId}/status`, { is_active: isActive })
}

/**
 * Soft delete Student.
 */
export async function deleteStudentApi(studentId) {
  return apiClient.delete(`/students/${studentId}`)
}
