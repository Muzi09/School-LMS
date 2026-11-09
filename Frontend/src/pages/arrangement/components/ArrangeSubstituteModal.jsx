import React, { useState, useMemo, useEffect } from "react"
import {
  Search,
  CheckCircle2,
  Trash2,
  Clock,
  BookOpen,
  Calendar,
  UserCheck,
  Plus,
  Info,
  X,
  FileText,
  AlertCircle,
  Users,
} from "lucide-react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TeacherInfoModal } from "./TeacherInfoModal"
import {
  TEACHERS,
  PERIODS,
  getTeacherScheduleForDate,
  getTeacherDutySummaryOnDate,
  formatDisplayDate,
} from "../mockArrangementData"
import { cn } from "@/lib/utils"

export function ArrangeSubstituteModal({
  isOpen,
  onClose,
  activeSlotInfo, // { dateStr, teacher, period, slot, arrangement, subTeacher }
  allArrangements = {},
  onAssignSubstitute, // (dateStr, absentTeacherId, periodNum, substituteTeacherId, note) => void
  onRemoveSubstitute, // (dateStr, absentTeacherId, periodNum) => void
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [customNote, setCustomNote] = useState("")
  const [infoModalTeacher, setInfoModalTeacher] = useState(null)

  const { teacher, dateStr, period, slot, arrangement, subTeacher } = activeSlotInfo || {}
  const displayDate = useMemo(() => (dateStr ? formatDisplayDate(dateStr) : ""), [dateStr])

  const isSelf = arrangement?.substituteTeacherId === "SELF"

  // Synchronize note when arrangement changes
  useEffect(() => {
    if (arrangement?.note && !isSelf) {
      setCustomNote(arrangement.note)
    } else {
      setCustomNote("")
    }
  }, [arrangement, period?.number, teacher?.id, isSelf])

  // Map of teachers already subbing in another class during this exact period on this date
  const subbedInThisPeriodMap = useMemo(() => {
    const map = new Map()
    if (!dateStr || !period?.number) return map

    for (const [key, arr] of Object.entries(allArrangements)) {
      if (key.startsWith(dateStr) && key.endsWith(`_${period.number}`) && arr.substituteTeacherId) {
        if (arr.substituteTeacherId !== "SELF") {
          const parts = key.split("_")
          const absentTeacherId = parts[1]
          const absentTeacher = TEACHERS.find((t) => t.id === absentTeacherId)
          const absentSchedule = getTeacherScheduleForDate(absentTeacherId, dateStr)
          const targetSlot = absentSchedule[period.number]
          map.set(arr.substituteTeacherId, {
            absentTeacherId,
            absentTeacherName: absentTeacher?.name || "Faculty",
            class: targetSlot?.class || "—",
            subject: targetSlot?.subject || "General",
          })
        }
      }
    }
    return map
  }, [allArrangements, dateStr, period?.number])

  // Calculate teachers who are free in this period according to their regular timetable
  const freeTeachersList = useMemo(() => {
    if (!period?.number || !dateStr) return []

    const periodNum = period.number
    const list = []

    for (const candidate of TEACHERS) {
      // 1. Cannot substitute for oneself
      if (candidate.id === teacher?.id) continue

      // 2. Cannot be teaching their own scheduled class in this period
      const candSchedule = getTeacherScheduleForDate(candidate.id, dateStr)
      if (candSchedule[periodNum]) continue

      // Check if already assigned to another absent teacher's class in this period
      const isAssignedToOtherSlot =
        subbedInThisPeriodMap.has(candidate.id) && subTeacher?.id !== candidate.id
      const otherSlotDetails = subbedInThisPeriodMap.get(candidate.id) || null

      // Get duty details (how many duties today + which class/period)
      const dutySummary = getTeacherDutySummaryOnDate(candidate.id, dateStr, allArrangements)

      list.push({
        teacher: candidate,
        dutyCount: dutySummary.count,
        duties: dutySummary.duties,
        isAssignedToOtherSlot,
        otherSlotDetails,
      })
    }

    // Sort: Currently assigned first, then Available first, then assigned to other slot last
    list.sort((a, b) => {
      const isACurrent = subTeacher?.id === a.teacher.id
      const isBCurrent = subTeacher?.id === b.teacher.id
      if (isACurrent) return -1
      if (isBCurrent) return 1
      if (!a.isAssignedToOtherSlot && b.isAssignedToOtherSlot) return -1
      if (a.isAssignedToOtherSlot && !b.isAssignedToOtherSlot) return 1
      return a.dutyCount - b.dutyCount
    })

    return list
  }, [period, dateStr, teacher, subTeacher, subbedInThisPeriodMap, allArrangements])

  // Filter by search query
  const filteredFreeTeachers = useMemo(() => {
    if (!searchQuery.trim()) return freeTeachersList
    const q = searchQuery.toLowerCase()
    return freeTeachersList.filter(
      (item) =>
        item.teacher.name.toLowerCase().includes(q) ||
        item.teacher.subject.toLowerCase().includes(q) ||
        item.teacher.department.toLowerCase().includes(q)
    )
  }, [freeTeachersList, searchQuery])

  if (!isOpen || !activeSlotInfo || !teacher || !period) return null

  return (
    <Dialog isOpen={isOpen} onOpenChange={onClose} className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
      <div className="space-y-3">
        {/* ========================================================================= */}
        {/* Systematic Modal Header: Period, Timing, Teacher Name, Subject, Date     */}
        {/* ========================================================================= */}
        <DialogHeader className="border-b border-border/70 pb-3 space-y-2">
          {/* Row 1: Badges for Period, Time, Class, Subject, Date */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge className="bg-primary/10 text-primary border-primary/30 text-xs font-black px-2 py-0.5">
              <Clock className="size-3 mr-1 inline" />
              {period.label} ({period.startTime} – {period.endTime})
            </Badge>

            {slot && (
              <Badge variant="secondary" className="text-xs font-bold px-2 py-0.5">
                <BookOpen className="size-3 mr-1 inline text-muted-foreground" />
                Class {slot.class} • {slot.subject} {slot.room ? `(${slot.room})` : ""}
              </Badge>
            )}

            <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 ml-auto">
              <Calendar className="size-3 mr-1 text-primary inline" />
              {displayDate}
            </Badge>
          </div>

          {/* Row 2: Absent Teacher Title */}
          <div className="flex items-center gap-2 pt-0.5">
            <Avatar className="size-7 rounded-full ring-1 ring-border shrink-0">
              <AvatarImage src={teacher.avatar} alt={teacher.name} />
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                {teacher.initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-base font-black text-foreground leading-tight">
                Arrange Substitution for {teacher.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Mark as self if present for this period, or select a free faculty member below.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ========================================================================= */}
        {/* SELF BUTTON: Teacher taking class themselves (Fractional absence)         */}
        {/* ========================================================================= */}
        <div
          className={cn(
            "p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5",
            isSelf
              ? "bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30"
              : "bg-muted/30 border-border/80 hover:bg-muted/50"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={cn(
                "size-8 rounded-lg flex items-center justify-center shrink-0",
                isSelf
                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                  : "bg-background border border-border text-muted-foreground"
              )}
            >
              <UserCheck className="size-4.5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold text-foreground">
                  Teacher Present for this Lecture (Self)
                </span>
                {isSelf && (
                  <Badge className="bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 text-[9px] font-black px-1.5 py-0">
                    Active
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                For fractional / partial absence — teacher will conduct this specific class themselves.
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {isSelf ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => onRemoveSubstitute(dateStr, teacher.id, period.number)}
                className="h-7 text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/30 cursor-pointer"
              >
                <Trash2 className="size-3 mr-1" />
                <span>Cancel Self</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onAssignSubstitute(
                    dateStr,
                    teacher.id,
                    period.number,
                    "SELF",
                    "Teacher present for this period (Self)"
                  )
                  onClose()
                }}
                className="h-7 text-xs font-bold border-emerald-500/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/15 cursor-pointer shadow-2xs"
              >
                <UserCheck className="size-3.5 mr-1" />
                <span>Mark as Self</span>
              </Button>
            )}
          </div>
        </div>

        {/* Divider with label */}
        <div className="relative text-center my-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/70" />
          </div>
          <span className="relative bg-popover px-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            Or Assign a Substitute Faculty
          </span>
        </div>

        {/* Current Substitute Banner (if assigned to another teacher) */}
        {subTeacher && !isSelf && (
          <div className="p-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-foreground">
                  Currently Assigned: <strong className="text-emerald-800 dark:text-emerald-300">{subTeacher.name}</strong>
                </span>
                {arrangement?.note && (
                  <p className="text-[10px] text-muted-foreground truncate italic">
                    "{arrangement.note}"
                  </p>
                )}
              </div>
            </div>

            <Button
              type="button"
              variant="destructive"
              size="xs"
              onClick={() => onRemoveSubstitute(dateStr, teacher.id, period.number)}
              className="h-6 text-[10px] font-bold cursor-pointer shrink-0"
            >
              <Trash2 className="size-2.5 mr-1" />
              <span>Remove</span>
            </Button>
          </div>
        )}

        {/* Search & Instruction Note Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search faculty name..."
              className="pl-8 text-xs h-7.5 bg-background rounded-lg"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          <div className="relative">
            <FileText className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Instruction / lesson note (optional)..."
              className="pl-8 text-xs h-7.5 bg-background rounded-lg"
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Available Teachers List with Tiny Little Badges (Same as Side Panel)      */}
        {/* ========================================================================= */}
        <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1 border border-border/70 rounded-xl p-1 bg-background scrollbar-thin">
          {filteredFreeTeachers.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground space-y-1">
              <AlertCircle className="size-6 text-muted-foreground/40 mx-auto" />
              <p className="font-bold text-foreground">No Faculty Free in {period.label}</p>
              <p className="text-[11px]">All other teachers have regular classes scheduled during this period.</p>
            </div>
          ) : (
            filteredFreeTeachers.map(
              ({
                teacher: candidate,
                dutyCount,
                duties,
                isAssignedToOtherSlot,
                otherSlotDetails,
              }) => {
                const isCurrentlyAssigned = subTeacher?.id === candidate.id

                return (
                  <div
                    key={candidate.id}
                    className={cn(
                      "px-2.5 py-2 flex flex-col gap-1 border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors text-xs select-none rounded-lg",
                      isCurrentlyAssigned && "bg-emerald-500/10 border-emerald-500/30",
                      isAssignedToOtherSlot && "opacity-85 bg-muted/15"
                    )}
                  >
                    {/* Row 1: Avatar + Name + (i) Button + Status Badges + Assign Action */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Avatar className="size-5 rounded-full shrink-0 ring-1 ring-border">
                          <AvatarImage src={candidate.avatar} alt={candidate.name} />
                          <AvatarFallback className="text-[8px] bg-primary/10 text-primary font-bold">
                            {candidate.initials}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex items-center gap-1">
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

                      {/* Status Badges & Action */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isCurrentlyAssigned ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40">
                            <CheckCircle2 className="size-2.5 shrink-0" />
                            <span>Currently Assigned</span>
                          </span>
                        ) : isAssignedToOtherSlot ? (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                            title={`Already assigned in P${period.number} to cover Class ${otherSlotDetails?.class} (${otherSlotDetails?.absentTeacherName})`}
                          >
                            <Clock className="size-2.5 shrink-0" />
                            <span>Busy: P{period.number} &rarr; {otherSlotDetails?.class}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="size-2.5 shrink-0" />
                            <span>Available</span>
                          </span>
                        )}

                        {/* Duty Tag (Requirement 2: "Duty" / "Duties") */}
                        <span
                          className={cn(
                            "text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border",
                            dutyCount === 0
                              ? "bg-muted text-muted-foreground border-border"
                              : dutyCount === 1
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                              : "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                          )}
                        >
                          {dutyCount} {dutyCount === 1 ? "Duty" : "Duties"}
                        </span>

                        {isCurrentlyAssigned ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => onRemoveSubstitute(dateStr, teacher.id, period.number)}
                            className="h-5 px-1.5 text-[10px] font-bold text-destructive hover:bg-destructive/10 cursor-pointer"
                          >
                            <Trash2 className="size-2.5 mr-0.5" />
                            <span>Remove</span>
                          </Button>
                        ) : isAssignedToOtherSlot ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            disabled
                            className="h-5.5 px-2 text-[10px] font-bold opacity-50 cursor-not-allowed"
                            title="Cannot assign: Faculty is already assigned to another class during this period."
                          >
                            <span>Busy</span>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="xs"
                            onClick={() => {
                              onAssignSubstitute(
                                dateStr,
                                teacher.id,
                                period.number,
                                candidate.id,
                                customNote
                              )
                              onClose()
                            }}
                            className="h-5.5 px-2 text-[10px] font-bold cursor-pointer gap-0.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
                          >
                            <Plus className="size-2.5" />
                            <span>Assign</span>
                          </Button>
                        )}
                      </div>
                    </div>

                  {/* Row 2: Tiny Little Badges of existing duties today */}
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
                          <span className="text-[8px] text-muted-foreground">
                            ({d.absentTeacherName.split(" ").slice(-1)[0]})
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="pt-2 border-t border-border/70 flex justify-between items-center">
          <span className="text-[11px] text-muted-foreground">
            {filteredFreeTeachers.filter((t) => !t.isAssignedToOtherSlot).length} available (
            {filteredFreeTeachers.length} regularly free in {period.label})
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs font-semibold h-7 px-3 cursor-pointer"
          >
            Close
          </Button>
        </DialogFooter>
      </div>

      {/* Teacher (i) Information Dossier Dialog */}
      <TeacherInfoModal
        teacher={infoModalTeacher}
        dateStr={dateStr}
        allArrangements={allArrangements}
        isOpen={Boolean(infoModalTeacher)}
        onClose={() => setInfoModalTeacher(null)}
      />
    </Dialog>
  )
}

