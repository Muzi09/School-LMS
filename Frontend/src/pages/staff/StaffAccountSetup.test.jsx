// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, expect, test, vi } from "vitest"
import { apiClient } from "@/api/client"
import { StaffAccountSetup } from "./StaffAccountSetup"

vi.mock("@/api/client", () => {
  const apiClient = { get: vi.fn(), post: vi.fn() }
  return { apiClient, default: apiClient }
})

afterEach(cleanup)

test("shows the school and staff name returned by the invitation endpoint", async () => {
  apiClient.get.mockResolvedValue({
    staff_id: "synthetic-staff",
    first_name: "Asha",
    last_name: "Example",
    email: "asha@example.com",
    school_name: "Synthetic School",
    is_valid: true,
    message: "Invitation is valid.",
  })
  render(
    <MemoryRouter initialEntries={["/login/setup?token=synthetic-invitation"]}>
      <StaffAccountSetup />
    </MemoryRouter>
  )

  expect(await screen.findByText("Synthetic School")).toBeDefined()
  expect(screen.getByText("Asha Example (asha@example.com)")).toBeDefined()
})
