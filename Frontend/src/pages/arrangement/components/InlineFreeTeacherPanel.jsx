import React, { useState, useMemo, useEffect } from "react"
import {
  Clock,
  Info,
  Users,
  AlertCircle,
  UserCheck,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TeacherInfoModal } from "./TeacherInfoModal"
import {
  TEACHERS,
  PERIODS,
  getTeacherScheduleForDate,
  getTeacherDutySummaryOnDate,
} from "../mockArrangementData"
import { cn } from "@/lib/utils"

export function InlineFreeTeacherPanel({
  activeSlotInfo, // { dateStr, teacher, period, slot, arrangement, subTeacher }
  allArrangements = {},
  selectedDate,
  onAssignSubstitute,
  onRemoveSubstitute, // (dateStr, absentTeacherId, periodNum) => void
  onClose, // () => void
}) {
  // Active period number synced from activeSlotInfo or default to 1 (Period-only sync)
  const [selectedPeriodNum, setSelectedPeriodNum] = useState(() => activeSlotInfo?.period?.number || 1)

  // Keep period number synced when user clicks any period cell on the timetable
  useEffect(() => {
    if (activeSlotInfo?.period?.number) {
      setSelectedPeriodNum(activeSlotInfo.period.number)
    }
  }, [activeSlotInfo?.period?.number])

  // Teacher selected for (i) Information Modal
  const [infoModalTeacher, setInfoModalTeacher] = useState(null)

  const dateStr = activeSlotInfo?.dateStr || selectedDate
  const currentPeriodObj = useMemo(() => {
    return PERIODS.find((p) => p.number === selectedPeriodNum) || PERIODS[0]
  }, [selectedPeriodNum])

  // =========================================================================
  // SECTION 1: Free Teachers on this Period (Period-only sync across school)
  // =========================================================================

  // Teachers already subbing during this exact period on this date
  const alreadySubbedInThisPeriod = useMemo(() => {
    const set = new Set()
    if (!dateStr || !selectedPeriodNum) return set

    for (const [key, arr] of Object.entries(allArrangements)) {
      if (key.startsWith(dateStr) && key.endsWith(`_${selectedPeriodNum}`) && arr.substituteTeacherId) {
        if (arr.substituteTeacherId !== "SELF") {
          set.add(arr.substituteTeacherId)
        }
      }
    }
    return set
  }, [allArrangements, dateStr, selectedPeriodNum])

  // Calculate all teachers who have a free lecture during this period
  const freeTeachersList = useMemo(() => {
    if (!selectedPeriodNum || !dateStr) return []

    const list = []

    for (const candidate of TEACHERS) {
      // 1. Cannot be already subbing in another class in this period
      if (alreadySubbedInThisPeriod.has(candidate.id)) continue

      // 2. Cannot be teaching their own scheduled class in this period
      const candSchedule = getTeacherScheduleForDate(candidate.id, dateStr)
      if (candSchedule[selectedPeriodNum]) continue

      // Get duty details (how many arrangements + which class/period)
      const dutySummary = getTeacherDutySummaryOnDate(candidate.id, dateStr, allArrangements)

      list.push({
        teacher: candidate,
        dutyCount: dutySummary.count,
        duties: dutySummary.duties,
      })
    }

    // Sort by lowest dutyCount first (fair workload balancing)
    list.sort((a, b) => a.dutyCount - b.dutyCount)
    return list
  }, [selectedPeriodNum, dateStr, alreadySubbedInThisPeriod, allArrangements])

  // ===================================================================================
  // SECTION 2: Teachers Who Got Arrangements Today (Grouped by Teacher with Duty Counts)
  // ===================================================================================
  const assignedFacultyToday = useMemo(() => {
    if (!dateStr) return { list: [], totalDuties: 0 }
    const teacherMap = new Map()
    let totalDuties = 0

    for (const [key, arr] of Object.entries(allArrangements)) {
      if (key.startsWith(dateStr) && arr.substituteTeacherId && arr.substituteTeacherId !== "SELF") {
        const parts = key.split("_")
        const absentTeacherId = parts[1]
        const periodNum = Number(parts[2])

        const subTeacherId = arr.substituteTeacherId
        const subTeacherObj = TEACHERS.find((t) => t.id === subTeacherId)
        if (!subTeacherObj) continue

        const absentTeacher = TEACHERS.find((t) => t.id === absentTeacherId)
        const absentSchedule = getTeacherScheduleForDate(absentTeacherId, dateStr)
        const targetSlot = absentSchedule[periodNum]
        const periodObj = PERIODS.find((p) => p.number === periodNum)

        totalDuties += 1

        if (!teacherMap.has(subTeacherId)) {
          teacherMap.set(subTeacherId, {
            teacher: subTeacherObj,
            count: 0,
            duties: [],
          })
        }

        const entry = teacherMap.get(subTeacherId)
        entry.count += 1
        entry.duties.push({
          periodNum,
          periodLabel: periodObj?.label || `P${periodNum}`,
          startTime: periodObj?.startTime || "",
          endTime: periodObj?.endTime || "",
          class: targetSlot?.class || "—",
          subject: targetSlot?.subject || "General",
          absentTeacherName: absentTeacher?.name || "Faculty",
          absentTeacherId,
          note: arr.note || "",
        })
      }
    }

    // Sort duties within each teacher by periodNum
    for (const item of teacherMap.values()) {
      item.duties.sort((a, b) => a.periodNum - b.periodNum)
    }

    // Convert to list sorted by highest duty count first (workload awareness)
    const list = Array.from(teacherMap.values()).sort((a, b) => b.count - a.count)
    return { list, totalDuties }
  }, [allArrangements, dateStr])

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-xs flex flex-col h-[calc(100vh-5.5rem)] overflow-hidden">
      {/* ========================================================================= */}
      {/* SECTION 1 (TOP): Free Faculty in this Period (Period-only sync)           */}
      {/* ========================================================================= */}
      <div className="flex-1 min-h-0 flex flex-col border-b border-border/80">
        {/* Section 1 Header: Period info + Mini period switcher + count */}
        <div className="px-2.5 py-1.5 bg-muted/40 border-b border-border/70 flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Users className="size-3.5 text-primary shrink-0" />
              <span className="text-xs font-black text-foreground">
                Free Faculty ({currentPeriodObj.label})
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground truncate">
                • {currentPeriodObj.startTime}–{currentPeriodObj.endTime}
              </span>
            </div>

            <Badge variant="outline" className="text-[9px] font-extrabold px-1.5 py-0 bg-background text-primary border-primary/30 shrink-0">
              {freeTeachersList.length} free
            </Badge>
          </div>

          {/* Mini Period Switcher Rail: switch free lecture view to any period */}
          <div className="flex items-center gap-0.5 overflow-x-auto pb-0.5 scrollbar-none">
            {PERIODS.filter((p) => !p.isBreak).map((p) => {
              const isActive = p.number === selectedPeriodNum
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPeriodNum(p.number)}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all border",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                      : "bg-background text-muted-foreground border-border/70 hover:text-foreground hover:bg-muted/60"
                  )}
                  title={`View free teachers in ${p.label} (${p.startTime}–${p.endTime})`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Section 1 Content: Direct list of free teachers (no inputs, no teacher sub-bar) */}
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/50 scrollbar-thin">
          {freeTeachersList.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground space-y-1">
              <AlertCircle className="size-5 text-muted-foreground/40 mx-auto" />
              <p className="font-semibold text-foreground text-xs">No Free Faculty in {currentPeriodObj.label}</p>
              <p className="text-[10px]">All teachers are currently assigned regular classes or substitute duties.</p>
            </div>
          ) : (
            freeTeachersList.map(({ teacher: candidate, dutyCount, duties }) => (
              <div
                key={candidate.id}
                className="px-2.5 py-1.5 hover:bg-muted/30 transition-colors text-xs select-none space-y-1"
              >
                {/* Row 1: Avatar + Name + (i) Button + Duty Badge */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <Avatar className="size-5 rounded-full shrink-0 ring-1 ring-border">
                      <AvatarImage src={candidate.avatar} alt={candidate.name} />
                      <AvatarFallback className="text-[8px] bg-primary/10 text-primary font-bold">
                        {candidate.initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1 flex items-center gap-1">
                      <span className="font-bold text-foreground text-xs truncate leading-none">
                        {candidate.name}
                      </span>

                      {/* (i) Information Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setInfoModalTeacher(candidate)
                        }}
                        className="size-3.5 rounded-full text-muted-foreground hover:text-primary hover:bg-muted/80 inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                        title={`Click (i) to view full schedule & workload of ${candidate.name}`}
                      >
                        <Info className="size-2.5" />
                      </button>
                    </div>
                  </div>

                  {/* Duty Count Badge */}
                  <span
                    className={cn(
                      "text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border cursor-help shrink-0",
                      dutyCount === 0
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : dutyCount === 1
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                        : "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                    )}
                  >
                    {dutyCount} {dutyCount === 1 ? "Arrangement" : "Arrangements"}
                  </span>
                </div>

                {/* Row 2: Tiny Little Badges of existing duties today (same as Faculty with Arrangements Today) */}
                {duties.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap pl-6.5">
                    {duties.map((d) => (
                      <span
                        key={d.periodNum}
                        className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-muted/60 text-[9px] text-foreground border border-border/50"
                        title={`${d.periodLabel}: Class ${d.class} for ${d.absentTeacherName}`}
                      >
                        <span className="font-bold text-primary">{d.periodLabel}:</span>
                        <span className="font-semibold">{d.class}</span>
                        <span className="text-[8px] text-muted-foreground">({d.absentTeacherName.split(" ").slice(-1)[0]})</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ============================================================================================ */}
      {/* SECTION 2 (BOTTOM): Teachers Who Got the Arrangement with the Count (Compact List Form)     */}
      {/* ============================================================================================ */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Section 2 Header: Shows count of teachers who got duties and total duties */}
        <div className="px-2.5 py-1.5 bg-muted/40 border-b border-border/70 flex items-center justify-between gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <UserCheck className="size-3.5 text-primary shrink-0" />
            <span className="text-xs font-black text-foreground truncate">
              Faculty with Arrangements Today
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="secondary" className="text-[9px] font-black px-1.5 py-0 h-4 bg-muted text-foreground">
              {assignedFacultyToday.list.length} {assignedFacultyToday.list.length === 1 ? "Teacher" : "Teachers"}
            </Badge>
            {assignedFacultyToday.totalDuties > 0 && (
              <Badge className="text-[9px] font-black px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/30">
                {assignedFacultyToday.totalDuties} {assignedFacultyToday.totalDuties === 1 ? "Duty" : "Duties"}
              </Badge>
            )}
          </div>
        </div>

        {/* Section 2 List: Teachers Who Got Arrangements with Count & Period Badges */}
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/50 scrollbar-thin">
          {assignedFacultyToday.list.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground space-y-1">
              <UserCheck className="size-5 text-muted-foreground/40 mx-auto" />
              <p className="font-semibold text-foreground text-xs">No Faculty Assigned Yet Today</p>
              <p className="text-[10px]">Teachers assigned to cover classes will appear here with their duty counts.</p>
            </div>
          ) : (
            assignedFacultyToday.list.map(({ teacher: faculty, count, duties }) => (
              <div
                key={faculty.id}
                className="px-2.5 py-1.5 hover:bg-muted/30 transition-colors text-xs select-none space-y-1"
              >
                {/* Row 1: Avatar + Name + (i) Button + Duty Count Pill */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <Avatar className="size-5 rounded-full shrink-0 ring-1 ring-border">
                      <AvatarImage src={faculty.avatar} alt={faculty.name} />
                      <AvatarFallback className="text-[8px] bg-primary/10 text-primary font-bold">
                        {faculty.initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1 flex items-center gap-1">
                      <span className="font-bold text-foreground text-xs truncate leading-none">
                        {faculty.name}
                      </span>

                      {/* (i) Information Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setInfoModalTeacher(faculty)
                        }}
                        className="size-3.5 rounded-full text-muted-foreground hover:text-primary hover:bg-muted/80 inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                        title={`Click (i) to view complete schedule of ${faculty.name}`}
                      >
                        <Info className="size-2.5" />
                      </button>
                    </div>
                  </div>

                  {/* Teacher's Total Duty Count for Today */}
                  <span
                    className={cn(
                      "text-[9px] font-black px-2 py-0.2 rounded-full border shrink-0",
                      count === 1
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : count === 2
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                        : "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                    )}
                  >
                    {count} {count === 1 ? "Arrangement" : "Arrangements"}
                  </span>
                </div>

                {/* Row 2: Compact Pills of which periods and classes this teacher was assigned */}
                <div className="flex items-center gap-1 flex-wrap pl-6.5">
                  {duties.map((d) => (
                    <div
                      key={d.periodNum}
                      className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-muted/60 text-[9px] text-foreground border border-border/50 group"
                      title={`${d.periodLabel}: Class ${d.class} (${d.subject}) covering for ${d.absentTeacherName}`}
                    >
                      <span className="font-bold text-primary">{d.periodLabel}:</span>
                      <span className="font-semibold">{d.class}</span>
                      <span className="text-[8px] text-muted-foreground">({d.absentTeacherName.split(" ").slice(-1)[0]})</span>

                      {/* Remove this specific arrangement */}
                      <button
                        type="button"
                        onClick={() => onRemoveSubstitute(dateStr, d.absentTeacherId, d.periodNum)}
                        className="size-3 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive inline-flex items-center justify-center cursor-pointer ml-0.5"
                        title={`Remove arrangement for ${d.periodLabel}`}
                      >
                        <X className="size-2" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. Teacher Full Dossier (i) Information Dialog */}
      <TeacherInfoModal
        teacher={infoModalTeacher}
        dateStr={dateStr}
        allArrangements={allArrangements}
        isOpen={Boolean(infoModalTeacher)}
        onClose={() => setInfoModalTeacher(null)}
      />
    </div>
  )
}
