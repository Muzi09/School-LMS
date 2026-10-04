import React, { useMemo } from "react"
import { Clock } from "lucide-react"
import { TimetableCell } from "./TimetableCell"
import { cn } from "@/lib/utils"

const DAYS = [
  { key: "MONDAY", label: "Monday", short: "Mon" },
  { key: "TUESDAY", label: "Tuesday", short: "Tue" },
  { key: "WEDNESDAY", label: "Wednesday", short: "Wed" },
  { key: "THURSDAY", label: "Thursday", short: "Thu" },
  { key: "FRIDAY", label: "Friday", short: "Fri" },
  { key: "SATURDAY", label: "Saturday", short: "Sat" },
]

export function TimetableGrid({
  periods = [],
  entries = [],
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  canManage = false,
}) {
  // Index entries by `day_of_week` and `period_id` for O(1) lookup
  const entryMap = useMemo(() => {
    const map = new Map()
    for (const e of entries) {
      const key = `${e.day_of_week}_${e.period_id}`
      map.set(key, e)
    }
    return map
  }, [entries])

  if (periods.length === 0) {
    return null
  }

  return (
    <div className="w-full bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse min-w-[900px] text-left">
          {/* Table Header */}
          <thead>
            <tr className="border-b border-border/80 bg-muted/40">
              {/* Sticky Period Header */}
              <th className="sticky left-0 z-20 bg-muted/95 backdrop-blur-xs py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider w-[140px] border-r border-border/60 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Clock className="size-3.5 text-muted-foreground" />
                  <span>Period</span>
                </div>
              </th>

              {/* Day Headers */}
              {DAYS.map((day) => (
                <th
                  key={day.key}
                  className="py-3.5 px-3 text-center text-xs font-bold text-foreground uppercase tracking-wider min-w-[150px] border-r border-border/40 last:border-r-0"
                >
                  <span className="hidden sm:inline">{day.label}</span>
                  <span className="sm:hidden">{day.short}</span>
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body: 1 Row per Period */}
          <tbody className="divide-y divide-border/60">
            {periods.map((period) => (
              <tr key={period.id} className="hover:bg-muted/10 transition-colors">
                {/* Period Row Header (Sticky Left) */}
                <td className="sticky left-0 z-10 bg-card py-3 px-3 border-r border-border/60 shadow-xs align-middle text-center">
                  <div className="flex flex-col items-center justify-center text-center gap-1">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="inline-flex items-center justify-center size-6 rounded-md bg-primary/10 text-primary font-bold text-xs">
                        P{period.period_number}
                      </span>
                      <span className="text-md font-semibold text-foreground whitespace-nowrap">
                        Period {period.period_number}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground tracking-tight whitespace-nowrap">
                      {period.start_time} - {period.end_time}
                    </span>
                  </div>
                </td>

                {/* Day Cells */}
                {DAYS.map((day) => {
                  const entryKey = `${day.key}_${period.id}`
                  const entry = entryMap.get(entryKey) || null

                  return (
                    <td
                      key={day.key}
                      className="p-2 border-r border-border/40 last:border-r-0 align-top"
                    >
                      <TimetableCell
                        entry={entry}
                        day={day.key}
                        period={period}
                        onAdd={onAddEntry}
                        onEdit={onEditEntry}
                        onDelete={onDeleteEntry}
                        canManage={canManage}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default TimetableGrid
