import React, { useMemo } from "react"
import {
  X,
  Clock,
  BookOpen,
  UserCheck,
  Calendar,
  Mail,
  Phone,
  Briefcase,
  CheckCircle2,
  Coffee,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  PERIODS,
  TIMELINE_BOUNDARIES,
  getTeacherScheduleForDate,
  formatDisplayDate,
  TEACHERS,
} from "../mockArrangementData"
import { cn } from "@/lib/utils"

export function TeacherInfoModal({
  teacher,
  dateStr,
  allArrangements = {},
  isOpen,
  onClose,
}) {
  const displayDate = useMemo(() => (dateStr ? formatDisplayDate(dateStr) : ""), [dateStr])

  // Teacher's regular schedule on this date
  const schedule = useMemo(() => {
    if (!teacher?.id || !dateStr) return {}
    return getTeacherScheduleForDate(teacher.id, dateStr)
  }, [teacher?.id, dateStr])

  // Substitutions assigned to this teacher on this date
  const assignedDuties = useMemo(() => {
    if (!teacher?.id || !dateStr) return []
    const duties = []

    for (const [key, arr] of Object.entries(allArrangements)) {
      if (key.startsWith(dateStr) && arr.substituteTeacherId === teacher.id) {
        const parts = key.split("_")
        const absentTeacherId = parts[1]
        const periodNum = Number(parts[2])

        const absentTeacher = TEACHERS.find((t) => t.id === absentTeacherId)
        const absentSchedule = getTeacherScheduleForDate(absentTeacherId, dateStr)
        const slot = absentSchedule[periodNum]
        const periodObj = PERIODS.find((p) => p.number === periodNum)

        duties.push({
          periodNum,
          periodLabel: periodObj?.label || `P${periodNum}`,
          startTime: periodObj?.startTime || "",
          endTime: periodObj?.endTime || "",
          class: slot?.class || "—",
          subject: slot?.subject || "General",
          room: slot?.room || "Classroom",
          absentTeacherName: absentTeacher?.name || "Faculty",
          absentTeacherSubject: absentTeacher?.subject || "",
          note: arr.note || "",
          assignedAt: arr.assignedAt,
        })
      }
    }

    duties.sort((a, b) => a.periodNum - b.periodNum)
    return duties
  }, [teacher?.id, dateStr, allArrangements])

  // Aggregate day statistics
  const dayStats = useMemo(() => {
    let regularCount = 0
    let freeCount = 0

    for (let p = 1; p <= 8; p++) {
      if (schedule[p]) {
        regularCount++
      } else {
        freeCount++
      }
    }

    const substituteCount = assignedDuties.length
    const remainingFree = Math.max(0, freeCount - substituteCount)

    return {
      regularCount,
      substituteCount,
      freeCount,
      remainingFree,
      totalLoad: regularCount + substituteCount,
    }
  }, [schedule, assignedDuties])

  if (!isOpen || !teacher) return null

  return (
    <Dialog isOpen={isOpen} onOpenChange={onClose} className="sm:max-w-xl max-h-[88vh] overflow-y-auto">
      <div className="space-y-4">
        {/* Header */}
        <DialogHeader className="border-b border-border/70 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="size-11 rounded-full ring-2 ring-primary/20 shrink-0">
                <AvatarImage src={teacher.avatar} alt={teacher.name} />
                <AvatarFallback className="text-sm bg-primary/10 text-primary font-bold">
                  {teacher.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-base font-black text-foreground">
                  {teacher.name}
                </DialogTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <span className="font-semibold text-foreground">{teacher.subject}</span>
                  <span>•</span>
                  <span>{teacher.designation || teacher.department}</span>
                </div>
              </div>
            </div>

            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-muted/40">
              <Calendar className="size-2.5 mr-1 text-primary inline" />
              {displayDate}
            </Badge>
          </div>
        </DialogHeader>

        {/* Contact info strip */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/60">
          {teacher.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="size-3 text-muted-foreground" />
              <span>{teacher.email}</span>
            </div>
          )}
          {teacher.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="size-3 text-muted-foreground" />
              <span>{teacher.phone}</span>
            </div>
          )}
        </div>

        {/* Workload Metric Pills */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl border border-border bg-card text-center space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">
              Regular Classes
            </span>
            <span className="text-base font-black text-foreground block">
              {dayStats.regularCount} <span className="text-xs font-normal text-muted-foreground">Periods</span>
            </span>
          </div>

          <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-800 dark:text-emerald-300 block">
              Substitutions
            </span>
            <span className="text-base font-black text-emerald-700 dark:text-emerald-400 block">
              {dayStats.substituteCount} <span className="text-xs font-normal text-emerald-600/80">Duties</span>
            </span>
          </div>

          <div className="p-2.5 rounded-xl border border-border bg-card text-center space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">
              Remaining Free
            </span>
            <span className="text-base font-black text-foreground block">
              {dayStats.remainingFree} <span className="text-xs font-normal text-muted-foreground">Periods</span>
            </span>
          </div>
        </div>

        {/* Complete Day Period-by-Period Timeline */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="size-3 text-primary" />
            <span>Full Daily Schedule (Periods 1 to 8)</span>
          </h4>

          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/60">
            {PERIODS.map((p, idx) => {
              if (p.isBreak) {
                return (
                  <div
                    key="break"
                    className="p-2 bg-muted/40 flex items-center justify-between text-xs text-muted-foreground"
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <Coffee className="size-3 text-muted-foreground" />
                      <span>Recess Break</span>
                    </div>
                    <span className="text-[11px] font-semibold">{TIMELINE_BOUNDARIES[idx]} – {TIMELINE_BOUNDARIES[idx + 1]}</span>
                  </div>
                )
              }

              const pNum = p.number
              const regularSlot = schedule[pNum]
              const subDuty = assignedDuties.find((d) => d.periodNum === pNum)

              return (
                <div
                  key={p.id}
                  className={cn(
                    "p-2 flex items-center justify-between gap-3 text-xs transition-colors",
                    subDuty
                      ? "bg-emerald-500/10 border-l-3 border-l-emerald-500"
                      : regularSlot
                      ? "bg-card border-l-3 border-l-primary"
                      : "bg-muted/15"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-black text-foreground text-xs w-7 shrink-0">
                      {p.label}
                    </span>

                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {p.startTime} – {p.endTime}
                    </span>

                    <div className="min-w-0">
                      {subDuty ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className="bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 text-[9px] font-bold px-1.5 py-0">
                            Substitute
                          </Badge>
                          <span className="font-bold text-foreground truncate">
                            Class {subDuty.class} ({subDuty.subject})
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate">
                            covering for {subDuty.absentTeacherName}
                          </span>
                        </div>
                      ) : regularSlot ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-foreground">
                            Class {regularSlot.class} • {regularSlot.subject}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            ({regularSlot.room || "Room"})
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60 italic text-[11px]">
                          Free Period (Available)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {subDuty ? (
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                        Arranged
                      </span>
                    ) : regularSlot ? (
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        Teaching
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-muted-foreground/50">
                        Free
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <DialogFooter className="pt-2 border-t border-border/70 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs font-semibold h-8 px-4 cursor-pointer"
          >
            Close
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  )
}

