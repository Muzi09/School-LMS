import React, { useState, useDeferredValue, useMemo } from "react"
import {
  Briefcase,
  UserPlus,
  RefreshCw,
  Eye,
  Edit2,
  Trash2,
  Send,
  Copy,
  Check,
  Loader2,
  ShieldAlert,
  FileSpreadsheet,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useStaffList } from "@/hooks/useStaff"
import { resendStaffSetupApi } from "@/api/staffService"
import { PageHeader } from "@/components/common/PageHeader"
import { DataTable } from "@/components/common/DataTable"
import { StaffFormModal } from "./StaffFormModal"
import { StaffDetailsModal } from "./StaffDetailsModal"
import { StaffDeleteDialog } from "./StaffDeleteDialog"
import { BulkStaffImportModal } from "./BulkStaffImportModal"
import { Combobox } from "@/components/ui/combobox"
import { formatDateTime } from "@/lib/utils"

export function StaffList() {
  const [globalFilter, setGlobalFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [setupModalData, setSetupModalData] = useState(null)
  const [isResendingId, setIsResendingId] = useState(null)
  const [isCopiedLink, setIsCopiedLink] = useState(false)
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
    status: statusFilter || undefined,
    search: deferredSearch.trim() || undefined,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
  })

  const staffList = data?.items || []
  const total = data?.total || 0

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [viewingStaff, setViewingStaff] = useState(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deletingStaff, setDeletingStaff] = useState(null)
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false)

  const handleResendSetup = async (staff) => {
    try {
      setIsResendingId(staff.id)
      const res = await resendStaffSetupApi(staff.id)
      const data = res?.data || res
      setSetupModalData({
        staffName: `${staff.first_name} ${staff.last_name}`.trim(),
        setupUrl: data.setup_url,
        emailSent: data.email_sent,
        message: data.message,
      })
      refetch()
    } catch (err) {
      alert(err.response?.data?.detail || err.message || "Failed to generate setup link.")
    } finally {
      setIsResendingId(null)
    }
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
        id: "account_status",
        header: "Account Status",
        accessorFn: (row) => row.status || row.staff_profile?.status || "PENDING_ACTIVATION",
        Cell: ({ cell }) => {
          const status = cell.getValue()
          const isPending = status === "PENDING_ACTIVATION"
          return (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                isPending
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              }`}
            >
              <span className={`size-1.5 rounded-full ${isPending ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
              <span>{isPending ? "Pending Activation" : "Active"}</span>
            </span>
          )
        },
      },
      {
        id: "created_by_name",
        header: "Created By",
        accessorFn: (row) => row.created_by_name || "Principal",
        Cell: ({ cell }) => (
          <span className="text-foreground text-sm font-medium">
            {cell.getValue()}
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
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsBulkImportOpen(true)}
            className="h-9 px-4 text-sm font-medium gap-2 shadow-2xs border-border/80 hover:bg-accent cursor-pointer"
          >
            <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>Bulk Import</span>
          </Button>
        }
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
              {s.status === "PENDING_ACTIVATION" && (
                <Button
                  variant="outline"
                  size="sm"
                  title="Resend Setup Email or Copy Setup Link"
                  disabled={isResendingId === s.id}
                  onClick={() => handleResendSetup(s)}
                  className="h-8 px-2.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg gap-1.5 cursor-pointer shadow-2xs"
                >
                  {isResendingId === s.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  <span className="hidden sm:inline">Setup Link</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                title="View Staff Details"
                onClick={() => {
                  setViewingStaff(s)
                  setIsDetailsOpen(true)
                }}
                className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
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
                className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
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
                className="size-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10 cursor-pointer"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )
        }}
        renderTopToolbarCustomActions={() => (
          <div className="flex items-center gap-2">
            <div className="w-[170px]">
              <Combobox
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val)
                  setPagination((prev) => ({ ...prev, pageIndex: 0 }))
                }}
                options={[
                  { value: "", label: "All Status" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "PENDING_ACTIVATION", label: "Pending Activation" },
                ]}
                placeholder="All Status"
                className="h-8 rounded-lg border-input bg-card px-2.5 text-xs shadow-xs"
              />
            </div>
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

      <BulkStaffImportModal
        isOpen={isBulkImportOpen}
        onClose={() => {
          setIsBulkImportOpen(false)
          refetch()
        }}
        onImportSuccess={() => refetch()}
      />

      {/* Resend / Share Setup Link Modal */}
      {setupModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-xs animate-in fade-in-0 duration-200"
            onClick={() => setSetupModalData(null)}
          />
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 text-center z-10 animate-in fade-in-0 zoom-in-95 duration-200 space-y-4">
            <div className="size-14 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
              <Send className="size-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-foreground">Staff Setup Link</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {setupModalData.emailSent
                  ? `A fresh setup invitation has been sent to ${setupModalData.staffName}'s email address.`
                  : `Outgoing email was not sent (Email Setup not active). Please copy and share this link manually.`}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/60 border border-border text-left space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  One-Time Setup Link
                </label>
                <span className="text-[10px] text-muted-foreground">Expires in 48 hours</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={setupModalData.setupUrl}
                  className="flex-1 h-9 px-3 text-xs bg-background border border-border rounded-lg text-foreground font-mono truncate"
                />
                <Button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(setupModalData.setupUrl)
                    setIsCopiedLink(true)
                    setTimeout(() => setIsCopiedLink(false), 2000)
                  }}
                  className="h-9 px-3 text-xs font-semibold rounded-lg shrink-0 gap-1.5 cursor-pointer"
                >
                  {isCopiedLink ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  <span>{isCopiedLink ? "Copied!" : "Copy"}</span>
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                The staff member will use this link to set their master password and 4-digit PIN.
              </p>
            </div>

            <Button
              type="button"
              onClick={() => setSetupModalData(null)}
              className="w-full h-10 text-sm font-semibold rounded-xl cursor-pointer"
            >
              Done & Close
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default StaffList
