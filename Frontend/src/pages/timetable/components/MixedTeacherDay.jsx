import { lessonRoomLabel } from "../rooms"
import { clock, duration, minutes } from "../lessonTime"
import { isTeachingSlot } from "../sectionSchedule"
import { formatClassSection } from "../timetableUtils"
import { getSubjectTheme } from "../subjectTheme"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const PIXELS_PER_MINUTE = 3

function mergeIntervals(intervals) {
  const result = []
  for (const [start, end] of intervals.sort((a, b) => a[0] - b[0])) {
    const last = result.at(-1)
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else result.push([start, end])
  }
  return result
}

function availableIntervals(day, knownHours) {
  if (knownHours) return day.free
  const teaching = mergeIntervals(day.bells.filter(isTeachingSlot).map(period => [minutes(period.start_time), minutes(period.end_time)]))
  const occupied = mergeIntervals(day.lessons.map(entry => [minutes(entry.period.start_time), minutes(entry.period.end_time)]))
  return teaching.flatMap(([start, end]) => {
    const free = []
    let cursor = start
    for (const [bookedStart, bookedEnd] of occupied) {
      if (bookedEnd <= cursor || bookedStart >= end) continue
      if (bookedStart > cursor) free.push([cursor, Math.min(bookedStart, end)])
      cursor = Math.max(cursor, bookedEnd)
      if (cursor >= end) break
    }
    if (cursor < end) free.push([cursor, end])
    return free
  })
}

function lessonLanes(lessons) {
  const lanes = []
  return lessons.map(entry => {
    const start = minutes(entry.period.start_time)
    const end = minutes(entry.period.end_time)
    let lane = lanes.findIndex(lastEnd => lastEnd <= start)
    if (lane < 0) lane = lanes.length
    lanes[lane] = end
    return { entry, start, end, lane }
  })
}

export function MixedTeacherWeek({ days, edit, open, remove, knownHours, conflicts, density }) {
  const rows = days.map(day => ({
    ...day,
    available: availableIntervals(day, knownHours),
    lessons: lessonLanes(day.lessons),
  }))
  const allTimes = rows.flatMap(day => [
    ...day.bells.flatMap(period => [minutes(period.start_time), minutes(period.end_time)]),
    ...day.available.flat(),
    ...day.lessons.flatMap(({ start, end }) => [start, end]),
  ])
  if (!allTimes.length) return null

  const start = Math.floor(Math.min(...allTimes) / 30) * 30
  const end = Math.ceil(Math.max(...allTimes) / 30) * 30
  const width = Math.max(1, end - start) * PIXELS_PER_MINUTE
  const ticks = []
  for (let time = start; time <= end; time += 30) ticks.push(time)
  const position = time => ((time - start) / (end - start)) * 100 + "%"
  const span = (from, to) => ({ left: position(from), width: ((to - from) / (end - start)) * 100 + "%" })

  return <div className="overflow-x-auto" aria-label="Teacher weekly schedule by clock time">
    <div style={{ minWidth: width + 64 }}>
      <div className="grid grid-cols-[4rem_1fr] border-b bg-muted/50 text-xs text-muted-foreground">
        <div className="p-2 font-semibold">Day</div>
        <div className="relative h-10 border-l" aria-label="Time of day">
          {ticks.map(time => <span key={time} className="absolute top-1 -translate-x-1/2 whitespace-nowrap font-medium first:translate-x-0 last:-translate-x-full"
            style={{ left: position(time) }}>{clock(time)}</span>)}
        </div>
      </div>
      {rows.map(day => {
        const laneCount = Math.max(1, ...day.lessons.map(item => item.lane + 1))
        const laneHeight = density === "compact" ? 76 : 84
        return <section key={day.day} className="grid grid-cols-[4rem_1fr] border-b last:border-b-0" aria-label={`${day.day} schedule`}>
          <div className="flex flex-col gap-1 border-r bg-muted/20 p-2 text-xs">
            <strong className="text-foreground"><span aria-hidden="true">{day.day.slice(0, 3)}</span><span className="sr-only">{day.day}</span></strong>
            <span className="text-muted-foreground">{day.lessons.length} assigned</span>
            {edit && <Button size="xs" variant="outline" onPress={() => open(day.day, null, null)}>Assign</Button>}
          </div>
          <div className="relative" style={{ height: laneCount * laneHeight }}>
            {ticks.slice(0, -1).map(time => <span key={time} className="pointer-events-none absolute inset-y-0 border-l border-border/45" style={{ left: position(time) }} />)}
            {day.available.map(([from, to], index) => {
              const fitsPeriod = day.bells.some(period => isTeachingSlot(period) &&
                minutes(period.start_time) >= from && minutes(period.end_time) <= to)
              if (!knownHours && !fitsPeriod) return null
              return <button key={`${from}-${to}`} type="button" disabled={!edit || !fitsPeriod}
                className={cn("absolute top-1 flex h-12 min-w-0 flex-col items-center justify-center overflow-hidden rounded-md border border-dashed border-border/80 bg-muted/35 px-1 text-xs text-muted-foreground",
                  edit && fitsPeriod && "cursor-pointer hover:border-primary hover:bg-primary/10 hover:text-primary")}
                style={span(from, to)}
                title={`${clock(from)}–${clock(to)} · ${duration(to - from)} ${knownHours ? "free" : "open bell time"}`}
                aria-label={`${day.day} ${clock(from)} to ${clock(to)}, ${knownHours ? "free" : "open bell time"}${fitsPeriod && edit ? ", assign lesson" : ""}`}
                onClick={event => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  const ratio = rect.width ? Math.min(0.999, Math.max(0, (event.clientX - rect.left) / rect.width)) : 0.5
                  open(day.day, null, null, clock(from + Math.floor(ratio * (to - from))), [clock(from), clock(to)])
                }}>
                <strong className="truncate">{knownHours ? `F${index + 1} · Free` : "Open"}</strong>
                <span className="truncate text-[10px]">{clock(from)}–{clock(to)}</span>
              </button>
            })}
            {day.lessons.map(({ entry, start: from, end: to, lane }) => {
              const subject = entry.subjectLabel || entry.subject?.name || "Subject"
              const section = entry.sectionLabel || formatClassSection(entry.section)
              const room = lessonRoomLabel(entry)
              const theme = getSubjectTheme(subject)
              const clash = conflicts.has(entry.id)
              return <div key={entry.id} className={cn("group absolute flex min-w-0 flex-col overflow-hidden rounded-md border bg-card px-2 py-1 text-xs",
                theme.cellBg, clash ? "border-destructive bg-destructive/10" : "border-border/80",
                edit && "cursor-pointer hover:ring-1 hover:ring-primary")}
                style={{ ...span(from, to), top: lane * laneHeight + 3, height: laneHeight - 6 }}
                title={[clock(from) + "–" + clock(to), section, subject, room, clash && "Time clash"].filter(Boolean).join(" · ")}
                role={edit ? "button" : undefined} tabIndex={edit ? 0 : undefined}
                onClick={() => edit && open(day.day, entry.period, entry)}
                onKeyDown={event => {
                  if (edit && ["Enter", " "].includes(event.key)) {
                    event.preventDefault()
                    open(day.day, entry.period, entry)
                  }
                }}>
                <span className="truncate font-mono text-[10px] text-muted-foreground">{clock(from)}–{clock(to)}</span>
                <strong className="truncate text-foreground">{section}</strong>
                <span className="flex min-w-0 items-center gap-1 font-medium"><span className={cn("size-1.5 shrink-0 rounded-full", theme.dot || "bg-primary")} /><span className="truncate">{subject} · {entry.periodLabels || "P" + entry.period.period_number}</span></span>
                <span className="truncate text-[10px] text-muted-foreground">{room}</span>
                {clash && <strong className="text-[10px] text-destructive">Time clash</strong>}
                {edit && <button type="button" title="Unassign slot" aria-label={`Unassign ${subject} for ${section}`}
                  className="absolute right-1 top-1 rounded bg-background px-1 text-muted-foreground opacity-0 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                  onClick={event => { event.stopPropagation(); remove(entry.id, entry.section_id) }}>×</button>}
              </div>
            })}
          </div>
        </section>
      })}
    </div>
  </div>
}
