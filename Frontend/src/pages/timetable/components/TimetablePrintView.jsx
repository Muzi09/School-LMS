import { forwardRef, useMemo } from "react"
import { lessonRoomLabel } from "../rooms"
import { cn } from "@/lib/utils"
import { clock, duration, interval, minutes } from "../lessonTime"
import { isTeachingSlot, lessonPeriod, scheduleGroups, setupForSection, teacherWeek } from "../sectionSchedule"
import { getSubjectTheme } from "../subjectTheme"
import { formatClassSection } from "../timetableUtils"

function indexBy(items, keyFor) {
  const result = new Map()
  for (const item of items) {
    const key = keyFor(item)
    if (!result.has(key)) result.set(key, [])
    result.get(key).push(item)
  }
  return result
}

function Lesson({ entry, teacherView, color }) {
  const subject = entry.subjectLabel || entry.subject?.name || "Subject"
  const detail = teacherView ? entry.sectionLabel : entry.teacher?.name || "Unassigned teacher"
  return <div className={cn("px-1 py-1 leading-tight", color && getSubjectTheme(subject).cellBg)}>
    <strong>{subject}</strong>
    <div>{detail}</div>
    <div>{lessonRoomLabel(entry)}</div>
    {teacherView && entry.coverage && <small>{entry.coverage}</small>}
  </div>
}

function PeriodGrid({ periods, days, entriesAt, teacherView, color, placements, sectionId }) {
  return <table className="mb-2 w-full table-fixed border-collapse text-center text-[10px]">
    <thead><tr className="bg-slate-100">
      <th scope="col" className="w-12 border p-1">Day</th>
      {periods.map(p => <th key={p.id} scope="col" className="border p-1">
        {p.label || "P" + p.period_number}<div className="font-normal">{interval(p)}</div>
      </th>)}
    </tr></thead>
    <tbody>{days.map(day => <tr key={day} className="break-inside-avoid">
      <th scope="row" className="border bg-slate-50">{day.slice(0,3)}</th>
      {periods.map(p => {
        const lessons = entriesAt(day,p)
        const expected = placements?.[lessons[0]?.placement_id]?.expected?.filter(r => r.section_ids.includes(sectionId)).length
        return <td key={p.id} className="border align-middle">
          {lessons.length ? lessons.map(e => <Lesson key={e.id} entry={e} teacherView={teacherView} color={color} />) :
            !isTeachingSlot(p) ? p.label || "Break" : teacherView ? "Free" : "—"}
          {lessons.length < expected && <small>{lessons.length} of {expected} options scheduled</small>}
        </td>
      })}
    </tr>)}</tbody>
  </table>
}

function ReviewLessons({ entries }) {
  if (!entries.length) return null
  return <div className="mt-2 border-t p-2 text-xs"><strong>Review · Outside the current bell schedule</strong>
    {entries.map(e => <div key={e.id}>{e.day_of_week} · {e.period && interval(e.period)} · {formatClassSection(e.section)} · {e.subject?.name}{e.room_number && " · Room " + e.room_number}</div>)}
  </div>
}

function ClassSchedule({ section, setups, entries, color, placements }) {
  const groups = scheduleGroups(setupForSection(section,setups))
  const slots = indexBy(entries,e => e.day_of_week + "/" + e.period_id)
  return <>
    {groups.map(g => <PeriodGrid key={g.id} periods={g.periods} days={g.days} color={color} placements={placements}
      sectionId={section.id} entriesAt={(day,p) => slots.get(day + "/" + p.id) || []} />)}
    {!groups.length && <p className="p-2 text-xs">No bell schedule assigned.</p>}
    <ReviewLessons entries={entries.filter(e => !lessonPeriod(e,groups))} />
  </>
}

function TeacherSchedulePrint({ teacher, sections, entries, setups, color }) {
  const allocations = new Map(sections.map(section => [section.id,{ section }]))
  for (const e of entries) if (e.section && !allocations.has(e.section_id)) allocations.set(e.section_id,{section:e.section})
  const week = teacherWeek([...allocations.values()], entries, setups, teacher.working_shifts)
  const blocks = []
  for (const day of week.days) {
    const last = blocks.at(-1)
    if (day.periods && last?.periods === day.periods) last.days.push(day)
    else blocks.push({periods:day.periods,days:[day]})
  }
  return <>
    <p className="px-2 py-1 text-xs">Assigned {week.count} · {duration(week.minutes)} teaching
      {week.hours.length > 0 && " · " + duration(week.days.flatMap(d => d.free).reduce((n,[a,b]) => n+b-a,0)) + " free"}</p>
    {blocks.map(({periods, days}) => {
      if (periods) {
        const slots = indexBy(days.flatMap(d => d.lessons),e => e.day_of_week + "/" + interval(e.period))
        return <PeriodGrid key={days[0].day} teacherView periods={periods} days={days.map(d => d.day)}
          entriesAt={(day,p) => slots.get(day + "/" + interval(p)) || []} color={color}/>
      }
      const day = days[0]
      const items = [
        ...day.lessons.map(e => ({key:e.id,start:e.period.start_time,range:interval(e.period),label:e.periodLabels + " · " + duration(minutes(e.period.end_time) - minutes(e.period.start_time)),entry:e})),
        ...day.free.map(([a,b],i) => ({key:"F" + i,start:clock(a),range:clock(a) + "–" + clock(b),label:"F" + (i+1) + " · " + duration(b-a) + " free"})),
      ].sort((a,b) => a.start.localeCompare(b.start))
      return <section key={day.day} className="border-t p-2 text-[10px]">
        <strong>{day.day} · {duration(day.teachingMinutes)} teaching</strong>
        {!week.hours.length && <span> · Working hours unavailable</span>}
        <div className="mt-1 flex flex-wrap gap-1">{items.map(item => <div key={item.key} className="break-inside-avoid border p-1">
          <div>{item.range} · {item.label}</div>
          {item.entry && <Lesson entry={item.entry} color={color} teacherView />}
        </div>)}</div>
      </section>
    })}
    {!blocks.length && <p className="p-2 text-xs">No class bell schedule assigned.</p>}
    <ReviewLessons entries={week.review}/>
  </>
}

export const TimetablePrintView = forwardRef(function TimetablePrintView({
  schoolName, timetableTitle, academicYear, printScope = "both", selectedSections = [], selectedTeachers = [],
  allSections = selectedSections, setups = [], entries = [], placements, pageBreak = "always", colorMode = "color", includeHeader = true,
}, ref) {
  const sections = useMemo(() => indexBy(entries,e => e.section_id),[entries])
  const teachers = useMemo(() => {
    const options = new Map()
    for (const e of entries) {
      if (!e.placement_id) continue
      if (!options.has(e.placement_id)) options.set(e.placement_id, new Set())
      options.get(e.placement_id).add(e.option_id)
    }
    const lessons = entries.map(e => {
      const count = options.get(e.placement_id)?.size
      const expected = placements?.[e.placement_id]?.expected?.length
      return count < expected ? { ...e, coverage: count + " of " + expected + " options scheduled" } : e
    })
    return indexBy(lessons, e => e.teacher?.id || e.teacher_user_id)
  }, [entries, placements])
  const teacherSections = useMemo(() => {
    const pairs = allSections.flatMap(section => [...new Set((section.subject_stats || []).map(s => s.teacher_id || s.teacher?.id).filter(Boolean))]
      .map(id => ({id,section})))
    return indexBy(pairs,pair => pair.id)
  },[allSections])
  const color = colorMode === "color"
  const card = (key,title,body) => <article key={key} className={cn("mb-4 bg-white text-slate-900",pageBreak === "always" ? "break-after-page" : "break-inside-avoid")}>
    {includeHeader && <div className="bg-slate-900 px-3 py-1.5 text-xs font-medium text-white">{[schoolName,timetableTitle,academicYear].filter(Boolean).join(" · ")}</div>}
    <h2 className="border border-slate-300 px-2 py-1 text-sm font-bold">{title}</h2>
    {body}
  </article>
  return <div ref={ref}>
    {printScope !== "teacherwise" && selectedSections.map(section => card("s"+section.id,formatClassSection(section),
      <ClassSchedule section={section} setups={setups} entries={sections.get(section.id) || []} color={color} placements={placements}/>))}
    {printScope !== "classwise" && selectedTeachers.map(t => card("t"+t.id,t.name || [t.first_name,t.last_name].filter(Boolean).join(" ") || t.email,
      <TeacherSchedulePrint teacher={t} setups={setups} sections={(teacherSections.get(t.id) || []).map(p => p.section)} entries={teachers.get(t.id) || []} color={color}/>))}
    {!selectedSections.length && !selectedTeachers.length && <p>No classes or teachers selected to print.</p>}
  </div>
})
