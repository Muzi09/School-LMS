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

  getSectionSubjects: async (className, section) => {
    return await apiClient.get(`/school/section-subjects?class_name=${encodeURIComponent(className)}&section=${encodeURIComponent(section)}`)
  },
}
