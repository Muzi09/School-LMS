// @vitest-environment jsdom
import { AxiosError } from "axios"
import { expect, test, vi } from "vitest"
import { ApiError, apiClient } from "./client"
import { exportTimetableExcelApi } from "./timetableService"

test("returns the response body and preserves browser credential handling", async () => {
  const body = { id: "fixture", first_name: "Example" }
  const adapter = vi.fn(async (config) => ({
    config,
    data: body,
    headers: {},
    status: 200,
    statusText: "OK",
  }))

  await expect(apiClient.get("/students/fixture", { adapter })).resolves.toEqual(body)
  expect(adapter).toHaveBeenCalledWith(expect.objectContaining({
    method: "get",
    url: "/students/fixture",
    withCredentials: true,
  }))
})

test("retains error details and reports an expired authenticated session", async () => {
  const expired = vi.fn()
  const adapter = async (config) => {
    throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, {
      config,
      data: { detail: "The session expired." },
      headers: {},
      status: 401,
      statusText: "Unauthorized",
    })
  }
  window.addEventListener("lms-session-expired", expired)
  try {
    await expect(apiClient.get("/students", { adapter })).rejects.toEqual(expect.objectContaining({
      name: "ApiError",
      message: "The session expired.",
      status: 401,
      data: { detail: "The session expired." },
    }))
    await expect(apiClient.get("/auth/me", { adapter })).rejects.toBeInstanceOf(ApiError)
    expect(expired).toHaveBeenCalledTimes(1)
  } finally {
    window.removeEventListener("lms-session-expired", expired)
  }
})

test("returns the Excel response body as the download blob", async () => {
  const workbook = new Blob(["workbook fixture"])
  const post = vi.spyOn(apiClient, "post").mockResolvedValue(workbook)
  const payload = { scope: "classwise" }
  try {
    await expect(exportTimetableExcelApi({ timetableId: "fixture", payload })).resolves.toBe(workbook)
    expect(post).toHaveBeenCalledWith("/timetable/fixture/export-excel", payload, { responseType: "blob" })
  } finally {
    post.mockRestore()
  }
})
