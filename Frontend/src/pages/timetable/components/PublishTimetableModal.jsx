import React, { useState } from "react"
import {
  Send,
  AlertTriangle,
  CheckCircle2,
  Users,
  Clock,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  Plus,
  Minus,
  RefreshCw,
} from "lucide-react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useTimetablePublishDiff, usePublishTimetable } from "@/hooks/useTimetable"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function PublishTimetableModal({
  isOpen,
  onClose,
  timetable,
  conflictsCount = 0,
  onPublished,
}) {
  const [expandedTeacherId, setExpandedTeacherId] = useState(null)

  const {
    data: diffData,
    isLoading: isDiffLoading,
    isError: isDiffError,
    refetch: refetchDiff,
  } = useTimetablePublishDiff(timetable?.id, {
    enabled: isOpen && Boolean(timetable?.id),
  })

  const publishMutation = usePublishTimetable()

  const hasConflicts = conflictsCount > 0 || (diffData && !diffData.can_publish)
  const effectiveConflictCount = Math.max(conflictsCount, diffData?.conflict_count || 0)

  const handlePublish = async () => {
    if (!timetable?.id) return
    if (hasConflicts) {
      toast.error("Cannot publish timetable with active schedule conflicts.")
      return
    }

    try {
      const res = await publishMutation.mutateAsync(timetable.id)
      toast.success(
        res.message || `Timetable published successfully as Version ${res.version}!`
      )
      onPublished?.(res)
      onClose?.()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to publish timetable."
      toast.error(msg)
    }
  }

  const toggleExpand = (teacherId) => {
    setExpandedTeacherId((prev) => (prev === teacherId ? null : teacherId))
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose?.()}
      className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden [&>[data-slot=dialog]]:flex [&>[data-slot=dialog]]:flex-col [&>[data-slot=dialog]]:overflow-hidden [&>[data-slot=dialog]]:h-full [&>[data-slot=dialog]]:max-h-[90vh]"
    >
      {/* Header */}
        <div className="px-6 py-4 border-b border-border/80 bg-muted/20 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Send className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>Publish Timetable</span>
                  {diffData && (
                    <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 bg-primary/10 text-primary border-primary/30">
                      v{diffData.next_version}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {timetable?.name || "Academic Timetable"} • Finalize changes and notify faculty
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Active Conflict Blocker Banner */}
          {hasConflicts ? (
            <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive space-y-3">
              <div className="flex items-start gap-3">
                <ShieldAlert className="size-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm leading-tight">
                    Publication Blocked: {effectiveConflictCount} {effectiveConflictCount === 1 ? "Conflict" : "Conflicts"} Detected
                  </h4>
                  <p className="text-xs text-destructive/90 leading-relaxed">
                    This timetable contains unresolved schedule conflicts (faculty double-booked in multiple classrooms at the same time). Timetables cannot be published until all conflicts are resolved.
                  </p>
                </div>
              </div>

              {diffData?.conflicts_summary?.length > 0 && (
                <div className="mt-2 pl-8 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-destructive/80">
                    Conflict details:
                  </span>
                  <ul className="text-xs space-y-1 list-disc list-inside text-destructive/90">
                    {diffData.conflicts_summary.slice(0, 5).map((msg, i) => (
                      <li key={i} className="truncate">{msg}</li>
                    ))}
                    {diffData.conflicts_summary.length > 5 && (
                      <li className="italic">
                        ...and {diffData.conflicts_summary.length - 5} more conflict(s).
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          ) : isDiffLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-xs font-medium">Calculating schedule snapshot diff...</span>
            </div>
          ) : isDiffError ? (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between">
              <span>Could not calculate schedule diff. You can still publish cleanly.</span>
              <Button size="xs" variant="outline" onClick={() => refetchDiff()}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              {/* Publication Info Banner */}
              <div className="p-4 rounded-xl border border-border/80 bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-primary" />
                    Targeted Faculty Notification Guarantee
                  </span>
                  <Badge variant="outline" className="text-[11px] font-semibold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30">
                    Zero Spam
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Teachers with schedule changes will receive a single consolidated notification highlighting their new, updated, or removed teaching periods. Teachers with zero changes will not be disturbed.
                </p>
              </div>

              {/* Notification Scope Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-border/60 bg-card flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Affected Faculty
                  </span>
                  <span className="text-xl font-black text-foreground">
                    {diffData?.affected_teachers_count || 0}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Will receive schedule updates
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-border/60 bg-card flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Total Active Periods
                  </span>
                  <span className="text-xl font-black text-foreground">
                    {diffData?.total_entries || 0}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Across all class sections
                  </span>
                </div>
              </div>

              {/* Affected Teachers Breakdown List */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    Affected Faculty List ({diffData?.affected_teachers?.length || 0})
                  </span>
                  {diffData?.is_first_publish && (
                    <span className="text-[10px] text-muted-foreground italic">
                      Initial Timetable Release (all assigned teachers notified)
                    </span>
                  )}
                </div>

                {(!diffData?.affected_teachers || diffData.affected_teachers.length === 0) ? (
                  <div className="py-6 text-center text-xs text-muted-foreground border border-dashed border-border/80 rounded-xl">
                    No schedule changes detected compared to the published snapshot.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {diffData.affected_teachers.map((t) => {
                      const isExpanded = expandedTeacherId === t.teacher_id
                      const addedCount = t.added_slots?.length || 0
                      const removedCount = t.removed_slots?.length || 0
                      const modifiedCount = t.modified_slots?.length || 0

                      return (
                        <div
                          key={t.teacher_id}
                          className="border border-border/70 rounded-xl bg-card overflow-hidden transition-all text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => toggleExpand(t.teacher_id)}
                            className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-muted/40 transition-colors cursor-pointer text-left"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Users className="size-3.5 text-muted-foreground shrink-0" />
                              <span className="font-bold text-foreground truncate">
                                {t.teacher_name}
                              </span>
                              {t.department && (
                                <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
                                  ({t.department})
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {addedCount > 0 && (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 text-[10px] px-1.5 py-0.5">
                                  +{addedCount} Added
                                </Badge>
                              )}
                              {removedCount > 0 && (
                                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px] px-1.5 py-0.5">
                                  -{removedCount} Removed
                                </Badge>
                              )}
                              {modifiedCount > 0 && (
                                <Badge variant="outline" className="bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/30 text-[10px] px-1.5 py-0.5">
                                  {modifiedCount} Modified
                                </Badge>
                              )}
                              {isExpanded ? (
                                <ChevronUp className="size-3.5 text-muted-foreground ml-1" />
                              ) : (
                                <ChevronDown className="size-3.5 text-muted-foreground ml-1" />
                              )}
                            </div>
                          </button>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <div className="px-3 py-2 bg-muted/20 border-t border-border/60 space-y-1.5 text-[11px]">
                              {t.added_slots?.map((slot, idx) => (
                                <div key={`add_${idx}`} className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                  <Plus className="size-3 shrink-0" />
                                  <span>{slot.day_of_week} P{slot.period_number}: {slot.subject_name} ({slot.class_name} {slot.section_name})</span>
                                </div>
                              ))}
                              {t.removed_slots?.map((slot, idx) => (
                                <div key={`rem_${idx}`} className="flex items-center gap-1.5 text-destructive">
                                  <Minus className="size-3 shrink-0" />
                                  <span>{slot.day_of_week} P{slot.period_number}: {slot.subject_name} ({slot.class_name} {slot.section_name})</span>
                                </div>
                              ))}
                              {t.modified_slots?.map((slot, idx) => (
                                <div key={`mod_${idx}`} className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                                  <RefreshCw className="size-3 shrink-0" />
                                  <span>{slot.day_of_week} P{slot.period_number}: {slot.subject_name} ({slot.class_name} {slot.section_name})</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/20 shrink-0 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onClose}
            className="h-9 px-4 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </Button>

          {hasConflicts ? (
            <Button
              type="button"
              variant="destructive"
              size="default"
              disabled
              className="h-9 px-5 text-xs font-bold gap-2 opacity-60 cursor-not-allowed"
            >
              <AlertTriangle className="size-4" />
              <span>Resolve Conflicts First</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="default"
              size="default"
              onClick={handlePublish}
              disabled={publishMutation.isPending || isDiffLoading}
              className="h-9 px-5 text-xs font-bold gap-2 cursor-pointer shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {publishMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Publishing & Notifying...</span>
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  <span>Publish & Notify Faculty</span>
                </>
              )}
            </Button>
          )}
        </div>
    </Dialog>
  )
}

