import React, { useState } from "react"
import { Calendar, Split, CheckSquare, Square, Layers, Info, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { format12h } from "./timeUtils"
import { cn } from "@/lib/utils"

const DAY_LABELS = {
  MONDAY: { short: "Mon", full: "Monday" },
  TUESDAY: { short: "Tue", full: "Tuesday" },
  WEDNESDAY: { short: "Wed", full: "Wednesday" },
  THURSDAY: { short: "Thu", full: "Thursday" },
  FRIDAY: { short: "Fri", full: "Friday" },
  SATURDAY: { short: "Sat", full: "Saturday" },
}

export function DayTabs({
  schedules = [],
  allSchedules = [],
  activeScheduleId,
  showHeader = true,
  readOnly = false,
  onSelectSchedule,
  onOpenSplitModal,
  onOpenMergeModal,
  onMultiSelectSplit,
}) {
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedDays, setSelectedDays] = useState([])
  const [selectedScheduleId, setSelectedScheduleId] = useState(null)

  const handleDayClick = (schedule, day, isUnique) => {
    if (readOnly) return
    if (isSelectMode) {
      if (schedule.days.length <= 1) return
      if (selectedScheduleId && selectedScheduleId !== schedule.id) {
        setSelectedScheduleId(schedule.id)
        setSelectedDays([day])
        return
      }
      setSelectedScheduleId(schedule.id)
      setSelectedDays((prev) =>
        prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
      )
      return
    }

    if (isUnique) {
      onOpenMergeModal(schedule, day)
    } else {
      if (schedule.days.length <= 1) return
      onOpenSplitModal(schedule, [day])
    }
  }

  const handleExecuteMultiSplit = () => {
    if (!selectedScheduleId || selectedDays.length === 0) return
    const schedule = schedules.find((s) => s.id === selectedScheduleId)
    if (schedule && selectedDays.length < schedule.days.length) {
      onOpenSplitModal(schedule, selectedDays)
      setIsSelectMode(false)
      setSelectedDays([])
      setSelectedScheduleId(null)
    }
  }

  return (
    <div className="space-y-2">
      {showHeader && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Calendar className="size-3.5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Day Schedules
            </span>
            <Badge variant="outline" className="text-[11px] font-semibold px-2 py-0.5">
              {schedules.length} {schedules.length === 1 ? "Schedule" : "Schedules"}
            </Badge>
          </div>

          {!readOnly && (
            <div className="flex items-center gap-1.5">
              {isSelectMode ? (
                <div className="flex items-center gap-1.5 animate-in fade-in-50 duration-150">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      setIsSelectMode(false)
                      setSelectedDays([])
                      setSelectedScheduleId(null)
                    }}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    disabled={selectedDays.length === 0}
                    onClick={handleExecuteMultiSplit}
                    className="bg-primary text-primary-foreground font-semibold text-xs shadow-2xs gap-1"
                  >
                    <Split className="size-3" />
                    <span>Split {selectedDays.length} Days</span>
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setIsSelectMode(true)}
                  className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
                >
                  <Split className="size-4" />
                  <span>Select multiple days</span>
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Schedule Groups with Day Tabs on Left and School Timing / Periods Count Right-Aligned */}
      <div className="flex flex-col gap-3 w-full">
        {schedules.map((schedule, sIdx) => {
          const isUnique = schedule.days.length === 1
          const isActive = schedule.id === activeScheduleId || schedules.length === 1
          const periods = schedule.periods || []
          const firstBell = periods[0]?.start_time
          const lastBell = periods[periods.length - 1]?.end_time
          const timingStr = firstBell && lastBell ? `${format12h(firstBell)} – ${format12h(lastBell)}` : ""
          const classPeriodsCount = periods.filter((p) => !p.is_break && p.type !== "Recess").length
          const totalPeriods = periods.length

          return (
            <div
              key={schedule.id || sIdx}
              className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap w-full"
            >
              {/* Left: Day Tabs Group (Light/dark app theme) */}
              <div
                className={cn(
                  "flex items-center gap-1.5 p-1 rounded-xl border transition-all duration-150 bg-primary/5 dark:bg-primary/10 border-border/80",
                  isActive && "ring-1 ring-border/80 shadow-2xs"
                )}
              >
                {/* Day Tabs */}
                <div className="flex items-center gap-0.5">
                  {schedule.days.map((day) => {
                    const dayInfo = DAY_LABELS[day.toUpperCase()] || { short: day, full: day }
                    const isDaySelected = selectedDays.includes(day) && selectedScheduleId === schedule.id
                    const canSplit = schedule.days.length > 1

                    const tabElement = (
                      <button
                        key={day}
                        type="button"
                        disabled={readOnly}
                        onClick={() => handleDayClick(schedule, day, isUnique)}
                        className={cn(
                          "relative px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 select-none",
                          readOnly ? "cursor-default" : "cursor-pointer",
                          isActive
                            ? "bg-primary text-primary-foreground font-bold shadow-xs"
                            : "text-muted-foreground hover:text-foreground hover:bg-primary/10",
                          isDaySelected && "ring-2 ring-primary bg-primary/20 text-primary font-bold"
                        )}
                        aria-label={`Schedule for ${dayInfo.full}`}
                      >
                        {isSelectMode && canSplit && (
                          isDaySelected ? (
                            <CheckSquare className="size-3.5 text-white shrink-0 stroke-[2.2]" />
                          ) : (
                            <Square className="size-3.5 text-white shrink-0 stroke-[2.2]" />
                          )
                        )}
                        <span>{dayInfo.short}</span>
                        {isUnique && (
                          <span className="size-1.5 rounded-full bg-primary/60" />
                        )}
                      </button>
                    )

                    if (!canSplit && !isUnique) {
                      return (
                        <span key={day} title="Only day in this schedule. Cannot split.">
                          {tabElement}
                        </span>
                      )
                    }

                    return tabElement
                  })}
                </div>

                {/* Multi-select split button per schedule if header is hidden */}
                {!showHeader && !readOnly && schedule.days.length > 1 && (
                  <div className="pl-1 border-l border-border/60">
                    {isSelectMode ? (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setIsSelectMode(false)
                            setSelectedDays([])
                            setSelectedScheduleId(null)
                          }}
                          className="h-6 px-1.5 text-[10px]"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          disabled={selectedDays.length === 0}
                          onClick={handleExecuteMultiSplit}
                          className="h-6 px-2 text-[10px] bg-primary text-primary-foreground font-semibold"
                        >
                          Split ({selectedDays.length})
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setIsSelectMode(true)
                          setSelectedScheduleId(schedule.id)
                        }}
                        className="size-7 p-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                        title="Select multiple days to split off"
                      >
                        <Split className="size-4 text-muted-foreground hover:text-foreground" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Right: School Timing & Class Periods Count as a Strip */}
              {periods.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/80 bg-primary/5 dark:bg-primary/10 text-xs sm:text-sm font-semibold text-foreground ml-auto shrink-0 shadow-2xs">
                  {timingStr && (
                    <div className="flex items-center gap-1.5 text-foreground">
                      <Clock className="size-3.5 sm:size-4 text-primary shrink-0" />
                      <span>{timingStr}</span>
                    </div>
                  )}
                  {timingStr && <span className="text-muted-foreground/50">•</span>}
                  <div className="text-muted-foreground flex items-center gap-1.5">
                    <span className="text-foreground font-bold">
                      {totalPeriods} {totalPeriods === 1 ? "Period" : "Periods"}
                    </span>
                    {totalPeriods !== classPeriodsCount && (
                      <>
                        <span className="text-muted-foreground/50">·</span>
                        <span>{classPeriodsCount} Class</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
