import React from "react"
import { useDeleteStudent } from "@/hooks/useStudents"
import { DeleteConfirmDialog } from "@/components/common/DeleteConfirmDialog"

export function StudentDeleteDialog({ isOpen, onClose, student }) {
  const deleteStudentMutation = useDeleteStudent()

  if (!student) return null

  const handleDelete = async () => {
    try {
      await deleteStudentMutation.mutateAsync(student.id)
      onClose()
    } catch (err) {
      console.error("Failed to delete student:", err)
    }
  }

  return (
    <DeleteConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleDelete}
      isPending={deleteStudentMutation.isPending}
      title="Delete Student Record"
      itemName={`${student.first_name || ""} ${student.last_name || ""}`.trim()}
      subText="This action will soft-delete their profile and revoke account access."
      confirmText="Delete Student"
    />
  )
}

export default StudentDeleteDialog
