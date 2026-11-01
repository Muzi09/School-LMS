import React, { useState } from "react"
import {
  CalendarCheck,
  Percent,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  PieChart,
  ChevronRight,
  TrendingUp,
  GraduationCap,
  Sparkles,
  Info,
  X,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModalHeader } from "@/components/common/ModalHeader"
import { cn } from "@/lib/utils"
import { useTimetableInsights } from "@/hooks/useTimetable"

export function TimetableInsightsDashboard({ onSelectSection }) {
  const { data: insights, isLoading } = useTimetableInsights()

  const [isConflictsModalOpen, setIsConflictsModalOpen] = useState(false)
  const [isCoverageModalOpen, setIsCoverageModalOpen] = useState(false)

  if (isLoading || !insights) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-2xl bg-card border border-border/70 p-3 flex flex-col justify-between animate-pulse"
          >
            <div className="size-6 rounded-lg bg-muted" />
            <div className="space-y-1">
              <div className="h-4 w-12 bg-muted rounded" />
              <div className="h-3 w-20 bg-muted/60 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const {
    is_configured,
    total_scheduled_periods,
    total_expected_slots,
    assignment_completion_percentage,
    unassigned_slots,
    total_teachers,
    teacher_utilization_percentage,
    free_teachers_now_count,
    conflict_count,
    conflicts = [],
    coverage_summary = { complete_count: 0, partial_count: 0, missing_count: 0, sections: [] },
  } = insights

  const { complete_count, partial_count, missing_count, sections = [] } = coverage_summary

  return (
    <div className="space-y-3">
      {/* Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Total Scheduled Periods */}
        <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Scheduled</span>
            <div className="size-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <CalendarCheck className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
              {total_scheduled_periods}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {is_configured ? `of ${total_expected_slots} total slots` : "Active periods"}
            </div>
          </div>
        </div>

        {/* Card 2: Assignment Completion */}
        <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Completion</span>
            <div className="size-7 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Percent className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            {is_configured && assignment_completion_percentage !== null ? (
              <>
                <div className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight flex items-baseline gap-1">
                  <span>{assignment_completion_percentage}%</span>
                </div>
                <div className="w-full bg-muted/60 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, assignment_completion_percentage)}%` }}
                  />
                </div>
              </>
            ) : (
              <div>
                <span className="inline-flex text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  Not Configured
                </span>
                <p className="text-[9px] text-muted-foreground mt-1">Set periods & classes</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Unassigned Slots */}
        <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Unassigned</span>
            <div className="size-7 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Clock className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            {is_configured && unassigned_slots !== null ? (
              <>
                <div className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                  {unassigned_slots}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  slots awaiting lessons
                </div>
              </>
            ) : (
              <div>
                <span className="inline-flex text-[11px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                  —
                </span>
                <p className="text-[9px] text-muted-foreground mt-1">Configure schedule</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Teacher Utilization */}
        <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Utilization</span>
            <div className="size-7 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <TrendingUp className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            {teacher_utilization_percentage !== null ? (
              <>
                <div className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                  {teacher_utilization_percentage}%
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {total_teachers} teaching staff
                </div>
              </>
            ) : (
              <div>
                <span className="inline-flex text-[11px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                  Not Configured
                </span>
                <p className="text-[9px] text-muted-foreground mt-1">No teaching staff</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 5: Free Teachers */}
        <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Free Staff</span>
            <div className="size-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Users className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
              {free_teachers_now_count ?? total_teachers}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              available right now
            </div>
          </div>
        </div>

        {/* Card 6: Scheduling Conflicts (Clickable) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => conflict_count > 0 && setIsConflictsModalOpen(true)}
          className={cn(
            "p-3.5 rounded-2xl border shadow-2xs transition-all flex flex-col justify-between text-left",
            conflict_count > 0
              ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800 hover:shadow-xs cursor-pointer"
              : "bg-card border-border/80"
          )}
        >
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "text-[11px] font-bold uppercase tracking-wider",
                conflict_count > 0 ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground"
              )}
            >
              Conflicts
            </span>
            <div
              className={cn(
                "size-7 rounded-xl flex items-center justify-center font-bold text-xs",
                conflict_count > 0
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              )}
            >
              {conflict_count > 0 ? (
                <AlertTriangle className="size-3.5" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
            </div>
          </div>

          <div className="mt-2">
            <div
              className={cn(
                "text-xl sm:text-2xl font-extrabold tracking-tight",
                conflict_count > 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {conflict_count}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-between">
              <span>{conflict_count > 0 ? "Click to inspect" : "Zero overlaps"}</span>
              {conflict_count > 0 && <ChevronRight className="size-3 text-rose-500" />}
            </div>
          </div>
        </div>
      </div>

      {/* Coverage Summary Ribbon (Clickable) */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsCoverageModalOpen(true)}
        className="p-3 sm:p-3.5 rounded-2xl bg-card border border-border/80 shadow-2xs hover:border-primary/40 hover:bg-muted/20 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <PieChart className="size-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-foreground block">
              Section Coverage Overview
            </span>
            <span className="text-[11px] text-muted-foreground">
              {sections.length} total sections across classes • Click to inspect section assignments
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>{complete_count} Complete</span>
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <span className="size-2 rounded-full bg-amber-500" />
            <span>{partial_count} Partial</span>
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <span className="size-2 rounded-full bg-rose-500" />
            <span>{missing_count} Missing</span>
          </span>

          <ChevronRight className="size-4 text-muted-foreground hidden sm:inline" />
        </div>
      </div>

      {/* Modal 1: Conflicts Inspector */}
      {isConflictsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200"
            onClick={() => setIsConflictsModalOpen(false)}
          />

          <div className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-200">
            <ModalHeader
              icon={AlertTriangle}
              iconClassName="bg-rose-500/10 text-rose-600 border-rose-500/20"
              title={`Scheduling Conflicts (${conflict_count})`}
              description="The following lessons overlap on the same day and time interval. Please reassign one of the conflicting lessons."
              onClose={() => setIsConflictsModalOpen(false)}
            />

            <div className="p-6 space-y-3 overflow-y-auto flex-1">
              {conflicts.map((conf, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-800/80 bg-rose-50/50 dark:bg-rose-950/30 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between font-bold text-rose-900 dark:text-rose-200">
                    <span>{conf.type === "TEACHER_CONFLICT" ? "Teacher Double-Booked" : "Class Schedule Overlap"}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-200 dark:bg-rose-800 text-rose-800 dark:text-rose-100">
                      {conf.day_of_week} • Period {conf.period_number}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{conf.description}</p>
                  <div className="text-[10px] text-muted-foreground/80 font-mono">
                    Time: {conf.start_time} - {conf.end_time}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-border/70 bg-muted/20 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsConflictsModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Section Coverage Inspector */}
      {isCoverageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200"
            onClick={() => setIsCoverageModalOpen(false)}
          />

          <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-200">
            <ModalHeader
              icon={PieChart}
              title="Timetable Coverage by Section"
              description="Breakdown of scheduled teaching periods vs expected slots for all sections. Click any section to switch to its class timetable."
              onClose={() => setIsCoverageModalOpen(false)}
            />

            <div className="p-6 space-y-3 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {sections.map((sec) => (
                  <div
                    key={sec.section_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSelectSection?.(sec.class_id, sec.section_id)
                      setIsCoverageModalOpen(false)
                    }}
                    className="p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/40 hover:border-primary/40 transition-all flex items-center justify-between gap-3 text-left cursor-pointer group shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                        <span>{sec.class_name} - Section {sec.section_name}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {sec.scheduled_periods} of {sec.expected_periods} slots scheduled ({sec.completion_percentage}%)
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                          sec.status === "COMPLETE"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200"
                            : sec.status === "PARTIAL"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200"
                            : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200"
                        )}
                      >
                        {sec.status}
                      </span>
                      <ExternalLink className="size-3 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border/70 bg-muted/20 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCoverageModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TimetableInsightsDashboard
