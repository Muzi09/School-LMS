import axios from "axios"

const getBaseURL = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  if (import.meta.env.VITE_BACKEND_URL) {
    const backend = import.meta.env.VITE_BACKEND_URL.replace(/\/+$/, "")
    return `${backend}/api/v1`
  }
  return "/api/v1"
}

export const apiClient = axios.create({
  baseURL: 'https://school-lms-d12h.onrender.com/api/v1/',
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
})

// Request interceptor to inject Authorization Bearer token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("school_lms_auth_token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

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
