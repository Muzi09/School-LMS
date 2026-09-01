import apiClient from "./client"

export const schoolConfigService = {
  getClasses: async () => {
    return await apiClient.get("/school/classes")
  },

  getSections: async () => {
    return await apiClient.get("/school/sections")
  },

  getHouses: async () => {
    return await apiClient.get("/school/houses")
  },
}
