import React, { useState, useMemo, useEffect } from "react"
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Archive,
  Layers,
  FileCheck2,
  Printer,
  Sparkles,
  Save,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { TeacherMultiSelectDropdown } from "./components/TeacherMultiSelectDropdown"
import { TeacherTimetableRow } from "./components/TeacherTimetableRow"
import { InlineFreeTeacherPanel } from "./components/InlineFreeTeacherPanel"
import { ArrangeSubstituteModal } from "./components/ArrangeSubstituteModal"
import { ReviewAndPublishModal } from "./components/ReviewAndPublishModal"
import { ArrangementSlipModal } from "./components/ArrangementSlipModal"
import { ArchivedRecordsView } from "./components/ArchivedRecordsView"
import {
  TEACHERS,
  PERIODS,
  getTodayDateString,
  getTeacherScheduleForDate,
  formatDisplayDate,
  loadArrangementData,
  saveArrangementData,
  resetArrangementData,
  autoAssignForDate,
  SAMPLE_ARCHIVED_RECORDS,
} from "./mockArrangementData"
import { cn } from "@/lib/utils"

export function Arrangement() {
  const todayStr = useMemo(() => getTodayDateString(), [])

  // 1. Navigation Tab: "workspace" (Active Arrangements) vs "archive" (Archived Records)
  const [activeTab, setActiveTab] = useState("workspace")

  // 2. Active Single Date State (Default: Today)
  const [selectedDate, setSelectedDate] = useState(() => getTodayDateString())

  // 3. Persistent Arrangement Mappings and Absent Teachers
  const [arrangementData, setArrangementData] = useState(() => loadArrangementData())

  // Save changes to localStorage
  useEffect(() => {
    saveArrangementData(arrangementData)
  }, [arrangementData])

  // Current absent teacher IDs for the selected date
  const absentTeacherIds = useMemo(() => {
    return arrangementData.absentTeachersByDate?.[selectedDate] || []
  }, [arrangementData.absentTeachersByDate, selectedDate])

  // Current absent teachers objects
  const absentTeachers = useMemo(() => {
    return absentTeacherIds.map((id) => TEACHERS.find((t) => t.id === id)).filter(Boolean)
  }, [absentTeacherIds])

  // 4. Active Slot Info for Substitution Panel & Modal
  // { dateStr, teacher, period, slot, arrangement, subTeacher }
  const [activeSlotInfo, setActiveSlotInfo] = useState(null)

  // 5. Arrange Substitute Modal State (opens on + Arrange click)
  const [isArrangeModalOpen, setIsArrangeModalOpen] = useState(false)

  // 6. Review & Publish Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)

  // 7. Print Slip Modal State
  const [isPrintSlipOpen, setIsPrintSlipOpen] = useState(false)

  // 7. Published status per date (persisted in arrangementData.publishedDates)
  const isDatePublished = useMemo(() => {
    return Boolean(arrangementData.publishedDates?.[selectedDate])
  }, [arrangementData.publishedDates, selectedDate])

  // 8. Check if selected date is Sunday
  const isSunday = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split("-").map(Number)
      return new Date(y, m - 1, d).getDay() === 0
    } catch {
      return false
    }
  }, [selectedDate])

  // 9. Coverage Metrics for the Selected Date
  const dateMetrics = useMemo(() => {
    let totalScheduled = 0
    let totalCovered = 0
    let totalUncovered = 0

    for (const tId of absentTeacherIds) {
      const schedule = getTeacherScheduleForDate(tId, selectedDate)

      for (let pNum = 1; pNum <= 8; pNum++) {
        if (schedule[pNum]) {
          totalScheduled++
          const key = `${selectedDate}_${tId}_${pNum}`
          if (arrangementData.arrangements?.[key]?.substituteTeacherId) {
            totalCovered++
          } else {
            totalUncovered++
          }
        }
      }
    }

    const coveragePct = totalScheduled > 0 ? Math.round((totalCovered / totalScheduled) * 100) : 0

    return {
      totalScheduled,
      totalCovered,
      totalUncovered,
      coveragePct,
      allCovered: totalScheduled > 0 && totalUncovered === 0,
    }
  }, [absentTeacherIds, selectedDate, arrangementData.arrangements])

  // --- Date Navigation Handlers ---

  const handleStepDay = (step) => {
    try {
      const [y, m, d] = selectedDate.split("-").map(Number)
      const dateObj = new Date(y, m - 1, d)
      dateObj.setDate(dateObj.getDate() + step)
      const nextDateStr = dateObj.toISOString().slice(0, 10)
      setSelectedDate(nextDateStr)
      setActiveSlotInfo(null)
    } catch {}
  }

  const handleJumpToToday = () => {
    setSelectedDate(todayStr)
    setActiveSlotInfo(null)
  }

  // --- Absent Teacher Handlers for Current Date ---

  const handleToggleTeacher = (teacherId) => {
    setArrangementData((prev) => {
      const currentList = prev.absentTeachersByDate?.[selectedDate] || []
      const exists = currentList.includes(teacherId)
      const nextList = exists
        ? currentList.filter((id) => id !== teacherId)
        : [...currentList, teacherId]

      return {
        ...prev,
        absentTeachersByDate: {
          ...prev.absentTeachersByDate,
          [selectedDate]: nextList,
        },
      }
    })
    if (activeSlotInfo?.teacher?.id === teacherId) {
      setActiveSlotInfo(null)
    }
  }

  const handleSelectAllTeachers = () => {
    setArrangementData((prev) => ({
      ...prev,
      absentTeachersByDate: {
        ...prev.absentTeachersByDate,
        [selectedDate]: TEACHERS.map((t) => t.id),
      },
    }))
    toast.info(`Marked all ${TEACHERS.length} faculty as absent for this date.`)
  }

  const handleClearAllTeachers = () => {
    setArrangementData((prev) => ({
      ...prev,
      absentTeachersByDate: {
        ...prev.absentTeachersByDate,
        [selectedDate]: [],
      },
    }))
    setActiveSlotInfo(null)
    toast.info("Cleared absent faculty for this date.")
  }

  const handleRemoveTeacher = (teacherId) => {
    const teacher = TEACHERS.find((t) => t.id === teacherId)
    setArrangementData((prev) => {
      const currentList = prev.absentTeachersByDate?.[selectedDate] || []
      return {
        ...prev,
        absentTeachersByDate: {
          ...prev.absentTeachersByDate,
          [selectedDate]: currentList.filter((id) => id !== teacherId),
        },
      }
    })
    if (activeSlotInfo?.teacher?.id === teacherId) {
      setActiveSlotInfo(null)
    }
    toast.info(`Removed ${teacher?.name || "Teacher"} from today's list.`)
  }

  // --- Arrangement Slot Handlers ---

  // Clicking on a timetable cell only selects and syncs the period with the side panel
  const handleSelectPeriod = (dateStr, periodNum, slotInfo) => {
    setActiveSlotInfo(slotInfo)
  }

  // Clicking "+ Arrange" button or arranged badge opens the Arrange modal directly
  const handleOpenArrangeModal = (dateStr, periodNum, slotInfo) => {
    setActiveSlotInfo(slotInfo)
    setIsArrangeModalOpen(true)
  }

  const handleAssignSubstitute = (
    dateStr,
    absentTeacherId,
    periodNum,
    substituteTeacherId,
    note
  ) => {
    const arrKey = `${dateStr}_${absentTeacherId}_${periodNum}`
    const isSelf = substituteTeacherId === "SELF"
    const subTeacher = isSelf
      ? { id: "SELF", name: "Self", isSelf: true }
      : TEACHERS.find((t) => t.id === substituteTeacherId)

    const updatedArrangements = {
      ...arrangementData.arrangements,
      [arrKey]: {
        substituteTeacherId,
        note: note || (isSelf ? "Self - Present for this lecture" : ""),
        assignedAt: new Date().toISOString(),
      },
    }

    setArrangementData((prev) => ({
      ...prev,
      arrangements: updatedArrangements,
    }))

    if (activeSlotInfo) {
      setActiveSlotInfo((prev) => ({
        ...prev,
        arrangement: updatedArrangements[arrKey],
        subTeacher,
      }))
    }

    // Interactive Toast with Undo action!
    if (isSelf) {
      toast.success(`Marked as Self for Period ${periodNum}`, {
        description: "Teacher will take this specific lecture themselves.",
        action: {
          label: "Undo",
          onClick: () => handleRemoveSubstitute(dateStr, absentTeacherId, periodNum),
        },
      })
    } else {
      toast.success(`Assigned ${subTeacher?.name} to Period ${periodNum}`, {
        description: activeSlotInfo?.slot
          ? `Covering Class ${activeSlotInfo.slot.class} (${activeSlotInfo.slot.subject})`
          : undefined,
        action: {
          label: "Undo",
          onClick: () => handleRemoveSubstitute(dateStr, absentTeacherId, periodNum),
        },
      })
    }
  }

  const handleRemoveSubstitute = (dateStr, absentTeacherId, periodNum) => {
    const arrKey = `${dateStr}_${absentTeacherId}_${periodNum}`
    const nextArrangements = { ...arrangementData.arrangements }
    delete nextArrangements[arrKey]

    setArrangementData((prev) => ({
      ...prev,
      arrangements: nextArrangements,
    }))

    if (activeSlotInfo) {
      setActiveSlotInfo((prev) => ({
        ...prev,
        arrangement: null,
        subTeacher: null,
      }))
    }

    toast.info(`Removed substitute from Period ${periodNum}`)
  }

  // Auto-Assign for Current Date
  const handleAutoAssign = () => {
    const { updatedArrangements, assignedCount } = autoAssignForDate(
      selectedDate,
      absentTeacherIds,
      arrangementData.arrangements
    )

    setArrangementData((prev) => ({
      ...prev,
      arrangements: updatedArrangements,
    }))

    if (assignedCount > 0) {
      toast.success(
        `Auto-assigned ${assignedCount} uncovered periods with least-loaded faculty!`
      )
    } else {
      toast.info("All scheduled periods are already covered for this date.")
    }
  }

  // Save Draft Explicitly
  const handleSaveDraft = () => {
    try {
      saveArrangementData(arrangementData)
      toast.success("Arrangement draft saved successfully!")
    } catch {
      toast.error("Failed to save draft.")
    }
  }

  // Publish Arrangements for Current Date
  const handlePublish = () => {
    setArrangementData((prev) => ({
      ...prev,
      publishedDates: {
        ...(prev.publishedDates || {}),
        [selectedDate]: true,
      },
    }))

    toast.success("Arrangements Published!", {
      description: `Notifications dispatched to all assigned substitute teachers for ${formatDisplayDate(selectedDate)}.`,
      duration: 5000,
    })
  }

  // Reset Demo Data
  const handleResetDemo = () => {
    const fresh = resetArrangementData()
    setArrangementData(fresh)
    setSelectedDate(todayStr)
    setActiveSlotInfo(null)
    toast.info("Reset arrangement demo data to default sample state.")
  }

  const displayDate = formatDisplayDate(selectedDate)

  return (
    <div className="w-full h-full flex flex-col min-h-0 space-y-2">
      {/* 1. Single Unified Top Header & Toolbar (Maximum Space Economy) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-border/70 shrink-0">
        {/* Left: Title & View Switcher */}
        <div className="flex items-center gap-2.5">
          <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight leading-none whitespace-nowrap">
            Arrangement and Substitution
          </h1>

          {/* View Switcher: Workspace vs Archive */}
          <div className="flex items-center p-0.5 rounded-lg border border-border bg-muted/40 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("workspace")}
              className={cn(
                "px-2.5 py-1 rounded-md font-bold flex items-center gap-1.5 cursor-pointer transition-all",
                activeTab === "workspace"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Layers className="size-3 text-primary" />
              <span className="hidden sm:inline">Workspace</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("archive")}
              className={cn(
                "px-2.5 py-1 rounded-md font-bold flex items-center gap-1.5 cursor-pointer transition-all",
                activeTab === "archive"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Archive className="size-3 text-muted-foreground" />
              <span className="hidden sm:inline">Archived</span>
            </button>
          </div>
        </div>

        {/* Right: All Toolbar Controls in Logical Order */}
        {activeTab === "workspace" ? (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* 1. Date Picker with Stepper */}
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5 shadow-2xs">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => handleStepDay(-1)}
                className="size-6.5 p-0 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft className="size-3.5" />
              </Button>

              <div className="relative inline-flex items-center px-1.5">
                <Calendar className="size-3 text-primary mr-1 shrink-0" />
                <span className="text-xs font-bold text-foreground whitespace-nowrap">
                  {displayDate}
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value)
                      setActiveSlotInfo(null)
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                  title="Click to pick date from calendar"
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => handleStepDay(1)}
                className="size-6.5 p-0 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                title="Next Day"
              >
                <ChevronRight className="size-3.5" />
              </Button>

              {selectedDate !== todayStr && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={handleJumpToToday}
                  className="h-5.5 px-1.5 text-[10px] font-bold text-primary hover:bg-primary/10 rounded cursor-pointer ml-0.5"
                >
                  Today
                </Button>
              )}
            </div>

            {/* 2. Status Badge */}
            {isDatePublished ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold h-6.5 px-2 gap-1">
                <CheckCircle2 className="size-2.5" />
                <span>Published</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="border-border text-muted-foreground text-[10px] font-semibold h-6.5 px-2">
                Draft
              </Badge>
            )}

            {/* 3. Teacher Dropdown */}
            <TeacherMultiSelectDropdown
              selectedTeacherIds={absentTeacherIds}
              onToggleTeacher={handleToggleTeacher}
              onSelectAll={handleSelectAllTeachers}
              onClearAll={handleClearAllTeachers}
            />

            {/* 4. Status Bar (Coverage Progress) */}
            {dateMetrics.totalScheduled > 0 && (
              <div className="hidden lg:inline-flex items-center gap-2 px-2 py-0.5 rounded-lg bg-muted/40 border border-border h-6.5">
                <span className="text-[10px] font-bold text-foreground whitespace-nowrap">
                  {dateMetrics.coveragePct}%
                </span>
                <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                  ({dateMetrics.totalCovered}/{dateMetrics.totalScheduled})
                </span>
                <div className="w-12 xl:w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      dateMetrics.allCovered ? "bg-emerald-500" : "bg-primary"
                    )}
                    style={{ width: `${dateMetrics.coveragePct}%` }}
                  />
                </div>
              </div>
            )}

            {/* 5. Auto-Assign Action */}
            {absentTeacherIds.length > 0 && dateMetrics.totalUncovered > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoAssign}
                className="h-6.5 px-2 text-xs font-semibold gap-1 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer shadow-2xs"
                title="Smart fill uncovered periods with least loaded free teachers"
              >
                <Sparkles className="size-3 text-primary" />
                <span className="hidden xl:inline">Auto-Assign</span>
              </Button>
            )}

            {/* 6. Print Slip Action */}
            {absentTeacherIds.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPrintSlipOpen(true)}
                className="h-6.5 px-2 text-xs font-semibold gap-1 cursor-pointer shadow-2xs"
                title="Print daily substitution slip"
              >
                <Printer className="size-3 text-muted-foreground" />
                <span className="hidden 2xl:inline">Print</span>
              </Button>
            )}

            {/* 7. Save Draft Action */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              className="h-6.5 px-2 text-xs font-semibold gap-1 cursor-pointer shadow-2xs"
              title="Save draft"
            >
              <Save className="size-3 text-muted-foreground" />
              <span className="hidden sm:inline">Save</span>
            </Button>

            {/* 8. Review & Publish Action (Primary Anchor) */}
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setIsReviewModalOpen(true)}
              disabled={absentTeacherIds.length === 0}
              className="h-6.5 px-2.5 text-xs font-bold gap-1 cursor-pointer shadow-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <FileCheck2 className="size-3" />
              <span>Review & Publish</span>
            </Button>

            {/* 9. Reset Demo Data */}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleResetDemo}
              className="size-6.5 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Reset arrangements to default sample data"
            >
              <RotateCcw className="size-3" />
            </Button>
          </div>
        ) : (
          /* Archive Tab Header Actions */
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleResetDemo}
              className="size-6.5 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Reset demo data"
            >
              <RotateCcw className="size-3" />
            </Button>
          </div>
        )}
      </div>

      {/* 2. Main Content */}
      {activeTab === "workspace" ? (
        <div className="flex-1 min-h-0 flex flex-col space-y-2 overflow-hidden">
          {/* Sunday / Holiday Warning Notice */}
          {isSunday && (
            <div className="p-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2 shrink-0">
              <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                <strong>Sunday Notice:</strong> School is closed on Sundays. No regular timetable periods are scheduled.
              </span>
            </div>
          )}

          {/* Option A Master-Detail Layout */}
          {absentTeachers.length === 0 ? (
            /* Actionable Empty State */
            <div className="flex-1 overflow-y-auto py-12 text-center bg-card rounded-2xl border border-dashed border-border/80 space-y-3 p-4">
              <Users className="size-8 text-muted-foreground/40 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-foreground">
                  No absent faculty marked for {displayDate}
                </p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Click the "+ Select Absent Faculty" button in the header above, or click any faculty below to mark them absent:
                </p>
              </div>

              {/* Quick-Pick Absent Teachers */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1 max-w-lg mx-auto">
                {TEACHERS.slice(0, 5).map((t) => (
                  <Button
                    key={t.id}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => handleToggleTeacher(t.id)}
                    className="text-xs font-semibold gap-1.5 h-7 px-2 cursor-pointer hover:border-primary/50"
                  >
                    <span>+ {t.name}</span>
                    <span className="text-[10px] text-muted-foreground">({t.subject})</span>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 overflow-hidden">
              {/* Left Column: Teacher Timetable Rows - Scrolls independently */}
              <div className="w-full lg:flex-1 lg:min-w-0 h-full overflow-y-auto space-y-2 pr-1.5 scrollbar-thin">
                {absentTeachers.map((teacher) => (
                  <TeacherTimetableRow
                    key={teacher.id}
                    dateStr={selectedDate}
                    teacher={teacher}
                    arrangements={arrangementData.arrangements || {}}
                    activePeriodNumber={
                      activeSlotInfo?.dateStr === selectedDate &&
                      activeSlotInfo?.teacher?.id === teacher.id
                        ? activeSlotInfo?.period?.number
                        : null
                    }
                    activeDateStr={
                      activeSlotInfo?.teacher?.id === teacher.id
                        ? activeSlotInfo?.dateStr
                        : null
                    }
                    onSelectPeriod={handleSelectPeriod}
                    onOpenArrangeModal={handleOpenArrangeModal}
                    onRemoveTeacher={handleRemoveTeacher}
                  />
                ))}
              </div>

              {/* Right Column: Fixed Side Panel - Does not scroll with timetable */}
              <div className="w-full lg:w-[380px] xl:w-[410px] shrink-0 h-full flex flex-col overflow-hidden animate-in fade-in-0 duration-200">
                <InlineFreeTeacherPanel
                  activeSlotInfo={activeSlotInfo}
                  allArrangements={arrangementData.arrangements || {}}
                  selectedDate={selectedDate}
                  absentTeacherIds={absentTeacherIds}
                  onAssignSubstitute={handleAssignSubstitute}
                  onRemoveSubstitute={handleRemoveSubstitute}
                  onClose={activeSlotInfo ? () => setActiveSlotInfo(null) : undefined}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Archived Records View: Historical Ledger */
        <div className="flex-1 min-h-0 overflow-y-auto">
          <ArchivedRecordsView
            records={SAMPLE_ARCHIVED_RECORDS}
            onOpenPrintSlipForDate={(dateStr) => {
              setSelectedDate(dateStr)
              setIsPrintSlipOpen(true)
            }}
          />
        </div>
      )}

      {/* Arrange Substitute Modal (Opens upon clicking + Arrange on any period cell) */}
      <ArrangeSubstituteModal
        isOpen={isArrangeModalOpen}
        onClose={() => setIsArrangeModalOpen(false)}
        activeSlotInfo={activeSlotInfo}
        allArrangements={arrangementData.arrangements || {}}
        onAssignSubstitute={handleAssignSubstitute}
        onRemoveSubstitute={handleRemoveSubstitute}
      />

      {/* Review & Publish Modal */}
      <ReviewAndPublishModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        dateStr={selectedDate}
        teacherIds={absentTeacherIds}
        allArrangements={arrangementData.arrangements || {}}
        onPublish={handlePublish}
      />

      {/* Printable Arrangement Slip Modal */}
      <ArrangementSlipModal
        isOpen={isPrintSlipOpen}
        onClose={() => setIsPrintSlipOpen(false)}
        dateStr={selectedDate}
        teacherIds={absentTeacherIds}
        arrangements={arrangementData.arrangements || {}}
      />
    </div>
  )
}

export default Arrangement
