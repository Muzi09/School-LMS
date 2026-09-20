import apiClient from "./client"

export const adminService = {
  getDashboardStats: async () => {
    return await apiClient.get("/admin/dashboard")
  },

  getPrincipals: async () => {
    return await apiClient.get("/admin/principals")
  },

  createPrincipal: async (principalData) => {
    return await apiClient.post("/admin/principals", principalData)
  },

  regenerateOnboarding: async (principalId) => {
    return await apiClient.post(`/admin/principals/${principalId}/regenerate-onboarding`)
  },

  getPlatformUsers: async () => {
    return await apiClient.get("/admin/users")
  },

  createPlatformUser: async (userData, targetRole) => {
    return await apiClient.post(`/admin/users?target_role=${targetRole}`, userData)
  },

  getSmtpConfig: async () => {
    return await apiClient.get("/admin/smtp")
  },

  saveSmtpConfig: async (smtpData) => {
    return await apiClient.post("/admin/smtp", smtpData)
  },

  testSmtpConfig: async (smtpData) => {
    return await apiClient.post("/admin/smtp/test", smtpData)
  },
}

export default adminService
