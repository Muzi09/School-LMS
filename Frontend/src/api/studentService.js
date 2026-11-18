import apiClient from "./client"

/**
 * @typedef {object} StudentRosterProfile
 * @property {string | null} [middle_name]
 * @property {string} roll_no
 * @property {string} class_name
 * @property {string} section
 * @property {string} house
 */
/**
 * @typedef {object} StudentRoster
 * @property {string} id
 * @property {string} first_name
 * @property {string} last_name
 * @property {boolean} is_active
 * @property {string} created_at
 * @property {string} updated_at
 * @property {StudentRosterProfile} student_profile
 */
/** @typedef {StudentRosterProfile & { gender: number, date_of_birth: string, father_first_name: string, father_last_name: string }} StudentProfile */
/** @typedef {Omit<StudentRoster, "student_profile"> & { login_mobile: string, email: string | null, role: number, student_profile: (StudentProfile & { id: string, user_id: string }) | null }} StudentDetail */
/** @typedef {{ first_name: string, last_name: string, login_mobile: string, email?: string | null, password?: string | null, profile: Omit<StudentProfile, "roll_no"> & { roll_no?: string }, subjects?: string[] | null }} NewStudent */
/** @typedef {Partial<Omit<NewStudent, "profile">> & { is_active?: boolean, profile?: Partial<StudentProfile> | null }} StudentUpdate */

/**
 * Fetch the minimum fields required by the school roster.
 * @param {{ isActive?: boolean | string | null, className?: string, section?: string, search?: string, page?: number, pageSize?: number }} [filters]
 * @returns {Promise<import("./client").PaginatedResponse<StudentRoster>>}
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
 * @param {string} studentId
 * @returns {Promise<StudentDetail>}
 */
export async function getStudentByIdApi(studentId) {
  return apiClient.get(`/students/${studentId}`)
}

/**
 * @param {string} studentId
 * @returns {Promise<Blob>}
 */
export async function exportStudentApi(studentId) {
  return apiClient.get(`/students/${studentId}/export`, { responseType: "blob" })
}

/**
 * Create Student.
 * @param {NewStudent} data
 * @returns {Promise<StudentDetail>}
 */
export async function createStudentApi(data) {
  return apiClient.post("/students", data)
}

/**
 * Update Student.
 * @param {string} studentId
 * @param {StudentUpdate} data
 * @returns {Promise<StudentDetail>}
 */
export async function updateStudentApi(studentId, data) {
  return apiClient.put(`/students/${studentId}`, data)
}

/**
 * Change Student active status.
 * @param {string} studentId
 * @param {boolean} isActive
 * @returns {Promise<StudentDetail>}
 */
export async function updateStudentStatusApi(studentId, isActive) {
  return apiClient.patch(`/students/${studentId}/status`, { is_active: isActive })
}

/**
 * Calculate preview roll number for a student.
 * @param {{ firstName?: string, lastName?: string, className?: string, section?: string, studentId?: string }} [form]
 * @returns {Promise<{ roll_no: string, class_name: string, section: string, total_students: number }>}
 */
export async function calculateStudentRollNoApi({ firstName, lastName, className, section, studentId } = {}) {
  const params = {
    first_name: firstName,
    last_name: lastName,
    class_name: className,
    section: section,
  }
  return apiClient.get("/students/calculate-roll-no", {
    params: { ...params, student_id: studentId || undefined },
  })
}

/**
 * Soft delete Student.
 * @param {string} studentId
 * @returns {Promise<import("./client").MessageResponse>}
 */
export async function deleteStudentApi(studentId) {
  return apiClient.delete(`/students/${studentId}`)
}
