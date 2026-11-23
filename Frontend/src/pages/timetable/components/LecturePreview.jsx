import { optionRoomLabel } from "../rooms"
import { interval } from "../lessonTime"

export function LecturePreview({ rows, index, section, group, day, time }) {
  const participants = [...new Set(rows.flatMap(row => row.section_ids))]
  const matrix = Boolean(section && group)
  const periodLabel = id => {
    const local = index.periods(id, day).find(period => interval(period) === time)
    return index.sections.get(id) + (local ? " · P" + local.period_number : "")
  }
  return <div className="overflow-x-auto rounded-md border">
    <table className="w-full text-left text-sm">
      <thead className="bg-muted text-xs">
        <tr>
          <th scope="col" className="p-2">Subject</th>
          <th scope="col" className="p-2">Teacher</th>
          {matrix ? participants.map(id => <th key={id} scope="col"
            className={section.id === id ? "p-2 text-primary" : "p-2"}>{periodLabel(id)}</th>) :
            <th scope="col" className="p-2">Sections and periods</th>}
          <th scope="col" className="p-2">Room</th>
        </tr>
      </thead>
      <tbody>{rows.map(row => <tr key={row.id} className="border-t">
        <th scope="row" className="p-2 font-medium">{index.subjects.get(row.subject_id)}</th>
        <td className="p-2">{index.teachers.get(row.teacher_id)?.name || "Unassigned"}</td>
        {matrix ? participants.map(id => <td key={id} className="p-2 text-center">
          {row.section_ids.includes(id) ? <span aria-label="Participates">✓</span> : <span aria-label="Does not participate">—</span>}
        </td>) : <td className="p-2">{row.section_ids.map(periodLabel).join(" + ")}</td>}
        <td className="p-2">{optionRoomLabel(index, row)}</td>
      </tr>)}</tbody>
    </table>
  </div>
}
