import { Fragment } from "react"
import { Button } from "@/components/ui/button"
import { isTeachingSlot } from "../sectionSchedule"
import { formatClassSection } from "../timetableUtils"
import { TeacherWiseCell } from "./TeacherWiseCell"

export function TeacherSchedule({ week, teacher, edit, density, zoom, open, remove }) {
  const rows = []
  for (const day of week.days) {
    const last = rows.at(-1)
    if (day.periods && last?.periods === day.periods) last.days.push(day)
    else rows.push({ periods: day.periods, days: [day] })
  }
  return <div className="overflow-x-auto" style={{ zoom: zoom / 100 }}>
    {week.review.map(e => <div className="flex items-center gap-3 border-b p-2 text-sm" key={e.id}>
      Review {e.day_of_week.toLowerCase()} · {formatClassSection(e.section)} · {e.subject?.name} · Period outside the class schedule
      {edit && <Button size="xs" variant="outline" onPress={() => remove(e.id, e.section_id)}>Remove lesson</Button>}
    </div>)}
    {!rows.length && !week.review.length && <p className="p-3 text-sm text-muted-foreground">No class bell schedule assigned.</p>}
    {rows.map(({ periods, days }) => periods ? (
      <div key={days[0].day} className="grid border-b" style={{ gridTemplateColumns: "4rem repeat(" + periods.length + ", minmax(7rem, 1fr))" }}>
        <div className="bg-muted/50 p-2 text-xs">Day</div>
        {periods.map(p => <div key={p.id} className="border-l bg-muted/50 p-1 text-center text-xs">
          <strong>{p.label || "P" + p.period_number}</strong><div>{p.start_time}–{p.end_time}</div>
        </div>)}
        {days.map(({ day, lessons }) => <Fragment key={day}>
          <strong className="border-t p-2 text-xs">{day.slice(0, 3)}</strong>
          {periods.map(p => {
            const slot = lessons.filter(e => String(e.period_id) === String(p.id))
            const activate = () => open(day, p, slot[0])
            return <div key={p.id} className="min-w-0 border-l border-t">
              {slot.some(e => week.conflicts.has(e.id)) && <strong className="px-1 text-xs text-destructive">Time clash</strong>}
              <TeacherWiseCell teacher={teacher} day={day} period={p} slotEntries={slot} density={density}
                isAssignMode={edit && isTeachingSlot(p)} onClick={activate} onDoubleClick={activate} onAssignClick={activate}
                onQuickUnassign={e => remove(e.id, e.section_id)} />
            </div>
          })}
        </Fragment>)}
      </div>
    ) : days.map(({ day, lessons }) => <section key={day} className="border-b p-2">
      <div className="flex items-center justify-between"><strong className="text-xs">{day}</strong>
        {edit && <Button size="xs" variant="outline" onPress={() => open(day, null, null)}>Add lesson</Button>}
      </div>
      {!lessons.length && <p className="text-xs text-muted-foreground">No lessons scheduled</p>}
      {lessons.map(e => <div key={e.id} className="flex flex-wrap items-center gap-x-3 border-t py-1 text-sm">
        <span className="font-mono">{e.period.start_time}–{e.period.end_time}</span>
        <strong>{formatClassSection(e.section)}</strong><span>{e.subject?.name} · {e.period.label || "P" + e.period.period_number}</span>
        {week.conflicts.has(e.id) && <strong className="text-destructive">Time clash</strong>}
        {edit && <Button size="xs" variant="ghost" onPress={() => open(day, e.period, e)}>Edit</Button>}
      </div>)}
    </section>))}
  </div>
}
