import React, { useState } from "react"
import {
  Calendar,
  ChevronDown,
  Copy,
  Edit2,
  MoreVertical,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverTrigger, PopoverDialog } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { DeleteConfirmDialog } from "@/components/common/DeleteConfirmDialog"
import {
  useActivateTimetable,
  useDuplicateTimetable,
  useDeleteTimetable,
  useUpdateTimetable,
} from "@/hooks/useTimetable"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function TimetableSelector({
  timetables = [],
  selectedTimetableId,
  currentCompletionPct = null,
  onSelectTimetable,
  onCreateNew,
  canManage = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmActiveTarget, setConfirmActiveTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameValue, setRenameValue] = useState("")
  const [renameError, setRenameError] = useState("")

  const activateMutation = useActivateTimetable()
  const duplicateMutation = useDuplicateTimetable()
  const deleteMutation = useDeleteTimetable()
  const updateMutation = useUpdateTimetable()

  const currentTimetable =
    timetables.find((t) => t.id === selectedTimetableId) || timetables[0] || null

  const handleStartSetActive = (target) => {
    setIsOpen(false)
    setConfirmActiveTarget(target)
  }

  const handleStartRename = (target) => {
    setIsOpen(false)
    setRenameTarget(target)
    setRenameValue(target.name)
    setRenameError("")
  }

  const handleStartDelete = (target) => {
    if (timetables.length <= 1) {
      toast.error("Cannot delete the only remaining timetable.")
      return
    }
    setIsOpen(false)
    setDeleteTarget(target)
  }

  const handleSetActive = async (target) => {
    try {
      const prevActive = timetables.find((t) => t.is_active)
      await activateMutation.mutateAsync(target.id)
      setConfirmActiveTarget(null)
      toast.success(`"${target.name}" is now the active timetable.`, {
        action: prevActive
          ? {
              label: "Undo",
              onClick: () => activateMutation.mutate(prevActive.id),
            }
          : undefined,
      })
    } catch (err) {
      toast.error(err?.data?.detail || err?.message || "Failed to set active timetable.")
    }
  }

  const handleDuplicate = async (target) => {
    try {
      await duplicateMutation.mutateAsync({ timetableId: target.id })
      toast.success(`Timetable "${target.name}" duplicated.`)
    } catch (err) {
      toast.error(err?.data?.detail || err?.message || "Failed to duplicate timetable.")
    }
  }

  const handleRenameSubmit = async (e) => {
    e.preventDefault()
    if (!renameValue.trim()) {
      setRenameError("Timetable name cannot be empty.")
      return
    }
    try {
      await updateMutation.mutateAsync({
        timetableId: renameTarget.id,
        payload: { name: renameValue.trim() },
      })
      toast.success("Timetable renamed successfully.")
      setRenameTarget(null)
      setRenameValue("")
      setRenameError("")
    } catch (err) {
      toast.error(err?.data?.detail || err?.message || "Failed to rename timetable.")
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success(`Timetable "${deleteTarget.name}" deleted.`)
      if (selectedTimetableId === deleteTarget.id) {
        const remaining = timetables.filter((t) => t.id !== deleteTarget.id)
        if (remaining.length > 0) {
          onSelectTimetable(remaining[0].id)
        }
      }
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err?.data?.detail || err?.message || "Failed to delete timetable.")
    }
  }

  return (
    <>
      <PopoverTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-9 px-3 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all cursor-pointer shadow-2xs max-w-[260px]",
            isOpen
              ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/40"
              : "border-border/80 bg-background text-foreground hover:bg-muted/50"
          )}
        >
          {/* Status Dot */}
          <span
            className={cn(
              "size-2 rounded-full shrink-0",
              currentTimetable?.is_active
                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                : "bg-muted-foreground/40"
            )}
          />
          <span className="truncate font-bold">
            {currentTimetable?.name || "Timetable 2026 - 2027"}
          </span>
          {currentTimetable?.is_active && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              Active
            </span>
          )}
          <ChevronDown
            className={cn(
              "size-3.5 text-muted-foreground transition-transform duration-200 shrink-0",
              isOpen && "rotate-180"
            )}
          />
        </Button>

        <Popover
          placement="bottom start"
          className="w-80 p-2.5 rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl z-50 space-y-1.5"
        >
          <PopoverDialog className="outline-hidden space-y-2">
            {/* Header: Calendar icon + SELECT TIMETABLE */}
            <div className="flex items-center gap-2 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <Calendar className="size-3.5 text-muted-foreground shrink-0" />
              <span>Select Timetable</span>
            </div>

            {/* List of timetables */}
            <div
              className={cn(
                "space-y-1 pr-0.5",
                timetables.length > 5 ? "max-h-64 overflow-y-auto" : "overflow-visible"
              )}
            >
              {timetables.map((t) => {
                const isSelected = t.id === selectedTimetableId
                const completionPct =
                  t.completion_percentage != null
                    ? Math.round(t.completion_percentage)
                    : 0

                return (
                  <div
                    key={t.id}
                    className={cn(
                      "group flex items-center justify-between gap-2 px-3 py-2 rounded-xl transition-all",
                      isSelected
                        ? "bg-primary/10 text-primary font-bold shadow-2xs"
                        : "hover:bg-muted/60 text-foreground"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectTimetable(t.id)
                        setIsOpen(false)
                      }}
                      className="flex-1 flex items-center gap-2.5 text-left cursor-pointer min-w-0"
                    >
                      <span
                        className={cn(
                          "size-2 rounded-full shrink-0",
                          t.is_active ? "bg-emerald-500" : "bg-muted-foreground/30"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs truncate font-semibold leading-tight">
                            {t.name}
                          </span>
                          {t.is_active && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 leading-none">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate mt-0.5 font-normal">
                          {completionPct}% completed
                        </div>
                      </div>
                    </button>

                    {/* Secondary Actions 3-Dots Menu */}
                    {canManage && (
                      <DropdownMenuTrigger>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                          aria-label="Actions"
                        >
                          <MoreVertical className="size-3.5" />
                        </Button>
                        <DropdownMenu
                          placement="bottom end"
                          className="w-44 z-[100] rounded-xl bg-card border border-border shadow-2xl p-1 space-y-0.5"
                        >
                          <DropdownMenuItem
                            isDisabled={t.is_active}
                            onAction={() => handleStartSetActive(t)}
                            className="cursor-pointer gap-2 text-xs py-1.5 px-2.5 rounded-lg font-medium"
                          >
                            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                            <span>Set as active</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onAction={() => handleStartRename(t)}
                            className="cursor-pointer gap-2 text-xs py-1.5 px-2.5 rounded-lg font-medium"
                          >
                            <Edit2 className="size-3.5 text-blue-500 shrink-0" />
                            <span>Rename</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onAction={() => handleDuplicate(t)}
                            className="cursor-pointer gap-2 text-xs py-1.5 px-2.5 rounded-lg font-medium"
                          >
                            <Copy className="size-3.5 text-purple-500 shrink-0" />
                            <span>Duplicate</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onAction={() => handleStartDelete(t)}
                            variant="destructive"
                            className="cursor-pointer gap-2 text-xs py-1.5 px-2.5 rounded-lg font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
                          >
                            <Trash2 className="size-3.5 shrink-0" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenu>
                      </DropdownMenuTrigger>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Bottom Button: + Create New Timetable... */}
            {canManage && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    onCreateNew?.()
                  }}
                  className="w-full py-2 px-3 rounded-xl border border-border/80 hover:border-primary/50 bg-background hover:bg-primary/5 text-primary text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                >
                  <Plus className="size-3.5" />
                  <span>Create New Timetable...</span>
                </button>
              </div>
            )}
          </PopoverDialog>
        </Popover>
      </PopoverTrigger>

      {/* Rename Modal / Dialog */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-xs"
            onClick={() => setRenameTarget(null)}
          />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-5 shadow-2xl space-y-4 z-10 animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-foreground">Rename Timetable</h3>
            <form onSubmit={handleRenameSubmit} noValidate className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">New Name</label>
                <Input
                  value={renameValue}
                  onChange={(e) => {
                    setRenameValue(e.target.value)
                    if (renameError) setRenameError("")
                  }}
                  placeholder="Enter timetable name"
                  autoFocus
                  className={cn("h-9 text-xs", renameError && "border-destructive focus-visible:ring-destructive")}
                />
                {renameError && (
                  <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                    {renameError}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setRenameTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="xs"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending && (
                    <Loader2 className="size-3 animate-spin mr-1" />
                  )}
                  Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete "${deleteTarget?.name}"?`}
        description="Are you sure you want to delete this timetable? All associated periods, setups, and entries will be removed."
        confirmLabel="Delete Timetable"
        isLoading={deleteMutation.isPending}
      />
    </>
  )
}
