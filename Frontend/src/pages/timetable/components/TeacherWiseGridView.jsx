import React, { useMemo } from "react"
import {
  User,
  Coffee,
  Search,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
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

export function TeacherWiseGridView({
  timetableData,
  isLoading = false,
  isError = false,
  searchQuery = "",
  zoom = 100,
}) {
  const {
    timetable,
    setups = [],
    entries = [],
    eligible_teachers = [],
  } = timetableData || {}

  const defaultDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]

  // Master periods across setups or entries
  const masterPeriods = useMemo(() => {
    if (setups.length > 0 && setups[0]?.periods?.length > 0) {
      return [...setups[0].periods].sort((a, b) => a.period_number - b.period_number)
    }
    const map = new Map()
    for (const e of entries) {
      if (e.period && !map.has(e.period.id)) {
        map.set(e.period.id, e.period)
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.period_number || 0) - (b.period_number || 0))
  }, [setups, entries])

  // Group entries by teacher
  const { teacherEntriesMap, teacherStatsMap } = useMemo(() => {
    const tMap = {}
    const sMap = {}

    for (const t of eligible_teachers) {
      tMap[String(t.id)] = {}
      sMap[String(t.id)] = { assigned: 0, classesSet: new Set() }
    }

    for (const e of entries) {
      if (!e.teacher_user_id) continue
      const tId = String(e.teacher_user_id)
      if (!tMap[tId]) tMap[tId] = {}
      if (!sMap[tId]) sMap[tId] = { assigned: 0, classesSet: new Set() }

      const p = e.period
      const pNum = p?.period_number || 0
      tMap[tId][`${e.day_of_week}_${e.period_id}`] = e
      tMap[tId][`${e.day_of_week}_${pNum}`] = e

      if (!p?.is_break) {
        sMap[tId].assigned += 1
      }
      if (e.section?.school_class) {
        sMap[tId].classesSet.add(e.section.school_class.name)
      }
    }

    return { teacherEntriesMap: tMap, teacherStatsMap: sMap }
  }, [eligible_teachers, entries])

  // Filter teachers by search query
  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return eligible_teachers
    const q = searchQuery.toLowerCase().trim()
    return eligible_teachers.filter((t) => {
      const name = `${t.first_name || ""} ${t.last_name || ""}`.toLowerCase()
      const dept = (t.department || t.designation || "").toLowerCase()
      const subj = (t.primary_subject || "").toLowerCase()
      return name.includes(q) || dept.includes(q) || subj.includes(q)
    })
  }, [eligible_teachers, searchQuery])

  // Max period columns for uniform grid alignment
  const periodsCount = masterPeriods.length || 8
  const baseColWidth = 140
  const dayColWidth = 56
  const gridTemplate = `${dayColWidth}px repeat(${periodsCount}, minmax(${baseColWidth}px, 1fr))`

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 rounded-2xl bg-muted/40 animate-pulse border border-border/60" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-sm font-semibold text-destructive">Failed to load teacher schedules.</p>
      </div>
    )
  }

  if (filteredTeachers.length === 0) {
    return (
      <div className="py-16 text-center space-y-3 border border-dashed rounded-2xl bg-muted/20">
        <User className="size-8 mx-auto text-muted-foreground opacity-60" />
        <p className="text-sm font-semibold text-foreground">No faculty members found</p>
        <p className="text-xs text-muted-foreground">
          {searchQuery ? "Try refining your search terms." : "No active staff members are enrolled in the school."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {filteredTeachers.map((teacher) => {
        const tId = String(teacher.id)
        const tName = `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim() || teacher.email
        const dept = teacher.department || teacher.designation || "Faculty"
        const stats = teacherStatsMap[tId] || { assigned: 0, classesSet: new Set() }
        const assignedCount = stats.assigned
        const totalTeachingSlots = defaultDays.length * (masterPeriods.filter((p) => !p.is_break).length || 8)
        const freeCount = Math.max(0, totalTeachingSlots - assignedCount)
        const loadPct = totalTeachingSlots > 0 ? Math.round((assignedCount / totalTeachingSlots) * 100) : 0
        const tMap = teacherEntriesMap[tId] || {}

        // Avatar initials
        const initials = `${teacher.first_name?.[0] || ""}${teacher.last_name?.[0] || ""}`.toUpperCase() || "T"

        return (
          <div
            key={teacher.id}
            id={`teacher-card-${teacher.id}`}
            className="bg-card text-card-foreground rounded-2xl border border-primary/20 shadow-xs overflow-hidden transition-all hover:shadow-sm"
          >
            {/* TEACHER CARD HEADER */}
            <div className="px-4 py-3 bg-muted/20 border-b border-border/60 flex items-center justify-between gap-3 flex-wrap">
              {/* Left: Avatar & Info */}
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                  {initials}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-foreground tracking-tight">{tName}</span>
                    <Badge variant="outline" className="text-[11px] font-semibold bg-primary/5 text-primary">
                      {dept}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Right: Workload Ticker */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                <span className="inline-flex items-center gap-1.5" title="Weekly assigned lectures">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>Assigned:</span>
                  <strong className="text-foreground">{assignedCount} pds/wk</strong>
                </span>

                <span className="opacity-40">|</span>

                <span className="inline-flex items-center gap-1.5" title="Weekly free periods">
                  <span className="size-2 rounded-full bg-sky-500" />
                  <span>Free:</span>
                  <strong className="text-foreground">{freeCount} pds</strong>
                </span>

                <span className="opacity-40">|</span>

                <span className="inline-flex items-center gap-1.5" title="Weekly load factor">
                  <span>Load:</span>
                  <strong className="text-foreground">{loadPct}%</strong>
                </span>
              </div>
            </div>

            {/* TIMETABLE GRID CANVAS */}
            <div className="overflow-x-auto scrollbar-thin">
              <div
                className="w-full origin-top-left"
                style={{
                  zoom: zoom / 100,
                  minWidth: `${dayColWidth + periodsCount * baseColWidth}px`,
                }}
              >
                {/* Timing Header Row */}
                <div
                  className="w-full bg-primary/5 border-b border-border/70"
                  style={{
                    display: "grid",
                    gridTemplateColumns: gridTemplate,
                  }}
                >
                  <div className="h-10 border-r border-border/70 flex items-center justify-center text-[10px] font-bold text-muted-foreground uppercase">
                    Days
                  </div>
                  {masterPeriods.map((p, pIdx) => {
                    const pLabel = p.name || `P${p.period_number || pIdx + 1}`
                    const startFmt = formatTime12h(p.start_time)
                    const endFmt = formatTime12h(p.end_time)
                    const isBreak = Boolean(p.is_break)

                    return (
                      <div
                        key={p.id || pIdx}
                        className={cn(
                          "h-10 border-r border-border/70 px-2 flex flex-col items-center justify-center text-center",
                          isBreak ? "bg-muted/40" : "bg-primary/5"
                        )}
                      >
                        <span className="text-xs font-bold text-foreground leading-tight">{pLabel}</span>
                        {startFmt && endFmt && (
                          <span className="text-[9.5px] text-muted-foreground font-normal leading-tight">
                            {startFmt} - {endFmt}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Day Rows */}
                {defaultDays.map((day) => {
                  return (
                    <div
                      key={day}
                      className="w-full border-b border-border/60 last:border-b-0"
                      style={{
                        display: "grid",
                        gridTemplateColumns: gridTemplate,
                      }}
                    >
                      {/* Day Label Cell */}
                      <div className="h-16 border-r border-border/70 bg-muted/20 flex items-center justify-center font-bold text-xs text-muted-foreground font-mono uppercase tracking-wider">
                        {day.slice(0, 3)}
                      </div>

                      {/* Period Cells */}
                      {masterPeriods.map((p, pIdx) => {
                        if (p.is_break) {
                          return (
                            <div
                              key={p.id || pIdx}
                              className="h-16 border-r border-border/70 bg-muted/30 flex items-center justify-center text-[11px] font-bold text-muted-foreground/80 italic select-none"
                            >
                              {p.name || "RECESS"}
                            </div>
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
                            <div
                              key={p.id || pIdx}
                              className={cn(
                                "h-16 border-r border-border/70 p-2 flex flex-col items-center justify-center text-center transition-all",
                                theme.cellBg
                              )}
                            >
                              <span className="text-xs font-bold text-foreground leading-tight">
                                {secLabel}
                              </span>
                              {subjName && (
                                <span className="text-[10.5px] font-semibold opacity-90 truncate max-w-full">
                                  {subjName}
                                </span>
                              )}
                            </div>
                          )
                        }

                        // Free period
                        return (
                          <div
                            key={p.id || pIdx}
                            style={{
                              backgroundImage:
                                "repeating-linear-gradient(135deg, rgba(148, 163, 184, 0.08) 0px, rgba(148, 163, 184, 0.08) 6px, transparent 6px, transparent 12px)",
                            }}
                            className="h-16 border-r border-border/70 flex items-center justify-center text-muted-foreground/60 select-none"
                            title={`Free Period (${formatTime12h(p.start_time)} - ${formatTime12h(p.end_time)})`}
                          >
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background/80 border border-dashed border-border text-[10px] text-muted-foreground">
                              <Coffee className="size-3 text-muted-foreground/70" />
                              <span>Free</span>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

