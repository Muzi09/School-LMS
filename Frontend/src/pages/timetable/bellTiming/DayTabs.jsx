import React, { useState } from "react"
import { Calendar, Split, CheckSquare, Square, Layers, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
                  <CheckSquare className="size-3.5" />
                  <span>Select multiple days</span>
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Folder-style Schedule Groups */}
      <div className="flex flex-wrap items-center gap-3">
        {schedules.map((schedule, sIdx) => {
          const isUnique = schedule.days.length === 1
          const isAmber = isUnique || schedule.days.includes("SATURDAY")
          const isActive = schedule.id === activeScheduleId || schedules.length === 1
          const periodCount = schedule.periods?.length || 0

          return (
            <div
              key={schedule.id}
              className={cn(
                "flex items-center gap-1.5 p-1 rounded-xl border transition-all duration-150",
                isAmber
                  ? "bg-amber-500/10 border-amber-300 dark:border-amber-700/60"
                  : "bg-muted/40 border-border/80",
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
                        "relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 select-none",
                        readOnly ? "cursor-default" : "cursor-pointer",
                        isActive
                          ? isAmber
                            ? "bg-amber-400 text-amber-950 font-bold shadow-xs dark:bg-amber-500 dark:text-amber-950"
                            : "bg-card text-foreground font-bold shadow-xs border border-border/60"
                          : isAmber
                          ? "text-amber-800 dark:text-amber-200 hover:bg-amber-400/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/80",
                        isDaySelected && "ring-2 ring-primary bg-primary/20 text-primary font-bold"
                      )}
                      aria-label={`Schedule for ${dayInfo.full}`}
                    >
                      {isSelectMode && canSplit && (
                        isDaySelected ? (
                          <CheckSquare className="size-3 text-primary shrink-0" />
                        ) : (
                          <Square className="size-3 text-muted-foreground shrink-0" />
                        )
                      )}
                      <span>{dayInfo.short}</span>
                      {isUnique && (
                        <span className="size-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
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

              {/* Periods Count Label */}
              <span
                className="px-2 py-1 text-[11px] font-semibold text-muted-foreground"
                title={`${periodCount} periods in this schedule`}
              >
                {periodCount} {periodCount === 1 ? "Period" : "Periods"}
              </span>

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
                      className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                      title="Select multiple days to split off"
                    >
                      <CheckSquare className="size-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
