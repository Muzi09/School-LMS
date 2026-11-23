// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { LectureGroupEditor } from "./LectureGroupEditor"

afterEach(cleanup)

const index = {
  options: [
    { id: "6a/s", class_id: "6", subject_id: "s", teacher_id: "t", section_ids: ["6a"], parallel: true },
    { id: "6b/s", class_id: "6", subject_id: "s", teacher_id: "t", section_ids: ["6b"], parallel: true },
    { id: "7a/s", class_id: "7", subject_id: "s", teacher_id: "t", section_ids: ["7a"], parallel: true },
  ],
  sectionClasses: new Map([["6a", "6"], ["6b", "6"], ["7a", "7"]]),
  sections: new Map([["6a", "6th A"], ["6b", "6th B"], ["7a", "7th A"]]),
  subjects: new Map([["s", "Sanskrit/Third Language"]]),
  teachers: new Map([["t", { name: "Athar Ahmad" }]]),
  rooms: new Map(),
}

it("keeps parallel sections from different classes in separate subject choices", () => {
  const onSave = vi.fn()
  render(<LectureGroupEditor index={index} onSave={onSave} onCancel={() => {}} />)

  const choices = screen.getAllByText("Sanskrit/Third Language · Athar Ahmad")
  expect(choices).toHaveLength(2)
  const sixth = choices[0].closest("div.p-3")
  const seventh = choices[1].closest("div.p-3")
  expect(within(sixth).getByText("6th A")).toBeTruthy()
  expect(within(sixth).getByText("6th B")).toBeTruthy()
  expect(within(sixth).queryByText("7th A")).toBeNull()
  expect(within(seventh).getByText("7th A")).toBeTruthy()

  fireEvent.change(screen.getByPlaceholderText("e.g. Senior electives"), { target: { value: "Languages" } })
  fireEvent.click(within(sixth).getAllByRole("checkbox")[0])
  fireEvent.click(within(seventh).getAllByRole("checkbox")[0])
  fireEvent.click(screen.getByText("Save group"))
  expect(onSave.mock.calls[0][0].options.map(row => row.section_ids)).toEqual([["6a", "6b"], ["7a"]])
})

it("separates sections when editing a previously merged group", () => {
  const onSave = vi.fn()
  const initial = { id: "group", name: "Languages", options: [
    { id: "old", subject_id: "s", teacher_id: "t", section_ids: ["6a", "6b", "7a"] },
  ] }
  render(<LectureGroupEditor index={index} initial={initial} onSave={onSave} onCancel={() => {}} />)

  expect(screen.getByText("Selected lessons (2)")).toBeTruthy()
  fireEvent.click(screen.getByText("Save group"))
  expect(onSave.mock.calls[0][0].options.map(row => row.section_ids)).toEqual([["6a", "6b"], ["7a"]])
})
