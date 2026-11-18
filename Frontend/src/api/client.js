import axios from "axios"

const baseURL = import.meta.env.VITE_API_BASE_URL || "/api/v1"

/** @typedef {import("axios").AxiosRequestConfig} RequestConfig */
/**
 * @template T @typedef {{ items: T[], total: number, page: number, page_size: number, total_pages: number }} PaginatedResponse
 */
/**
 * @typedef {object} MessageResponse
 * @property {string} message
 * @property {boolean} success
 */

const transport = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
  withCredentials: true,
})

transport.interceptors.request.use(
  (config) => {
    // Let browser set multipart/form-data boundary automatically when sending FormData
    if (config.data instanceof FormData) {
      config.headers.delete("Content-Type")
    }
    return config
  },
  (error) => Promise.reject(error)
)

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {number | undefined} status
   * @param {unknown} data
   */
  constructor(message, status, data) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.data = data
  }
}

/**
 * @template [T=any]
 * @param {RequestConfig} request
 * @returns {Promise<T>}
 */
async function requestData(request) {
  try {
    return (await transport.request(request)).data
  } catch (error) {
    if (!axios.isAxiosError(error)) throw error
    if (error.response?.status === 401 && !error.config?.url?.startsWith("/auth/")) {
      window.dispatchEvent(new Event("lms-session-expired"))
    }
    let message = "An unexpected error occurred"
    if (error.response?.data) {
      const data = error.response.data
      if (typeof data.detail === "string") {
        message = data.detail
      } else if (Array.isArray(data.detail)) {
        // Pydantic validation errors array
        message = data.detail.map(formatValidationIssue).join(", ")
      } else if (typeof data.message === "string") {
        message = data.message
      }
    } else if (error.message) {
      message = error.message
    }
    throw new ApiError(message, error.response?.status, error.response?.data)
  }
}

/** @param {{ loc?: (string | number)[], msg: string }} issue */
function formatValidationIssue(issue) {
  return `${issue.loc?.join(".") || "Field"}: ${issue.msg}`
}

export const apiClient = {
  /**
   * @template [T=any]
   * @param {string} url
   * @param {RequestConfig} [config]
   * @returns {Promise<T>}
   */
  get: (url, config) => requestData({ ...config, url, method: "GET" }),
  /**
   * @template [T=any]
   * @param {string} url
   * @param {unknown} [data]
   * @param {RequestConfig} [config]
   * @returns {Promise<T>}
   */
  post: (url, data, config) => requestData({ ...config, url, data, method: "POST" }),
  /**
   * @template [T=any]
   * @param {string} url
   * @param {unknown} [data]
   * @param {RequestConfig} [config]
   * @returns {Promise<T>}
   */
  put: (url, data, config) => requestData({ ...config, url, data, method: "PUT" }),
  /**
   * @template [T=any]
   * @param {string} url
   * @param {unknown} [data]
   * @param {RequestConfig} [config]
   * @returns {Promise<T>}
   */
  patch: (url, data, config) => requestData({ ...config, url, data, method: "PATCH" }),
  /**
   * @template [T=any]
   * @param {string} url
   * @param {RequestConfig} [config]
   * @returns {Promise<T>}
   */
  delete: (url, config) => requestData({ ...config, url, method: "DELETE" }),
}

export default apiClient
