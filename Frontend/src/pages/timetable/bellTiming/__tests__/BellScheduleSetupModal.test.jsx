// @vitest-environment jsdom
import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { BellScheduleSetupModal } from "../../components/BellScheduleSetupModal"

// Mock hooks and services
const mockMutateAsync = vi.fn().mockResolvedValue({ message: "Saved" })
const mockRefetch = vi.fn()

vi.mock("@/hooks/useTimetable", () => ({
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
    expect(screen.getByText("+ Create Setup 2")).toBeDefined()
  })

  it("creates a new setup when clicking '+ Create Setup 2' and shows unsaved bar", () => {
    render(
      <BellScheduleSetupModal
        isOpen={true}
        onClose={vi.fn()}
        timetableId="tt-123"
        wings={mockWings}
      />
    )

    const createBtn = screen.getByText("+ Create Setup 2")
    fireEvent.click(createBtn)

    // Unsaved changes bar appears
    expect(screen.getByText("You have unsaved changes")).toBeDefined()
    expect(screen.getByText("Save Changes")).toBeDefined()

    // Setup 2 is now rendered
    expect(screen.getByText("Setup 2")).toBeDefined()
  })

  it("supports Undo and Redo from the sticky unsaved bar", () => {
    render(
      <BellScheduleSetupModal
        isOpen={true}
        onClose={vi.fn()}
        timetableId="tt-123"
        wings={mockWings}
      />
    )

    // Create Setup 2
    fireEvent.click(screen.getByText("+ Create Setup 2"))
    expect(screen.getByText("Setup 2")).toBeDefined()

    // Click Undo
    const undoBtn = screen.getByLabelText("Undo")
    fireEvent.click(undoBtn)

    // Setup 2 should be gone
    expect(screen.queryByText("Setup 2")).toBeNull()

    // Click Redo
    const redoBtn = screen.getByLabelText("Redo")
    fireEvent.click(redoBtn)

    // Setup 2 should be back
    expect(screen.getByText("Setup 2")).toBeDefined()
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
    expect(screen.getByText(/Send Class 1 - A.*\(1 class\) to:/i)).toBeDefined()
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
    expect(screen.queryByText("+ Create Setup 2")).toBeNull()
    expect(screen.queryByText("Duplicate")).toBeNull()
  })
})

