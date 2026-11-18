import apiClient from "./client"

/**
 * @typedef {object} StaffSetupValidation
 * @property {string} staff_id
 * @property {string} first_name
 * @property {string} last_name
 * @property {string | null} email
 * @property {string | null} school_name
 * @property {boolean} is_valid
 * @property {string} message
 */

/**
 * Fetch paginated and filtered staff list.
 * @param {{ isActive?: boolean | string | null, status?: string, search?: string, page?: number, pageSize?: number }} [filters]
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
export async function getStaffByIdApi(/** @type {string} */ staffId) {
  return apiClient.get(`/staff/${staffId}`)
}

/**
 * Auto-generate next Staff ID.
 * @param {{ joiningYear?: number, roleCode?: string }} [options]
 * @returns {Promise<{ staff_id: string }>}
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
export async function createStaffApi(/** @type {Record<string, unknown>} */ data) {
  return apiClient.post("/staff", data)
}

/**
 * Update Staff member.
 */
export async function updateStaffApi(/** @type {string} */ staffId, /** @type {Record<string, unknown>} */ data) {
  return apiClient.put(`/staff/${staffId}`, data)
}

/**
 * Change Staff active status.
 */
export async function updateStaffStatusApi(/** @type {string} */ staffId, /** @type {boolean} */ isActive) {
  return apiClient.patch(`/staff/${staffId}/status`, { is_active: isActive })
}

/**
 * Soft delete Staff member.
 */
export async function deleteStaffApi(/** @type {string} */ staffId) {
  return apiClient.delete(`/staff/${staffId}`)
}

/**
 * Resend Staff account setup invitation email/link.
 */
export async function resendStaffSetupApi(/** @type {string} */ staffId) {
  return apiClient.post(`/staff/${staffId}/resend-setup`)
}

/**
 * Validate one-time Staff onboarding token.
 * @param {string} token
 * @returns {Promise<StaffSetupValidation>}
 */
export async function validateStaffSetupTokenApi(token) {
  return apiClient.get("/staff/setup/validate", { params: { token } })
}

/**
 * Set the password using a one-time staff invitation.
 * @param {{ token: string, password: string }} credentials
 * @returns {Promise<import("./client").MessageResponse>}
 */
export async function completeStaffSetupApi({ token, password }) {
  return apiClient.post("/staff/setup", { token, password })
}

/**
 * Download sample XLSX template for bulk staff import.
 * @returns {Promise<Blob>}
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
export async function previewBulkStaffImportApi(/** @type {File} */ file) {
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
export async function createBulkStaffImportApi(/** @type {File} */ file) {
  const formData = new FormData()
  formData.append("file", file)
  return apiClient.post("/staff/bulk-import", formData, {
    headers: {
      "Content-Type": undefined,
    },
    timeout: 120000,
  })
}


