// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { BellScheduleSetupModal } from "../../components/BellScheduleSetupModal"

// Mock hooks and services
const mockMutateAsync = vi.fn().mockResolvedValue({ message: "Saved" })
const mockRefetch = vi.fn()
const mockInvalidateQueries = vi.fn()

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useQueryClient: vi.fn(() => ({
      invalidateQueries: mockInvalidateQueries,
      setQueriesData: vi.fn(),
    })),
  }
})

vi.mock("@/hooks/useTimetable", () => ({
  timetableKeys: {
    setups: vi.fn((id) => ["setups", id]),
    all: ["timetables"],
  },
  useSetups: vi.fn(() => ({
    data: [
      {
        id: "setup-1",
        name: "Setup 1",
        order_index: 0,
        version: 1,
        is_default: true,
        applicable_days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"],
        assigned_section_ids: ["sec-1", "sec-2"],
        schedules: [
          {
            id: "sched-1",
            days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
            periods: [
              { id: "p1", period_number: 1, start_time: "08:30", end_time: "09:15", type: "CLASS", label: "P1" },
              { id: "p2", period_number: 2, start_time: "09:15", end_time: "10:00", type: "CLASS", label: "P2" },
            ],
          },
          {
            id: "sched-2",
            days: ["SATURDAY"],
            periods: [
              { id: "p-sat-1", period_number: 1, start_time: "08:30", end_time: "09:05", type: "CLASS", label: "P1" },
            ],
          },
        ],
      },
    ],
    isLoading: false,
    error: null,
    refetch: mockRefetch,
  })),
  useBatchSaveSetups: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}))

vi.mock("@/api/timetableService", () => ({
  previewSetupsImpactApi: vi.fn().mockResolvedValue({ affected_slots_count: 0, affected_entries: [] }),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe("BellScheduleSetupModal Orchestrator Integration", () => {
  const mockWings = [
    {
      id: "wing-1",
      name: "Primary",
      classes: [
        {
          id: "cls-1",
          name: "Class 1",
          sections: [
            { id: "sec-1", name: "A" },
            { id: "sec-2", name: "B" },
          ],
        },
      ],
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders setup cards, day tabs, and '+ Create Setup 2' card", () => {
    render(
      <BellScheduleSetupModal
        isOpen={true}
        onClose={vi.fn()}
        timetableId="tt-123"
        wings={mockWings}
      />
    )

    // Modal title & setup badge
    expect(screen.getByText("Timetable Frame & Bell Schedule Setup")).toBeDefined()
    expect(screen.getByText("1 SETUP")).toBeDefined()

    // Setup 1 card
    expect(screen.getByText("Setup 1")).toBeDefined()
    expect(screen.getAllByText("2 CLASSES").length).toBeGreaterThanOrEqual(1)

    // Days & timelines
    expect(screen.getByText("Mon")).toBeDefined()
    expect(screen.getByText("Fri")).toBeDefined()
    expect(screen.getByText("Sat")).toBeDefined()

    // Wing card & section chips
    expect(screen.getByText("Primary Wing")).toBeDefined()
    expect(screen.getByText("A")).toBeDefined()
    expect(screen.getByText("B")).toBeDefined()

    // Bottom placeholder card
    expect(screen.getByText("Create Setup 2")).toBeDefined()
  })

  it("creates a new setup when clicking 'Create Setup 2' and saves automatically without manual save bar", () => {
    render(
      <BellScheduleSetupModal
        isOpen={true}
        onClose={vi.fn()}
        timetableId="tt-123"
        wings={mockWings}
      />
    )

    const createBtn = screen.getByText("Create Setup 2")
    fireEvent.click(createBtn)

    // Setup 2 is now rendered
    expect(screen.getByText("Setup 2")).toBeDefined()

    // No manual save bar or buttons
    expect(screen.queryByText("Save Changes")).toBeNull()
    expect(screen.queryByText("You have unsaved changes")).toBeNull()
    expect(screen.queryByLabelText("Undo")).toBeNull()
    expect(screen.queryByLabelText("Redo")).toBeNull()
  })

  it("disables delete when only one setup exists, enables filled delete button and prompts reassignment when multiple setups exist", () => {
    render(
      <BellScheduleSetupModal
        isOpen={true}
        onClose={vi.fn()}
        timetableId="tt-123"
        wings={mockWings}
      />
    )

    // With 1 setup: Delete button is disabled
    const singleDeleteBtn = screen.getByRole("button", { name: /Delete Setup 1/i })
    expect(singleDeleteBtn.disabled).toBe(true)

    // Create Setup 2
    fireEvent.click(screen.getByText("Create Setup 2"))
    expect(screen.getByText("Setup 2")).toBeDefined()

    // With 2 setups: Delete button for Setup 1 is enabled
    const deleteBtns = screen.getAllByRole("button", { name: /Delete Setup/i })
    expect(deleteBtns[0].disabled).toBe(false)

    // Click delete on Setup 1 (which has assigned classes)
    fireEvent.click(deleteBtns[0])

    // Reassignment dialog opens
    expect(screen.getByText("Delete Setup 1")).toBeDefined()
    expect(screen.getByText(/Reassign classes before deleting/i)).toBeDefined()
    expect(screen.getByText(/Reassign & Delete/i)).toBeDefined()
  })

  it("opens move modal when clicking a section chip", () => {
    render(
      <BellScheduleSetupModal
        isOpen={true}
        onClose={vi.fn()}
        timetableId="tt-123"
        wings={mockWings}
      />
    )

    const chipA = screen.getByText("A")
    fireEvent.click(chipA)

    expect(screen.getByText("Move Schedule")).toBeDefined()
    expect(screen.getByText(/Send Class 1 - A.*\(1 class\) to/i)).toBeDefined()
  })

  it("read-only mode hides edit controls, '+ Create Setup' and 'Add Setup' buttons", () => {
    render(
      <BellScheduleSetupModal
        isOpen={true}
        onClose={vi.fn()}
        timetableId="tt-123"
        wings={mockWings}
        readOnly={true}
      />
    )

    // Add Setup and Create Setup should not exist
    expect(screen.queryByText("Add Setup")).toBeNull()
    expect(screen.queryByText("Create Setup 2")).toBeNull()
    expect(screen.queryByText("Duplicate")).toBeNull()
  })

  it("persists a dirty schedule only after explicit save", async () => {
    const onSaved = vi.fn()
    mockMutateAsync.mockResolvedValueOnce([
      {
        id: "setup-1",
        version: 2,
        name: "Setup 1",
        schedules: [],
        assigned_section_ids: ["sec-1", "sec-2"],
      },
    ])

    render(
      <BellScheduleSetupModal
        isOpen={true}
        onClose={vi.fn()}
        timetableId="tt-123"
        wings={mockWings}
        onSaved={onSaved}
      />
    )

    const duplicateBtn = screen.getByText("Duplicate")
    fireEvent.click(duplicateBtn)

    expect(mockMutateAsync).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Save Bell Schedule" }))
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1)
    })
    expect(mockMutateAsync).toHaveBeenCalledTimes(1)
    expect(mockMutateAsync.mock.calls[0][0]).toEqual(expect.objectContaining({
      timetable_id: "tt-123",
    }))
  })

  it("keeps unsaved edits after a conflict and lets the user discard them", async () => {
    const onClose = vi.fn()
    mockMutateAsync.mockRejectedValueOnce(Object.assign(new Error("The timetable has changed."), { status: 409 }))
    render(<BellScheduleSetupModal isOpen onClose={onClose} timetableId="tt-123" timetableVersion={4} wings={mockWings} />)

    fireEvent.click(screen.getByText("Duplicate"))
    fireEvent.click(screen.getByRole("button", { name: "Save Bell Schedule" }))
    expect(await screen.findByText("The timetable has changed. Your edits are still here.")).toBeDefined()
    expect(mockMutateAsync.mock.calls[0][0].timetable_version).toBe(4)
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }))
    expect(screen.getByText("Unsaved changes")).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: "Discard Changes" }))
    expect(screen.getByText("All changes saved")).toBeDefined()
    expect(onClose).not.toHaveBeenCalled()
  })
})

