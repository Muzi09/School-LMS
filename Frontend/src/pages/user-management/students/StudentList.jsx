import React, { useState, useDeferredValue, useMemo } from "react"
import {
  GraduationCap,
  UserPlus,
  RefreshCw,
  Eye,
  Edit2,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useStudentsList, useUpdateStudentStatus } from "@/hooks/useStudents"
import { PageHeader } from "@/components/common/PageHeader"
import { DataTable } from "@/components/common/DataTable"
import { StudentFormModal } from "./StudentFormModal"
import { StudentDetailsModal } from "./StudentDetailsModal"
import { StudentDeleteDialog } from "./StudentDeleteDialog"
import { formatDateTime } from "@/lib/utils"

export function StudentList() {
  const [globalFilter, setGlobalFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [classFilter, setClassFilter] = useState("")
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
  } = useStudentsList({
    isActive: statusFilter === "" ? undefined : statusFilter === "true",
    className: classFilter || undefined,
    search: deferredSearch.trim() || undefined,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
  })

  const studentsList = data?.items || []
  const total = data?.total || 0

  const updateStatusMutation = useUpdateStudentStatus()

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [viewingStudent, setViewingStudent] = useState(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deletingStudent, setDeletingStudent] = useState(null)

  const handleToggleStatus = (student) => {
    updateStatusMutation.mutate({
      studentId: student.id,
      isActive: !student.is_active,
    })
  }

  const columns = useMemo(
    () => [
      {
        accessorFn: (row) => {
          const profile = row.student_profile || {}
          return `${row.first_name} ${profile.middle_name ? `${profile.middle_name} ` : ""}${row.last_name}`
        },
        id: "name",
        header: "Student Name",
        Cell: ({ row }) => {
          const s = row.original
          const profile = s.student_profile || {}
          return (
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center text-xs shrink-0">
                {s.first_name?.[0]}{s.last_name?.[0]}
              </div>
              <div>
                <span className="font-semibold text-foreground text-sm block">
                  {s.first_name} {profile.middle_name ? `${profile.middle_name} ` : ""}{s.last_name}
                </span>
                <span className="text-xs text-muted-foreground block truncate max-w-[180px]">
                  {s.email || "No email"}
                </span>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "student_profile.roll_no",
        header: "Roll No",
        Cell: ({ cell }) => (
          <span className="font-mono text-foreground font-medium text-sm">
            {cell.getValue() || "—"}
          </span>
        ),
      },
      {
        id: "class_section",
        header: "Class & Section",
        accessorFn: (row) => {
          const p = row.student_profile || {}
          return p.class_name ? `${p.class_name} • ${p.section || ""}` : "—"
        },
        Cell: ({ cell }) => <span className="text-foreground text-sm">{cell.getValue()}</span>,
      },
      {
        accessorKey: "student_profile.house",
        header: "House",
        Cell: ({ cell }) => (
          <span className="text-foreground text-sm">{cell.getValue() || "—"}</span>
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
          const p = row.student_profile || {}
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
        icon={GraduationCap}
        title="Manage Students"
        description="Register students, manage academic placement, class sections, and guardian contact profiles."
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        onCreate={() => {
          setEditingStudent(null)
          setIsFormOpen(true)
        }}
        createLabel="Create Student"
        createIcon={UserPlus}
      />

      {/* TanStack Data Table */}
      <DataTable
        columns={columns}
        data={studentsList}
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
                title="View Student Details"
                onClick={() => {
                  setViewingStudent(s)
                  setIsDetailsOpen(true)
                }}
                className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Eye className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Edit Student"
                onClick={() => {
                  setEditingStudent(s)
                  setIsFormOpen(true)
                }}
                className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Edit2 className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Delete Student"
                onClick={() => {
                  setDeletingStudent(s)
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
      <StudentFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        student={editingStudent}
      />

      <StudentDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        student={viewingStudent}
        onEdit={(s) => {
          setEditingStudent(s)
          setIsFormOpen(true)
        }}
      />

      <StudentDeleteDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        student={deletingStudent}
      />
    </div>
  )
}

export default StudentList
