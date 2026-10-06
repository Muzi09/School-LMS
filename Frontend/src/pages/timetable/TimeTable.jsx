import React, { useState, useEffect, useMemo } from "react"
import {
  CalendarDays,
  Settings,
  Plus,
  RefreshCw,
  AlertCircle,
  Loader2,
  CalendarCheck,
  Sparkles,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/PageHeader"
import { DeleteConfirmDialog } from "@/components/common/DeleteConfirmDialog"
import { useAuth } from "@/context/AuthContext"
import { Permission, hasPermission } from "@/lib/permissions"
import {
  useSchoolClasses,
  useTimetable,
  useCreateTimetableEntry,
  useUpdateTimetableEntry,
  useDeleteTimetableEntry,
} from "@/hooks/useTimetable"

import { TimetableGrid } from "./components/TimetableGrid"
import { TimetableEntryDialog } from "./components/TimetableEntryDialog"
import { PeriodSettingsDialog } from "./components/PeriodSettingsDialog"
import { Combobox } from "@/components/ui/combobox"
import { toast } from "sonner"

export function TimeTable() {
  const { user } = useAuth()
  const canManage = hasPermission(user?.role, Permission.MANAGE_TIMETABLE)

  // 1. Load classes & sections
  const {
    data: classesData = [],
    isLoading: isClassesLoading,
    error: classesError,
    refetch: refetchClasses,
  } = useSchoolClasses()

  const [selectedClassId, setSelectedClassId] = useState("")
  const [selectedSectionId, setSelectedSectionId] = useState("")

  // Auto-select first class and section on load
  useEffect(() => {
    if (classesData.length > 0 && !selectedClassId) {
      const firstClass = classesData[0]
      setSelectedClassId(firstClass.id)
      const firstSection = firstClass.sections?.[0]
      if (firstSection) {
        setSelectedSectionId(firstSection.id)
      }
    }
  }, [classesData, selectedClassId])

  // Get active class object and sections
  const currentClass = useMemo(() => {
    return classesData.find((c) => c.id === selectedClassId) || null
  }, [classesData, selectedClassId])

  const classSections = useMemo(() => {
    return currentClass?.sections || []
  }, [currentClass])

  // Handle Class selection change: update section to first section of that class
  const handleClassChange = (valueOrEvent) => {
    const classId = valueOrEvent?.target ? valueOrEvent.target.value : valueOrEvent
    setSelectedClassId(classId)
    const targetClass = classesData.find((c) => String(c.id) === String(classId))
    const firstSec = targetClass?.sections?.[0]
    setSelectedSectionId(firstSec ? firstSec.id : "")
  }

  // 2. Load timetable data for selected section
  const {
    data: timetableData,
    isLoading: isTimetableLoading,
    isFetching: isTimetableFetching,
    error: timetableError,
    refetch: refetchTimetable,
  } = useTimetable(selectedSectionId)

  // Mutations
  const createEntryMutation = useCreateTimetableEntry()
  const updateEntryMutation = useUpdateTimetableEntry()
  const deleteEntryMutation = useDeleteTimetableEntry()

  // Dialog states
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false)
  const [activeEntry, setActiveEntry] = useState(null)
  const [slotDay, setSlotDay] = useState("MONDAY")
  const [slotPeriod, setSlotPeriod] = useState(null)
  const [isSlotReadOnly, setIsSlotReadOnly] = useState(false)
  const [isPeriodSettingsOpen, setIsPeriodSettingsOpen] = useState(false)

  // Delete confirmation modal state
  const [deleteTargetEntry, setDeleteTargetEntry] = useState(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  // Handlers
  const handleAddFromCell = (day, period) => {
    if (!canManage) return
    setActiveEntry(null)
    setSlotDay(day)
    setSlotPeriod(period)
    setIsSlotReadOnly(true)
    setIsEntryDialogOpen(true)
  }

  const handleEditFromCell = (entry, day, period) => {
    setActiveEntry(entry)
    setSlotDay(day)
    setSlotPeriod(period)
    setIsSlotReadOnly(true)
    setIsEntryDialogOpen(true)
  }

  const handleTopAddClick = () => {
    if (!canManage) return
    setActiveEntry(null)
    setSlotDay("MONDAY")
    const period1 = periods.find((p) => Number(p.period_number) === 1) || periods[0] || null
    setSlotPeriod(period1)
    setIsSlotReadOnly(false)
    setIsEntryDialogOpen(true)
  }

  const handleSaveEntry = async (data) => {
    if (data.isEdit || data.entryId) {
      await updateEntryMutation.mutateAsync({
        entryId: data.entryId,
        payload: data.payload,
        sectionId: selectedSectionId,
      })
    } else {
      await createEntryMutation.mutateAsync({
        ...data,
        section_id: data.section_id || selectedSectionId,
      })
    }
  }

  const handleDeleteRequest = (entry) => {
    setDeleteTargetEntry(entry)
    setIsDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTargetEntry) return
    try {
      await deleteEntryMutation.mutateAsync({
        entryId: deleteTargetEntry.id,
        sectionId: selectedSectionId,
      })
      setIsDeleteDialogOpen(false)
      setIsEntryDialogOpen(false)
      setDeleteTargetEntry(null)
      toast.success("Timetable entry deleted successfully.")
    } catch (err) {
      toast.error(err.data?.detail || err.message || "Failed to delete entry.")
    }
  }

  const periods = timetableData?.periods || []
  const entries = timetableData?.entries || []
  const subjects = timetableData?.subjects || []
  const sectionMeta = timetableData?.section || null

  // Completion calculation (6 days * number of periods)
  const totalPossibleSlots = periods.length * 6
  const scheduledSlotsCount = entries.length
  const completionPercentage =
    totalPossibleSlots > 0
      ? Math.round((scheduledSlotsCount / totalPossibleSlots) * 100)
      : 0

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-200 pb-12">
      {/* Page Header */}
      <PageHeader
        icon={CalendarDays}
        title="Time Table"
        description="Manage weekly class schedules, periods, and teacher assignments."
        actions={
          <div className="flex items-center gap-2.5">
            {canManage && (
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() => setIsPeriodSettingsOpen(true)}
                className="h-9 px-3.5 text-xs font-semibold gap-2 shadow-2xs"
              >
                <Settings className="size-3.5" />
                <span>Period Settings</span>
              </Button>
            )}

            {canManage && (
              <Button
                type="button"
                size="default"
                onClick={handleTopAddClick}
                disabled={!selectedSectionId || periods.length === 0}
                className="h-9 px-4 text-xs font-semibold gap-2 shadow-xs"
              >
                <Plus className="size-4" />
                <span>Add Entry</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Class & Section Selection Bar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap">
          {/* Class Select */}
          <div className="flex flex-col items-start gap-0.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider shrink-0">
              Class
            </label>
            <div className="w-[150px] sm:w-[170px]">
              <Combobox
                value={selectedClassId}
                onValueChange={handleClassChange}
                options={classesData.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
                placeholder={classesData.length === 0 ? "No Classes" : "Select Class"}
                disabled={isClassesLoading || classesData.length === 0}
                className="h-9 text-xs font-semibold rounded-xl bg-background border border-border"
              />
            </div>
          </div>

          {/* Section Select */}
          <div className="flex flex-col items-start gap-0.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider shrink-0">
              Section
            </label>
            <div className="w-[140px] sm:w-[160px]">
              <Combobox
                value={selectedSectionId}
                onValueChange={(val) => setSelectedSectionId(val)}
                options={classSections.map((s) => ({
                  value: s.id,
                  label: `${s.name}`,
                }))}
                placeholder={classSections.length === 0 ? "No Sections" : "Select Section"}
                disabled={isClassesLoading || classSections.length === 0}
                className="h-9 text-xs font-semibold rounded-xl bg-background border border-border"
              />
            </div>
          </div>
        </div>

        {/* Timetable Completion Indicator */}
        {periods.length > 0 && selectedSectionId && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground self-start md:self-auto bg-muted/50 px-3 py-1.5 rounded-xl border border-border/60">
            <CalendarCheck className="size-3.5 text-primary" />
            <span>
              <strong className="text-foreground font-semibold">
                {scheduledSlotsCount}
              </strong>{" "}
              of {totalPossibleSlots} periods scheduled ({completionPercentage}%)
            </span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {isClassesLoading ? (
        <div className="py-16 text-center text-xs text-muted-foreground bg-card rounded-2xl border border-border">
          <Loader2 className="size-6 animate-spin mx-auto mb-2 text-primary" />
          Loading class configurations...
        </div>
      ) : classesData.length === 0 ? (
        <div className="p-12 text-center bg-card rounded-2xl border border-dashed border-border space-y-3">
          <CalendarDays className="size-10 mx-auto text-muted-foreground/60" />
          <h3 className="text-base font-bold text-foreground">No Classes Configured</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Please configure classes and sections before managing school timetables.
          </p>
        </div>
      ) : periods.length === 0 && !isTimetableLoading ? (
        <div className="p-12 text-center bg-card rounded-2xl border border-dashed border-border space-y-4">
          <div className="size-12 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <Settings className="size-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">No Periods Configured</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              You need to configure your daily school period timings before you can build a timetable.
            </p>
          </div>
          {canManage && (
            <Button
              type="button"
              onClick={() => setIsPeriodSettingsOpen(true)}
              className="gap-2 text-xs font-semibold h-9 px-4"
            >
              <Settings className="size-4" />
              <span>Configure Period Settings</span>
            </Button>
          )}
        </div>
      ) : isTimetableLoading ? (
        <div className="py-20 text-center text-xs text-muted-foreground bg-card rounded-2xl border border-border">
          <Loader2 className="size-6 animate-spin mx-auto mb-2 text-primary" />
          Loading timetable grid...
        </div>
      ) : timetableError ? (
        <div className="p-8 text-center bg-card rounded-2xl border border-destructive/20 text-destructive space-y-3">
          <AlertCircle className="size-8 mx-auto" />
          <h4 className="text-base font-bold">Unable to load timetable</h4>
          <p className="text-xs text-muted-foreground">
            We couldn't retrieve the timetable schedule right now.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetchTimetable()}
            className="gap-2 text-xs"
          >
            <RefreshCw className="size-3.5" />
            <span>Try Again</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          

          {/* Weekly Grid */}
          <TimetableGrid
            periods={periods}
            entries={entries}
            onAddEntry={handleAddFromCell}
            onEditEntry={handleEditFromCell}
            onDeleteEntry={handleDeleteRequest}
            canManage={canManage}
          />
        </div>
      )}

      {/* Add / Edit Timetable Entry Modal */}
      <TimetableEntryDialog
        isOpen={isEntryDialogOpen}
        onClose={() => setIsEntryDialogOpen(false)}
        entry={activeEntry}
        initialDay={slotDay}
        initialPeriod={slotPeriod}
        section={sectionMeta}
        subjects={subjects}
        periods={periods}
        entries={entries}
        onSave={handleSaveEntry}
        onDeleteRequest={handleDeleteRequest}
        isPending={createEntryMutation.isPending || updateEntryMutation.isPending}
        canManage={canManage}
        isSlotReadOnly={isSlotReadOnly}
      />

      {/* Period Settings Modal */}
      <PeriodSettingsDialog
        isOpen={isPeriodSettingsOpen}
        onClose={() => setIsPeriodSettingsOpen(false)}
      />

      {/* Delete Entry Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Timetable Entry?"
        description={
          deleteTargetEntry ? (
            <span>
              This will remove <strong>{deleteTargetEntry.subject?.name}</strong>
              {deleteTargetEntry.teacher?.name ? (
                <> taught by <strong>{deleteTargetEntry.teacher.name}</strong></>
              ) : null}{" "}
              from Class {sectionMeta?.class_name}-{sectionMeta?.section_name} during{" "}
              {deleteTargetEntry.day_of_week} Period {deleteTargetEntry.period_number}.
            </span>
          ) : (
            "Are you sure you want to delete this timetable entry?"
          )
        }
        confirmText="Delete Entry"
        isPending={deleteEntryMutation.isPending}
      />
    </div>
  )
}

export default TimeTable
