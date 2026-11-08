import React, { useState } from "react"
import {
  CheckCircle2,
  Copy,
  Trash2,
  Edit2,
  Check,
  AlertTriangle,
  Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { DayTabs } from "./DayTabs"
import { BellTimeline } from "./BellTimeline"
import { WingCard } from "./WingCard"
import { cn } from "@/lib/utils"

export function SetupCard({
  setup,
  setupIndex = 0,
  isOnlySetup = false,
  wings = [],
  sectionAssignments = {},
  selectedSectionIds = [],
  activeScheduleId,
  readOnly = false,
  onSelectSchedule,
  onRenameSetup,
  onDuplicateSetup,
  onDeleteSetup,
  onOpenSplitModal,
  onOpenMergeModal,
  onOpenPeriodModal,
  onInsertPeriodAtBoundary,
  onEditBoundaryTime,
  onApplyTemplate,
  onWingClick,
  onClassClick,
  onSectionClick,
  otherSetups = [],
}) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(setup.name)

  // Assigned sections in this setup
  const assignedSectionIds = Object.entries(sectionAssignments)
    .filter(([_, sId]) => sId === setup.id)
    .map(([secId]) => secId)

  const assignedCount = assignedSectionIds.length
  const schedules = setup.schedules || []
  const activeSchedule = schedules.find((s) => s.id === activeScheduleId) || schedules[0]

  const handleSaveName = () => {
    const trimmed = nameVal.trim()
    if (trimmed && trimmed !== setup.name) {
      onRenameSetup(setup.id, trimmed)
    } else {
      setNameVal(setup.name)
    }
    setIsEditingName(false)
  }

  const canDelete = !isOnlySetup

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card shadow-sm transition-all duration-150 overflow-hidden",
        assignedCount === 0 ? "border-border/80 bg-muted/5" : "border-border/80"
      )}
    >
      {/* 1. SETUP CARD HEADER */}
      <div className="flex items-center justify-between gap-3 p-4 sm:p-5 bg-muted/20 border-b border-border/70 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {/* Numbered Badge (Dark version of app theme) */}
          <div className="size-9 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center shadow-xs shrink-0">
            {setupIndex + 1}
          </div>

          {/* Editable Setup Name */}
          <div className="flex items-center gap-2 min-w-0">
            {isEditingName && !readOnly ? (
              <div className="flex items-center gap-1.5">
                <Input
                  value={nameVal}
                  onChange={(e) => setNameVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName()
                    if (e.key === "Escape") {
                      setNameVal(setup.name)
                      setIsEditingName(false)
                    }
                  }}
                  autoFocus
                  className="h-8 text-sm font-bold w-48"
                />
                <Button
                  type="button"
                  size="xs"
                  onClick={handleSaveName}
                  className="size-7 p-0"
                >
                  <Check className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div
                onClick={() => !readOnly && setIsEditingName(true)}
                className={cn(
                  "flex items-center gap-1.5",
                  !readOnly && "cursor-pointer group"
                )}
                title={readOnly ? undefined : "Click to rename setup"}
              >
                <h3 className="text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                  {setup.name}
                </h3>
                {!readOnly && (
                  <Edit2 className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            )}

            {/* Pill showing "36 CLASSES" */}
            <Badge
              variant={assignedCount === 0 ? "outline" : "secondary"}
              className={cn(
                "text-[10px] font-bold tracking-wider px-2 py-0.5 shrink-0",
                assignedCount === 0 && "bg-muted text-muted-foreground border-border/80"
              )}
            >
              {assignedCount} {assignedCount === 1 ? "CLASS" : "CLASSES"}
            </Badge>

            {assignedCount === 0 && (
              <Badge variant="outline" className="text-[10px] bg-muted/60 text-muted-foreground border-border/80 gap-1 hidden sm:inline-flex">
                <AlertTriangle className="size-3" />
                <span>Empty Setup</span>
              </Badge>
            )}
          </div>
        </div>

        {/* Action Buttons: Duplicate & Delete */}
        {!readOnly && (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onDuplicateSetup(setup.id)}
              className="h-8 px-2.5 text-xs font-semibold gap-1.5 shadow-2xs hover:border-primary/40 text-foreground"
              title="Duplicate timings into a new setup"
            >
              <Copy className="size-3.5 text-primary" />
              <span>Duplicate</span>
            </Button>

            {/* Delete Action (enabled when more than one setup exists) */}
            <span
              title={
                isOnlySetup
                  ? "Cannot delete the only bell setup. A timetable needs at least one setup."
                  : `Delete ${setup.name}`
              }
            >
              <Button
                type="button"
                size="xs"
                isDisabled={isOnlySetup}
                disabled={isOnlySetup}
                onClick={() => onDeleteSetup(setup.id)}
                className={cn(
                  "h-8 px-2.5 text-xs font-semibold gap-1.5 shadow-2xs bg-destructive text-white hover:bg-destructive/90",
                  isOnlySetup && "opacity-40 cursor-not-allowed pointer-events-none"
                )}
                aria-label={`Delete ${setup.name}`}
              >
                <Trash2 className="size-3.5 text-white" />
                <span className="hidden sm:inline text-white">Delete</span>
              </Button>
            </span>
          </div>
        )}
      </div>

      {/* 2. BELL TIMINGS SECTION */}
      <div className="p-4 sm:p-5 border-b border-border/60">
        {/* All Schedules with their Folder Tabs & Timelines */}
        <div className="space-y-6">
          {schedules.map((schedule, sIdx) => {
            return (
              <div key={schedule.id || sIdx} className="space-y-3">
                <DayTabs
                  schedules={[schedule]}
                  allSchedules={schedules}
                  showHeader={false}
                  readOnly={readOnly}
                  onOpenSplitModal={(sch, days) => onOpenSplitModal(setup.id, sch, days)}
                  onOpenMergeModal={(sch, day) => onOpenMergeModal(setup.id, sch, day)}
                />

                <BellTimeline
                  schedule={schedule}
                  setupId={setup.id}
                  readOnly={readOnly}
                  onOpenPeriodModal={(period, idx) => onOpenPeriodModal(setup.id, schedule.id, period, idx)}
                  onInsertPeriodAtBoundary={(insertAfterIdx) =>
                    onInsertPeriodAtBoundary(setup.id, schedule.id, insertAfterIdx)
                  }
                  onEditBoundaryTime={(idx, newTime, isFirst) =>
                    onEditBoundaryTime(setup.id, schedule.id, idx, newTime, isFirst)
                  }
                  onApplyTemplate={(tmpl) => onApplyTemplate(setup.id, schedule.id, tmpl)}
                  otherSetups={otherSetups}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. CLASS ASSIGNMENT SECTION */}
      <div className="p-4 sm:p-5 space-y-4 bg-muted/5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-sm font-semibold text-foreground">
            The above bell timings are applicable to these classes
          </p>
        </div>

        {/* Wing Cards Grid */}
        {assignedCount > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {wings.map((wing, wIdx) => (
              <WingCard
                key={wing.id}
                wing={wing}
                wingIndex={wIdx}
                assignedSectionIds={assignedSectionIds}
                selectedSectionIds={selectedSectionIds}
                readOnly={readOnly}
                onWingClick={(w, secIds) => onWingClick(w, secIds, setup.id)}
                onClassClick={(cls, wName, secIds) => onClassClick(cls, wName, secIds, setup.id)}
                onSectionClick={(e, sec, clsName, wName) =>
                  onSectionClick(e, sec, clsName, wName, setup.id)
                }
              />
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/20 text-center text-xs text-muted-foreground">
            No classes currently assigned to this setup. Click any class or wing from other setups to move them here.
          </div>
        )}
      </div>
    </div>
  )
}
