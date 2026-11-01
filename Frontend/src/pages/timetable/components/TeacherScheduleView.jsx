import React, { useState, useEffect } from "react"
import {
  User,
  GraduationCap,
  Calendar,
  Clock,
  Sparkles,
  BookOpen,
  Mail,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { Combobox } from "@/components/ui/combobox"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useEligibleTeachers, useTeacherSchedule } from "@/hooks/useTimetable"
import { TimelineScheduleGrid } from "./TimelineScheduleGrid"

export function TeacherScheduleView({ canManage = false }) {
  const { data: teachers = [], isLoading: isTeachersLoading } = useEligibleTeachers()
  const [selectedTeacherId, setSelectedTeacherId] = useState("")

  // Auto-select first teacher
  useEffect(() => {
    if (teachers.length > 0 && !selectedTeacherId) {
      setSelectedTeacherId(teachers[0].id)
    }
  }, [teachers, selectedTeacherId])

  const selectedTeacher = teachers.find((t) => String(t.id) === String(selectedTeacherId)) || null

  const {
    data: teacherData,
    isLoading: isScheduleLoading,
    error: scheduleError,
    refetch,
  } = useTeacherSchedule(selectedTeacherId)

  const periods = teacherData?.periods || []
  const entries = teacherData?.entries || []
  const totalPeriods = teacherData?.total_teaching_periods || entries.length

  // Calculate distinct classes
  const distinctClasses = Array.from(
    new Set(
      entries
        .filter((e) => e.class_name)
        .map((e) => `${e.class_name}${e.section_name ? `-${e.section_name}` : ""}`)
    )
  )

  return (
    <div className="space-y-4">
      {/* Teacher Selection & Profile Banner */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
          <div className="flex flex-col items-start gap-1 w-full sm:w-auto">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Select Teaching Staff
            </label>
            <div className="w-full sm:w-[260px]">
              <Combobox
                value={selectedTeacherId}
                onValueChange={(val) => setSelectedTeacherId(val)}
                options={teachers.map((t) => ({
                  value: t.id,
                  label: `${t.name}${t.department ? ` (${t.department})` : ""}`,
                }))}
                placeholder={teachers.length === 0 ? "No Teachers" : "Select Teacher"}
                disabled={isTeachersLoading || teachers.length === 0}
                className="h-9 text-xs font-semibold rounded-xl bg-background border border-border w-full"
              />
            </div>
          </div>

          {/* Quick Teacher Meta Pills */}
          {selectedTeacher && (
            <div className="flex items-center gap-2 flex-wrap pt-1 sm:pt-4">
              {selectedTeacher.department && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-muted/60 text-muted-foreground border border-border/50">
                  {selectedTeacher.department}
                </span>
              )}
              {selectedTeacher.designation && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  {selectedTeacher.designation}
                </span>
              )}
              {selectedTeacher.email && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="size-3" />
                  <span>{selectedTeacher.email}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Teaching load badge */}
        {selectedTeacher && (
          <div className="flex items-center gap-3 bg-muted/40 p-2.5 rounded-xl border border-border/60 self-start md:self-auto">
            <div className="flex items-center gap-1.5 text-xs">
              <Clock className="size-4 text-primary" />
              <span>
                <strong className="text-foreground font-bold">{totalPeriods}</strong> periods/week
              </span>
            </div>
            <div className="h-3 w-[1px] bg-border" />
            <div className="flex items-center gap-1.5 text-xs">
              <GraduationCap className="size-4 text-primary" />
              <span>
                <strong className="text-foreground font-bold">{distinctClasses.length}</strong>{" "}
                classes
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Schedule Timeline */}
      {isTeachersLoading || (isScheduleLoading && !teacherData) ? (
        <div className="py-20 text-center text-xs text-muted-foreground bg-card rounded-2xl border border-border">
          <Loader2 className="size-6 animate-spin mx-auto mb-2 text-primary" />
          Loading teacher timetable...
        </div>
      ) : scheduleError ? (
        <div className="p-8 text-center bg-card rounded-2xl border border-destructive/20 text-destructive space-y-3">
          <AlertCircle className="size-8 mx-auto" />
          <h4 className="text-base font-bold">Unable to load teacher schedule</h4>
          <p className="text-xs text-muted-foreground">
            {scheduleError.data?.detail || scheduleError.message || "Failed to load schedule."}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 text-xs">
            Try Again
          </Button>
        </div>
      ) : teachers.length === 0 ? (
        <div className="p-12 text-center bg-card rounded-2xl border border-dashed border-border space-y-3">
          <User className="size-10 mx-auto text-muted-foreground/60" />
          <h3 className="text-base font-bold text-foreground">No Teaching Staff Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Please register teaching staff profiles in User Management.
          </p>
        </div>
      ) : (
        <TimelineScheduleGrid
          periods={periods}
          entries={entries}
          canManage={false}
          showClass={true}
          emptyMessage="No teaching assignments for this day. Teacher is free."
        />
      )}
    </div>
  )
}

export default TeacherScheduleView
