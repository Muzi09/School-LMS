// @vitest-environment jsdom
import React from "react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { BellTimeline } from "../BellTimeline"
import { DayTabs } from "../DayTabs"
import { PeriodModal } from "../PeriodModal"
import { DaySplitModal } from "../DaySplitModal"
import { DayMergeModal } from "../DayMergeModal"
import { MoveScheduleModal } from "../MoveScheduleModal"
import { SetupCard } from "../SetupCard"
import { PERIOD_TYPES } from "../validators"

afterEach(() => {
  cleanup()
})

describe("Bell Timing Components Integration", () => {
  const sampleSchedule = {
    id: "sched-1",
    days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
    periods: [
      { id: "p1", period_number: 1, start_time: "08:30", end_time: "09:15", type: PERIOD_TYPES.CLASS, label: "P1" },
      { id: "p2", period_number: 2, start_time: "09:15", end_time: "10:00", type: PERIOD_TYPES.CLASS, label: "P2" },
      { id: "p3", period_number: 3, start_time: "10:00", end_time: "10:45", type: PERIOD_TYPES.CLASS, label: "P3" },
      { id: "p4", period_number: 4, start_time: "10:45", end_time: "11:30", type: PERIOD_TYPES.CLASS, label: "P4" },
      { id: "p5", period_number: 5, start_time: "11:30", end_time: "11:45", type: PERIOD_TYPES.RECESS, label: "Recess" },
      { id: "p6", period_number: 6, start_time: "11:45", end_time: "12:30", type: PERIOD_TYPES.CLASS, label: "P5" },
      { id: "p7", period_number: 7, start_time: "12:30", end_time: "13:15", type: PERIOD_TYPES.CLASS, label: "P6" },
      { id: "p8", period_number: 8, start_time: "13:15", end_time: "14:00", type: PERIOD_TYPES.CLASS, label: "P7" },
      { id: "p9", period_number: 9, start_time: "14:00", end_time: "14:45", type: PERIOD_TYPES.CLASS, label: "P8" },
    ],
  }

  describe("DayTabs", () => {
    it("renders day tabs and period count label", () => {
      render(
        <DayTabs
          schedules={[sampleSchedule]}
          activeScheduleId="sched-1"
          onSelectSchedule={vi.fn()}
          onOpenSplitModal={vi.fn()}
          onOpenMergeModal={vi.fn()}
        />
      )

      expect(screen.getByText("Mon")).toBeDefined()
      expect(screen.getByText("Fri")).toBeDefined()
      expect(screen.getByText("9 Periods")).toBeDefined()
    })

    it("triggers split modal when shared day is clicked", () => {
      const onOpenSplit = vi.fn()
      render(
        <DayTabs
          schedules={[sampleSchedule]}
          activeScheduleId="sched-1"
          onSelectSchedule={vi.fn()}
          onOpenSplitModal={onOpenSplit}
          onOpenMergeModal={vi.fn()}
        />
      )

      fireEvent.click(screen.getByRole("button", { name: "Schedule for Friday" }))
      expect(onOpenSplit).toHaveBeenCalledWith(sampleSchedule, ["FRIDAY"])
    })
  })

  describe("BellTimeline", () => {
    it("renders periods, recess block, and boundary time pills", () => {
      render(
        <BellTimeline
          schedule={sampleSchedule}
          setupId="setup-1"
          onOpenPeriodModal={vi.fn()}
          onInsertPeriodAtBoundary={vi.fn()}
        />
      )

      // Period labels
      expect(screen.getAllByText("P1").length).toBeGreaterThan(0)
      expect(screen.getAllByText("Recess").length).toBeGreaterThan(0)
      // Boundary times (8:30 AM, 9:15 AM)
      expect(screen.getAllByText("8:30 AM").length).toBeGreaterThan(0)
      expect(screen.getAllByText("9:15 AM").length).toBeGreaterThan(0)
      // Summary strip
      expect(screen.getByText(/Class Periods/i)).toBeDefined()
      expect(screen.getAllByText(/15m/).length).toBeGreaterThan(0)
    })

    it("renders draggable boundary time chips without popup click behavior", () => {
      const onEditBoundary = vi.fn()
      render(
        <BellTimeline
          schedule={sampleSchedule}
          setupId="setup-1"
          onOpenPeriodModal={vi.fn()}
          onInsertPeriodAtBoundary={vi.fn()}
          onEditBoundaryTime={onEditBoundary}
        />
      )

      const sliders = screen.getAllByRole("slider")
      expect(sliders.length).toBeGreaterThan(0)
      expect(sliders[0].className).toContain("cursor-ew-resize")
      // Arrow keys trigger boundary time edit
      fireEvent.keyDown(sliders[0], { key: "ArrowLeft" })
      expect(onEditBoundary).toHaveBeenCalled()
    })

    it("shifts subsequent periods and updates boundary times in real time during drag", () => {
      const onEditBoundary = vi.fn()
      render(
        <BellTimeline
          schedule={sampleSchedule}
          setupId="setup-1"
          onOpenPeriodModal={vi.fn()}
          onInsertPeriodAtBoundary={vi.fn()}
          onEditBoundaryTime={onEditBoundary}
        />
      )

      // Find boundary chip 1 (between period 0 and period 1)
      const sliders = screen.getAllByRole("slider")
      // slider 0 is start boundary (8:30 AM), slider 1 is boundary between P1 and Recess (9:15 AM)
      const boundarySlider = sliders[1]

      // Start drag at clientX = 100
      fireEvent.pointerDown(boundarySlider, { button: 0, clientX: 100 })

      // Drag right by 20px (+10 minutes: from 09:15 to 09:25)
      fireEvent.pointerMove(window, { clientX: 120 })

      // P1 end time should now preview 9:25 AM
      expect(screen.getAllByText("9:25 AM").length).toBeGreaterThan(0)

      // P2 (which was 9:15 - 10:00, 45m) must shift ahead to 9:25 - 10:10 AM
      expect(screen.getAllByText("10:10 AM").length).toBeGreaterThan(0)

      // Finish drag
      fireEvent.pointerUp(window)

      // onEditBoundaryTime called with new end time
      expect(onEditBoundary).toHaveBeenCalledWith(1, "09:25", false)
    })

    it("enforces minimum 15-minute duration when dragging period boundaries", () => {
      const onEditBoundary = vi.fn()
      render(
        <BellTimeline
          schedule={sampleSchedule}
          setupId="setup-1"
          onOpenPeriodModal={vi.fn()}
          onInsertPeriodAtBoundary={vi.fn()}
          onEditBoundaryTime={onEditBoundary}
        />
      )

      const sliders = screen.getAllByRole("slider")
      // Boundary 1 is P1 end time (start 08:30, end 09:15)
      const boundarySlider = sliders[1]

      // Start drag at clientX = 200
      fireEvent.pointerDown(boundarySlider, { button: 0, clientX: 200 })

      // Drag left by 100px (attempting to reduce duration from 45m down to -5m)
      fireEvent.pointerMove(window, { clientX: 100 })

      // P1 end time must be clamped to minimum 15 min duration (08:30 + 15m = 08:45)
      expect(screen.getAllByText("8:45 AM").length).toBeGreaterThan(0)

      // Finish drag
      fireEvent.pointerUp(window)
      expect(onEditBoundary).toHaveBeenCalledWith(1, "08:45", false)
    })

    it("ensures a 15-minute period has wide cell width so 'P1 15m' is visible and not hidden behind chips", () => {
      render(
        <BellTimeline
          schedule={sampleSchedule}
          setupId="setup-1"
          onOpenPeriodModal={vi.fn()}
          onInsertPeriodAtBoundary={vi.fn()}
        />
      )

      // In sampleSchedule, period 5 is Recess 11:30 - 11:45 (15m duration)
      // Cell width formula: 95 + 15 * 1 = 110px (reduced from 140px, but still plenty of room)
      const fifteenMinSpans = screen.getAllByText("15m")
      expect(fifteenMinSpans.length).toBeGreaterThan(0)
      const periodButton = fifteenMinSpans[0].closest("button")
      const periodCell = periodButton?.parentElement
      expect(periodCell?.style.width).toBe("110px")
    })
  })

  describe("PeriodModal", () => {
    it("renders Start Time, End Time, and Period Types including Extra-curricular", () => {
      render(
        <PeriodModal
          isOpen={true}
          onClose={vi.fn()}
          mode="add"
          insertAfterIndex={0}
          schedule={sampleSchedule}
          onSave={vi.fn()}
        />
      )

      expect(screen.getByText("Start Time")).toBeDefined()
      expect(screen.getByText("End Time")).toBeDefined()
      expect(screen.getByText("Class")).toBeDefined()
      expect(screen.getByText("Recess")).toBeDefined()
      expect(screen.getByText("Assembly")).toBeDefined()
      expect(screen.getByText("Extra-curricular")).toBeDefined()

      // Selected period type has filled variant (bg-primary text-primary-foreground)
      const classBtn = screen.getByText("Class")
      expect(classBtn.className).toContain("bg-primary")
      expect(classBtn.className).toContain("text-primary-foreground")

      // Removed fields
      expect(screen.queryByText("TITLE / LABEL")).toBeNull()
      expect(screen.queryByText("DURATION")).toBeNull()
      expect(screen.queryByText("CASCADE BEHAVIOR")).toBeNull()
    })

    it("saves period with default shift cascade mode and auto-labels correctly", () => {
      const onSave = vi.fn()
      render(
        <PeriodModal
          isOpen={true}
          onClose={vi.fn()}
          mode="add"
          insertAfterIndex={0}
          schedule={sampleSchedule}
          onSave={onSave}
        />
      )

      // Select Extra-curricular
      fireEvent.click(screen.getByText("Extra-curricular"))

      // Click Save Timing
      fireEvent.click(screen.getByText("Save Timing"))

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          periodData: expect.objectContaining({
            type: "ACTIVITY",
            label: "E1",
          }),
          cascadeMode: "shift",
          shiftEntireDay: false,
        })
      )
    })

    it("rejects period duration < 15 minutes and shows validation error", () => {
      render(
        <PeriodModal
          isOpen={true}
          onClose={vi.fn()}
          mode="edit"
          periodIndex={0}
          periodData={{ start_time: "08:30", end_time: "08:40", type: PERIOD_TYPES.CLASS, label: "P1" }}
          schedule={sampleSchedule}
          onSave={vi.fn()}
        />
      )

      expect(screen.getByText("Duration must be at least 15 minutes.")).toBeDefined()
      const saveBtn = screen.getByText("Save Timing").closest("button")
      expect(saveBtn?.getAttribute("aria-disabled") === "true" || saveBtn?.disabled).toBeTruthy()
    })
  })

  describe("DaySplitModal", () => {
    it("renders day question with proper text", () => {
      const onConfirm = vi.fn()
      render(
        <DaySplitModal
          isOpen={true}
          onClose={vi.fn()}
          schedule={sampleSchedule}
          daysToSplit={["FRIDAY"]}
          onConfirmSplit={onConfirm}
        />
      )

      expect(screen.getByText("Schedule for Friday")).toBeDefined()
      expect(screen.getByText("Does Friday have different bell timings than the rest of the days?")).toBeDefined()
      const yesBtn = screen.getByText("Yes, Split Off")
      fireEvent.click(yesBtn)
      expect(onConfirm).toHaveBeenCalledWith(["FRIDAY"])
    })
  })

  describe("DayMergeModal", () => {
    it("renders unique day warning and target schedule option", () => {
      const satSchedule = { id: "sched-2", days: ["SATURDAY"], periods: [] }
      const onConfirm = vi.fn()
      render(
        <DayMergeModal
          isOpen={true}
          onClose={vi.fn()}
          sourceSchedule={satSchedule}
          allSchedules={[sampleSchedule, satSchedule]}
          day="SATURDAY"
          onConfirmMerge={onConfirm}
        />
      )

      expect(screen.getByText("Schedule for Saturday")).toBeDefined()
      expect(screen.getByText("MERGE BACK WITH:")).toBeDefined()
      expect(screen.getByText("Confirm & Merge")).toBeDefined()
    })
  })

  describe("MoveScheduleModal", () => {
    it("formats singular '1 class' and plural 'N classes' properly", () => {
      const setups = [
        { id: "s1", name: "Setup 1" },
        { id: "s2", name: "Setup 2" },
      ]

      // 1 class
      const { rerender } = render(
        <MoveScheduleModal
          isOpen={true}
          onClose={vi.fn()}
          targetType="SECTION"
          targetInfo={{ name: "B", className: "Class 1", wingName: "Primary", sectionCount: 1, sectionIds: ["sec-1"] }}
          currentSetupId="s1"
          setups={setups}
          sectionAssignments={{ "sec-1": "s1" }}
          onMoveToSetup={vi.fn()}
          onCreateAndMove={vi.fn()}
        />
      )
      expect(screen.getByText("Send Class 1 - B — Primary (1 class) to:")).toBeDefined()

      // 2 classes
      rerender(
        <MoveScheduleModal
          isOpen={true}
          onClose={vi.fn()}
          targetType="CLASS"
          targetInfo={{ name: "Class 1", wingName: "Primary", sectionCount: 2, sectionIds: ["sec-1", "sec-2"] }}
          currentSetupId="s1"
          setups={setups}
          sectionAssignments={{ "sec-1": "s1", "sec-2": "s1" }}
          onMoveToSetup={vi.fn()}
          onCreateAndMove={vi.fn()}
        />
      )
      expect(screen.getByText("Send Class 1 (Primary) (2 classes) to:")).toBeDefined()
      expect(screen.getByText("Create Setup 3 & Move")).toBeDefined()
    })
  })
})
