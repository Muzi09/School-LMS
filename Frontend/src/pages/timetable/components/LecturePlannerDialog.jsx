import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LecturePreview } from "./LecturePreview"
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import apiClient from "@/api/client"
import { ALL_WEEKDAYS } from "../bellTiming/validators"
import { optionRoomLabel } from "../rooms"
import { interval } from "../lessonTime"
import { applyOptionChanges, placedOptions, plannerIndex, restoresForCell, timesFor, unavailable } from "../lecturePlanner"
import { LectureGroupEditor } from "./LectureGroupEditor"
import { SubjectGroupLibrary } from "./SubjectGroupLibrary"
import { ChevronRight, Plus } from "lucide-react"

function scheduledOption({ id, subject_id, teacher_id, section_ids }) {
  return { id, subject_id, teacher_id, section_ids }
}

const dayName = day => day[0] + day.slice(1).toLowerCase()
const selectClass = "rounded-md border bg-background px-2 py-1.5 text-sm"

export function LecturePlannerDialog({data, cell = {}, onClose, renderAssignment}) {
  const index = useMemo(() => plannerIndex(data), [data])
  const cache = useQueryClient()
  const plan = data.lecture_plan || {}
  const groups = plan.groups || {}, placements = plan.placements || {}
  const {day, section, teacher, period, at, currentEntry} = cell
  const origin = currentEntry?.placement_id
  const placed = placements[origin]
  const initialGroup = groups[placed?.group_id] || plan.archived_groups?.[placed?.group_id]
  const initialTime = period && interval(period)
  const actual = id => placedOptions(index.byPlacement.get(id) || [])
  const [stage,setStage] = useState(origin ? "preview" : day ? "choose" : "manage")
  const [choice,setChoice] = useState(initialGroup || null)
  const [rows,setRows] = useState(() => origin ? actual(origin) : [])
  const [days,setDays] = useState(() => day ? {[day]:{time:initialTime || "", id:origin}} : {})
  const [editing,setEditing] = useState(null)
  const [returnStage,setReturnStage] = useState("choose")
  const [version,setVersion] = useState(data.timetable.version)
  const [action,setAction] = useState(cell.remove ? "removeScope" : "edit")
  const [error,setError] = useState("")
  const [busy,setBusy] = useState(false)
  const [point,setPoint] = useState(at || "")
  const [groupSearch,setGroupSearch] = useState("")
  const [updatedGroup,setUpdatedGroup] = useState(null)
  const restores = useMemo(() => restoresForCell(index, data.lecture_plan || {}, day, section?.id, teacher?.id),
    [index, data.lecture_plan, day, section?.id, teacher?.id])
  const group = choice?.options ? choice : null
  const title = teacher?.name || [teacher?.first_name,teacher?.last_name].filter(Boolean).join(" ") || index.sections.get(section?.id)
  const groupsHere = Object.values(groups).filter(g => g.options.some(r => teacher ? r.teacher_id === teacher.id : r.section_ids.includes(section?.id)))
  const search = groupSearch.trim().toLowerCase()
  const matchingGroups = search ? groupsHere.filter(g => [g.name,...g.options.flatMap(r => [
    index.subjects.get(r.subject_id),index.teachers.get(r.teacher_id)?.name,...r.section_ids.map(s => index.sections.get(s)),
  ])].join(" ").toLowerCase().includes(search)) : groupsHere
  const optionsHere = index.options.filter(r => teacher ? r.teacher_id === teacher.id : r.section_ids.includes(section?.id))
  const selected = Object.entries(days)
  const listSections = opts => [...new Set(opts.flatMap(r => r.section_ids))].map(id => index.sections.get(id)).join(" + ")
  const openEditor = g => {setEditing(g);setReturnStage(stage);setStage("editor");setError("")}
  const choose = (c,time) => {
    setChoice(c);setRows(c.options || [{...c,id:crypto.randomUUID()}]);setDays({[day]:{time}});setAction("edit");setStage("preview");setError("")
  }
  const setDay = (d, val) => setDays(prev => {
    const next = {...prev}
    if (val) next[d] = val
    else delete next[d]
    return next
  })
  const peers = group ? Object.entries(placements).filter(([id,p]) => p.group_id === group.id && index.byPlacement.has(id)) : []
  const rowsFor = (id) => {
    const local = id ? actual(id) : rows
    if (action === "removeAll") return []
    if (action === "removeScope") return teacher ? local.filter(r => r.teacher_id !== teacher.id) :
      local.map(r => ({...r,section_ids:r.section_ids.filter(s => s !== section.id)})).filter(r => r.section_ids.length)
    if (updatedGroup && id) return applyOptionChanges(placements[id].expected, updatedGroup.options, local)
    return origin && id && id !== origin ? applyOptionChanges(actual(origin), rows, local) : rows
  }
  const dayError = ([d,{time,id}]) => !time ? "Choose a common period." : action !== "edit" ? "" : unavailable(index, rowsFor(id), d, time, id)
  const save = async (path, payload, onSuccess) => {
    if (busy) return
    setBusy(true);setError("")
    try {
      const url = "/timetable/timetables/" + data.timetable.id + "/" + path
      const result = payload === null ? await apiClient.delete(url,{params:{version}}) : await apiClient.post(url,{...payload,version})
      setVersion(version + 1)
      await cache.invalidateQueries({queryKey:["timetable"]})
      onSuccess(result)
    } catch (err) {
      setError(err.message)
      if (err.status === 409) await cache.invalidateQueries({queryKey:["timetable"]})
    } finally {setBusy(false)}
  }
  const saveDefinition = draft => save("lecture-groups",{ ...draft, options: draft.options.map(scheduledOption) },result => {
    if (returnStage === "manage" && Object.values(placements).some(p => p.group_id === result.id)) {
      setChoice(result);setUpdatedGroup(result);setRows(result.options);setDays({});setStage("preview")
    } else if (day && !origin && result.options.some(r => teacher ? r.teacher_id === teacher.id : r.section_ids.includes(section.id))) {
      setStage("choose")
      const time = initialTime || timesFor(index,result.options,day).find(t => !point || (t.slice(0,5) <= point && point < t.slice(-5)))
      if (time) choose(result,time)
    } else setStage(returnStage)
  })
  const submit = () => save("placements",{group_id:group?.id || null,days:selected.map(([d,{time,id}]) => ({
    day:d,start:time.slice(0,5),end:time.slice(-5),placement_id:id || null,options:rowsFor(id).map(scheduledOption),apply_definition:Boolean(updatedGroup),
  }))},onClose)
  const availableTimes = day ? (section || initialTime ? [initialTime].filter(Boolean) :
    [...new Set(optionsHere.flatMap(o => index.periods(o.section_ids[0],day).map(interval)))].sort()
      .filter(t => !point || (t.slice(0,5) <= point && point < t.slice(-5)))) : []
  const choicesFor = time => (renderAssignment ? matchingGroups : [...matchingGroups,...optionsHere]).filter(c => (c.options || [c]).some(r =>
    (!teacher || teacher.id === r.teacher_id) && r.section_ids.some(s => (!section || section.id === s) && index.periods(s,day).some(p => interval(p) === time))))
  const content = () => <>
    {!renderAssignment &&
    <DialogHeader><DialogTitle>{stage === "editor" ? (editing ? "Edit subject group" : "Create subject group") : stage === "manage" ? "Subject groups" : origin ? "Scheduled group" : updatedGroup ? "Update scheduled weekdays" : "Assign lesson"}</DialogTitle>
      {day && <span className="text-sm text-muted-foreground">{title} · {dayName(day)} {period && "· P" + period.period_number + " · " + initialTime} {at && "· Around " + at}</span>}
    </DialogHeader>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {stage === "manage" && <SubjectGroupLibrary groups={groups} placements={placements} index={index} onEdit={openEditor}
      busy={busy} onDelete={id => save("lecture-groups/" + id,null,() => {})} />}
    {stage === "editor" && <LectureGroupEditor index={index} initial={editing} busy={busy} onSave={saveDefinition} onCancel={() => setStage(returnStage)} />}
    {stage === "lessons" && <LectureGroupEditor scheduled index={index} initial={{...group,options:rows}} onSave={draft => {setRows(draft.options);setStage("preview")}} onCancel={() => setStage("preview")} />}
    {stage === "choose" && <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3"><div className="min-w-40 flex-1"><h3 className="font-semibold">Choose a subject group</h3>
        <p className="text-xs text-muted-foreground">Review the lessons and select weekdays before assigning.</p></div>
        <Button size="sm" variant="outline" onPress={() => openEditor(null)}><Plus />Create group</Button>
        {teacher && !period && groupsHere.length > 0 && <label className="ml-auto">Around <input type="time" value={point} onChange={e => setPoint(e.target.value)} /></label>}</div>
      {groupsHere.length > 4 && <Input aria-label="Search groups for this slot" placeholder="Find a group, subject, teacher or section" value={groupSearch} onChange={e => setGroupSearch(e.target.value)} />}
      {cell.stretch && !optionsHere.some(o => index.periods(o.section_ids[0],day).some(p =>
        p.start_time.slice(0,5) >= cell.stretch[0] && p.end_time.slice(0,5) <= cell.stretch[1])) &&
        <p>No full teaching period fits in this free stretch.</p>}
      {!availableTimes.length && <p>No teaching period covers this time. Choose another time to see other periods.</p>}
      {renderAssignment && availableTimes.length > 0 && availableTimes.every(t => !choicesFor(t).length && !restores.has(t)) &&
        <p className="rounded-xl border border-dashed p-5 text-center text-muted-foreground">{search ? "No groups match your search." : "No saved group matches this slot. Create a group to include " + title + "."}</p>}
      {availableTimes.filter(time => restores.has(time) || choicesFor(time).length > 0).map(time => <section key={time} className="rounded-lg border">
        <h3 className="rounded-t-lg bg-muted px-3 py-2 font-semibold">{time}</h3>
        {(restores.get(time) || []).map(({id, group, option, missing, rows, reason}) => <div key={id + option.id} className="border-t px-3 py-2">
          <Button variant="outline" isDisabled={busy || Boolean(reason)} onPress={() => save("placements", {
            group_id:group.id, days:[{day, start:time.slice(0,5), end:time.slice(-5), placement_id:id, options:rows.map(scheduledOption)}],
          }, onClose)}>Restore {index.subjects.get(option.subject_id)} · {missing.map(s => index.sections.get(s)).join(" + ")}</Button>
          <p className="text-xs">{group.name} · {index.teachers.get(option.teacher_id)?.name}</p>
          {reason && <p className="text-xs text-destructive">{reason}</p>}
        </div>)}
        {choicesFor(time).filter(c => !restores.get(time)?.some(r => r.group.id === c.id)).map(c => {
          const opts = c.options || [c]
          const reason = unavailable(index,opts,day,time)
          return <button key={c.id} disabled={!renderAssignment && Boolean(reason)} onClick={() => choose(c,time)}
            className={`block w-full border-t px-3 py-2 text-left hover:bg-muted/50 ${reason ? "text-muted-foreground opacity-65" : ""}`}>
            <span className="flex items-center justify-between gap-2"><strong>{c.options ? c.name : index.subjects.get(c.subject_id) + " only"}</strong><ChevronRight className="size-4" /></span>
            {opts.map(row => <span key={row.id} className="mt-1 grid gap-x-3 text-xs sm:grid-cols-2">
              <span>{index.subjects.get(row.subject_id)} · {index.teachers.get(row.teacher_id)?.name || "Teacher unassigned"}</span>
              <span className="text-muted-foreground">{listSections([row])}</span>
            </span>)}
            {reason && <span className="block text-xs">{reason}</span>}
          </button>
        })}
      </section>)}
    </div>}
    {stage === "preview" && <div className="space-y-4">
      <h3 className="font-semibold">{group?.name || (index.subjects.get(rows[0]?.subject_id) + " only")}</h3>
      {origin && <label className="block">Action <select className={selectClass} value={action} onChange={e => {
        setAction(e.target.value)
        if (e.target.value !== "edit") setDays(Object.fromEntries(selected.map(([d, value]) => [d,{...value,time:interval(index.byPlacement.get(value.id)[0].period)}])))
      }}>
        <option value="edit">Edit scheduled group</option><option value="removeScope">{teacher ? "Remove this teacher’s lesson" : "Remove this section"}</option>
        <option value="removeAll">Remove entire group</option></select></label>}
      <LecturePreview rows={rows} index={index} section={section} group={group} day={day} time={days[day]?.time} />
      {origin && action === "edit" && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onPress={() => setStage("lessons")}>Edit lessons</Button>
        {(placed?.expected || []).map(r => {
          const current = rows.find(o => o.id === r.id)
          const missing = r.section_ids.filter(s => !current?.section_ids.includes(s))
          if (!missing.length) return null
          return <Button key={r.id} size="sm" variant="outline" onPress={() => setRows(current ? rows.map(o => o !== current ? o : {...o,section_ids:[...o.section_ids,...missing]}) : [...rows,r])}>
            Restore {index.subjects.get(r.subject_id)} · {missing.map(s => index.sections.get(s)).join(" + ")}</Button>
        })}</div>}
      {updatedGroup && <p>Saved group updated. Select any existing placements to update as well.</p>}
      <fieldset className="space-y-1"><legend className="mb-2 font-semibold">Schedule on</legend>
        {ALL_WEEKDAYS.map(d => {
          const matches = peers.filter(([,p]) => p.day === d)
          if ((origin || updatedGroup) && !matches.length) return null
          const chosen = days[d]
          const id = chosen?.id || (origin && d === day ? origin : matches[0]?.[0])
          const localTime = id && interval(index.byPlacement.get(id)[0].period)
          const suggested = (origin || updatedGroup) ? localTime : days[day]?.time || initialTime
          const opts = rowsFor((origin || updatedGroup) && id)
          const times = opts.length ? timesFor(index,opts,d) : [localTime]
          const problem = chosen && dayError([d,chosen])
          const defaultTime = times.includes(suggested) ? suggested : times[0]
          return <div key={d} className={`flex flex-wrap items-center gap-2 rounded-md px-3 py-1.5 ${chosen ? "bg-primary/5" : ""}`}>
            <label className="flex w-28 items-center gap-2"><input type="checkbox" checked={Boolean(chosen)} disabled={!chosen && !times.length} onChange={e => setDay(d,e.target.checked ? {id:(origin || updatedGroup) ? id : null,time:defaultTime || ""} : null)} />{dayName(d)}</label>
            {!chosen && !times.length && <span className="text-xs text-muted-foreground">No common period</span>}
            {chosen && <>{(origin || updatedGroup) && matches.length > 1 && <select aria-label={d + " placement"} className={selectClass} value={chosen.id} onChange={e => setDay(d,{id:e.target.value,time:interval(index.byPlacement.get(e.target.value)[0].period)})}>
              {matches.map(([k]) => <option key={k} value={k}>{interval(index.byPlacement.get(k)[0].period)}</option>)}</select>}
              <select disabled={action !== "edit"} aria-label={d + " period"} className={selectClass} value={chosen.time} onChange={e => setDay(d,{...chosen,time:e.target.value})}>
              {[...new Set([chosen.time,...times])].map(t => <option key={t} value={t}>{t || "Choose period"}</option>)}</select>
              {problem && <span className="text-xs text-destructive">{problem}</span>}
              {(updatedGroup || (origin && d !== day)) && <div className="basis-full pl-5 text-xs">
                {opts.map(r => <div key={r.id}>{index.subjects.get(r.subject_id)} · {index.teachers.get(r.teacher_id)?.name} · {listSections([r])}{" · " + optionRoomLabel(index, r)}</div>)}
              </div>}</>}
          </div>
        })}</fieldset>
      {action !== "edit" && <p>{action === "removeAll" ? "Remove all lessons for " + listSections(rows) : teacher ? "Remove " + teacher.name + "’s lesson across " + listSections(rows.filter(r => r.teacher_id === teacher.id)) : "Remove " + title + " from its scheduled options"} on the selected weekdays.</p>}
      <div className="flex justify-end gap-2 border-t pt-3">{updatedGroup && <Button variant="outline" onPress={onClose}>Done</Button>}{!origin && !updatedGroup && <Button variant="outline" onPress={() => setStage("choose")}>Back</Button>}
        <Button isDisabled={busy || !selected.length || selected.some(dayError)} onPress={submit}>
          {action !== "edit" ? "Confirm removal" : origin || updatedGroup ? "Save weekdays" : group ? "Assign group" : "Assign lesson"}</Button></div>
    </div>}
  </>
  if (renderAssignment) return renderAssignment(content, availableTimes.some(t => restores.has(t)), busy)
  return <Dialog isOpen onOpenChange={v => !v && !busy && onClose()} isDismissable={!busy} className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">{content()}</Dialog>
}
