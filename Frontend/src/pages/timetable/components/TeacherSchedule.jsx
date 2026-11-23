import { MixedTeacherWeek } from "./MixedTeacherDay"
import { interval } from "../lessonTime"
import { Fragment } from "react"
import { Button } from "@/components/ui/button"
import { isTeachingSlot } from "../sectionSchedule"
import { formatClassSection } from "../timetableUtils"
import { TeacherWiseCell } from "./TeacherWiseCell"

export function TeacherSchedule({ week, teacher, edit, density, zoom, open, remove }) {
  const hasMixedBells = week.days.some(day => !day.periods)
  const rows = []
  for (const day of hasMixedBells ? [] : week.days) {
    const last = rows.at(-1)
    if (day.periods && last?.periods === day.periods) last.days.push(day)
    else rows.push({ periods: day.periods, days: [day] })
  }
  return <div className="overflow-x-auto" style={{ zoom: zoom / 100 }}>
    {week.review.map(e => <div className="flex items-center gap-3 border-b p-2 text-sm" key={e.id}>
      Review {e.day_of_week.toLowerCase()} · {formatClassSection(e.section)} · {e.subject?.name} · Period outside the class schedule
      {edit && <Button size="xs" variant="outline" onPress={() => remove(e.id, e.section_id)}>Remove lesson</Button>}
    </div>)}
    {!week.days.length && !week.review.length && <p className="p-3 text-sm text-muted-foreground">No class bell schedule assigned.</p>}
    {hasMixedBells && <MixedTeacherWeek days={week.days} edit={edit} density={density}
      knownHours={Boolean(week.hours.length)} conflicts={week.conflicts} open={open} remove={remove} />}
    {rows.map(({ periods, days }) => periods ? (
      <div key={days[0].day} className="grid border-b" style={{ gridTemplateColumns: "4rem repeat(" + periods.length + ", minmax(7rem, 1fr))" }}>
        <div className="bg-muted/50 p-2 text-xs">Day</div>
        {periods.map(p => <div key={p.id} className="border-l bg-muted/50 p-1 text-center text-xs">
          <strong>{p.label || "P" + p.period_number}</strong><div>{p.start_time}–{p.end_time}</div>
        </div>)}
        {days.map(({ day, lessons, bells }) => <Fragment key={day}>
          <strong className="border-t p-2 text-xs">{day.slice(0, 3)}</strong>
          {periods.map(p => {
            const slot = lessons.filter(e => interval(e.period) === interval(p))
            const actualPeriod = bells.find(candidate => interval(candidate) === interval(p)) || p
            const activate = () => open(day, slot[0]?.period || actualPeriod, slot[0])
            return <div key={p.id} className="min-w-0 border-l border-t">
              {slot.some(e => week.conflicts.has(e.id)) && <strong className="px-1 text-xs text-destructive">Time clash</strong>}
              <TeacherWiseCell teacher={teacher} day={day} period={p} slotEntries={slot} density={density}
                isAssignMode={edit && isTeachingSlot(p)} onClick={activate} onDoubleClick={activate} onAssignClick={activate}
                onQuickUnassign={e => remove(e.id, e.section_id)} />
            </div>
          })}
        </Fragment>)}
      </div>
    ) : null)}
  </div>
}
