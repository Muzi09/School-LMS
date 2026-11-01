import React, { useState, useMemo } from "react"
import {
  Layers,
  Clock,
  Search,
  Calendar,
  Sparkles,
  GraduationCap,
  Loader2,
  AlertCircle,
  Filter,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useMasterTimetable } from "@/hooks/useTimetable"
import {
  DAYS,
  getTodayKey,
  timeStringToMinutes,
  minutesToTimeString,
  getTimelineBounds,
} from "../timetableUtils"
import { TimelineBlock } from "./TimelineBlock"

export function MasterTimetableGridView({ onEditEntry }) {
  const [selectedDay, setSelectedDay] = useState(getTodayKey)
  const [searchQuery, setSearchQuery] = useState("")

  const { data: masterData, isLoading, error, refetch } = useMasterTimetable()

  const periods = masterData?.periods || []
  const sections = masterData?.sections || []
  const allEntries = masterData?.entries || []

  const bounds = useMemo(() => getTimelineBounds(periods), [periods])
  const { startMinutes, totalMinutes, timeMarkers } = bounds

  // Maximum width for the space between each time marker (each 60 mins is capped at 220px)
  const trackWidthPx = useMemo(() => {
    const HOUR_MAX_WIDTH = 220
    const hours = Math.max(1, totalMinutes / 60)
    return Math.round(hours * HOUR_MAX_WIDTH)
  }, [totalMinutes])

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections
    const q = searchQuery.toLowerCase().trim()
    return sections.filter((s) => s.display_name?.toLowerCase().includes(q))
  }, [sections, searchQuery])

  // Index entries by `(section_id, day_of_week)`
  const entriesBySectionAndDay = useMemo(() => {
    const map = new Map()
    for (const e of allEntries) {
      if (e.day_of_week !== selectedDay) continue
      const secId = String(e.section_id)
      if (!map.has(secId)) {
        map.set(secId, [])
      }
      map.get(secId).push(e)
    }
    return map
  }, [allEntries, selectedDay])

  const todayKey = getTodayKey()

  return (
    <div className="space-y-4">
      {/* Controls Bar: Day Tabs & Section Search */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Day Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {DAYS.map((d) => {
            const isActive = d.key === selectedDay
            const isToday = d.key === todayKey
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setSelectedDay(d.key)}
                className={cn(
                  "relative px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/20"
                    : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
                )}
              >
                <span>{d.label}</span>
                {isToday && (
                  <span
                    className={cn(
                      "ml-1.5 text-[9px] px-1 rounded-full",
                      isActive ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
                    )}
                  >
                    Today
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search input & count badge */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-[240px]">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Filter class/section..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8 text-xs rounded-xl bg-background border-border w-full"
            />
          </div>

          <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/60 border border-border/60 text-xs font-semibold text-muted-foreground">
            <GraduationCap className="size-3.5 text-primary" />
            <span>{filteredSections.length} Sections</span>
          </div>
        </div>
      </div>

      {/* Main Master Timetable Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-muted-foreground bg-card rounded-2xl border border-border">
          <Loader2 className="size-6 animate-spin mx-auto mb-2 text-primary" />
          Loading school-wide master timetable...
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-card rounded-2xl border border-destructive/20 text-destructive space-y-3">
          <AlertCircle className="size-8 mx-auto" />
          <h4 className="text-base font-bold">Unable to load master timetable</h4>
          <p className="text-xs text-muted-foreground">
            {error.data?.detail || error.message || "Failed to load master timetable."}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 text-xs">
            Try Again
          </Button>
        </div>
      ) : filteredSections.length === 0 ? (
        <div className="p-12 text-center bg-card rounded-2xl border border-dashed border-border space-y-3">
          <GraduationCap className="size-10 mx-auto text-muted-foreground/60" />
          <h3 className="text-base font-bold text-foreground">No Classes or Sections Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery
              ? "No classes match your filter query."
              : "Please configure classes and sections in School Management."}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden flex flex-col">
          <div className="overflow-x-auto max-h-[700px] overflow-y-auto scrollbar-thin">
            {/* Master Header */}
            <div className="sticky top-0 z-30 flex bg-muted/85 backdrop-blur-md border-b border-border/80">
              {/* Sticky Class Column Header */}
              <div className="sticky left-0 z-40 w-32 sm:w-36 shrink-0 p-3 bg-muted/95 border-r border-border/70 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider shadow-xs">
                Class / Section
              </div>

              {/* Master Time Scale */}
              <div
                className="relative shrink-0 h-9 px-3 border-r border-border/40"
                style={{ width: `${trackWidthPx}px` }}
              >
                <div className="relative w-full h-full">
                  {timeMarkers.map((marker, idx) => {
                    const pct = ((marker - startMinutes) / totalMinutes) * 100
                    const label = minutesToTimeString(marker)
                    const isFirst = idx === 0 || pct === 0
                    const isLast = idx === timeMarkers.length - 1 || pct >= 100
                    return (
                      <div
                        key={marker}
                        className={cn(
                          "absolute top-0 bottom-0 flex flex-col justify-center",
                          isFirst
                            ? "translate-x-0 items-start pl-0.5"
                            : isLast
                            ? "-translate-x-full items-end pr-0.5"
                            : "-translate-x-1/2 items-center"
                        )}
                        style={{ left: `${pct}%` }}
                      >
                        <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground whitespace-nowrap">
                          {label}
                        </span>
                        <div
                          className={cn(
                            "h-1.5 w-[1px] bg-border mt-0.5",
                            isFirst ? "ml-1" : isLast ? "mr-1" : "mx-auto"
                          )}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Rows: 1 Row per Class/Section */}
            <div className="divide-y divide-border/60">
              {filteredSections.map((sec) => {
                const secEntries = entriesBySectionAndDay.get(String(sec.id)) || []
                const occupiedPeriodIds = new Set(secEntries.map((e) => e.period_id))

                return (
                  <div
                    key={sec.id}
                    className="relative flex hover:bg-muted/10 transition-colors"
                  >
                    {/* Sticky Left Class Column */}
                    <div className="sticky left-0 z-20 w-32 sm:w-36 shrink-0 p-3 bg-card border-r border-border/70 flex flex-col justify-center text-left shadow-xs">
                      <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                        {sec.class_name}
                      </span>
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        Section {sec.section_name}
                      </span>
                      <span className="text-[9px] text-primary/80 mt-0.5 font-medium">
                        {secEntries.length}/{periods.length} slots
                      </span>
                    </div>

                    {/* Timeline Track for this Section */}
                    <div
                      className="relative shrink-0 py-1.5 px-3 min-h-[72px] sm:min-h-[80px] border-r border-border/30"
                      style={{ width: `${trackWidthPx}px` }}
                    >
                      <div className="relative w-full h-full">
                        {/* Background Vertical Grid Lines */}
                        <div className="absolute inset-0 pointer-events-none flex">
                          {timeMarkers.map((marker, i) => {
                            const markerPct = ((marker - startMinutes) / totalMinutes) * 100
                            if (i === 0 || markerPct === 0) return null
                            return (
                              <div
                                key={marker}
                                className="absolute top-0 bottom-0 border-r border-dashed border-border/30"
                                style={{ left: `${markerPct}%` }}
                              />
                            )
                          })}
                        </div>

                        {/* Empty Periods */}
                        {periods.map((period) => {
                          if (occupiedPeriodIds.has(period.id)) return null
                          const pStart = timeStringToMinutes(period.start_time)
                          const pEnd = timeStringToMinutes(period.end_time)
                          const left = Math.max(0, ((pStart - startMinutes) / totalMinutes) * 100)
                          const width = Math.max(2, ((pEnd - pStart) / totalMinutes) * 100)

                          return (
                            <div
                              key={period.id}
                              style={{
                                left: `${left}%`,
                                width: `${width}%`,
                              }}
                              className="absolute top-1 bottom-1 rounded-xl border border-dashed border-border/40 bg-muted/10 flex items-center justify-center text-[10px] text-muted-foreground/30 select-none"
                              title={`Period ${period.period_number} Free (${period.start_time} - ${period.end_time})`}
                            >
                              —
                            </div>
                          )
                        })}

                        {/* Scheduled Lessons */}
                        {secEntries.map((entry) => {
                          const p = periods.find((x) => x.id === entry.period_id)
                          const startTime = entry.start_time || p?.start_time || "08:00"
                          const endTime = entry.end_time || p?.end_time || "08:45"

                          const eStart = timeStringToMinutes(startTime)
                          const eEnd = timeStringToMinutes(endTime)
                          const left = Math.max(0, ((eStart - startMinutes) / totalMinutes) * 100)
                          const width = Math.max(4, ((eEnd - eStart) / totalMinutes) * 100)

                          return (
                            <TimelineBlock
                              key={entry.id}
                              entry={{
                                ...entry,
                                start_time: startTime,
                                end_time: endTime,
                                class_name: sec.class_name,
                                section_name: sec.section_name,
                                period_number: entry.period_number || p?.period_number || 0,
                              }}
                              style={{
                                left: `${left}%`,
                                width: `${width}%`,
                              }}
                              onEdit={onEditEntry}
                              canManage={false}
                              compact={true}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MasterTimetableGridView
