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

  // Full Configuration Workspace
  getFullConfig: async () => {
    return await apiClient.get("/school/config")
  },

  // Classes
  createClass: async (payload) => {
    return await apiClient.post("/school/classes", payload)
  },
  updateClass: async (classId, payload) => {
    return await apiClient.patch(`/school/classes/${classId}`, payload)
  },
  reorderClasses: async (payload) => {
    return await apiClient.put("/school/classes/reorder", payload)
  },
  deleteClass: async (classId) => {
    return await apiClient.delete(`/school/classes/${classId}`)
  },

  // Sections
  createSection: async (classId, payload) => {
    return await apiClient.post(`/school/classes/${classId}/sections`, payload)
  },
  updateSection: async (sectionId, payload) => {
    return await apiClient.patch(`/school/sections/${sectionId}`, payload)
  },
  deleteSection: async (sectionId) => {
    return await apiClient.delete(`/school/sections/${sectionId}`)
  },
  assignSectionSubjects: async (classId, sectionId, subjectIds) => {
    return await apiClient.put(`/school/classes/${classId}/sections/${sectionId}/subjects`, {
      subject_ids: subjectIds,
    })
  },

  // Subjects
  createSubject: async (payload) => {
    return await apiClient.post("/school/subjects", payload)
  },
  updateSubject: async (subjectId, payload) => {
    return await apiClient.patch(`/school/subjects/${subjectId}`, payload)
  },
  reorderSubjects: async (payload) => {
    return await apiClient.put("/school/subjects/reorder", payload)
  },
  deleteSubject: async (subjectId) => {
    return await apiClient.delete(`/school/subjects/${subjectId}`)
  },

  // Wings
  createWing: async (payload) => {
    return await apiClient.post("/school/wings", payload)
  },
  updateWing: async (wingId, payload) => {
    return await apiClient.patch(`/school/wings/${wingId}`, payload)
  },
  deleteWing: async (wingId) => {
    return await apiClient.delete(`/school/wings/${wingId}`)
  },

  // Houses
  createHouse: async (payload) => {
    return await apiClient.post("/school/houses", payload)
  },
  updateHouse: async (houseId, payload) => {
    return await apiClient.patch(`/school/houses/${houseId}`, payload)
  },
  deleteHouse: async (houseId) => {
    return await apiClient.delete(`/school/houses/${houseId}`)
  },

  // Customization
  updateCustomization: async (payload) => {
    return await apiClient.patch("/school/customization", payload)
  },
  uploadEmblem: async (formData) => {
    return await apiClient.post("/school/customization/emblem", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })
  },

  // Teachers & Faculty Assignments
  getTeachers: async () => {
    return await apiClient.get("/school/teachers")
  },
  assignClassTeacher: async (sectionId, teacherId) => {
    return await apiClient.put(`/school/sections/${sectionId}/class-teacher`, {
      class_teacher_id: teacherId || null,
    })
  },
  assignSectionSubjectTeacher: async (sectionId, subjectId, teacherId) => {
    return await apiClient.put(`/school/sections/${sectionId}/subjects/${subjectId}/teacher`, {
      teacher_id: teacherId || null,
    })
  },
}

