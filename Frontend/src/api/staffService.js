import apiClient from "./client"

/**
 * Fetch paginated and filtered staff list.
 */
export async function getStaffListApi({ isActive, status, search, page = 1, pageSize = 10 } = {}) {
  const params = {}
  if (isActive !== undefined && isActive !== null && isActive !== "") params.is_active = isActive
  if (status) params.status = status
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
 * Auto-generate next Staff ID.
 */
export async function generateStaffIdApi({ joiningYear, roleCode = "STF" } = {}) {
  const params = {}
  if (joiningYear) params.joining_year = joiningYear
  if (roleCode) params.role_code = roleCode
  return apiClient.get("/staff/generate-id", { params })
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

/**
 * Resend Staff account setup invitation email/link.
 */
export async function resendStaffSetupApi(staffId) {
  return apiClient.post(`/staff/${staffId}/resend-setup`)
}

/**
 * Validate one-time Staff onboarding token.
 */
export async function validateStaffSetupTokenApi(token) {
  return apiClient.get("/staff/setup/validate", { params: { token } })
}

/**
 * Complete Staff account setup (create password and PIN).
 */
export async function completeStaffSetupApi({ token, password, pin }) {
  return apiClient.post("/staff/setup", { token, password, pin })
}

/**
 * Download sample XLSX template for bulk staff import.
 */
export async function downloadStaffImportSampleApi() {
  return apiClient.get("/staff/bulk-import/sample", {
    responseType: "blob",
    timeout: 30000,
  })
}

/**
 * Preview and validate bulk staff XLSX file (dry-run).
 */
export async function previewBulkStaffImportApi(file) {
  const formData = new FormData()
  formData.append("file", file)
  return apiClient.post("/staff/bulk-import/preview", formData, {
    headers: {
      "Content-Type": undefined,
    },
    timeout: 60000,
  })
}

/**
 * Authoritatively create valid staff records from uploaded XLSX.
 */
export async function createBulkStaffImportApi(file) {
  const formData = new FormData()
  formData.append("file", file)
  return apiClient.post("/staff/bulk-import", formData, {
    headers: {
      "Content-Type": undefined,
    },
    timeout: 120000,
  })
}


