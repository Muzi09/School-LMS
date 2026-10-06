import { useState } from "react"
import {
  Clock,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TimePicker } from "@/components/ui/time-picker"
import { toast } from "sonner"
import { ModalHeader } from "@/components/common/ModalHeader"
import { DeleteConfirmDialog } from "@/components/common/DeleteConfirmDialog"
import {
  usePeriods,
  useCreatePeriod,
  useUpdatePeriod,
  useDeletePeriod,
} from "@/hooks/useTimetable"

/**
 * Add specified minutes to "HH:mm" time string.
 */
function addMinutes(timeStr, minutesToAdd) {
  if (!timeStr || typeof timeStr !== "string") return "08:00"
  const parts = timeStr.trim().split(":")
  const hours = parseInt(parts[0], 10) || 0
  const mins = parseInt(parts[1], 10) || 0
  let totalMinutes = hours * 60 + mins + minutesToAdd
  totalMinutes = (totalMinutes + 24 * 60) % (24 * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function PeriodSettingsDialog({ isOpen, onClose }) {
  const { data: periods = [], isLoading } = usePeriods()
  const createPeriodMutation = useCreatePeriod()
  const updatePeriodMutation = useUpdatePeriod()
  const deletePeriodMutation = useDeletePeriod()

  // Local draft inputs for period number typing: { [periodId]: string }
  const [periodNumberInputs, setPeriodNumberInputs] = useState({})
  const [savingRowId, setSavingRowId] = useState(null)
  const [isAddingPeriod, setIsAddingPeriod] = useState(false)
  const [periodToDelete, setPeriodToDelete] = useState(null)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)

  if (!isOpen) return null

  // Sort periods by period_number ascending
  const sortedPeriods = [...periods].sort((a, b) => a.period_number - b.period_number)

  // Direct save helper for period update
  const handleSavePeriod = async (periodId, payload) => {
    setSavingRowId(periodId)
    try {
      await updatePeriodMutation.mutateAsync({
        periodId,
        payload,
      })
    } catch (err) {
      toast.error(err.data?.detail || err.message || "Failed to update period.")
    } finally {
      setSavingRowId(null)
    }
  }

  // Handle typing period number
  const handlePeriodNumberChange = (periodId, val) => {
    setPeriodNumberInputs((prev) => ({
      ...prev,
      [periodId]: val,
    }))
  }

  // Save period number on blur or enter
  const handlePeriodNumberBlur = async (period) => {
    const inputVal = periodNumberInputs[period.id]
    if (inputVal === undefined) return

    const num = parseInt(inputVal, 10)
    if (isNaN(num) || num <= 0) {
      toast.error("Period number must be greater than 0.")
      // Reset back to server value
      setPeriodNumberInputs((prev) => {
        const next = { ...prev }
        delete next[period.id]
        return next
      })
      return
    }

    if (num === period.period_number) {
      // Unchanged
      setPeriodNumberInputs((prev) => {
        const next = { ...prev }
        delete next[period.id]
        return next
      })
      return
    }

    await handleSavePeriod(period.id, {
      period_number: num,
      start_time: period.start_time,
      end_time: period.end_time,
    })

    setPeriodNumberInputs((prev) => {
      const next = { ...prev }
      delete next[period.id]
      return next
    })
  }

  // Direct save on start time change
  const handleStartTimeChange = async (period, newStartTime) => {
    if (!newStartTime || newStartTime === period.start_time) return

    // If new start time is >= current end time, push end time by 45 mins to remain valid
    let targetEndTime = period.end_time
    if (newStartTime >= period.end_time) {
      targetEndTime = addMinutes(newStartTime, 45)
    }

    const currentNum =
      periodNumberInputs[period.id] !== undefined
        ? parseInt(periodNumberInputs[period.id], 10) || period.period_number
        : period.period_number

    await handleSavePeriod(period.id, {
      period_number: currentNum,
      start_time: newStartTime,
      end_time: targetEndTime,
    })
  }

  // Direct save on end time change
  const handleEndTimeChange = async (period, newEndTime) => {
    if (!newEndTime || newEndTime === period.end_time) return

    if (newEndTime <= period.start_time) {
      toast.error("End time must be later than start time.")
      return
    }

    const currentNum =
      periodNumberInputs[period.id] !== undefined
        ? parseInt(periodNumberInputs[period.id], 10) || period.period_number
        : period.period_number

    await handleSavePeriod(period.id, {
      period_number: currentNum,
      start_time: period.start_time,
      end_time: newEndTime,
    })
  }

  // Intelligent "+ Add" creates a new period row immediately with calculated defaults:
  // - Next sequential period number
  // - Start time: 45 minutes after previous period's start time
  // - End time: 45 minutes after next start time
  const handleAddPeriod = async () => {
    setIsAddingPeriod(true)
    try {
      const maxNum = periods.reduce((acc, p) => Math.max(acc, p.period_number), 0)
      const nextNum = maxNum + 1

      let nextStart = "08:00"
      if (sortedPeriods.length > 0) {
        const lastPeriod = sortedPeriods[sortedPeriods.length - 1]
        nextStart = addMinutes(lastPeriod.start_time, 45)
      }
      const nextEnd = addMinutes(nextStart, 45)

      await createPeriodMutation.mutateAsync({
        period_number: nextNum,
        start_time: nextStart,
        end_time: nextEnd,
      })
    } catch (err) {
      toast.error(err.data?.detail || err.message || "Failed to add period.")
    } finally {
      setIsAddingPeriod(false)
    }
  }

  // Open delete confirmation modal
  const handleDelete = (period) => {
    setPeriodToDelete(period)
    setIsConfirmDeleteOpen(true)
  }

  // Confirm delete period
  const handleConfirmDelete = async () => {
    if (!periodToDelete) return

    try {
      await deletePeriodMutation.mutateAsync(periodToDelete.id)
      setPeriodNumberInputs((prev) => {
        const next = { ...prev }
        delete next[periodToDelete.id]
        return next
      })
      toast.success(`Period ${periodToDelete.period_number} deleted successfully.`)
      setIsConfirmDeleteOpen(false)
      setPeriodToDelete(null)
    } catch (err) {
      toast.error(err.data?.detail || err.message || "Failed to delete period.")
    }
  }

  const isSaving = savingRowId !== null || updatePeriodMutation.isPending

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-200">
        <ModalHeader
          icon={Clock}
          title="Period Settings"
          description="Configure school timetable periods and daily class timings."
          onClose={onClose}
        />

        {/* Top Progress Bar for Background Saving / Fetching */}
        <div className="h-0.5 w-full bg-transparent overflow-hidden shrink-0">
          {(isSaving || isAddingPeriod || deletePeriodMutation.isPending || isLoading) && (
            <div className="h-full w-full bg-primary animate-pulse transition-all" />
          )}
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">

          {/* Unified Heading with Dynamic Count and + Add Button */}
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                CONFIGURED PERIODS ({periods.length})
              </span>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleAddPeriod}
              disabled={isAddingPeriod || isLoading}
              className="h-8 px-3.5 text-xs font-semibold gap-1.5 rounded-xl cursor-pointer"
            >
              {isAddingPeriod ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              <span>Add</span>
            </Button>
          </div>

          {/* Unified List of Always-Editable Period Rows */}
          {isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              <Loader2 className="size-5 animate-spin mx-auto mb-2 text-primary" />
              Loading periods...
            </div>
          ) : periods.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-border rounded-2xl p-6 text-xs text-muted-foreground space-y-3 bg-muted/10">
              <p>No periods have been configured for this school yet.</p>
              <Button
                type="button"
                size="sm"
                onClick={handleAddPeriod}
                disabled={isAddingPeriod}
                className="h-8 text-xs gap-1.5 rounded-xl cursor-pointer"
              >
                {isAddingPeriod ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                <span>Add First Period (08:00 - 08:45)</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sortedPeriods.map((p) => {
                const currentPeriodNumber =
                  periodNumberInputs[p.id] !== undefined
                    ? periodNumberInputs[p.id]
                    : p.period_number
                const isRowSaving = savingRowId === p.id

                return (
                  <div
                    key={p.id}
                    className="p-3 px-3.5 rounded-xl border border-border/70 bg-card hover:border-border transition-all flex items-center gap-3"
                  >
                    {/* Period # (Width increased to w-16) */}
                    <div className="flex flex-col items-center shrink-0 w-16">
                      <label
                        htmlFor={`p-num-${p.id}`}
                        className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1"
                      >
                        # Period
                      </label>
                      <Input
                        id={`p-num-${p.id}`}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={3}
                        value={currentPeriodNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "")
                          handlePeriodNumberChange(p.id, val)
                        }}
                        onBlur={() => handlePeriodNumberBlur(p)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            e.currentTarget.blur()
                          }
                        }}
                        className="h-9 w-16 text-center text-xs font-bold px-1 rounded-xl"
                      />
                    </div>

                    {/* Start Time Picker (Directly saved on change) */}
                    <div className="flex-1 min-w-0">
                      <label
                        htmlFor={`period-${p.id}-start`}
                        className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1"
                      >
                        Start Time
                      </label>
                      <TimePicker
                        id={`period-${p.id}-start`}
                        name={`period_${p.id}_start`}
                        value={p.start_time}
                        onChange={(val) => handleStartTimeChange(p, val)}
                        className="h-9 text-xs"
                        required
                      />
                    </div>

                    {/* End Time Picker (Directly saved on change) */}
                    <div className="flex-1 min-w-0">
                      <label
                        htmlFor={`period-${p.id}-end`}
                        className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1"
                      >
                        End Time
                      </label>
                      <TimePicker
                        id={`period-${p.id}-end`}
                        name={`period_${p.id}_end`}
                        value={p.end_time}
                        onChange={(val) => handleEndTimeChange(p, val)}
                        className="h-9 text-xs"
                        required
                      />
                    </div>

                    {/* Row Actions: Clean Delete Button */}
                    <div className="flex items-center gap-1.5 shrink-0 pt-4.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(p)}
                        disabled={deletePeriodMutation.isPending || isRowSaving}
                        className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                        title="Delete Period"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-border/70 bg-muted/20 flex items-center justify-end">
          <Button
            type="button"
            onClick={onClose}
            disabled={isAddingPeriod || savingRowId !== null}
            className="h-10 px-6 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
          >
            Done
          </Button>
        </div>
      </div>
    </div>

    {/* Delete Period Confirmation Modal */}
      <DeleteConfirmDialog
        isOpen={isConfirmDeleteOpen}
        onClose={() => {
          setIsConfirmDeleteOpen(false)
          setPeriodToDelete(null)
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Period?"
        itemName={
          periodToDelete
            ? `Period ${periodToDelete.period_number} (${periodToDelete.start_time} - ${periodToDelete.end_time})`
            : ""
        }
        subText="This will remove this period from the school timetable schedule. Any scheduled entries during this period will be affected."
        confirmText="Delete Period"
        isPending={deletePeriodMutation.isPending}
        className="z-[60]"
      />
    </>
  )
}

export default PeriodSettingsDialog
