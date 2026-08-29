import apiClient from "./client"

/**
 * Fetch paginated and filtered users list.
 */
export async function getUsersApi({ schoolId, role, isActive, search, page = 1, pageSize = 10 } = {}) {
  const params = {}
  if (schoolId) params.school_id = schoolId
  if (role !== undefined && role !== null && role !== "") params.role = role
  if (isActive !== undefined && isActive !== null && isActive !== "") params.is_active = isActive
  if (search) params.search = search
  params.page = page
  params.page_size = pageSize

  return apiClient.get("/users", { params })
}

/**
 * Fetch single user by ID.
 */
export async function getUserByIdApi(userId) {
  return apiClient.get(`/users/${userId}`)
}

/**
 * Create Principal user (Role 1).
 */
export async function createPrincipalApi(data) {
  return apiClient.post("/users/principal", data)
}

/**
 * Create Staff user (Role 2).
 */
export async function createStaffApi(data) {
  return apiClient.post("/users/staff", data)
}

/**
 * Create Student user (Role 3).
 */
export async function createStudentApi(data) {
  return apiClient.post("/users/student", data)
}

/**
 * Update user details.
 */
export async function updateUserApi(userId, data) {
  return apiClient.put(`/users/${userId}`, data)
}

/**
 * Update user active status.
 */
export async function updateUserStatusApi(userId, isActive) {
  return apiClient.patch(`/users/${userId}/status`, { is_active: isActive })
}

/**
 * Soft delete user.
 */
export async function deleteUserApi(userId) {
  return apiClient.delete(`/users/${userId}`)
}
