// @vitest-environment jsdom
import React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ClassWiseGridView } from "../ClassWiseGridView"
import { TeacherWiseGridView } from "../TeacherWiseGridView"
import { TeacherSlotAssignmentDialog } from "../TeacherSlotAssignmentDialog"

afterEach(cleanup)
const teacher = { id: "t", first_name: "Sam", last_name: "Roy", name: "Sam Roy" }
function fixture() {
  const entries = [], sections = []
  const setups = [
    ["Primary", "Maths", ["08:00", "08:40"], ["09:00", "09:30"]],
    ["Senior", "Physics", ["08:30", "09:20"], ["10:00", "10:20"]],
  ].map(([name, subject, monday, saturday], i) => {
    const id = "setup" + i
    const stat = { id: subject, subject_id: subject, name: subject, teacher_id: "t", is_academic: true }
    const sec = { id: "sec" + i, class_name: name, class_id: "c" + i, name: "A", setup_id: id, subject_stats: [stat] }
    sections.push(sec)
    const schedules = [["MONDAY", monday], ["SATURDAY", saturday]].map(([day, times]) => {
      const period = { id: name + day, period_number: 1, period_type: "CLASS", label: "P1", start_time: times[0], end_time: times[1] }
      entries.push({ id: period.id + "-lesson", section: sec, section_id: sec.id, teacher, day_of_week: day, period,
        period_id: period.id, period_number: 1, subject: { id: subject, name: subject, is_academic: true } })
      return { id: day, days: [day], periods: [period] }
    })
    return { id, name, schedules, applicable_days: ["MONDAY", "SATURDAY"], assigned_section_ids: [sec.id] }
  })
  const classes = sections.map(sec => ({ id: sec.class_id, name: sec.class_name, sections: [sec] }))
  return { setups, entries, eligible_teachers: [teacher], wings: [{ id: "w", name: "School", classes }],
    timetable: { id: "tt", name: "Summer" }, stats: {} }
}

function show(component) {
  return render(<QueryClientProvider client={new QueryClient()}>{component}</QueryClientProvider>)
}

it("renders the same class, period and exact times in both tabs on Monday and Saturday", () => {
  const data = fixture()
  const table = show(<ClassWiseGridView timetableData={data} />)
  for (const e of data.entries) {
    const card = document.getElementById("class-section-" + e.section_id)
    expect(within(card).getByText(e.period.start_time + "–" + e.period.end_time)).toBeTruthy()
    const cell = card.querySelector('[data-slot-key="' + [e.section_id, e.day_of_week, e.period_id].join("_") + '"]')
    expect(cell.textContent).toContain(e.subject.name)
  }
  table.unmount()
  show(<TeacherWiseGridView timetableData={data} />)
  for (const e of data.entries) {
    const row = screen.getByText(e.period.start_time + "–" + e.period.end_time).parentElement
    expect(row.textContent).toContain(e.subject.name)
    expect(row.textContent).toContain(e.section.class_name)
    expect(row.closest("section").textContent).toContain(e.day_of_week)
  }
  expect(screen.getAllByText("Time clash")).toHaveLength(2)
})

it("offers the selected class's Saturday bell and saves its actual ID", () => {
  const data = fixture()
  const section = data.wings[0].classes[1].sections[0]
  const submit = vi.fn()
  show(<TeacherSlotAssignmentDialog isOpen onClose={() => {}} onAssign={submit} setups={data.setups}
    cellData={{ teacher, day: "SATURDAY", period: data.setups[0].schedules[1].periods[0] }}
    teacherAllocations={[{ subject_id: "Physics", subject_name: "Physics", section, is_academic: true }]} existingEntries={[]} />)
  const picker = screen.getByRole("combobox")
  expect(picker.textContent).toContain("10:00–10:20")
  expect(picker.textContent).not.toContain("09:00–09:30")
  fireEvent.change(picker, { target: { value: "SeniorSATURDAY" } })
  fireEvent.click(screen.getByText("Assign Slot"))
  expect(submit).toHaveBeenCalledWith(expect.objectContaining({ section_id: "sec1", period: expect.objectContaining({ id: "SeniorSATURDAY" }) }))
})
