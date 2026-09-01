import apiClient from "./client"

export const superAdminService = {
  getDashboardStats: async () => {
    return await apiClient.get("/super-admin/dashboard")
  },

  getPrincipals: async () => {
    return await apiClient.get("/super-admin/principals")
  },

  createPrincipal: async (principalData) => {
    return await apiClient.post("/super-admin/principals", principalData)
  },

  getPlatformUsers: async () => {
    return await apiClient.get("/super-admin/users")
  },

  createPlatformUser: async (userData, targetRole) => {
    return await apiClient.post(`/super-admin/users?target_role=${targetRole}`, userData)
  },

  getSmtpConfig: async () => {
    return await apiClient.get("/super-admin/smtp")
  },

  saveSmtpConfig: async (smtpData) => {
    return await apiClient.post("/super-admin/smtp", smtpData)
  },
}
