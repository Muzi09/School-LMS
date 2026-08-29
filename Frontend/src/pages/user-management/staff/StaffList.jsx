import React, { useState, useDeferredValue, useMemo } from "react"
import {
  Briefcase,
  UserPlus,
  RefreshCw,
  Eye,
  Edit2,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useStaffList, useUpdateStaffStatus } from "@/hooks/useStaff"
import { DataTable } from "@/components/common/DataTable"
import { StaffFormModal } from "./StaffFormModal"
import { StaffDetailsModal } from "./StaffDetailsModal"
import { StaffDeleteDialog } from "./StaffDeleteDialog"

export function StaffList() {
  const [globalFilter, setGlobalFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  const deferredSearch = useDeferredValue(globalFilter)

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useStaffList({
    isActive: statusFilter === "" ? undefined : statusFilter === "true",
    search: deferredSearch.trim() || undefined,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
  })

  const staffList = data?.items || []
  const total = data?.total || 0

  const updateStatusMutation = useUpdateStaffStatus()

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [viewingStaff, setViewingStaff] = useState(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deletingStaff, setDeletingStaff] = useState(null)

  const handleToggleStatus = (staff) => {
    updateStatusMutation.mutate({
      staffId: staff.id,
      isActive: !staff.is_active,
    })
  }

  const columns = useMemo(
    () => [
      {
        accessorFn: (row) => `${row.first_name} ${row.last_name}`,
        id: "name",
        header: "Staff Member",
        Cell: ({ row }) => {
          const s = row.original
          return (
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-xs shrink-0">
                {s.first_name?.[0]}{s.last_name?.[0]}
              </div>
              <div>
                <span className="font-semibold text-foreground text-xs block">
                  {s.first_name} {s.last_name}
                </span>
                <span className="text-[11px] text-muted-foreground block truncate max-w-[200px]">
                  {s.email}
                </span>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "staff_profile.roll_no",
        header: "Roll / Staff ID",
        Cell: ({ cell }) => (
          <span className="font-mono text-foreground font-medium text-xs">
            {cell.getValue() || "—"}
          </span>
        ),
      },
      {
        accessorKey: "login_mobile",
        header: "Login Mobile",
        Cell: ({ cell }) => (
          <span className="font-mono text-foreground text-xs">
            {cell.getValue()}
          </span>
        ),
      },
      {
        id: "father_name",
        header: "Father's Name",
        accessorFn: (row) => {
          const p = row.staff_profile || {}
          return p.father_first_name ? `${p.father_first_name} ${p.father_last_name || ""}` : "—"
        },
        Cell: ({ cell }) => <span className="text-foreground text-xs">{cell.getValue()}</span>,
      },
      {
        accessorKey: "is_active",
        header: "Status",
        Cell: ({ row }) => {
          const s = row.original
          return (
            <button
              onClick={() => handleToggleStatus(s)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                s.is_active
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                  : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
              }`}
            >
              <span className={`size-1.5 rounded-full ${s.is_active ? "bg-emerald-500" : "bg-destructive"}`} />
              <span>{s.is_active ? "Active" : "Inactive"}</span>
            </button>
          )
        },
      },
    ],
    []
  )

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Briefcase className="size-5 text-primary" />
            <span>Manage Staff</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create, view, manage, and assign teaching and administrative staff members.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingStaff(null)
              setIsFormOpen(true)
            }}
            className="gap-1.5 text-xs shadow-xs"
          >
            <UserPlus className="size-4" />
            <span>Create Staff</span>
          </Button>
        </div>
      </div>

      {/* MRT Data Table */}
      <DataTable
        columns={columns}
        data={staffList}
        rowCount={total}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={Boolean(error)}
        errorMessage={error?.message}
        manualPagination
        manualFiltering
        state={{
          pagination,
          globalFilter,
        }}
        onPaginationChange={setPagination}
        onGlobalFilterChange={setGlobalFilter}
        enableRowActions
        renderRowActions={({ row }) => {
          const s = row.original
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                title="View Staff Details"
                onClick={() => {
                  setViewingStaff(s)
                  setIsDetailsOpen(true)
                }}
              >
                <Eye className="size-3.5 text-muted-foreground hover:text-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Edit Staff"
                onClick={() => {
                  setEditingStaff(s)
                  setIsFormOpen(true)
                }}
              >
                <Edit2 className="size-3.5 text-muted-foreground hover:text-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Delete Staff"
                onClick={() => {
                  setDeletingStaff(s)
                  setIsDeleteOpen(true)
                }}
              >
                <Trash2 className="size-3.5 text-destructive/80 hover:text-destructive" />
              </Button>
            </div>
          )
        }}
        renderTopToolbarCustomActions={() => (
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPagination((prev) => ({ ...prev, pageIndex: 0 }))
              }}
              className="h-8 rounded-lg border border-input bg-card px-2.5 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">All Status</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          </div>
        )}
      />

      {/* Modals */}
      <StaffFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        staff={editingStaff}
      />

      <StaffDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        staff={viewingStaff}
        onEdit={(s) => {
          setEditingStaff(s)
          setIsFormOpen(true)
        }}
      />

      <StaffDeleteDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        staff={deletingStaff}
      />
    </div>
  )
}

export default StaffList
