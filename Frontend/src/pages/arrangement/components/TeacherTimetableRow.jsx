import React, { useMemo } from "react"
import {
  CheckCircle2,
  Coffee,
  Plus,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  PERIODS,
  TIMELINE_BOUNDARIES,
  getTeacherScheduleForDate,
  TEACHERS,
} from "../mockArrangementData"
import { cn } from "@/lib/utils"

export function TeacherTimetableRow({
  dateStr,
  teacher,
  arrangements = {}, // map of `${dateStr}_${teacher.id}_${periodNumber}` -> { substituteTeacherId, note }
  activePeriodNumber,
  activeDateStr,
  onSelectPeriod, // (dateStr, periodNumber, slotInfo) => void (only syncs period with side panel)
  onOpenArrangeModal, // (dateStr, periodNumber, slotInfo) => void (opens Arrange modal)
  onRemoveTeacher, // (teacherId) => void
}) {
  // Teacher's schedule for this specific date
  const schedule = useMemo(() => {
    return getTeacherScheduleForDate(teacher.id, dateStr)
  }, [teacher.id, dateStr])

  // Count scheduled vs covered periods
  const { totalScheduled, coveredCount } = useMemo(() => {
    let scheduled = 0
    let covered = 0
    for (let p = 1; p <= 8; p++) {
      if (schedule[p]) {
        scheduled++
        const key = `${dateStr}_${teacher.id}_${p}`
        if (arrangements[key]?.substituteTeacherId) {
          covered++
        }
      }
    }
    return { totalScheduled: scheduled, coveredCount: covered }
  }, [schedule, dateStr, teacher.id, arrangements])

  return (
    <div className="w-full rounded-xl border border-border/80 bg-card shadow-2xs overflow-visible transition-all">
      {/* 1. Embedded Thumbprint Header on Top Left */}
      <div className="px-3 py-1.5 bg-muted/30 border-b border-border/70 flex items-center justify-between">
        <div className="inline-flex items-center gap-2">
          {/* Teacher Avatar & Identity Thumbprint */}
          <Avatar className="size-5 rounded-full shrink-0 ring-1 ring-primary/20">
            <AvatarImage src={teacher.avatar} alt={teacher.name} />
            <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-bold">
              {teacher.initials}
            </AvatarFallback>
          </Avatar>

          <span className="text-xs font-black text-foreground tracking-tight">
            {teacher.name}
          </span>

          <span className="text-[11px] font-semibold text-muted-foreground">
            • {teacher.subject}
          </span>

          <span className="text-[10px] text-muted-foreground/70 hidden sm:inline">
            ({teacher.designation || teacher.department})
          </span>
        </div>

        {/* Right side of thumbprint: Coverage count & Quick Remove */}
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-bold text-muted-foreground">
            {totalScheduled === 0 ? (
              <span className="text-muted-foreground/60">No classes scheduled</span>
            ) : coveredCount === totalScheduled ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                <CheckCircle2 className="size-3" />
                All {totalScheduled} Covered
              </span>
            ) : (
              <span>
                <strong className="text-foreground">{coveredCount}</strong>/{totalScheduled} Covered
              </span>
            )}
          </span>

          {onRemoveTeacher && (
            <button
              type="button"
              onClick={() => onRemoveTeacher(teacher.id)}
              className="size-5 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors cursor-pointer"
              title={`Remove ${teacher.name} from arrangements`}
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Unified Period Boxes with Identical Width & Shifted-Up Boundary In/Out Times */}
      <div className="pt-3 pb-1.5 px-2 bg-background overflow-x-auto select-none scrollbar-thin">
        <div className="grid grid-cols-9 min-w-[760px] relative border-b border-l border-border/70 rounded-b-lg">
          {PERIODS.map((period, idx) => {
            const isBreak = period.isBreak
            const periodNum = period.number
            const slot = periodNum ? schedule[periodNum] : null
            const isFree = !slot && !isBreak

            // Check if arranged or marked as self
            const arrangementKey = `${dateStr}_${teacher.id}_${periodNum}`
            const arrangement = arrangements[arrangementKey]
            const isSelf = arrangement?.substituteTeacherId === "SELF"
            const subTeacher = isSelf
              ? { id: "SELF", name: "Self", isSelf: true }
              : arrangement?.substituteTeacherId
              ? TEACHERS.find((t) => t.id === arrangement.substituteTeacherId)
              : null

            const isSelected = activeDateStr === dateStr && activePeriodNumber === periodNum
            const isClickable = !isBreak && !isFree

            // Shared boundary in & out times (shifted upward above divider)
            const startTime = TIMELINE_BOUNDARIES[idx]
            const endTime = TIMELINE_BOUNDARIES[idx + 1]

            const handleCellClick = () => {
              if (isClickable) {
                onSelectPeriod(dateStr, periodNum, {
                  teacher,
                  dateStr,
                  period,
                  slot,
                  arrangement,
                  subTeacher,
                })
              }
            }

            return (
              <div
                key={period.id}
                role={isClickable ? "button" : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onClick={handleCellClick}
                onKeyDown={(e) => {
                  if (isClickable && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault()
                    handleCellClick()
                  }
                }}
                className={cn(
                  "relative flex flex-col justify-between p-1.5 border-r border-t border-border/70 transition-all min-h-[92px] outline-none",
                  isBreak && "bg-muted/20 cursor-default",
                  isFree && "bg-muted/10 cursor-default",
                  isClickable && "cursor-pointer",
                  // Unarranged state: prominent amber left accent
                  !isFree && !isBreak && !subTeacher && "border-l-2 border-l-amber-500/80 hover:bg-amber-500/5",
                  // Arranged state: prominent emerald left accent + subtle tint
                  !isFree && !isBreak && subTeacher && "border-l-2 border-l-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10",
                  // Selected state: primary focus ring
                  isSelected && "ring-2 ring-primary ring-inset bg-primary/10"
                )}
                title={
                  isBreak
                    ? "Recess period"
                    : isFree
                    ? "Free period — no scheduled class"
                    : subTeacher
                    ? `Arranged with ${subTeacher.name}. Click to view or change.`
                    : `Unarranged: Class ${slot?.class} (${slot?.subject}). Click to assign substitute.`
                }
              >
                {/* Boundary Start Time Pill (first column only, shifted upward) */}
                {idx === 0 && (
                  <div className="absolute left-0 -top-2.5 -translate-x-1/2 z-20 pointer-events-none">
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold border border-border/90 bg-background shadow-2xs whitespace-nowrap text-muted-foreground">
                      {startTime}
                    </span>
                  </div>
                )}

                {/* Boundary End Time Pill on divider (shifted upward: out of this period is in of next) */}
                <div className="absolute right-0 -top-2.5 translate-x-1/2 z-20 pointer-events-none">
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold border border-border/90 bg-background shadow-2xs whitespace-nowrap text-muted-foreground">
                    {endTime}
                  </span>
                </div>

                {/* Box Top: Period Label Centered, Room No Centered Below It */}
                <div className="text-center pt-0.5">
                  <span className="text-[11px] font-black text-foreground block tracking-tight leading-tight">
                    {period.label}
                  </span>
                  {slot?.room ? (
                    <span className="text-[9px] font-medium text-muted-foreground block truncate leading-tight mt-0.5">
                      {slot.room}
                    </span>
                  ) : isBreak ? (
                    <span className="text-[9px] font-medium text-muted-foreground/60 block leading-tight mt-0.5">
                      35m
                    </span>
                  ) : (
                    <span className="text-[9px] text-transparent block leading-tight mt-0.5 select-none">
                      -
                    </span>
                  )}
                </div>

                {/* Box Center: Class & Subject (Consolidated & Centered) */}
                <div className="my-1 text-center">
                  {isBreak ? (
                    <div className="py-0.5 flex flex-col items-center justify-center text-muted-foreground/60">
                      <Coffee className="size-3 mb-0.5" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">
                        Recess
                      </span>
                    </div>
                  ) : isFree ? (
                    <div className="py-0.5">
                      <span className="text-[10px] font-medium text-muted-foreground/50 italic">
                        Free
                      </span>
                    </div>
                  ) : (
                    <div className="py-0.5">
                      <span className="font-extrabold text-xs text-foreground block tracking-tight leading-tight">
                        Class {slot.class}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground truncate block leading-tight mt-0.5">
                        {slot.subject}
                      </span>
                    </div>
                  )}
                </div>

                {/* Box Bottom: Arrange Button or Arranged Badge */}
                <div className="pt-1">
                  {!isBreak && !isFree && (
                    <>
                      {subTeacher ? (
                        // Already Arranged
                        <div
                          className="w-full text-center py-0.5 px-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 transition-colors flex items-center justify-center gap-1 shadow-2xs"
                        >
                          <span className="text-[10px] font-bold truncate">
                            {subTeacher.name.split(" ").slice(-1)[0]}
                          </span>
                          <CheckCircle2 className="size-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        </div>
                      ) : (
                        // Unarranged: "Arrange" button
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          className="w-full h-5.5 text-[10px] font-bold px-1 rounded transition-all gap-0.5 shadow-2xs border-primary/40 text-primary hover:bg-primary/10 pointer-events-none"
                        >
                          <Plus className="size-2.5" />
                          <span>Arrange</span>
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
