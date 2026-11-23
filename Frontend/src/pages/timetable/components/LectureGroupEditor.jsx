import { optionRoomLabel } from "../rooms"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function LectureGroupEditor({ index, initial, onSave, onCancel, busy, scheduled = false }) {
  const [name, setName] = useState(initial?.name || "")
  const [rows, setRows] = useState(() => (initial?.options || []).flatMap(row => {
    const byClass = new Map()
    for (const sectionId of row.section_ids) {
      const classId = index.sectionClasses.get(sectionId)
      if (!byClass.has(classId)) byClass.set(classId, [])
      byClass.get(classId).push(sectionId)
    }
    return [...byClass.values()].map((sectionIds, i) => ({
      ...row, id: i ? crypto.randomUUID() : row.id, section_ids: sectionIds,
    }))
  }))
  const [search, setSearch] = useState("")
  const [startingSections, setStartingSections] = useState([])
  const offerings = useMemo(() => {
    const result = new Map()
    for (const allocation of index.options) {
      if (!allocation.parallel || !index.teachers.has(allocation.teacher_id)) continue
      const key = allocation.class_id + "/" + allocation.subject_id + "/" + allocation.teacher_id
      if (!result.has(key)) result.set(key, { ...allocation, section_ids: [] })
      result.get(key).section_ids.push(...allocation.section_ids)
    }
    return [...result.values()]
  }, [index])
  const eligibleSections = [...new Set(offerings.flatMap(o => o.section_ids))]
  const changeSections = (offering, sectionIds) => {
    const existing = rows.find(r => r.subject_id === offering.subject_id && r.teacher_id === offering.teacher_id &&
      r.section_ids.some(id => index.sectionClasses.get(id) === offering.class_id))
    if (!existing) {
      if (sectionIds.length) setRows([...rows, { ...offering, id: crypto.randomUUID(), section_ids: sectionIds }])
    } else {
      setRows(rows.flatMap(row => row !== existing ? [row] : sectionIds.length ? [{ ...row, section_ids: sectionIds }] : []))
    }
  }
  return <div className="space-y-4">
    {!scheduled && <label className="grid gap-1 font-medium">Group name
      <Input value={name} placeholder="e.g. Senior electives" maxLength={100} onChange={e => setName(e.target.value)} />
    </label>}
    <div><h3 className="font-semibold">Choose subjects and sections</h3>
      <p className="text-xs text-muted-foreground">Select a subject to include its sections, or pick sections individually. Only Parallel allocations appear here.</p></div>
    {eligibleSections.length > 0 && <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Limit default selections to specific sections</summary>
      <div className="mt-2 flex flex-wrap gap-3">{eligibleSections.map(id => <label key={id}>
        <input type="checkbox" checked={startingSections.includes(id)} onChange={e => setStartingSections(
          e.target.checked ? [...startingSections,id] : startingSections.filter(s => s !== id))} /> {index.sections.get(id)}
      </label>)}</div></details>}
    <Input aria-label="Find eligible subjects or sections" placeholder="Find a subject, teacher or section" value={search} onChange={e => setSearch(e.target.value)} />
    <div className="max-h-56 overflow-y-auto divide-y rounded-md border">
      {offerings.map(offering => {
        const teacher = index.teachers.get(offering.teacher_id).name
        const subject = index.subjects.get(offering.subject_id)
        const selected = rows.find(r => r.subject_id === offering.subject_id && r.teacher_id === offering.teacher_id &&
          r.section_ids.some(id => index.sectionClasses.get(id) === offering.class_id))
        const matches = [subject,teacher,...offering.section_ids.map(id => index.sections.get(id))].join(" ")
        if (!matches.toLowerCase().includes(search.toLowerCase())) return null
        const defaults = offering.section_ids.filter(id => !startingSections.length || startingSections.includes(id))
        return <div key={offering.id} className={selected ? "bg-primary/5 p-3" : "p-3"}>
          <label className="flex items-center gap-2 font-medium">
            <input type="checkbox" checked={Boolean(selected)} disabled={!selected && !defaults.length}
              onChange={e => changeSections(offering,e.target.checked ? defaults : [])} />
            {subject} · {teacher}
          </label>
          <div className="ml-5 mt-2 flex flex-wrap gap-2">{offering.section_ids.map(id => <label key={id} className="inline-flex cursor-pointer items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs">
            <input type="checkbox" checked={selected?.section_ids.includes(id) || false}
              onChange={e => changeSections(offering,e.target.checked ? [...(selected?.section_ids || []),id] : selected.section_ids.filter(s => s !== id))} />
            {" "}{index.sections.get(id)}
          </label>)}</div>
        </div>
      })}
      {!offerings.length && <p className="p-3">Enable parallel subjects and assign their teachers in Manage School.</p>}
    </div>
    {rows.length > 0 && <h3 className="font-semibold">Selected lessons ({rows.length})</h3>}
    {rows.map(row => <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 text-sm" key={row.id}>
      <span>{index.subjects.get(row.subject_id)} · {row.section_ids.map(id => index.sections.get(id)).join(" + ")}</span>
      <span className="break-words text-xs text-muted-foreground">{optionRoomLabel(index, row)}</span>
      <Button size="icon-xs" variant="ghost" aria-label={"Remove " + index.subjects.get(row.subject_id)} onPress={() => setRows(rows.filter(r => r.id !== row.id))}>×</Button>
    </div>)}
    <div className="flex justify-end gap-2"><Button variant="outline" onPress={onCancel}>Back</Button>
      <Button isDisabled={busy || !name.trim() || !rows.length} onPress={() => onSave({id:initial?.id,name:name.trim(),options:rows})}>
        {scheduled ? "Use these lessons" : "Save group"}
      </Button></div>
  </div>
}
