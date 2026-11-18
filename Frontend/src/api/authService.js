import apiClient from "./client"

/**
 * @typedef {object} AuthUser
 * @property {string} id
 * @property {string} first_name
 * @property {string} last_name
 * @property {string | null} [email]
 * @property {string} login_mobile
 * @property {number} role
 * @property {boolean} is_active
 * @property {boolean} school_setup_completed
 * @property {string | null} [school_id]
 * @property {string | null} [school_name]
 * @property {string | null} [school_primary_color]
 * @property {string | null} [school_emblem_url]
 */

export const authService = {
  /**
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ token_type: "cookie", user: AuthUser }>}
   */
  login: async (email, password) => {
    return apiClient.post("/auth/login", { email, password }, {
      headers: { "X-LMS-Session": "browser" },
    })
  },

  logout: async () => {
    await apiClient.post("/auth/logout")
  },

  /** @returns {Promise<AuthUser>} */
  getMe: async () => {
    return await apiClient.get("/auth/me")
  },

  /**
   * @param {string} token
   * @returns {Promise<{ user_id: string, first_name: string, last_name: string, email: string, login_mobile: string, is_valid: boolean, message: string }>}
   */
  validateOnboardingToken: async (token) => {
    return await apiClient.get(`/principal/onboarding/validate?token=${encodeURIComponent(token)}`)
  },

  /**
   * @param {string} token
   * @param {File} file
   * @returns {Promise<{ emblem_url: string }>}
   */
  uploadSchoolEmblem: async (token, file) => {
    const formData = new FormData()
    formData.append("token", token)
    formData.append("file", file)
    return await apiClient.post("/principal/onboarding/upload-emblem", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })
  },

  /**
   * @param {Record<string, unknown>} setupData
   * @returns {Promise<{ success: boolean, message: string, school_id: string, school_name: string, principal_id: string }>}
   */
  completeSchoolSetup: async (setupData) => {
    return await apiClient.post("/principal/onboarding/complete", setupData)
  },
}
