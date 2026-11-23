// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { teacherWeek } from "../../sectionSchedule"
import { TeacherSchedule } from "../TeacherSchedule"

afterEach(cleanup)

it("uses the period grid when bell schedules share a core with extra edge periods", () => {
  const first = { id: "first", class_name: "Primary", name: "A", setup_id: "early" }
  const second = { id: "second", class_name: "Senior", name: "A", setup_id: "late" }
  const period = (id, number, start, end) => ({
    id, period_number: number, period_type: "CLASS", label: "P" + number,
    start_time: start, end_time: end,
  })
  const early = period("early-extra", 1, "08:00", "08:30")
  const earlyCore = period("early-core", 2, "08:30", "09:10")
  const lateCore = period("late-core", 1, "08:30", "09:10")
  const late = period("late-extra", 2, "09:10", "09:40")
  const setups = [
    { id: "early", applicable_days: ["MONDAY"], schedules: [{ id: "early-day", days: ["MONDAY"], periods: [early, earlyCore] }] },
    { id: "late", applicable_days: ["MONDAY"], schedules: [{ id: "late-day", days: ["MONDAY"], periods: [lateCore, late] }] },
  ]
  const week = teacherWeek([{ section: first }, { section: second }], [], setups)
  expect(week.days[0].periods.map(item => item.start_time)).toEqual(["08:00", "08:30", "09:10"])
  expect(week.days[0].periods[1].label).toBe("P2 / P1")

  const open = vi.fn()
  render(<TeacherSchedule week={week} teacher={{ id: "teacher" }} edit zoom={100} density="comfortable" open={open} remove={() => {}} />)
  expect(screen.queryByLabelText("Teacher weekly schedule by clock time")).toBeNull()
  expect(screen.getByText("P2 / P1")).toBeTruthy()
  fireEvent.click(screen.getByLabelText(/Free Period.*MONDAY P2.*9:10 AM - 9:40 AM/))
  expect(open).toHaveBeenCalledWith("MONDAY", late, undefined)
})
