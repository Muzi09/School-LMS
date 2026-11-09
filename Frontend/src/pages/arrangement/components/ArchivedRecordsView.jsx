import React, { useState, useMemo } from "react"
import {
  Archive,
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  Printer,
  BarChart3,
  ListOrdered,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  TEACHERS,
  PERIODS,
  BASE_TEACHER_SCHEDULE,
  ABSENCE_TYPES,
  ABSENCE_TYPE_LABELS,
} from "../mockArrangementData"
import { cn } from "@/lib/utils"

export function ArchivedRecordsView({
  records = [],
  onOpenPrintSlipForDate,
}) {
  const [activeSubTab, setActiveSubTab] = useState("daily-ledger") // "daily-ledger" | "faculty-stats"
  const [teacherFilter, setTeacherFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all") // "all" | "fully-covered" | "pending-cover"
  const [absenceTypeFilter, setAbsenceTypeFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Expanded date cards state (set of date strings)
  const [expandedDates, setExpandedDates] = useState(() => {
    // Expand the latest 2 dates by default
    const set = new Set()
    records.slice(0, 2).forEach((r) => set.add(r.date))
    return set
  })

  const toggleDateExpand = (d) => {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  // Filtered records based on controls
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      // Teacher filter
      if (teacherFilter !== "all" && rec.teacherId !== teacherFilter) {
        return false
      }

      // Absence type filter
      if (absenceTypeFilter !== "all" && rec.absenceType !== absenceTypeFilter) {
        return false
      }

      // Status filter
      if (statusFilter !== "all") {
        const isFullyCovered = rec.affectedPeriods?.every(
          (p) => Boolean(rec.substitutes?.[p]?.substituteTeacherId)
        )
        if (statusFilter === "fully-covered" && !isFullyCovered) return false
        if (statusFilter === "pending-cover" && isFullyCovered) return false
      }

      // Search query (teacher name, reason, subject)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const t = TEACHERS.find((item) => item.id === rec.teacherId)
        const matchName = t?.name.toLowerCase().includes(q)
        const matchReason = rec.reason?.toLowerCase().includes(q)
        const matchDate = rec.date.includes(q)
        if (!matchName && !matchReason && !matchDate) return false
      }

      return true
    })
  }, [records, teacherFilter, absenceTypeFilter, statusFilter, searchQuery])

  // Group filtered records by date descending
  const groupedByDate = useMemo(() => {
    const groups = {}
    for (const rec of filteredRecords) {
      if (!groups[rec.date]) {
        groups[rec.date] = []
      }
      groups[rec.date].push(rec)
    }
    // Sort dates descending
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a))
    return sortedDates.map((date) => ({
      date,
      records: groups[date],
    }))
  }, [filteredRecords])

  // Aggregate Faculty Statistics across all records
  const facultyStats = useMemo(() => {
    const stats = {}
    for (const t of TEACHERS) {
      stats[t.id] = {
        teacher: t,
        totalAbsences: 0,
        fullDayAbsences: 0,
        fractionalAbsences: 0,
        periodsRelieved: 0,
        periodsCoveredForOthers: 0,
        reasons: [],
      }
    }

    for (const rec of records) {
      if (stats[rec.teacherId]) {
        stats[rec.teacherId].totalAbsences += 1
        if (rec.absenceType === ABSENCE_TYPES.FULL_DAY) {
          stats[rec.teacherId].fullDayAbsences += 1
        } else {
          stats[rec.teacherId].fractionalAbsences += 1
        }
        stats[rec.teacherId].periodsRelieved += rec.affectedPeriods?.length || 0
        if (rec.reason) stats[rec.teacherId].reasons.push(rec.reason)
      }

      // Track substitutions taken by teachers
      if (rec.substitutes) {
        for (const sub of Object.values(rec.substitutes)) {
          if (sub.substituteTeacherId && stats[sub.substituteTeacherId]) {
            stats[sub.substituteTeacherId].periodsCoveredForOthers += 1
          }
        }
      }
    }

    return Object.values(stats).sort(
      (a, b) => b.periodsCoveredForOthers - a.periodsCoveredForOthers
    )
  }, [records])

  // Export records to CSV
  const handleExportCSV = () => {
    const rows = [
      [
        "Date",
        "Period",
        "Class",
        "Subject",
        "Absent Teacher",
        "Absence Type",
        "Reason",
        "Substitute Teacher",
        "Substitute Subject",
        "Status",
        "Instructions",
      ],
    ]

    for (const rec of filteredRecords) {
      const absentTeacher = TEACHERS.find((t) => t.id === rec.teacherId)
      const schedule = BASE_TEACHER_SCHEDULE[rec.teacherId] || {}

      for (const pNum of rec.affectedPeriods || []) {
        const slot = schedule[pNum]
        const sub = rec.substitutes?.[pNum]
        const subTeacher = sub?.substituteTeacherId
          ? TEACHERS.find((t) => t.id === sub.substituteTeacherId)
          : null

        rows.push([
          rec.date,
          `Period ${pNum}`,
          slot?.class || "",
          slot?.subject || "",
          absentTeacher?.name || "",
          ABSENCE_TYPE_LABELS[rec.absenceType] || "",
          `"${(rec.reason || "").replace(/"/g, '""')}"`,
          subTeacher?.name || "Unarranged",
          subTeacher?.subject || "",
          subTeacher ? "Covered" : "Unarranged",
          `"${(sub?.note || "").replace(/"/g, '""')}"`,
        ])
      }
    }

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `School_Arrangement_Archive_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-4">
      {/* Perspective / SubTab Switcher + Filter Controls */}
      <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* SubTab Toggle */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 text-xs">
            <button
              type="button"
              onClick={() => setActiveSubTab("daily-ledger")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                activeSubTab === "daily-ledger"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ListOrdered className="size-3.5 text-primary" />
              <span>Date-Wise Daily Ledgers</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("faculty-stats")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                activeSubTab === "faculty-stats"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BarChart3 className="size-3.5 text-primary" />
              <span>Faculty Workload & Absence Summary</span>
            </button>
          </div>

          {/* Export Action */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-9 px-3.5 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer shadow-2xs bg-background hover:bg-muted/60"
          >
            <Download className="size-3.5 text-primary" />
            <span>Export Archive CSV</span>
          </Button>
        </div>

        {/* Detailed Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-border/60">
          {/* Search Input */}
          <div className="relative">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search teacher, date, reason..."
              className="pl-8.5 text-xs h-8.5 rounded-xl border-border/80 bg-background"
            />
          </div>

          {/* Teacher Dropdown */}
          <select
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            className="text-xs h-8.5 rounded-xl border border-border/80 bg-background px-3 text-foreground font-medium cursor-pointer"
          >
            <option value="all">All Faculty</option>
            {TEACHERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.subject})
              </option>
            ))}
          </select>

          {/* Absence Type Filter */}
          <select
            value={absenceTypeFilter}
            onChange={(e) => setAbsenceTypeFilter(e.target.value)}
            className="text-xs h-8.5 rounded-xl border border-border/80 bg-background px-3 text-foreground font-medium cursor-pointer"
          >
            <option value="all">All Absence Durations</option>
            {Object.entries(ABSENCE_TYPES).map(([k, v]) => (
              <option key={k} value={v}>
                {ABSENCE_TYPE_LABELS[v]}
              </option>
            ))}
          </select>

          {/* Cover Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs h-8.5 rounded-xl border border-border/80 bg-background px-3 text-foreground font-medium cursor-pointer"
          >
            <option value="all">All Cover Statuses</option>
            <option value="fully-covered">Fully Arranged (100%)</option>
            <option value="pending-cover">Pending Cover (Vacant Slots)</option>
          </select>
        </div>
      </div>

      {/* SubTab 1: Date-Wise Daily Ledgers */}
      {activeSubTab === "daily-ledger" && (
        <div className="space-y-4">
          {groupedByDate.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-2xl space-y-1">
              <Archive className="size-8 text-muted-foreground/60 mx-auto mb-2" />
              <p className="font-bold text-foreground">No archived arrangement records found</p>
              <p>Adjust your search filters or mark a teacher absent to create historical records.</p>
            </div>
          ) : (
            groupedByDate.map(({ date, records }) => {
              const isExpanded = expandedDates.has(date)

              // Calculate date stats
              let totalAffected = 0
              let totalCovered = 0
              records.forEach((r) => {
                totalAffected += r.affectedPeriods?.length || 0
                r.affectedPeriods?.forEach((p) => {
                  if (r.substitutes?.[p]?.substituteTeacherId) totalCovered++
                })
              })

              const coveragePercent =
                totalAffected > 0 ? Math.round((totalCovered / totalAffected) * 100) : 100

              return (
                <div
                  key={date}
                  className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden transition-all"
                >
                  {/* Date Accordion Header */}
                  <div
                    onClick={() => toggleDateExpand(date)}
                    className="p-4 bg-muted/20 hover:bg-muted/40 transition-colors flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none border-b border-border/60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">
                            {date}
                          </h4>
                          <span className="text-xs text-muted-foreground">
                            • {records.length} faculty absent
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{totalAffected} periods affected</span>
                          <span>•</span>
                          <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                            {totalCovered} covered ({coveragePercent}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenPrintSlipForDate(date)
                        }}
                        className="h-8 px-2.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 cursor-pointer gap-1.5"
                      >
                        <Printer className="size-3.5" />
                        <span>Print Day Slip</span>
                      </Button>
                    </div>
                  </div>

                  {/* Date Expanded Detailed Table */}
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            <th className="py-2.5 px-3 w-28">Period & Time</th>
                            <th className="py-2.5 px-3 w-24">Class / Room</th>
                            <th className="py-2.5 px-3">Subject</th>
                            <th className="py-2.5 px-3">Absent Faculty</th>
                            <th className="py-2.5 px-3">Leave Type & Reason</th>
                            <th className="py-2.5 px-3">Substitute Faculty</th>
                            <th className="py-2.5 px-3">Instructions / Notes</th>
                            <th className="py-2.5 px-3 w-24 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {records.map((rec) => {
                            const absentTeacher = TEACHERS.find((t) => t.id === rec.teacherId)
                            const schedule = BASE_TEACHER_SCHEDULE[rec.teacherId] || {}

                            return rec.affectedPeriods?.map((pNum) => {
                              const slot = schedule[pNum]
                              const periodObj = PERIODS.find((p) => p.number === pNum)
                              const sub = rec.substitutes?.[pNum]
                              const subTeacher = sub?.substituteTeacherId
                                ? TEACHERS.find((t) => t.id === sub.substituteTeacherId)
                                : null

                              return (
                                <tr
                                  key={`${rec.id}-${pNum}`}
                                  className="hover:bg-muted/20 transition-colors"
                                >
                                  <td className="py-2.5 px-3 font-semibold text-foreground">
                                    Period {pNum}
                                    <div className="text-[10px] text-muted-foreground font-normal">
                                      {periodObj ? `${periodObj.startTime} – ${periodObj.endTime}` : ""}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className="font-bold text-foreground">
                                      {slot?.class || "—"}
                                    </span>
                                    <div className="text-[10px] text-muted-foreground">
                                      {slot?.room}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 font-medium text-foreground">
                                    {slot?.subject || "—"}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className="font-semibold text-destructive">
                                      {absentTeacher?.name}
                                    </span>
                                    <div className="text-[10px] text-muted-foreground">
                                      {absentTeacher?.subject}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0 font-medium border-border"
                                    >
                                      {ABSENCE_TYPE_LABELS[rec.absenceType]}
                                    </Badge>
                                    <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1" title={rec.reason}>
                                      {rec.reason}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    {subTeacher ? (
                                      <div className="font-bold text-emerald-800 dark:text-emerald-300">
                                        {subTeacher.name}
                                        <div className="text-[10px] text-muted-foreground font-normal">
                                          {subTeacher.subject}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-amber-600 dark:text-amber-400 font-bold text-xs">
                                        Unarranged
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-muted-foreground text-[11px] max-w-[180px] truncate" title={sub?.note}>
                                    {sub?.note || "—"}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    {subTeacher ? (
                                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] px-2 py-0.5 font-bold">
                                        Covered
                                      </Badge>
                                    ) : (
                                      <Badge variant="destructive" className="text-[10px] px-2 py-0.5 font-bold">
                                        Vacant
                                      </Badge>
                                    )}
                                  </td>
                                </tr>
                              )
                            })
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* SubTab 2: Faculty Workload & Absence Summary (Analytics Ledger) */}
      {activeSubTab === "faculty-stats" && (
        <div className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border/60 bg-muted/20">
            <h4 className="text-sm font-bold text-foreground">
              Faculty Absence & Substitution Duty Summary
            </h4>
            <p className="text-xs text-muted-foreground">
              Cumulative historical metrics across all archived dates to track leave frequency and equitable substitution duties.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4">Faculty Member</th>
                  <th className="py-3 px-3">Subject / Dept</th>
                  <th className="py-3 px-3 text-center">Days Absent</th>
                  <th className="py-3 px-3 text-center">Full Day Leaves</th>
                  <th className="py-3 px-3 text-center">Fractional Leaves</th>
                  <th className="py-3 px-3 text-center">Periods Relieved</th>
                  <th className="py-3 px-3 text-center bg-primary/5 font-bold text-primary">
                    Arrangement Duties Taken
                  </th>
                  <th className="py-3 px-3 text-center">Duty Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {facultyStats.map((item) => {
                  const balance = item.periodsCoveredForOthers - item.periodsRelieved
                  return (
                    <tr key={item.teacher.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8 rounded-lg shrink-0">
                            <AvatarImage src={item.teacher.avatar} alt={item.teacher.name} />
                            <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-bold text-xs">
                              {item.teacher.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-bold text-foreground truncate">
                            {item.teacher.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {item.teacher.subject} • {item.teacher.department}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-foreground">
                        {item.totalAbsences}
                      </td>
                      <td className="py-3 px-3 text-center text-muted-foreground">
                        {item.fullDayAbsences}
                      </td>
                      <td className="py-3 px-3 text-center text-muted-foreground">
                        {item.fractionalAbsences}
                      </td>
                      <td className="py-3 px-3 text-center text-destructive font-semibold">
                        {item.periodsRelieved}
                      </td>
                      <td className="py-3 px-3 text-center bg-primary/5 font-bold text-primary">
                        <Badge className="bg-primary/15 text-primary border-primary/30 text-xs px-2 py-0.5">
                          {item.periodsCoveredForOthers} periods
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center font-bold">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-md text-xs",
                            balance > 0
                              ? "text-emerald-700 bg-emerald-500/15"
                              : balance < 0
                              ? "text-destructive bg-destructive/15"
                              : "text-muted-foreground bg-muted"
                          )}
                        >
                          {balance > 0 ? `+${balance}` : balance}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

