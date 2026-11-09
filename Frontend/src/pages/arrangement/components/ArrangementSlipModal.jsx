import React, { useMemo } from "react"
import { Printer, School, CheckCircle2 } from "lucide-react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  TEACHERS,
  PERIODS,
  getTeacherScheduleForDate,
  formatDisplayDate,
} from "../mockArrangementData"

export function ArrangementSlipModal({
  isOpen,
  onClose,
  dateStr,
  teacherIds = [],
  selectedTeacherId,
  arrangements = {},
}) {
  const slipItems = useMemo(() => {
    const list = []
    let sno = 1

    const targetTeacherIds = new Set(teacherIds)
    if (selectedTeacherId) targetTeacherIds.add(selectedTeacherId)
    
    // Also include any teacher who has arrangements on this date
    for (const key of Object.keys(arrangements)) {
      if (key.startsWith(dateStr)) {
        const parts = key.split("_")
        if (parts[1]) targetTeacherIds.add(parts[1])
      }
    }

    for (const teacherId of targetTeacherIds) {
      const teacher = TEACHERS.find((t) => t.id === teacherId)
      const schedule = getTeacherScheduleForDate(teacherId, dateStr)

      for (let pNum = 1; pNum <= 8; pNum++) {
        const slot = schedule[pNum]
        if (!slot) continue // free period for absent teacher

        const periodObj = PERIODS.find((p) => p.number === pNum)
        const arrKey = `${dateStr}_${teacherId}_${pNum}`
        const arr = arrangements[arrKey]
        const isSelf = arr?.substituteTeacherId === "SELF"
        const subTeacher = isSelf
          ? { id: "SELF", name: "Self (Present)", subject: "Teacher Present", isSelf: true }
          : arr?.substituteTeacherId
          ? TEACHERS.find((t) => t.id === arr.substituteTeacherId)
          : null

        list.push({
          sno: sno++,
          periodNum: pNum,
          periodLabel: periodObj?.label || `P${pNum}`,
          periodTime: `${periodObj?.startTime} – ${periodObj?.endTime}`,
          class: slot.class,
          subject: slot.subject,
          room: slot.room || "Classroom",
          teacherName: teacher?.name || "Teacher",
          teacherSubject: teacher?.subject || "",
          substituteTeacher: subTeacher ? subTeacher.name : "Pending Cover",
          substituteSubject: subTeacher ? subTeacher.subject : "",
          isCovered: Boolean(subTeacher),
          note: arr?.note || "Standard study & supervision",
        })
      }
    }

    list.sort((a, b) => a.periodNum - b.periodNum)
    return list
  }, [dateStr, selectedTeacherId, teacherIds, arrangements])

  const handlePrint = () => {
    window.print()
  }

  const formattedDate = formatDisplayDate(dateStr)

  return (
    <Dialog isOpen={isOpen} onOpenChange={onClose} className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
      <div className="relative w-full space-y-4">
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border/60 pb-3">
          <div>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <School className="size-4.5 text-primary" />
              <span>Daily Faculty Arrangement Slip</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Official staff notice for {formattedDate}
            </DialogDescription>
          </div>
          <Button
            type="button"
            onClick={handlePrint}
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold h-8 px-3 rounded-lg cursor-pointer gap-1.5 shadow-2xs mr-8"
          >
            <Printer className="size-3.5" />
            <span>Print Slip</span>
          </Button>
        </DialogHeader>

        {/* Printable Sheet */}
        <div className="p-5 rounded-xl border border-border bg-background shadow-2xs space-y-4 text-foreground print:border-none print:shadow-none print:p-0">
          {/* Institution Letterhead */}
          <div className="text-center border-b border-border/70 pb-3 space-y-0.5">
            <h3 className="text-lg font-black tracking-tight uppercase">
              Apex Academy Senior Secondary School
            </h3>
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold">
              Daily Faculty Substitution & Cover Roster
            </p>
            <div className="flex items-center justify-center gap-3 text-xs font-bold pt-1 text-primary">
              <span>Date: {formattedDate}</span>
              <span>•</span>
              <span>Arranged Covers: {slipItems.filter((i) => i.isCovered).length}</span>
              <span>•</span>
              <span>Vacant: {slipItems.filter((i) => !i.isCovered).length}</span>
            </div>
          </div>

          {/* Table */}
          {slipItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground space-y-1">
              <CheckCircle2 className="size-6 text-emerald-500 mx-auto mb-1" />
              <p className="font-bold text-foreground">No Arrangements Recorded</p>
              <p className="text-[11px]">No substitution arrangements have been assigned on this date.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 px-2.5 w-8 text-center">#</th>
                    <th className="py-2 px-2.5 w-24">Period & Time</th>
                    <th className="py-2 px-2.5 w-20">Class</th>
                    <th className="py-2 px-2.5">Subject</th>
                    <th className="py-2 px-2.5">Faculty</th>
                    <th className="py-2 px-2.5">Substitute Faculty</th>
                    <th className="py-2 px-2.5">Instructions</th>
                    <th className="py-2 px-2.5 w-16 text-center">Sign</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {slipItems.map((item) => (
                    <tr key={item.sno} className="hover:bg-muted/15">
                      <td className="py-2 px-2.5 text-center font-bold text-muted-foreground text-[11px]">
                        {item.sno}
                      </td>
                      <td className="py-2 px-2.5 font-semibold text-foreground">
                        {item.periodLabel}
                        <div className="text-[10px] text-muted-foreground font-normal">
                          {item.periodTime}
                        </div>
                      </td>
                      <td className="py-2 px-2.5">
                        <span className="font-bold">{item.class}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">({item.room})</span>
                      </td>
                      <td className="py-2 px-2.5 font-medium">{item.subject}</td>
                      <td className="py-2 px-2.5">
                        <span className="font-semibold text-foreground">{item.teacherName}</span>
                        <div className="text-[10px] text-muted-foreground">{item.teacherSubject}</div>
                      </td>
                      <td className="py-2 px-2.5">
                        {item.isCovered ? (
                          <span className="font-bold text-emerald-800 dark:text-emerald-300">
                            {item.substituteTeacher}
                            <span className="text-[10px] text-muted-foreground font-normal ml-1">
                              ({item.substituteSubject})
                            </span>
                          </span>
                        ) : (
                          <Badge variant="destructive" className="text-[9px] px-1 py-0 font-bold">
                            Unarranged
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-2.5 text-muted-foreground text-[11px] truncate max-w-[150px]">
                        {item.note}
                      </td>
                      <td className="py-2 px-2.5 text-center border-l border-border/40">
                        <div className="h-5 border-b border-dashed border-border/80 w-10 mx-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Signature Block */}
          <div className="pt-6 flex items-center justify-between text-xs font-semibold text-muted-foreground border-t border-border/60">
            <div>
              <div className="w-28 border-b border-foreground/50 h-6" />
              <p className="mt-1">Coordinator</p>
            </div>
            <div className="text-right">
              <div className="w-28 border-b border-foreground/50 h-6 ml-auto" />
              <p className="mt-1">Principal</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-end pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs font-semibold h-8 px-3 rounded-lg cursor-pointer"
          >
            Close
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  )
}
