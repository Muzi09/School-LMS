import apiClient from "./client"

/**
 * Fetch all available schools.
 */
export async function getSchoolsApi() {
  return apiClient.get("/schools")
}
