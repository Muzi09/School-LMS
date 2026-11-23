// @vitest-environment jsdom
import { SectionSubjectsDialog } from "@/pages/school-management/Dialogs"
import { StructureOrderDialog } from "@/pages/school-management/StructureOrderDialog"
import { LecturePlannerDialog } from "../LecturePlannerDialog"
import { teacherWeek } from "../../sectionSchedule"
import { TimetablePrintView } from "../TimetablePrintView"
import apiClient from "@/api/client"
import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { format12h } from "../../bellTiming/timeUtils"
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
  return render(<MemoryRouter><QueryClientProvider client={new QueryClient()}>{component}</QueryClientProvider></MemoryRouter>)
}

it("shows class teachers and lists their sections even without subject assignments in the wing", () => {
  const data = fixture()
  const staff = { id: "ct", name: "Zara Khan", first_name: "Zara", last_name: "Khan" }
  data.eligible_teachers.push(staff)
  for (const schoolClass of data.wings[0].classes) {
    Object.assign(schoolClass.sections[0], { class_teacher_id: staff.id, class_teacher_name: staff.name })
  }

  const classView = show(<ClassWiseGridView timetableData={data} />)
  expect(screen.getAllByTitle("Class Teacher: Zara Khan")).toHaveLength(2)
  classView.unmount()
  show(<TeacherWiseGridView timetableData={data} selectedWingId="w" />)
  const card = document.getElementById("teacher-card-ct")
  expect(within(card).getByText("Class teacher for")).toBeTruthy()
  expect(within(card).getByText("Primary A, Senior A")).toBeTruthy()
})

it("shows the section room once in Class-wise and each lesson's room in Teacher-wise", () => {
  const data = fixture()
  data.wings[0].classes[0].sections[0].room_number = "204"
  data.entries[0].room_number = "204"
  data.entries[1].room_number = "Lab-2"
  const page = show(<ClassWiseGridView timetableData={data} />)
  expect(screen.getAllByText("Room 204")).toHaveLength(1)
  const regular = document.querySelector('[data-slot-key="sec0_MONDAY_PrimaryMONDAY"]')
  const lab = document.querySelector('[data-slot-key="sec0_SATURDAY_PrimarySATURDAY"]')
  expect(within(regular).queryByText("Room 204")).toBeNull()
  expect(within(lab).getByText("Room Lab-2")).toBeTruthy()
  page.unmount()
  show(<TeacherWiseGridView timetableData={data} />)
  expect(screen.getByText("Room 204")).toBeTruthy()
  expect(screen.getByText("Room Lab-2")).toBeTruthy()
})

it("offers drag moves and direct position changes in their respective lists", async () => {
  const save = vi.spyOn(apiClient, "put").mockResolvedValue({ success: true })
  const wings = [{ id: "junior", name: "Junior" }, { id: "senior", name: "Senior" }]
  const classes = [{
    id: "grade", wing_id: "junior", name: "Grade 1",
    sections: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }],
  }]
  try {
    show(<StructureOrderDialog open onOpenChange={() => {}} wings={wings} classes={classes} />)
    const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn() }
    const target = screen.getByText("Junior").closest("li")
    fireEvent.dragStart(screen.getByTitle("Drag Senior"), { dataTransfer })
    fireEvent.dragOver(target, { dataTransfer })
    fireEvent.drop(target, { dataTransfer })
    await waitFor(() => expect(save).toHaveBeenCalledWith("/school/wings/reorder", { ids: ["senior", "junior"] }))
    await screen.findByText("Order saved")
    fireEvent.click(screen.getByRole("tab", { name: "Sections" }))
    fireEvent.change(screen.getByRole("combobox", { name: "Position of C" }), { target: { value: "1" } })
    await waitFor(() => expect(save).toHaveBeenLastCalledWith(
      "/school/classes/grade/sections/reorder", { ids: ["c", "a", "b"] },
    ))
  } finally {
    save.mockRestore()
  }
})

it("reports stable toolbar actions and renders the newly selected wing", () => {
  const data = fixture()
  data.wings = data.wings[0].classes.map(schoolClass => ({
    id: schoolClass.id,
    name: schoolClass.name,
    classes: [schoolClass],
  }))
  const queryClient = new QueryClient()
  const reportToolbar = vi.fn()
  const view = wingId => (
    <QueryClientProvider client={queryClient}>
      <ClassWiseGridView timetableData={data} selectedWingId={wingId} onAssignBarPropsChange={reportToolbar} />
    </QueryClientProvider>
  )

  const table = render(view("c0"))
  expect(document.getElementById("class-section-sec0")).toBeTruthy()
  expect(reportToolbar).toHaveBeenCalledTimes(1)
  table.rerender(view("c0"))
  expect(reportToolbar).toHaveBeenCalledTimes(1)

  table.rerender(view("c1"))
  expect(document.getElementById("class-section-sec0")).toBeNull()
  expect(document.getElementById("class-section-sec1")).toBeTruthy()
  expect(reportToolbar).toHaveBeenCalledTimes(2)
})

it("renders the same class, period and exact times in both tabs on Monday and Saturday", () => {
  const data = fixture()
  const table = show(<ClassWiseGridView timetableData={data} />)
  for (const e of data.entries) {
    const card = document.getElementById("class-section-" + e.section_id)
    expect(within(card).getByText(format12h(e.period.start_time))).toBeTruthy()
    expect(within(card).getByText(format12h(e.period.end_time))).toBeTruthy()
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

it("shares matching period boundaries and displays both times across a gap", () => {
  const data = fixture()
  data.setups[0].schedules[0].periods.push(
    { id: "P2", period_number: 2, period_type: "CLASS", label: "P2", start_time: "08:40:00", end_time: "09:10" },
    { id: "P3", period_number: 3, period_type: "CLASS", label: "P3", start_time: "09:20", end_time: "09:50" }
  )
  show(<ClassWiseGridView timetableData={data} />)

  const card = within(document.getElementById("class-section-sec0"))
  expect(card.getAllByText("8:40 AM")).toHaveLength(1)
  expect(card.getByText("9:10 AM")).toBeTruthy()
  expect(card.getByText("9:20 AM")).toBeTruthy()
  expect(card.getByText("9:50 AM")).toBeTruthy()
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

function electiveFixture() {
  const data = fixture()
  const other = {id:"t2", name:"Music Teacher", first_name:"Music", last_name:"Teacher"}
  data.eligible_teachers = [{...teacher,working_shifts:[{start_time:"08:00",end_time:"12:00"}]},other]
  const sections = data.wings[0].classes.map(c => c.sections[0])
  const opts = [
    {id:"math", subject_id:"Maths", teacher_id:"t", section_ids:sections.map(s => s.id), room_number:"201"},
    {id:"music", subject_id:"Music", teacher_id:"t2", section_ids:[sections[0].id], room_number:"202"},
  ]
  sections.forEach((s,i) => {
    s.subject_stats = opts.filter(r => r.section_ids.includes(s.id)).map(r => ({
      subject_id:r.subject_id,name:r.subject_id,teacher_id:r.teacher_id,parallel:true,is_academic:true,room_number:r.room_number,
    }))
    const monday = data.setups[i].schedules[0].periods[0]
    Object.assign(monday,{start_time:"08:45",end_time:"09:15",period_number:i+2})
  })
  data.entries = []
  data.timetable.version = 4
  data.lecture_plan = {groups:{g:{id:"g",name:"Morning electives",options:opts}},placements:{}}
  return {data,sections,opts}
}

it("edits a split subject room in Manage School and can restore inheritance", async () => {
  const child = {id:"ai", name:"AI", is_academic:true}
  const section = {id:"sec",name:"A",room_number:"204",subjects:[
    {id:"options",name:"Options",is_split:true,child_subjects:[child]},
  ],room_reviews:{ai:{name:"AI",labels:["B-12","Lab-1"]}}}
  const schoolClass = {id:"12",name:"Grade 12",sections:[section]}
  const put = vi.spyOn(apiClient,"put").mockResolvedValue({success:true})
  try {
    show(<SectionSubjectsDialog isOpen targetClass={schoolClass} targetSection={section} />)
    fireEvent.click(screen.getByRole("button", {name:"Edit room for Grade 12 A AI"}))
    let dialogHeading = await screen.findByRole("heading", {name: "Subject room"})
    let dialog = within(dialogHeading.closest("[role='dialog']"))
    fireEvent.click(dialog.getByRole("button",{name:"Lab-1"}))
    fireEvent.click(dialog.getByRole("button",{name:"Save room"}))
    await waitFor(() => expect(put).toHaveBeenCalledWith("/school/sections/sec/subjects/ai/room", {room_number:"Lab-1"}))
    await waitFor(() => expect(screen.queryByRole("heading", {name: "Subject room"})).toBeNull())
    fireEvent.click(screen.getByRole("button", {name:"Edit room for Grade 12 A AI"}))
    dialogHeading = await screen.findByRole("heading", {name: "Subject room"})
    dialog = within(dialogHeading.closest("[role='dialog']"))
    fireEvent.click(dialog.getByRole("button",{name:"Use section room"}))
    await waitFor(() => expect(put).toHaveBeenLastCalledWith("/school/sections/sec/subjects/ai/room", {room_number:null}))
    await waitFor(() => expect(screen.queryByRole("heading", {name: "Subject room"})).toBeNull())
    fireEvent.click(screen.getByRole("button", {name:"Edit room for Grade 12 A"}))
    dialogHeading = await screen.findByRole("heading", {name: "Section room"})
    dialog = within(dialogHeading.closest("[role='dialog']"))
    fireEvent.change(dialog.getByRole("textbox"),{target:{value:" 205 "}})
    fireEvent.click(dialog.getByRole("button",{name:"Save room"}))
    await waitFor(() => expect(put).toHaveBeenLastCalledWith("/school/sections/sec/room", {room_number:"205"}))
  } finally { put.mockRestore() }
})

it("keeps inherited rooms and parallel settings visible when a split activity changes category", async () => {
  const section = {id:"a", name:"A", room_number:"Sports Hall", subjects:[
    {id:"sports", name:"Sports", category:"academic", is_split:true, child_subjects:[{id:"yoga",name:"Yoga"}]},
  ]}
  show(<SectionSubjectsDialog isOpen targetClass={{id:"12",name:"Grade 12"}} targetSection={section}/>)
  const editor = () => screen.getByRole("button",{name:"Edit room for Grade 12 A Yoga"})
  expect(editor().textContent).toBe("Sports Hall")
  fireEvent.click(screen.getByTitle("Move to Non-Academic"))
  expect(editor().textContent).toBe("Sports Hall")
  expect(screen.getByRole("checkbox",{name:"Yoga can run alongside other subjects"})).toBeTruthy()
  fireEvent.click(editor())
  expect(await screen.findByRole("heading",{name:"Subject room"})).toBeTruthy()
})

it("prints each section's options and counts a combined lesson once in the teacher's week", () => {
  const {data, sections, opts} = electiveFixture()
  const entries = opts.flatMap(o => o.section_ids.map(id => {
    const i = sections.findIndex(s => s.id === id)
    const period = data.setups[i].schedules[0].periods[0]
    return {id:o.id + id, placement_id:"group", option_id:o.id, day_of_week:"MONDAY", period_id:period.id, period,
      teacher:data.eligible_teachers.find(t => t.id === o.teacher_id), section:sections[i], section_id:id,
      subject:{name:o.subject_id}, room_number:o.room_number}
  }))
  const props = {allSections:sections, selectedSections:sections, selectedTeachers:[data.eligible_teachers[0]],
    setups:data.setups, entries, placements:{group:{expected:opts}}, includeHeader:false}
  const page = render(<TimetablePrintView {...props}/>)
  const [first,second,faculty] = screen.getAllByRole("article").map(node => within(node))
  expect(first.getByText("Maths")).toBeTruthy()
  expect(first.getByText("Music")).toBeTruthy()
  expect(first.getByText("Room 202")).toBeTruthy()
  expect(second.queryByText("Music")).toBeNull()
  expect(faculty.getByText(/Assigned 1 · 30m teaching/)).toBeTruthy()
  expect(faculty.getAllByText("Maths")).toHaveLength(1)
  expect(faculty.getByText(/Primary.*A.*[+] Senior.*A/)).toBeTruthy()
  expect(faculty.getByText(/F1 · 4h 0m free/)).toBeTruthy()
  page.rerender(<TimetablePrintView {...props} entries={entries.filter(e => e.option_id !== "music")}/>)
  expect(first.getByText("1 of 2 options scheduled")).toBeTruthy()
  expect(faculty.getByText("1 of 2 options scheduled")).toBeTruthy()
  expect(second.queryByText("1 of 2 options scheduled")).toBeNull()
  page.rerender(<TimetablePrintView {...props} entries={entries.map(e => e.section_id === sections[1].id ? {...e, room_number:"B-12"} : e)} />)
  expect(faculty.getByText(/Primary.*201.*Senior.*B-12/)).toBeTruthy()
  expect(faculty.getAllByText("Maths")).toHaveLength(1)
  page.rerender(<TimetablePrintView {...props} entries={entries.map(e => ({...e, teacher:data.eligible_teachers[0]}))}/>)
  expect(faculty.getByText(/Assigned 1 · 30m teaching/)).toBeTruthy()
  expect(faculty.getByText("Maths / Music")).toBeTruthy()
  expect(faculty.getByText(/Senior.*Maths.*Primary.*Music/)).toBeTruthy()
})

it.each(["Classwise","Teacherwise"])("places the same elective group through the %s Assign control", async view => {
  const {data,sections} = electiveFixture()
  sections[0].subject_stats.push({subject_id:"Art",name:"Art",is_academic:false})
  const post = vi.spyOn(apiClient,"post").mockResolvedValue({success:true})
  try {
    if (view === "Classwise") {
      show(<ClassWiseGridView timetableData={data} isAssignMode />)
      const cell = document.querySelector('[data-slot-key="sec0_MONDAY_PrimaryMONDAY"]')
      fireEvent.click(within(cell).getByText("Assign"))
    } else {
      show(<TeacherWiseGridView timetableData={data} isAssignMode />)
      fireEvent.click(screen.getAllByText("Assign")[0])
    }
    const dialog = await screen.findByRole("dialog")
    const picker = within(dialog)
    if (view === "Classwise") {
      expect(picker.queryByRole("link", {name:"Manage School"})).toBeNull()
      fireEvent.click(picker.getByText("Art"))
      expect(picker.getByRole("button", {name:"Assign Slot"}).disabled).toBe(false)
      expect(picker.getByRole("checkbox", {name:"MONDAY"}).checked).toBe(true)
      expect(picker.getByRole("checkbox", {name:"TUESDAY"}).disabled).toBe(true)
    }
    if (view === "Classwise") {
      expect(picker.getByRole("link", {name:"Manage School"}).getAttribute("href")).toContain("sectionId=sec0&subjectId=Art")
    } else {
      expect(picker.getByText("Assigned subjects")).toBeTruthy()
      expect(picker.getByText("Maths")).toBeTruthy()
      expect(picker.queryByText("Art")).toBeNull()
      expect(picker.queryByText("Music")).toBeNull()
      expect(picker.getAllByText("Sam Roy")).toHaveLength(1)
    }
    expect(picker.queryByRole("textbox", {name:/search/i})).toBeNull()
    expect(picker.queryByText("Create group")).toBeNull()
    fireEvent.click(picker.getByRole("tab",{name:"Group"}))
    expect(picker.queryByRole("button",{name:"Assign Slot"})).toBeNull()
    fireEvent.click(picker.getByText("Morning electives"))
    if (view === "Classwise") {
      expect(picker.getByRole("columnheader",{name:/Primary.*P2/})).toBeTruthy()
      expect(picker.getByRole("columnheader",{name:/Senior.*P3/})).toBeTruthy()
    } else expect(picker.getByText(/Primary.*P2.*Senior.*P3/)).toBeTruthy()
    expect(picker.getByText("201")).toBeTruthy()
    fireEvent.click(picker.getByRole("button",{name:"Assign group"}))
    await waitFor(() => expect(post).toHaveBeenCalledWith("/timetable/timetables/tt/placements",expect.objectContaining({
      group_id:"g",version:4,days:[expect.objectContaining({day:"MONDAY",start:"08:45",end:"09:15",
        options:expect.arrayContaining([expect.objectContaining({section_ids:sections.map(s=>s.id)})])})],
    })))
  } finally {post.mockRestore()}
})

it.each([false,true])("restores one missing section membership from its empty cell (outside booking: %s)", async blocked => {
  const {data,sections,opts} = electiveFixture()
  data.lecture_plan.placements.place = {group_id:"g",expected:opts,day:"MONDAY"}
  const period = data.setups[1].schedules[0].periods[0]
  const survivor = {id:"entry", placement_id:"place", option_id:"math", teacher,
    section:sections[1], section_id:sections[1].id, period, period_id:period.id,
    day_of_week:"MONDAY", subject:{id:"Maths",name:"Maths"}}
  data.entries = [survivor]
  if (blocked) data.entries.push({...survivor,id:"outside",placement_id:null,section_id:"elsewhere"})
  const post = vi.spyOn(apiClient,"post").mockResolvedValue({success:true})
  try {
    show(<ClassWiseGridView timetableData={data} isAssignMode />)
    const cell = document.querySelector('[data-slot-key="sec0_MONDAY_PrimaryMONDAY"]')
    fireEvent.click(within(cell).getByText("Assign"))
    const dialog = within(await screen.findByRole("dialog"))
    const restore = dialog.getByRole("button",{name:/Restore Maths/})
    expect(restore.disabled).toBe(blocked)
    fireEvent.click(restore)
    if (blocked) expect(post).not.toHaveBeenCalled()
    else await waitFor(() => expect(post).toHaveBeenCalledWith("/timetable/timetables/tt/placements", {
      version:4, group_id:"g", days:[{day:"MONDAY", start:"08:45", end:"09:15", placement_id:"place",
        options:[{id:"math",subject_id:"Maths",teacher_id:"t",section_ids:[sections[1].id,sections[0].id]}]}],
    }))
  } finally {post.mockRestore()}
})

it("finds subject groups by teacher, edits their lessons and confirms deletion", async () => {
  const {data} = electiveFixture()
  const remove = vi.spyOn(apiClient,"delete").mockResolvedValue({success:true})
  try {
    show(<LecturePlannerDialog data={data} onClose={() => {}} />)
    fireEvent.change(screen.getByRole("textbox",{name:"Search subject groups"}),{target:{value:"Sam Roy"}})
    fireEvent.click(screen.getByRole("button",{name:"Edit Morning electives"}))
    expect(screen.getByLabelText("Group name").value).toBe("Morning electives")
    fireEvent.click(screen.getByRole("button",{name:"Back"}))
    fireEvent.click(screen.getByRole("button",{name:"Delete Morning electives"}))
    fireEvent.click(screen.getByRole("button",{name:"Cancel"}))
    expect(remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button",{name:"Delete Morning electives"}))
    fireEvent.click(screen.getByRole("button",{name:"Delete group"}))
    await waitFor(() => expect(remove).toHaveBeenCalledWith("/timetable/timetables/tt/lecture-groups/g",{params:{version:4}}))
  } finally { remove.mockRestore() }
})

it("counts a shared lesson once for its teacher and shows a section-specific missing option", () => {
  const {data,sections,opts} = electiveFixture()
  data.lecture_plan.placements.place = {group_id:"g",expected:opts,day:"MONDAY"}
  data.entries = sections.map((sec,i) => {
    const p = data.setups[i].schedules[0].periods[0]
    return {id:"entry"+i,placement_id:"place",option_id:"math",teacher,section:sec,section_id:sec.id,
      period:p,period_id:p.id,day_of_week:"MONDAY",subject:{id:"Maths",name:"Maths"},room_number:"201"}
  })
  const table = show(<ClassWiseGridView timetableData={data} isAssignMode />)
  expect(screen.getAllByText("1 of 2 options scheduled")).toHaveLength(1)
  fireEvent.click(screen.getByText("1 of 2 options scheduled"))
  expect(within(screen.getByRole("dialog")).getByText(/Restore Music/)).toBeTruthy()
  table.unmount()
  show(<TeacherWiseGridView timetableData={data} isAssignMode />)
  expect(screen.getByText(/Primary.*A.*[+] Senior.*A/)).toBeTruthy()
  expect(screen.queryByText("Time clash")).toBeNull()
  expect(screen.getByText("30m teaching")).toBeTruthy()
})

it("shows overlapping bells together and disables the option that runs into a booking", () => {
  const {data} = electiveFixture()
  const monday = data.setups[1].schedules[0].periods[0]
  Object.assign(monday,{start_time:"08:50",end_time:"09:30"})
  const bookedPeriod = {...monday,id:"next",start_time:"09:20",end_time:"10:00"}
  data.entries.push({id:"booked",period:bookedPeriod,period_id:"next",section_id:"sec0",
    subject:{id:"Maths",name:"Maths"},teacher,day_of_week:"MONDAY"})
  show(<LecturePlannerDialog data={data} cell={{teacher,day:"MONDAY",at:"09:00"}} />)
  expect(screen.getByRole("heading",{name:"08:45–09:15"})).toBeTruthy()
  const later = screen.getByRole("heading",{name:"08:50–09:30"}).closest("section")
  expect(within(later).getByRole("button",{name:/Maths only/}).disabled).toBe(true)
  expect(within(later).getByText(/has Maths at 09:20/)).toBeTruthy()
})

it("numbers continuous free stretches independently each day inside the teacher's shifts", () => {
  const data = fixture()
  const allocations = data.wings[0].classes.map(c => ({section:c.sections[0]}))
  const shifts = [{start_time:"07:30",end_time:"10:30"}]
  const week = teacherWeek(allocations,data.entries,data.setups,shifts)
  expect(week.days.find(d => d.day === "MONDAY").free).toEqual([[450,480],[560,630]])
  expect(week.days.find(d => d.day === "SATURDAY").free).toEqual([[450,540],[570,600],[620,630]])
})

it("assigns from Classwise, removes Music from Teacherwise and restores it from Classwise", async () => {
  const {data,sections} = electiveFixture()
  const client = new QueryClient({defaultOptions:{queries:{retry:false}}})
  const queryKey = ["timetable","class-wise","tt","all"]
  let server = data
  const post = vi.spyOn(apiClient,"post").mockImplementation(async (_,payload) => {
    const {options} = payload.days[0]
    const entries = options.flatMap(row => row.section_ids.map(sid => {
      const i = sections.findIndex(s => s.id === sid)
      const period = data.setups[i].schedules[0].periods[0]
      return {id:row.id+sid,placement_id:"place",option_id:row.id,subject:{id:row.subject_id,name:row.subject_id},
        teacher:data.eligible_teachers.find(t => t.id === row.teacher_id),section:sections[i],section_id:sid,
        day_of_week:"MONDAY",period,period_id:period.id,room_number:sections[i].subject_stats.find(s => s.subject_id === row.subject_id)?.room_number}
    }))
    server = {...server,timetable:{...server.timetable,version:server.timetable.version+1},entries,
      lecture_plan:{...data.lecture_plan,placements:{place:{day:"MONDAY",group_id:"g",expected:data.lecture_plan.groups.g.options}}}}
    return {success:true}
  })
  function View({teacherView}) {
    const result = useQuery({queryKey,queryFn:async () => server,initialData:data,staleTime:Infinity})
    const Grid = teacherView ? TeacherWiseGridView : ClassWiseGridView
    return <Grid timetableData={result.data} isAssignMode />
  }
  const board = teacherView => <MemoryRouter><QueryClientProvider client={client}><View teacherView={teacherView}/></QueryClientProvider></MemoryRouter>
  try {
    const page = render(board(false))
    fireEvent.click(within(document.querySelector('[data-slot-key="sec0_MONDAY_PrimaryMONDAY"]')).getByText("Assign"))
    let dialog = within(await screen.findByRole("dialog"))
    expect(dialog.getByRole("button", { name: "Assign Slot" })).toBeTruthy()
    fireEvent.click(dialog.getByRole("tab",{name:"Group"}))
    expect(dialog.getByRole("button", { name: "Create group" })).toBeTruthy()
    fireEvent.click(dialog.getByText("Morning electives"))
    fireEvent.click(dialog.getByRole("button",{name:"Assign group"}))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    page.rerender(board(true))
    const music = screen.getAllByTitle("Unassign slot").find(button => button.parentElement.textContent.includes("Music"))
    fireEvent.click(music)
    dialog = within(await screen.findByRole("dialog"))
    fireEvent.click(dialog.getByRole("button",{name:"Confirm removal"}))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    page.rerender(board(false))
    fireEvent.click(await screen.findByText("1 of 2 options scheduled"))
    dialog = within(await screen.findByRole("dialog"))
    fireEvent.click(dialog.getByRole("button",{name:/Restore Music/}))
    fireEvent.click(dialog.getByRole("button",{name:"Save weekdays"}))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.queryByText("1 of 2 options scheduled")).toBeNull()
    expect(server.entries).toHaveLength(3)
    expect(post).toHaveBeenCalledTimes(3)
  } finally {post.mockRestore();client.clear()}
})
