import React from "react"
import { getSubjectTheme } from "../subjectTheme"
import { cn } from "@/lib/utils"

function formatTime12h(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return ""
  const parts = timeStr.split(":")
  if (parts.length < 2) return timeStr
  const [h, m] = parts.map(Number)
  if (isNaN(h)) return timeStr
  const period = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m || 0).padStart(2, "0")} ${period}`
}

export const TimetablePrintView = React.forwardRef(function TimetablePrintView(
  {
    schoolName = "School",
    timetableTitle = "Timetable",
    academicYear = "2026-2027",
    printScope = "classwise", // "classwise" | "teacherwise" | "both"
    selectedSections = [],
    selectedTeachers = [],
    setups = [],
    entries = [],
    pageBreak = "always", // "always" | "auto"
    colorMode = "color", // "color" | "bw"
    includeHeader = true,
  },
  ref
) {
  const isColor = colorMode === "color"
  const defaultDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]

  // Map section to setup
  const secToSetup = React.useMemo(() => {
    const map = {}
    for (const s of setups) {
      let rawSecIds = s.assigned_section_ids || []
      if (typeof rawSecIds === "string") {
        try {
          rawSecIds = JSON.parse(rawSecIds)
        } catch {
          rawSecIds = []
        }
      }
      for (const id of rawSecIds) {
        map[String(id)] = s
      }
    }
    return map
  }, [setups])

  // Index entries by sectionId_day_period
  const classEntryMap = React.useMemo(() => {
    const map = {}
    for (const e of entries) {
      const p = e.period
      const pNum = p?.period_number || 0
      map[`${e.section_id}_${e.day_of_week}_${e.period_id}`] = e
      map[`${e.section_id}_${e.day_of_week}_${pNum}`] = e
    }
    return map
  }, [entries])

  // Group entries by teacher
  const { teacherEntriesMap, teacherWorkloadMap } = React.useMemo(() => {
    const tMap = {}
    const wMap = {}
    for (const e of entries) {
      if (!e.teacher_user_id) continue
      const tId = String(e.teacher_user_id)
      if (!tMap[tId]) tMap[tId] = {}
      const p = e.period
      const pNum = p?.period_number || 0
      tMap[tId][`${e.day_of_week}_${e.period_id}`] = e
      tMap[tId][`${e.day_of_week}_${pNum}`] = e
      if (!p?.is_break) {
        wMap[tId] = (wMap[tId] || 0) + 1
      }
    }
    return { teacherEntriesMap: tMap, teacherWorkloadMap: wMap }
  }, [entries])

  // Fallback master periods
  const fallbackPeriods = React.useMemo(() => {
    if (setups.length > 0 && setups[0]?.periods?.length > 0) {
      return setups[0].periods
    }
    // Extract unique periods from entries
    const seen = new Map()
    for (const e of entries) {
      if (e.period && !seen.has(e.period.id)) {
        seen.set(e.period.id, e.period)
      }
    }
    return Array.from(seen.values()).sort((a, b) => (a.period_number || 0) - (b.period_number || 0))
  }, [setups, entries])

  const renderClassSectionCard = (section) => {
    const setup = secToSetup[String(section.id)] || setups[0] || null
    let secDays = defaultDays
    let secPeriods = fallbackPeriods

    if (setup) {
      let rawDays = setup.applicable_days
      if (typeof rawDays === "string") {
        try {
          rawDays = JSON.parse(rawDays)
        } catch {
          rawDays = defaultDays
        }
      }
      if (Array.isArray(rawDays) && rawDays.length > 0) {
        secDays = rawDays.map((d) => String(d).toUpperCase())
      }
      if (setup.periods && setup.periods.length > 0) {
        secPeriods = [...setup.periods].sort((a, b) => a.period_number - b.period_number)
      }
    }

    const clsName = section.class_name || "Class"
    const secName = section.name || ""

    return (
      <div
        key={`print-sec-${section.id}`}
        className={cn(
          "print-card border border-slate-800 rounded-lg overflow-hidden bg-white text-slate-900 mb-6",
          pageBreak === "always" ? "break-after-page" : "break-inside-avoid"
        )}
        style={{
          pageBreakAfter: pageBreak === "always" ? "always" : "auto",
          breakAfter: pageBreak === "always" ? "page" : "auto",
        }}
      >
        {/* Header Branding */}
        {includeHeader && (
          <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold tracking-tight uppercase">{schoolName}</h2>
              <p className="text-[10px] text-slate-300 font-medium">
                {timetableTitle} {academicYear ? `(${academicYear})` : ""} — Class Schedule
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-black px-2.5 py-1 bg-white text-slate-900 rounded-md">
                CLASS {clsName} - {secName}
              </span>
            </div>
          </div>
        )}

        {/* Timetable Table Grid */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-400 font-bold text-slate-800">
                <th className="border-r border-slate-300 px-2 py-2 w-16 text-[11px] uppercase tracking-wider">
                  Days
                </th>
                {secPeriods.map((p, pIdx) => {
                  const pNum = p.name || `P${p.period_number || pIdx + 1}`
                  const startFmt = formatTime12h(p.start_time)
                  const endFmt = formatTime12h(p.end_time)
                  const timeRange = startFmt && endFmt ? `${startFmt} - ${endFmt}` : ""
                  return (
                    <th
                      key={p.id || pIdx}
                      className="border-r border-slate-300 px-1 py-1.5 min-w-[75px] font-semibold"
                    >
                      <div className="text-[11px] font-bold text-slate-900">{pNum}</div>
                      {timeRange && <div className="text-[9px] text-slate-500 font-normal">{timeRange}</div>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {secDays.map((day) => {
                return (
                  <tr key={day} className="border-b border-slate-300 last:border-b-0">
                    <td className="border-r border-slate-300 px-1 py-2 font-bold text-[10px] bg-slate-50 uppercase tracking-wider text-slate-700">
                      {day.slice(0, 3)}
                    </td>
                    {secPeriods.map((p, pIdx) => {
                      if (p.is_break) {
                        return (
                          <td
                            key={p.id || pIdx}
                            className="border-r border-slate-300 px-1 py-2 bg-slate-100 text-slate-500 font-bold text-[10px] italic select-none"
                          >
                            {p.name || "BREAK"}
                          </td>
                        )
                      }

                      const entry =
                        classEntryMap[`${section.id}_${day}_${p.id}`] ||
                        classEntryMap[`${section.id}_${day}_${p.period_number}`]

                      if (entry && entry.subject) {
                        const subjName = entry.subject.name || "Subject"
                        const theme = getSubjectTheme(subjName, entry.subject.category)
                        const teacherName = entry.teacher
                          ? `${entry.teacher.first_name || ""} ${entry.teacher.last_name || ""}`.trim()
                          : ""

                        return (
                          <td
                            key={p.id || pIdx}
                            className={cn(
                              "border-r border-slate-300 px-1 py-1.5 transition-colors align-middle",
                              isColor ? theme.cellBg : "bg-white"
                            )}
                          >
                            <div className="font-bold text-[11px] text-slate-900 leading-tight">
                              {subjName}
                            </div>
                            {teacherName && (
                              <div className="text-[9.5px] text-slate-600 font-medium leading-tight mt-0.5">
                                ({teacherName})
                              </div>
                            )}
                          </td>
                        )
                      }

                      return (
                        <td
                          key={p.id || pIdx}
                          className="border-r border-slate-300 px-1 py-2 text-slate-300 text-[10px]"
                        >
                          -
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderTeacherCard = (teacher) => {
    const tId = String(teacher.id)
    const tName = `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim() || teacher.email
    const dept = teacher.tag || teacher.designation || teacher.department || "Teacher"
    const assignedCount = teacherWorkloadMap[tId] || 0
    const tMap = teacherEntriesMap[tId] || {}
    const secPeriods = fallbackPeriods

    return (
      <div
        key={`print-teacher-${teacher.id}`}
        className={cn(
          "print-card border border-slate-800 rounded-lg overflow-hidden bg-white text-slate-900 mb-6",
          pageBreak === "always" ? "break-after-page" : "break-inside-avoid"
        )}
        style={{
          pageBreakAfter: pageBreak === "always" ? "always" : "auto",
          breakAfter: pageBreak === "always" ? "page" : "auto",
        }}
      >
        {/* Header Branding */}
        {includeHeader && (
          <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold tracking-tight uppercase">{schoolName}</h2>
              <p className="text-[10px] text-slate-300 font-medium">
                {timetableTitle} {academicYear ? `(${academicYear})` : ""} — Faculty Schedule
              </p>
            </div>
            <div className="text-right flex items-center gap-2">
              <span className="text-[10px] font-semibold text-slate-300">
                {dept} • Assigned: {assignedCount} pds/wk
              </span>
              <span className="text-xs font-black px-2.5 py-1 bg-white text-slate-900 rounded-md">
                {tName.toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {/* Timetable Table Grid */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-400 font-bold text-slate-800">
                <th className="border-r border-slate-300 px-2 py-2 w-16 text-[11px] uppercase tracking-wider">
                  Days
                </th>
                {secPeriods.map((p, pIdx) => {
                  const pNum = p.name || `P${p.period_number || pIdx + 1}`
                  const startFmt = formatTime12h(p.start_time)
                  const endFmt = formatTime12h(p.end_time)
                  const timeRange = startFmt && endFmt ? `${startFmt} - ${endFmt}` : ""
                  return (
                    <th
                      key={p.id || pIdx}
                      className="border-r border-slate-300 px-1 py-1.5 min-w-[75px] font-semibold"
                    >
                      <div className="text-[11px] font-bold text-slate-900">{pNum}</div>
                      {timeRange && <div className="text-[9px] text-slate-500 font-normal">{timeRange}</div>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {defaultDays.map((day) => {
                return (
                  <tr key={day} className="border-b border-slate-300 last:border-b-0">
                    <td className="border-r border-slate-300 px-1 py-2 font-bold text-[10px] bg-slate-50 uppercase tracking-wider text-slate-700">
                      {day.slice(0, 3)}
                    </td>
                    {secPeriods.map((p, pIdx) => {
                      if (p.is_break) {
                        return (
                          <td
                            key={p.id || pIdx}
                            className="border-r border-slate-300 px-1 py-2 bg-slate-100 text-slate-500 font-bold text-[10px] italic select-none"
                          >
                            {p.name || "BREAK"}
                          </td>
                        )
                      }

                      const entry = tMap[`${day}_${p.id}`] || tMap[`${day}_${p.period_number}`]

                      if (entry && entry.section) {
                        const sec = entry.section
                        const clsName = sec.school_class?.name || ""
                        const secLabel = `${clsName} ${sec.name || ""}`.trim()
                        const subjName = entry.subject?.name || ""
                        const theme = getSubjectTheme(subjName, entry.subject?.category)

                        return (
                          <td
                            key={p.id || pIdx}
                            className={cn(
                              "border-r border-slate-300 px-1 py-1.5 transition-colors align-middle",
                              isColor ? theme.cellBg : "bg-white"
                            )}
                          >
                            <div className="font-black text-[11px] text-slate-900 leading-tight">
                              {secLabel}
                            </div>
                            {subjName && (
                              <div className="text-[9.5px] text-slate-700 font-semibold leading-tight mt-0.5">
                                ({subjName})
                              </div>
                            )}
                          </td>
                        )
                      }

                      return (
                        <td
                          key={p.id || pIdx}
                          className="border-r border-slate-300 px-1 py-2 text-slate-400 text-[10px] font-mono"
                        >
                          Free
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div ref={ref} id="printable-timetable-area" className="w-full text-slate-900 bg-white">
      {/* Printable Stylesheet injected directly into the component */}
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 8mm;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide all application elements except printable timetable area */
          body > *:not(#print-root-container) {
            display: none !important;
          }
          #printable-timetable-area {
            display: block !important;
            width: 100% !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .break-after-page {
            page-break-after: always !important;
            break-after: page !important;
          }
          .break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Class-wise tables */}
      {(printScope === "classwise" || printScope === "both") && (
        <div>
          {selectedSections.map((section) => renderClassSectionCard(section))}
        </div>
      )}

      {/* Teacher-wise tables */}
      {(printScope === "teacherwise" || printScope === "both") && (
        <div>
          {selectedTeachers.map((teacher) => renderTeacherCard(teacher))}
        </div>
      )}

      {selectedSections.length === 0 && selectedTeachers.length === 0 && (
        <div className="py-12 text-center text-sm text-slate-500">
          No classes or teachers selected to print.
        </div>
      )}
    </div>
  )
})

