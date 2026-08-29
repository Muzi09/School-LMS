import React from "react"
import { AlertTriangle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useDeleteStudent } from "@/hooks/useStudents"

export function StudentDeleteDialog({ isOpen, onClose, student }) {
  const deleteStudentMutation = useDeleteStudent()

  if (!isOpen || !student) return null

  const handleDelete = async () => {
    try {
      await deleteStudentMutation.mutateAsync(student.id)
      onClose()
    } catch (err) {
      console.error("Failed to delete student:", err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-full bg-destructive/10 text-destructive shrink-0">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Delete Student Record</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Are you sure you want to remove{" "}
              <strong className="text-foreground font-medium">
                {student.first_name} {student.last_name}
              </strong>
              ? This action will soft-delete their profile and revoke account access.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={deleteStudentMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleteStudentMutation.isPending}
            className="gap-1.5"
          >
            {deleteStudentMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
            <span>Delete Student</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default StudentDeleteDialog
