import React, { useMemo } from "react"
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  Bell,
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
  TEACHERS,
  PERIODS,
  formatDisplayDate,
  getTeacherScheduleForDate,
} from "../mockArrangementData"
import { cn } from "@/lib/utils"

export function ReviewAndPublishModal({
  isOpen,
  onClose,
  dateStr,
  teacherIds = [],
  allArrangements = {},
  onPublish, // () => void
}) {
  const displayDate = useMemo(() => formatDisplayDate(dateStr), [dateStr])

  // Aggregate stats for this date
  const reviewStats = useMemo(() => {
    let totalScheduled = 0
    let totalCovered = 0
    let totalUncovered = 0

    for (const tId of teacherIds) {
      const schedule = getTeacherScheduleForDate(tId, dateStr)

      for (let pNum = 1; pNum <= 8; pNum++) {
        if (schedule[pNum]) {
          totalScheduled++
          const key = `${dateStr}_${tId}_${pNum}`
          if (allArrangements[key]?.substituteTeacherId) {
            totalCovered++
          } else {
            totalUncovered++
          }
        }
      }
    }

    return {
      teacherCount: teacherIds.length,
      totalScheduled,
      totalCovered,
      totalUncovered,
    }
  }, [teacherIds, dateStr, allArrangements])

  if (!isOpen) return null

  return (
    <Dialog isOpen={isOpen} onOpenChange={onClose} className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
      <div className="flex flex-col space-y-4">
        {/* Header */}
        <DialogHeader className="pb-3 border-b border-border/80">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Bell className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-black text-foreground">
                Review & Publish Daily Arrangements
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Verify substitution coverage for <strong className="text-foreground">{displayDate}</strong> before notifying faculty.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-3.5 space-y-3.5 pr-1 scrollbar-thin">
          {/* 1. Summary Statistics Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl border border-border/80 bg-muted/20 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Absent Faculty
              </span>
              <p className="text-lg font-black text-foreground">
                {reviewStats.teacherCount}
              </p>
            </div>

            <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 block">
                Covered Periods
              </span>
              <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                {reviewStats.totalCovered} / {reviewStats.totalScheduled}
              </p>
            </div>

            <div
              className={cn(
                "p-2.5 rounded-xl border space-y-0.5",
                reviewStats.totalUncovered > 0
                  ? "border-amber-500/30 bg-amber-500/10"
                  : "border-border/80 bg-muted/20"
              )}
            >
              <span
                className={cn(
                  "text-[10px] uppercase font-bold block",
                  reviewStats.totalUncovered > 0
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-muted-foreground"
                )}
              >
                Uncovered Periods
              </span>
              <p
                className={cn(
                  "text-lg font-black",
                  reviewStats.totalUncovered > 0
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-foreground"
                )}
              >
                {reviewStats.totalUncovered}
              </p>
            </div>
          </div>

          {/* 2. Uncovered Warning Banner (if any) */}
          {reviewStats.totalUncovered > 0 && (
            <div className="p-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[11px]">
                  {reviewStats.totalUncovered} period(s) remain uncovered.
                </p>
                <p className="text-[10px] opacity-90 mt-0.5">
                  You can publish now with partial coverage or return to assign substitutes.
                </p>
              </div>
            </div>
          )}

          {/* 3. Detailed Faculty Roster */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Today's Substitution Roster
            </span>

            {teacherIds.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-4 text-center">
                No absent teachers marked for this date.
              </p>
            ) : (
              teacherIds.map((tId) => {
                const absentTeacher = TEACHERS.find((t) => t.id === tId)
                const schedule = getTeacherScheduleForDate(tId, dateStr)

                return (
                  <div
                    key={tId}
                    className="p-2.5 rounded-xl border border-border/70 bg-card space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="size-5 rounded-full">
                        <AvatarImage src={absentTeacher?.avatar} />
                        <AvatarFallback className="text-[9px] font-bold">
                          {absentTeacher?.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-black text-foreground">
                        {absentTeacher?.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        ({absentTeacher?.subject})
                      </span>
                    </div>

                    {/* Periods list */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                      {PERIODS.map((period) => {
                        if (period.isBreak) return null
                        const pNum = period.number
                        const slot = schedule[pNum]
                        if (!slot) return null

                        const arrKey = `${dateStr}_${tId}_${pNum}`
                        const arr = allArrangements[arrKey]
                        const isSelf = arr?.substituteTeacherId === "SELF"
                        const subTeacher = isSelf
                          ? { id: "SELF", name: "Self (Teacher Present)", isSelf: true }
                          : arr?.substituteTeacherId
                          ? TEACHERS.find((t) => t.id === arr.substituteTeacherId)
                          : null

                        return (
                          <div
                            key={pNum}
                            className={cn(
                              "px-2 py-1.5 rounded-lg border text-xs flex items-center justify-between gap-2",
                              subTeacher
                                ? "bg-emerald-500/10 border-emerald-500/30 text-foreground"
                                : "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                            )}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 font-bold text-[11px]">
                                <span>{period.label}: Class {slot.class}</span>
                                <span className="font-normal text-muted-foreground">({slot.subject})</span>
                              </div>
                              {subTeacher ? (
                                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold block truncate">
                                  Sub: {subTeacher.name}
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold block">
                                  ⚠️ Uncovered
                                </span>
                              )}
                            </div>

                            {subTeacher ? (
                              <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            ) : (
                              <AlertTriangle className="size-3 text-amber-600 dark:text-amber-400 shrink-0" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="pt-3 border-t border-border/80 flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs cursor-pointer h-8"
          >
            Back to Edit
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => {
              onPublish()
              onClose()
            }}
            className="text-xs font-bold gap-1.5 cursor-pointer shadow-xs h-8"
          >
            <Send className="size-3.5" />
            <span>Publish & Notify Faculty</span>
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  )
}
