import axios from "axios"

export const apiClient = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
})

// Response interceptor to unwrap data and normalize API errors
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    let message = "An unexpected error occurred"
    if (error.response?.data) {
      const data = error.response.data
      if (typeof data.detail === "string") {
        message = data.detail
      } else if (Array.isArray(data.detail)) {
        // Pydantic validation errors array
        message = data.detail.map((err) => `${err.loc?.join(".") || "Field"}: ${err.msg}`).join(", ")
      } else if (data.message) {
        message = data.message
      }
    } else if (error.message) {
      message = error.message
    }
    const customError = new Error(message)
    customError.status = error.response?.status
    customError.data = error.response?.data
    return Promise.reject(customError)
  }
)

export default apiClient
