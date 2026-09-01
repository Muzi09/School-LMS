import apiClient from "./client"

export const authService = {
  login: async (email, password) => {
    return await apiClient.post("/auth/login", { email, password })
  },

  quickLogin: async (email, pin) => {
    return await apiClient.post("/auth/quick-login", { email, pin })
  },

  getMe: async () => {
    return await apiClient.get("/auth/me")
  },

  validateOnboardingToken: async (token) => {
    return await apiClient.get(`/principal/onboarding/validate?token=${encodeURIComponent(token)}`)
  },

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

  completeSchoolSetup: async (setupData) => {
    return await apiClient.post("/principal/onboarding/complete", setupData)
  },
}
