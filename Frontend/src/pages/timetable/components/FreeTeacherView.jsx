import React, { useState, useMemo } from "react"
import {
  Users,
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  GraduationCap,
  Calendar,
  Filter,
  UserCheck,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useFreeTeachers } from "@/hooks/useTimetable"
import { DAYS, getTodayKey, formatTime12, calculateDuration } from "../timetableUtils"

export function FreeTeacherView() {
  const [selectedDay, setSelectedDay] = useState(getTodayKey)
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedOccupiedSlot, setExpandedOccupiedSlot] = useState(null)

  const { data: freeData, isLoading, error, refetch } = useFreeTeachers(selectedDay)

  const periods = freeData?.periods || []
  const daysList = freeData?.days || []
  const totalStaff = freeData?.total_teachers || 0

  const activeDayData = useMemo(() => {
    return daysList.find((d) => d.day_of_week === selectedDay) || null
  }, [daysList, selectedDay])

  const daySlots = activeDayData?.periods || []

  // Filter slots based on teacher search query
  const filteredSlots = useMemo(() => {
    if (!searchQuery.trim()) return daySlots

    const q = searchQuery.toLowerCase().trim()
    return daySlots.map((slot) => {
      const filteredFree = slot.free_teachers.filter(
        (t) =>
          t.name?.toLowerCase().includes(q) ||
          t.department?.toLowerCase().includes(q) ||
          t.designation?.toLowerCase().includes(q)
      )
      const filteredOccupied = slot.occupied_teachers.filter(
        (item) =>
          item.teacher?.name?.toLowerCase().includes(q) ||
          item.subject?.name?.toLowerCase().includes(q) ||
          item.section?.class_name?.toLowerCase().includes(q)
      )
      return {
        ...slot,
        free_teachers: filteredFree,
        occupied_teachers: filteredOccupied,
        hasMatch: filteredFree.length > 0 || filteredOccupied.length > 0,
      }
    })
  }, [daySlots, searchQuery])

  const todayKey = getTodayKey()

  return (
    <div className="space-y-4">
      {/* Controls Header: Day Pills & Filter Search */}
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

        {/* Search Input & Total Staff badge */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-[240px]">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search teacher, dept, class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8 text-xs rounded-xl bg-background border-border w-full"
            />
          </div>

          <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/60 border border-border/60 text-xs font-semibold text-muted-foreground">
            <Users className="size-3.5 text-primary" />
            <span>{totalStaff} Staff</span>
          </div>
        </div>
      </div>

      {/* Main Availability Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-muted-foreground bg-card rounded-2xl border border-border">
          <Loader2 className="size-6 animate-spin mx-auto mb-2 text-primary" />
          Analyzing teacher schedules and availability across actual time intervals...
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-card rounded-2xl border border-destructive/20 text-destructive space-y-3">
          <AlertCircle className="size-8 mx-auto" />
          <h4 className="text-base font-bold">Unable to load teacher availability</h4>
          <p className="text-xs text-muted-foreground">
            {error.data?.detail || error.message || "Failed to scan availability."}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 text-xs">
            Try Again
          </Button>
        </div>
      ) : periods.length === 0 ? (
        <div className="p-12 text-center bg-card rounded-2xl border border-dashed border-border space-y-3">
          <Clock className="size-10 mx-auto text-muted-foreground/60" />
          <h3 className="text-base font-bold text-foreground">No Timetable Periods Configured</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Please configure daily period timings to view interval availability.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredSlots.map((slot) => {
            const isExpanded = expandedOccupiedSlot === slot.period_id
            const freeCount = slot.free_count ?? slot.free_teachers.length
            const occCount = slot.occupied_count ?? slot.occupied_teachers.length
            const duration = calculateDuration(slot.start_time, slot.end_time)

            return (
              <div
                key={slot.period_id}
                className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden flex flex-col"
              >
                {/* Interval Header */}
                <div className="p-3.5 sm:p-4 border-b border-border/70 bg-muted/20 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="size-7 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                      P{slot.period_number}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-foreground">
                          Period {slot.period_number}
                        </h4>
                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-background border border-border/50 text-muted-foreground">
                          {duration}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Clock className="size-3 text-muted-foreground/70" />
                        <span>
                          {formatTime12(slot.start_time)} – {formatTime12(slot.end_time)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary badges */}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="size-3" />
                      <span>{freeCount} Free</span>
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedOccupiedSlot(isExpanded ? null : slot.period_id)
                      }
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer",
                        occCount > 0
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100"
                          : "bg-muted text-muted-foreground border-border/50"
                      )}
                    >
                      <span>{occCount} Teaching</span>
                      {occCount > 0 &&
                        (isExpanded ? (
                          <ChevronUp className="size-3" />
                        ) : (
                          <ChevronDown className="size-3" />
                        ))}
                    </button>
                  </div>
                </div>

                {/* Free Teachers Content Area */}
                <div className="p-3.5 sm:p-4 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <UserCheck className="size-3.5 text-emerald-600" />
                      <span>Available Teachers ({slot.free_teachers.length})</span>
                    </span>
                  </div>

                  {slot.free_teachers.length === 0 ? (
                    <div className="py-4 text-center text-xs text-muted-foreground/70 italic bg-muted/10 rounded-xl border border-dashed border-border/50">
                      All teaching staff are assigned to classes during this period.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                      {slot.free_teachers.map((t) => (
                        <div
                          key={t.id}
                          className="p-2 rounded-xl border border-border/60 bg-background/50 hover:bg-muted/40 transition-colors flex items-center justify-between gap-2 shadow-2xs"
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-foreground truncate block">
                              {t.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate block">
                              {t.department || t.designation || "Teaching Staff"}
                            </span>
                          </div>
                          <span className="shrink-0 size-2 rounded-full bg-emerald-500" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Expandable Currently Occupied Teachers List */}
                  {isExpanded && occCount > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/60 space-y-2 animate-in fade-in-0 duration-150">
                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <Briefcase className="size-3.5" />
                        <span>Currently Teaching ({slot.occupied_teachers.length})</span>
                      </span>

                      <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
                        {slot.occupied_teachers.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-bold text-foreground truncate block">
                                {item.teacher?.name}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                Subject:{" "}
                                <strong className="text-foreground">
                                  {item.subject?.name}
                                </strong>
                              </span>
                            </div>

                            <span className="shrink-0 px-2 py-0.5 rounded-lg bg-background text-foreground font-semibold border border-border/50 text-[11px]">
                              {item.section?.class_name}-{item.section?.section_name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default FreeTeacherView
