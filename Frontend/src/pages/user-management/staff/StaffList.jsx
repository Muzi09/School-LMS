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
import { PageHeader } from "@/components/common/PageHeader"
import { DataTable } from "@/components/common/DataTable"
import { StaffFormModal } from "./StaffFormModal"
import { StaffDetailsModal } from "./StaffDetailsModal"
import { StaffDeleteDialog } from "./StaffDeleteDialog"
import { formatDateTime } from "@/lib/utils"

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
                <span className="font-semibold text-foreground text-sm block">
                  {s.first_name} {s.last_name}
                </span>
                <span className="text-xs text-muted-foreground block truncate max-w-[200px]">
                  {s.email}
                </span>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "staff_profile.roll_no",
        header: "Staff ID",
        Cell: ({ cell }) => (
          <span className="font-mono text-foreground font-medium text-sm">
            {cell.getValue() || "—"}
          </span>
        ),
      },
      {
        accessorKey: "login_mobile",
        header: "Login Mobile",
        Cell: ({ cell }) => (
          <span className="font-mono text-foreground text-sm">
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
        Cell: ({ cell }) => <span className="text-foreground text-sm">{cell.getValue()}</span>,
      },
      {
        accessorKey: "is_active",
        header: "Status",
        Cell: ({ row }) => {
          const s = row.original
          return (
            <button
              onClick={() => handleToggleStatus(s)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
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
      // Mixin Audit Columns (hidden by default)
      {
        accessorKey: "created_at",
        header: "Created At",
        Cell: ({ cell }) => (
          <span className="font-mono text-foreground text-sm">
            {formatDateTime(cell.getValue())}
          </span>
        ),
      },
      {
        accessorKey: "updated_at",
        header: "Updated At",
        Cell: ({ cell }) => (
          <span className="font-mono text-foreground text-sm">
            {formatDateTime(cell.getValue())}
          </span>
        ),
      },
      {
        accessorKey: "created_by",
        header: "Created By",
        Cell: ({ cell }) => (
          <span className="font-mono text-foreground text-sm">
            {cell.getValue() ? String(cell.getValue()).slice(0, 8) + "..." : "—"}
          </span>
        ),
      },
      {
        accessorKey: "updated_by",
        header: "Updated By",
        Cell: ({ cell }) => (
          <span className="font-mono text-foreground text-sm">
            {cell.getValue() ? String(cell.getValue()).slice(0, 8) + "..." : "—"}
          </span>
        ),
      },
      {
        accessorKey: "deleted_at",
        header: "Deleted At",
        Cell: ({ cell }) => (
          <span className="font-mono text-foreground text-sm">
            {formatDateTime(cell.getValue())}
          </span>
        ),
      },
      {
        accessorKey: "deleted_by",
        header: "Deleted By",
        Cell: ({ cell }) => (
          <span className="font-mono text-foreground text-sm">
            {cell.getValue() ? String(cell.getValue()).slice(0, 8) + "..." : "—"}
          </span>
        ),
      },
    ],
    []
  )

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-200">
      {/* Common Page Header */}
      <PageHeader
        icon={Briefcase}
        title="Manage Staff"
        description="Create, view, manage, and assign teaching and administrative staff members."
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        onCreate={() => {
          setEditingStaff(null)
          setIsFormOpen(true)
        }}
        createLabel="Create Staff"
        createIcon={UserPlus}
      />

      {/* TanStack Data Table */}
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
        initialState={{
          columnVisibility: {
            created_at: false,
            updated_at: false,
            created_by: false,
            updated_by: false,
            deleted_at: false,
            deleted_by: false,
          },
        }}
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
            <div className="flex items-center justify-end gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                title="View Staff Details"
                onClick={() => {
                  setViewingStaff(s)
                  setIsDetailsOpen(true)
                }}
                className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Eye className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Edit Staff"
                onClick={() => {
                  setEditingStaff(s)
                  setIsFormOpen(true)
                }}
                className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Edit2 className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Delete Staff"
                onClick={() => {
                  setDeletingStaff(s)
                  setIsDeleteOpen(true)
                }}
                className="size-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-4" />
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
