import React, { useMemo } from "react"
import { Clock, CalendarDays } from "lucide-react"
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
        <table className="w-full border-collapse min-w-[850px] text-left">
          {/* Table Header: Period times on X-Axis */}
          <thead>
            <tr className="border-b border-border/80 bg-muted/40">
              {/* Sticky Day Column Header */}
              <th className="sticky left-0 z-20 bg-muted/95 backdrop-blur-xs py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider w-[130px] border-r border-border/60 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <CalendarDays className="size-3.5 text-muted-foreground" />
                  <span>Day</span>
                </div>
              </th>

              {/* Period Headers (X-Axis) */}
              {periods.map((period) => (
                <th
                  key={period.id}
                  className="py-3 px-3 text-center text-xs font-bold border-r border-border/40 last:border-r-0 min-w-[160px]"
                >
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="inline-flex items-center justify-center size-5 rounded-md bg-primary/10 text-primary font-bold text-[11px]">
                        P{period.period_number}
                      </span>
                      <span className="text-xs font-bold text-foreground whitespace-nowrap">
                        Period {period.period_number}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground tracking-tight whitespace-nowrap">
                      <Clock className="size-3 text-muted-foreground/70" />
                      <span>
                        {period.start_time} - {period.end_time}
                      </span>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body: 1 Row per Day (Y-Axis) */}
          <tbody className="divide-y divide-border/60">
            {DAYS.map((day) => (
              <tr key={day.key} className="hover:bg-muted/10 transition-colors">
                {/* Day Row Header (Sticky Left Y-Axis) */}
                <td className="sticky left-0 z-10 bg-card py-3 px-3 border-r border-border/60 shadow-xs align-middle text-center">
                  <div className="flex flex-col items-center justify-center text-center gap-0.5">
                    <span className="text-sm font-bold text-foreground whitespace-nowrap">
                      {day.label}
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {day.short}
                    </span>
                  </div>
                </td>

                {/* Period Cells */}
                {periods.map((period) => {
                  const entryKey = `${day.key}_${period.id}`
                  const entry = entryMap.get(entryKey) || null

                  return (
                    <td
                      key={period.id}
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
