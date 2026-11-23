// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { ClassSectionWorkspace } from "./ClassSectionWorkspace"

it("searches only teachers eligible for the subject's wing and replaces a legacy assignment", () => {
  Element.prototype.scrollIntoView ??= () => {}
  const onAssign = vi.fn()
  const teachers = [
    { id: "a", name: "Sam Roy", assigned_wing_ids: ["senior", "primary"] },
    { id: "b", name: "Lina Ali", assigned_wing_ids: ["primary"] },
    { id: "c", name: "Raj Singh", assigned_wing_ids: ["senior"] },
  ]
  const subject = { id: "math", name: "Math", teacher: teachers[2] }
  const grade = { id: "one", name: "One", wing_id: "primary",
    sections: [{ id: "a1", name: "A", subjects: [subject] }] }
  render(<ClassSectionWorkspace classes={[grade]} teachers={teachers}
    wings={[{ id: "primary", name: "Primary" }, { id: "senior", name: "Senior" }]}
    onAssignSubjectTeacher={onAssign} />)
  fireEvent.click(screen.getByRole("button", { name: "Raj Singh" }))
  expect(screen.queryByRole("option", { name: /Raj Singh/i })).toBeNull()
  expect(screen.getByRole("option", { name: /Lina Ali/i })).toBeTruthy()
  const search = screen.getByRole("textbox", { name: "Search teachers" })
  fireEvent.change(search, { target: { value: "ROY" } })
  expect(screen.queryByRole("option", { name: /Lina Ali/i })).toBeNull()
  fireEvent.keyDown(search, { key: "Enter" })
  expect(onAssign).toHaveBeenCalledExactlyOnceWith("a1", "math", "a")
})
