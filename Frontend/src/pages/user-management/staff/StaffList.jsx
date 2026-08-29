import React, { useState, useDeferredValue } from "react"
import {
  Briefcase,
  UserPlus,
  Search,
  RefreshCw,
  Eye,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { useStaffList, useUpdateStaffStatus } from "@/hooks/useStaff"
import { StaffFormModal } from "./StaffFormModal"
import { StaffDetailsModal } from "./StaffDetailsModal"
import { StaffDeleteDialog } from "./StaffDeleteDialog"

export function StaffList() {
  const [searchInput, setSearchInput] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 10

  const deferredSearch = useDeferredValue(searchInput)

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useStaffList({
    isActive: statusFilter === "" ? undefined : statusFilter === "true",
    search: deferredSearch.trim() || undefined,
    page,
    pageSize,
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

  const totalPages = Math.ceil(total / pageSize) || 1

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

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, roll no, mobile..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value)
              setPage(1)
            }}
            className="pl-8 h-8 text-xs bg-card"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="h-8 rounded-lg border border-input bg-card px-2.5 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">All Status</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        {error && (
          <div className="p-4 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error.message || "Failed to load staff members"}</span>
          </div>
        )}

        <Table>
          <TableHeader className="bg-muted/40 uppercase text-[11px] font-semibold text-muted-foreground tracking-wider">
            <TableRow>
              <TableHead className="px-5 py-3.5">Staff Member</TableHead>
              <TableHead className="px-5 py-3.5">Roll / Staff ID</TableHead>
              <TableHead className="px-5 py-3.5">Login Mobile</TableHead>
              <TableHead className="px-5 py-3.5">Father's Name</TableHead>
              <TableHead className="px-5 py-3.5">Status</TableHead>
              <TableHead className="px-5 py-3.5 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/60">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                  <Loader2 className="size-6 animate-spin mx-auto mb-2 text-primary" />
                  <span>Loading staff directory...</span>
                </TableCell>
              </TableRow>
            ) : staffList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                  <Users className="size-8 mx-auto mb-2 opacity-30" />
                  <p className="font-medium text-foreground text-sm">No staff members found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {searchInput ? "Try modifying your search criteria." : "Click 'Create Staff' to add a staff member."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              staffList.map((s) => {
                const profile = s.staff_profile || {}
                return (
                  <TableRow key={s.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="px-5 py-3.5">
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
                    </TableCell>
                    <TableCell className="px-5 py-3.5 font-mono text-foreground font-medium">
                      {profile.roll_no || "—"}
                    </TableCell>
                    <TableCell className="px-5 py-3.5 font-mono text-foreground">{s.login_mobile}</TableCell>
                    <TableCell className="px-5 py-3.5 text-foreground">
                      {profile.father_first_name ? `${profile.father_first_name} ${profile.father_last_name || ""}` : "—"}
                    </TableCell>
                    <TableCell className="px-5 py-3.5">
                      <button
                        onClick={() => handleToggleStatus(s)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                          s.is_active
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                            : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                        }`}
                      >
                        <span className={`size-1.5 rounded-full ${s.is_active ? "bg-emerald-500" : "bg-destructive"}`} />
                        <span>{s.is_active ? "Active" : "Inactive"}</span>
                      </button>
                    </TableCell>
                    <TableCell className="px-5 py-3.5 text-right">
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
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
          <span>
            Showing <strong className="text-foreground">{staffList.length}</strong> of{" "}
            <strong className="text-foreground">{total}</strong> staff members
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="px-2 font-medium text-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

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
