import { useMemo, useState } from "react"
import { Layers, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function SubjectGroupLibrary({groups, placements, index, onEdit, onDelete, busy}) {
  const [query, setQuery] = useState("")
  const [confirm, setConfirm] = useState(null)
  const cards = useMemo(() => {
    const counts = new Map()
    for (const p of Object.values(placements)) counts.set(p.group_id, (counts.get(p.group_id) || 0) + 1)
    return Object.values(groups).map(group => {
      const lessons = group.options.map(row => ({
        id:row.id, subject:index.subjects.get(row.subject_id), teacher:index.teachers.get(row.teacher_id)?.name,
        sections:row.section_ids.map(id => index.sections.get(id)).join(", "),
      }))
      return {group, lessons, count:counts.get(group.id) || 0,
        search:[group.name,...lessons.flatMap(r => [r.subject,r.teacher,r.sections])].join(" ").toLowerCase()}
    }).sort((a,b) => a.group.name.localeCompare(b.group.name))
  }, [groups, placements, index])
  const visible = cards.filter(card => card.search.includes(query.trim().toLowerCase()))
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Save Parallel subjects, teachers and sections together, then assign them to a common period.</p>
    <div className="flex flex-wrap items-center gap-2">
      {cards.length > 0 && <Input aria-label="Search subject groups" placeholder="Find a group, subject, teacher or section" className="min-w-40 flex-1" value={query} onChange={e => setQuery(e.target.value)} />}
      <Button onPress={() => onEdit(null)}><Plus />Create group</Button>
    </div>
    {!visible.length && <p className="rounded-lg border border-dashed p-5 text-center text-muted-foreground">{cards.length ? "No groups match your search." : "Create your first subject group."}</p>}
    {visible.map(({group,lessons,count}) => <article key={group.id} className="rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Layers className="size-4 text-primary" />
        <h3 className="min-w-0 flex-1 break-words font-semibold">{group.name}</h3>
        <Button variant="outline" size="sm" aria-label={"Edit " + group.name} onPress={() => onEdit(group)}><Pencil />Edit</Button>
        <Button variant="ghost" size="icon-sm" aria-label={"Delete " + group.name} onPress={() => setConfirm(group.id)}><Trash2 /></Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{count ? count + (count === 1 ? " scheduled period" : " scheduled periods") : "Available to schedule"}</p>
      <ul className="mt-3 divide-y border-t">{lessons.map(row => <li key={row.id} className="grid gap-1 py-2 text-sm sm:grid-cols-2">
        <span><strong>{row.subject}</strong> · {row.teacher}</span><span className="text-muted-foreground">{row.sections}</span>
      </li>)}</ul>
      {confirm === group.id && <div className="mt-2 rounded-lg bg-muted p-3">
        <p>Delete “{group.name}” from subject groups?{count > 0 && " Its scheduled lessons will stay on the timetable."}</p>
        <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" isDisabled={busy} onPress={() => setConfirm(null)}>Cancel</Button>
          <Button size="sm" variant="destructive" isDisabled={busy} onPress={() => onDelete(group.id)}>Delete group</Button></div>
      </div>}
    </article>)}
  </div>
}
