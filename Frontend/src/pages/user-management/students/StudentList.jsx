import React, { useState, useDeferredValue } from "react"
import {
  GraduationCap,
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
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { useStudentsList, useUpdateStudentStatus } from "@/hooks/useStudents"
import { StudentFormModal } from "./StudentFormModal"
import { StudentDetailsModal } from "./StudentDetailsModal"
import { StudentDeleteDialog } from "./StudentDeleteDialog"

export function StudentList() {
  const [searchInput, setSearchInput] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [classFilter, setClassFilter] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 10

  const deferredSearch = useDeferredValue(searchInput)

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
    page,
    pageSize,
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

  const totalPages = Math.ceil(total / pageSize) || 1

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <GraduationCap className="size-5 text-primary" />
            <span>Manage Students</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Register students, manage academic placement, class sections, and guardian contact profiles.
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
              setEditingStudent(null)
              setIsFormOpen(true)
            }}
            className="gap-1.5 text-xs shadow-xs"
          >
            <UserPlus className="size-4" />
            <span>Create Student</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, roll no, mobile, house..."
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

      {/* Students Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        {error && (
          <div className="p-4 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error.message || "Failed to load students"}</span>
          </div>
        )}

        <Table>
          <TableHeader className="bg-muted/40 uppercase text-[11px] font-semibold text-muted-foreground tracking-wider">
            <TableRow>
              <TableHead className="px-5 py-3.5">Student Name</TableHead>
              <TableHead className="px-5 py-3.5">Roll No</TableHead>
              <TableHead className="px-5 py-3.5">Class & Section</TableHead>
              <TableHead className="px-5 py-3.5">House</TableHead>
              <TableHead className="px-5 py-3.5">Login Mobile</TableHead>
              <TableHead className="px-5 py-3.5">Father's Name</TableHead>
              <TableHead className="px-5 py-3.5">Status</TableHead>
              <TableHead className="px-5 py-3.5 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/60">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="px-5 py-12 text-center text-muted-foreground">
                  <Loader2 className="size-6 animate-spin mx-auto mb-2 text-primary" />
                  <span>Loading student registry...</span>
                </TableCell>
              </TableRow>
            ) : studentsList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-5 py-12 text-center text-muted-foreground">
                  <Users className="size-8 mx-auto mb-2 opacity-30" />
                  <p className="font-medium text-foreground text-sm">No students found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {searchInput ? "Try modifying your search criteria." : "Click 'Create Student' to register a student."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              studentsList.map((s) => {
                const profile = s.student_profile || {}
                return (
                  <TableRow key={s.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center text-xs shrink-0">
                          {s.first_name?.[0]}{s.last_name?.[0]}
                        </div>
                        <div>
                          <span className="font-semibold text-foreground text-xs block">
                            {s.first_name} {profile.middle_name ? `${profile.middle_name} ` : ""}{s.last_name}
                          </span>
                          <span className="text-[11px] text-muted-foreground block truncate max-w-[180px]">
                            {s.email || "No email"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-3.5 font-mono text-foreground font-medium">
                      {profile.roll_no || "—"}
                    </TableCell>
                    <TableCell className="px-5 py-3.5 text-foreground">
                      {profile.class_name ? `${profile.class_name} • ${profile.section || ""}` : "—"}
                    </TableCell>
                    <TableCell className="px-5 py-3.5 text-muted-foreground">
                      {profile.house || "—"}
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
                          title="View Student Details"
                          onClick={() => {
                            setViewingStudent(s)
                            setIsDetailsOpen(true)
                          }}
                        >
                          <Eye className="size-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Edit Student"
                          onClick={() => {
                            setEditingStudent(s)
                            setIsFormOpen(true)
                          }}
                        >
                          <Edit2 className="size-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Delete Student"
                          onClick={() => {
                            setDeletingStudent(s)
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
            Showing <strong className="text-foreground">{studentsList.length}</strong> of{" "}
            <strong className="text-foreground">{total}</strong> students
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
