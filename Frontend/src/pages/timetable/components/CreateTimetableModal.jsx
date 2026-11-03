import React, { useState, useMemo } from "react"
import { Calendar, Copy, Clock, Layers, Loader2, Sparkles } from "lucide-react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Combobox } from "@/components/ui/combobox"
import { useCreateTimetable } from "@/hooks/useTimetable"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const TIMETABLE_TYPES = [
  { value: "Academic", label: "Academic Timetable" },
  { value: "Winter", label: "Winter Bell Timetable" },
  { value: "Exam", label: "Examination Timetable" },
  { value: "Custom", label: "Custom Schedule" },
]

export function CreateTimetableModal({
  isOpen,
  onClose,
  existingTimetables = [],
  onCreated,
}) {
  const [name, setName] = useState("")
  const [type, setType] = useState("Academic")
  const [academicYear, setAcademicYear] = useState("2026-27")
  const [startOption, setStartOption] = useState("blank") // "blank" | "duplicate" | "copy_bell"
  const [sourceTimetableId, setSourceTimetableId] = useState(
    existingTimetables[0]?.id || ""
  )
  const [isActive, setIsActive] = useState(false)
  const [errors, setErrors] = useState({})

  const createMutation = useCreateTimetable()

  const sourceTimetableOptions = useMemo(() => {
    return existingTimetables.map((t) => ({
      value: String(t.id),
      label: `${t.name}${t.is_active ? " (Active)" : ""}`,
    }))
  }, [existingTimetables])

  const handleSubmit = async (e) => {
    e.preventDefault()

    const newErrors = {}
    if (!name.trim()) {
      newErrors.name = "Timetable name is required."
    }

    if (startOption !== "blank" && !sourceTimetableId) {
      newErrors.source = "Please select a source timetable."
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})

    try {
      const payload = {
        name: name.trim(),
        description: `${type} Timetable for ${academicYear}`,
        academic_year: academicYear.trim(),
        type,
        start_option: startOption,
        source_timetable_id: startOption !== "blank" ? sourceTimetableId : null,
        is_active: isActive,
      }

      const res = await createMutation.mutateAsync(payload)
      toast.success(`Timetable "${name}" created successfully.`)
      if (onCreated) onCreated(res)
      onClose()
    } catch (err) {
      toast.error(err?.data?.detail || err?.message || "Failed to create timetable.")
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-lg"
    >
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold shadow-xs shrink-0">
            <Calendar className="size-5" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-foreground">
              Create New Timetable
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Configure calendar schedule, bell setups, and slot allocations.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit} noValidate className="space-y-4 py-2">
        {/* Timetable Name Field */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">
            Timetable Name <span className="text-destructive">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (errors.name) {
                setErrors((prev) => ({ ...prev, name: undefined }))
              }
            }}
            placeholder="e.g. Winter Bell Timetable 2026–27"
            className={cn(
              "h-10 text-xs sm:text-sm rounded-xl px-3.5",
              errors.name && "border-destructive focus-visible:ring-destructive"
            )}
            autoFocus
          />
          {errors.name && (
            <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
              {errors.name}
            </p>
          )}
        </div>

        {/* Type & Academic Year */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Type</label>
            <Combobox
              options={TIMETABLE_TYPES}
              value={type}
              onValueChange={(val) => setType(val || "Academic")}
              placeholder="Select timetable type"
              className="w-full h-10 text-xs sm:text-sm rounded-xl bg-background border border-border"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Academic Year</label>
            <Input
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="e.g. 2026-27"
              className="h-10 text-xs sm:text-sm rounded-xl px-3.5"
            />
          </div>
        </div>

        {/* Start Option: Blank vs Duplicate vs Bell Only */}
        <div className="space-y-2 pt-1">
          <label className="text-xs font-semibold text-foreground">
            Starting Configuration
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setStartOption("blank")
                if (errors.source) setErrors((prev) => ({ ...prev, source: undefined }))
              }}
              className={cn(
                "p-3 rounded-xl border text-left transition-all cursor-pointer",
                startOption === "blank"
                  ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30 font-medium"
                  : "border-border/80 hover:bg-muted/40 text-foreground"
              )}
            >
              <Sparkles className="size-4 mb-1 text-primary" />
              <div className="text-xs font-bold leading-tight">Blank Template</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                Fresh schedule from scratch
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStartOption("duplicate")}
              disabled={existingTimetables.length === 0}
              className={cn(
                "p-3 rounded-xl border text-left transition-all cursor-pointer",
                existingTimetables.length === 0 && "opacity-50 cursor-not-allowed",
                startOption === "duplicate"
                  ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30 font-medium"
                  : "border-border/80 hover:bg-muted/40 text-foreground"
              )}
            >
              <Copy className="size-4 mb-1 text-blue-500" />
              <div className="text-xs font-bold leading-tight">Full Clone</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                Copy setups & all entries
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStartOption("copy_bell")}
              disabled={existingTimetables.length === 0}
              className={cn(
                "p-3 rounded-xl border text-left transition-all cursor-pointer",
                existingTimetables.length === 0 && "opacity-50 cursor-not-allowed",
                startOption === "copy_bell"
                  ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30 font-medium"
                  : "border-border/80 hover:bg-muted/40 text-foreground"
              )}
            >
              <Clock className="size-4 mb-1 text-amber-500" />
              <div className="text-xs font-bold leading-tight">Bell Schedule</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                Copy period timings only
              </div>
            </button>
          </div>
        </div>

        {/* Source Timetable Selection (if cloning or copying bell) */}
        {startOption !== "blank" && existingTimetables.length > 0 && (
          <div className="space-y-1 animate-in fade-in-0 duration-150">
            <label className="text-xs font-semibold text-foreground">
              Source Timetable <span className="text-destructive">*</span>
            </label>
            <Combobox
              options={sourceTimetableOptions}
              value={sourceTimetableId}
              onValueChange={(val) => {
                setSourceTimetableId(val || "")
                if (errors.source) setErrors((prev) => ({ ...prev, source: undefined }))
              }}
              placeholder="Select source timetable to copy from"
              className={cn(
                "w-full h-10 text-xs sm:text-sm rounded-xl bg-background border border-border",
                errors.source && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {errors.source && (
              <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                {errors.source}
              </p>
            )}
          </div>
        )}

        {/* Set as Active Checkbox */}
        <div className="pt-2 flex items-center gap-2.5">
          <input
            type="checkbox"
            id="is-active-checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="size-4 rounded-md border-input text-primary focus:ring-primary cursor-pointer"
          />
          <label htmlFor="is-active-checkbox" className="text-xs font-medium text-foreground cursor-pointer select-none">
            Set this as the Active School Timetable immediately
          </label>
        </div>

        <DialogFooter className="pt-4 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onClose}
            className="h-9 px-4 text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="default"
            disabled={createMutation.isPending}
            className="h-9 px-4 text-xs font-bold gap-1.5 shadow-xs"
          >
            {createMutation.isPending && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            <span>Create Timetable</span>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
