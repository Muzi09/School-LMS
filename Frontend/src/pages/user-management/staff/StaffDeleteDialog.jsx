import React from "react"
import { useDeleteStaff } from "@/hooks/useStaff"
import { DeleteConfirmDialog } from "@/components/common/DeleteConfirmDialog"

export function StaffDeleteDialog({ isOpen, onClose, staff }) {
  const deleteStaffMutation = useDeleteStaff()

  if (!staff) return null

  const handleDelete = async () => {
    try {
      await deleteStaffMutation.mutateAsync(staff.id)
      onClose()
    } catch (err) {
      console.error("Failed to delete staff:", err)
    }
  }

  return (
    <DeleteConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleDelete}
      isPending={deleteStaffMutation.isPending}
      title="Delete Staff Member"
      itemName={`${staff.first_name || ""} ${staff.last_name || ""}`.trim()}
      subText="This action will soft-delete their account and revoke login access."
      confirmText="Delete Staff"
    />
  )
}

export default StaffDeleteDialog
