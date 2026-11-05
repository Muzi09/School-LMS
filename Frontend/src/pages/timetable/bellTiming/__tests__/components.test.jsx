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
  })

  describe("PeriodModal", () => {
    it("shows quick duration chips and updates end time", () => {
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

      // Click 30m quick duration
      const chip30 = screen.getByText("30m")
      fireEvent.click(chip30)
      expect(screen.getByText("30 mins")).toBeDefined()
    })

    it("displays cascade choice options", () => {
      render(
        <PeriodModal
          isOpen={true}
          onClose={vi.fn()}
          mode="add"
          insertAfterIndex={1}
          schedule={sampleSchedule}
          onSave={vi.fn()}
        />
      )

      expect(screen.getByText("CASCADE BEHAVIOR")).toBeDefined()
      expect(screen.getByText("Shift all following periods")).toBeDefined()
      expect(screen.getByText("Keep day end time fixed")).toBeDefined()
      expect(screen.getByText("Only this period")).toBeDefined()
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
      expect(screen.getByText("+ Create Setup 3 & Move")).toBeDefined()
    })
  })
})
