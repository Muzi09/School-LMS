import apiClient from "./client"

/**
 * Fetch paginated and filtered staff list.
 */
export async function getStaffListApi({ isActive, search, page = 1, pageSize = 10 } = {}) {
  const params = {}
  if (isActive !== undefined && isActive !== null && isActive !== "") params.is_active = isActive
  if (search) params.search = search
  params.page = page
  params.page_size = pageSize

  return apiClient.get("/staff", { params })
}

/**
 * Fetch single staff member by ID.
 */
export async function getStaffByIdApi(staffId) {
  return apiClient.get(`/staff/${staffId}`)
}

/**
 * Create Staff member.
 */
export async function createStaffApi(data) {
  return apiClient.post("/staff", data)
}

/**
 * Update Staff member.
 */
export async function updateStaffApi(staffId, data) {
  return apiClient.put(`/staff/${staffId}`, data)
}

/**
 * Change Staff active status.
 */
export async function updateStaffStatusApi(staffId, isActive) {
  return apiClient.patch(`/staff/${staffId}/status`, { is_active: isActive })
}

/**
 * Soft delete Staff member.
 */
export async function deleteStaffApi(staffId) {
  return apiClient.delete(`/staff/${staffId}`)
}
