import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  School,
  RefreshCw,
  BookOpen,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/PageHeader"

import { schoolConfigService } from "@/api/schoolConfigService"
import { WingsBar } from "./WingsBar"
import { ClassSectionWorkspace } from "./ClassSectionWorkspace"
import {
  AddClassDialog,
  AddSectionDialog,
  AddWingDialog,
  SectionSubjectsDialog,
  ConfirmDeleteDialog,
  ChangeClassWingDialog,
  ManageWingClassesDialog,
  AssignClassTeacherDialog,
} from "./Dialogs"

export function ManageSchool() {
  const queryClient = useQueryClient()

  // -------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------
  const {
    data: config,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["schoolConfig"],
    queryFn: () => schoolConfigService.getFullConfig(),
    staleTime: 30000,
  })

  // 1b. Fetch Eligible Staff / Teachers for Faculty Assignments
  const { data: teachers = [] } = useQuery({
    queryKey: ["schoolTeachers"],
    queryFn: () => schoolConfigService.getTeachers(),
    staleTime: 60000,
  })

  // Normalize fetched data
  const classes = useMemo(() => {
    const rawClasses = config?.classes || []
    return rawClasses.map((cls) => ({
      ...cls,
      sections: [...(cls.sections || [])].sort((a, b) => {
        const nameCompare = (a.name || "").localeCompare(b.name || "", undefined, {
          numeric: true,
          sensitivity: "base",
        })
        if (nameCompare !== 0) return nameCompare
        if (a.created_at && b.created_at) {
          return new Date(a.created_at) - new Date(b.created_at)
        }
        return String(a.id || "").localeCompare(String(b.id || ""))
      }),
    }))
  }, [config?.classes])
  const wings = useMemo(() => config?.wings || [], [config?.wings])
  const subjects = useMemo(() => config?.subjects || [], [config?.subjects])

  // -------------------------------------------------------------
  // Selection State
  // -------------------------------------------------------------
  const [selectedWingId, setSelectedWingId] = useState("all") // "all" | "unassigned" | wing.id

  // Filter classes based on selected wing
  const filteredClasses = useMemo(() => {
    if (selectedWingId === "all") return classes
    if (selectedWingId === "unassigned") {
      const assignedIds = new Set()
      wings.forEach((w) => (w.class_ids || []).forEach((cid) => assignedIds.add(cid)))
      return classes.filter((c) => !assignedIds.has(c.id))
    }
    const wing = wings.find((w) => w.id === selectedWingId)
    if (!wing) return classes
    const wingClassIdSet = new Set(wing.class_ids || [])
    return classes.filter((c) => wingClassIdSet.has(c.id))
  }, [classes, wings, selectedWingId])

  // -------------------------------------------------------------
  // Dialog Open States
  // -------------------------------------------------------------
  const [isAddClassOpen, setIsAddClassOpen] = useState(false)
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false)
  const [targetClassForSection, setTargetClassForSection] = useState(null)
  const [isAddWingOpen, setIsAddWingOpen] = useState(false)
  const [isSectionSubjectsOpen, setIsSectionSubjectsOpen] = useState(false)
  const [sectionSubjectTarget, setSectionSubjectTarget] = useState({ class: null, section: null })
  const [isChangeWingOpen, setIsChangeWingOpen] = useState(false)
  const [targetClassForWing, setTargetClassForWing] = useState(null)
  const [isManageWingClassesOpen, setIsManageWingClassesOpen] = useState(false)
  const [targetWingForClasses, setTargetWingForClasses] = useState(null)
  const [isAssignClassTeacherOpen, setIsAssignClassTeacherOpen] = useState(false)
  const [targetSectionForClassTeacher, setTargetSectionForClassTeacher] = useState({ class: null, section: null })

  // Generic Confirmation Dialog
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    description: "",
    confirmLabel: "Delete",
    onConfirm: () => {},
    isLoading: false,
  })

  // -------------------------------------------------------------
  // Mutations & Query Invalidation
  // -------------------------------------------------------------
  const invalidateConfig = () => {
    queryClient.invalidateQueries({ queryKey: ["schoolConfig"] })
  }

  // 1. Class Mutations
  const createClassMutation = useMutation({
    mutationFn: (payload) => schoolConfigService.createClass(payload),
    onSuccess: (data) => {
      invalidateConfig()
      toast.success(`Class '${data?.name}' created successfully.`)
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create class.")
    },
  })

  const updateClassMutation = useMutation({
    mutationFn: ({ classId, payload }) => schoolConfigService.updateClass(classId, payload),
    onSuccess: () => {
      invalidateConfig()
      toast.success("Class updated successfully.")
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update class.")
    },
  })

  const deleteClassMutation = useMutation({
    mutationFn: (classId) => schoolConfigService.deleteClass(classId),
    onSuccess: () => {
      invalidateConfig()
      toast.success("Class deleted successfully.")
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete class.")
    },
  })

  // 2. Section Mutations
  const createSectionMutation = useMutation({
    mutationFn: ({ classId, payload }) => schoolConfigService.createSection(classId, payload),
    onSuccess: () => {
      invalidateConfig()
      toast.success("Section added successfully.")
    },
    onError: (err) => {
      toast.error(err.message || "Failed to add section.")
    },
  })

  const updateSectionMutation = useMutation({
    mutationFn: ({ sectionId, payload }) => schoolConfigService.updateSection(sectionId, payload),
    onSuccess: () => {
      invalidateConfig()
      toast.success("Section renamed successfully.")
    },
    onError: (err) => {
      toast.error(err.message || "Failed to rename section.")
    },
  })

  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId) => schoolConfigService.deleteSection(sectionId),
    onSuccess: () => {
      invalidateConfig()
      toast.success("Section deleted successfully.")
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete section.")
    },
  })

  const assignSectionSubjectsMutation = useMutation({
    mutationFn: ({ classId, sectionId, subjectIds }) =>
      schoolConfigService.assignSectionSubjects(classId, sectionId, subjectIds),
    onSuccess: () => {
      invalidateConfig()
      toast.success("Section subjects updated.")
    },
    onError: (err) => {
      toast.error(err.message || "Failed to assign section subjects.")
    },
  })

  // 3. Wing Mutations
  const createWingMutation = useMutation({
    mutationFn: (payload) => schoolConfigService.createWing(payload),
    onSuccess: (data) => {
      invalidateConfig()
      if (data?.id) setSelectedWingId(data.id)
      toast.success(`Wing '${data?.name}' created successfully.`)
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create wing.")
    },
  })

  const updateWingMutation = useMutation({
    mutationFn: ({ wingId, payload }) => schoolConfigService.updateWing(wingId, payload),
    onSuccess: () => {
      invalidateConfig()
      toast.success("Wing updated successfully.")
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update wing.")
    },
  })

  const deleteWingMutation = useMutation({
    mutationFn: (wingId) => schoolConfigService.deleteWing(wingId),
    onSuccess: () => {
      invalidateConfig()
      setSelectedWingId("all")
      toast.success("Wing deleted. Assigned classes are now unassigned.")
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete wing.")
    },
  })

  // 7. Class Teacher Assignment Mutation
  const assignClassTeacherMutation = useMutation({
    mutationFn: ({ sectionId, teacherId }) =>
      schoolConfigService.assignClassTeacher(sectionId, teacherId),
    onSuccess: (_, variables) => {
      invalidateConfig()
      toast.success(
        variables.teacherId
          ? "Class teacher assigned successfully."
          : "Class teacher unassigned successfully."
      )
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || err.message || "Failed to update class teacher."
      toast.error(msg)
    },
  })

  // 8. Section Subject Teacher Assignment Mutation
  const assignSubjectTeacherMutation = useMutation({
    mutationFn: ({ sectionId, subjectId, teacherId }) =>
      schoolConfigService.assignSectionSubjectTeacher(sectionId, subjectId, teacherId),
    onSuccess: (_, variables) => {
      invalidateConfig()
      toast.success(
        variables.teacherId
          ? "Subject teacher assigned successfully."
          : "Subject teacher unassigned successfully."
      )
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || err.message || "Failed to update subject teacher."
      toast.error(msg)
    },
  })

  // -------------------------------------------------------------
  // Handlers for UI Subcomponents
  // -------------------------------------------------------------

  // Class Teacher & Faculty Handlers
  const handleOpenAssignClassTeacher = (schoolClass, section) => {
    setTargetSectionForClassTeacher({ class: schoolClass, section })
    setIsAssignClassTeacherOpen(true)
  }

  const handleSaveClassTeacher = (sectionId, teacherId) => {
    assignClassTeacherMutation.mutate({ sectionId, teacherId })
    setIsAssignClassTeacherOpen(false)
  }

  const handleAssignSubjectTeacher = (sectionId, subjectId, teacherId) => {
    assignSubjectTeacherMutation.mutate({ sectionId, subjectId, teacherId })
  }

  // Class Actions
  const handleOpenAddClass = () => {
    setIsAddClassOpen(true)
  }

  const handleRenameClass = (clsId, newName) => {
    updateClassMutation.mutate({ classId: clsId, payload: { name: newName } })
  }

  const handleDeleteClass = (cls) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete ${cls.name}?`,
      description: `Are you sure you want to delete '${cls.name}' and its sections? This action cannot be undone. Any enrolled students or active timetable entries will prevent deletion.`,
      confirmLabel: "Delete Class",
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }))
        try {
          await deleteClassMutation.mutateAsync(cls.id)
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        } catch {
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }))
        }
      },
    })
  }

  // Section Actions
  const handleOpenAddSection = (cls) => {
    setTargetClassForSection(cls)
    setIsAddSectionOpen(true)
  }

  const handleRenameSection = (clsId, secId, newName) => {
    updateSectionMutation.mutate({ sectionId: secId, payload: { name: newName } })
  }

  const handleDeleteSection = (clsId, sec) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete ${sec.name}?`,
      description: `Are you sure you want to delete '${sec.name}'? Active students or timetable entries assigned to this section will prevent deletion.`,
      confirmLabel: "Delete Section",
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }))
        try {
          await deleteSectionMutation.mutateAsync(sec.id)
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        } catch {
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }))
        }
      },
    })
  }

  const handleManageSubjectsForSection = (cls, sec) => {
    setSectionSubjectTarget({ class: cls, section: sec })
    setIsSectionSubjectsOpen(true)
  }

  // Wing Actions
  const handleOpenAddWing = () => {
    setIsAddWingOpen(true)
  }

  const handleUpdateWing = (wingId, payload) => {
    updateWingMutation.mutate({ wingId, payload })
  }

  const handleDeleteWing = (wing) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete Wing '${wing.name}'?`,
      description: `Are you sure you want to delete '${wing.name}'? Underlying classes will NOT be deleted; they will simply become unassigned.`,
      confirmLabel: "Delete Wing",
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }))
        try {
          await deleteWingMutation.mutateAsync(wing.id)
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        } catch {
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }))
        }
      },
    })
  }

  // Wing Reassignment / Class Association Actions
  const handleOpenChangeWing = (cls) => {
    setTargetClassForWing(cls)
    setIsChangeWingOpen(true)
  }

  const handleSaveWingAssignment = (clsId, wingId) => {
    updateClassMutation.mutate({
      classId: clsId,
      payload: { wing_id: wingId, update_wing: true },
    })
  }

  const handleOpenManageWingClasses = (wing) => {
    setTargetWingForClasses(wing)
    setIsManageWingClassesOpen(true)
  }

  const handleSaveWingClasses = (wingId, classIds) => {
    updateWingMutation.mutate({
      wingId,
      payload: { class_ids: classIds },
    })
  }



  // -------------------------------------------------------------
  // Loading State
  // -------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in-0 duration-200 pb-12">
        {/* Header Skeleton */}
        <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="size-11 rounded-xl bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-muted rounded animate-pulse" />
              <div className="h-4 w-72 bg-muted/60 rounded animate-pulse" />
            </div>
          </div>
          <div className="h-9 w-28 bg-muted rounded-xl animate-pulse" />
        </div>

        {/* Wings Bar Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-card border border-border animate-pulse shadow-xs"
            />
          ))}
        </div>

        {/* Class Section Workspace Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 h-96 rounded-2xl bg-card border border-border animate-pulse shadow-xs" />
          <div className="lg:col-span-8 h-96 rounded-2xl bg-card border border-border animate-pulse shadow-xs" />
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // Error State
  // -------------------------------------------------------------
  if (isError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full p-6 rounded-2xl border border-destructive/40 bg-card text-center space-y-4 shadow-sm">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="size-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">Failed to Load School Configuration</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {error?.message || "An unexpected error occurred while fetching school configuration."}
            </p>
          </div>
          <Button
            onClick={() => refetch()}
            size="sm"
            className="font-semibold text-xs cursor-pointer gap-2"
          >
            <RefreshCw className="size-3.5" /> Retry Loading
          </Button>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------
  return (
    <div className="space-y-6 animate-in fade-in-0 duration-200 pb-12">
      {/* 1. Common Application Page Header */}
      <PageHeader
        icon={School}
        title="Manage School"
        description="Manage your school's academic structure, classes, sections, wings, and teacher assignments."
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        onCreate={handleOpenAddClass}
        createLabel="Add Class"
      />

      {/* 2. Top Bar: Wings Navigation & Class Overview */}
      <div className="space-y-2">
        <WingsBar
          wings={wings}
          classes={classes}
          selectedWingId={selectedWingId}
          onSelectWing={(wid) => setSelectedWingId(wid)}
          onAddWing={handleOpenAddWing}
          onUpdateWing={handleUpdateWing}
          onDeleteWing={handleDeleteWing}
          onOpenChangeWing={handleOpenChangeWing}
          onOpenManageClasses={handleOpenManageWingClasses}
        />
      </div>

      {/* 3. Section A: Classes & Sections Workspace */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Classes & Sections Workspace
            </h2>
          </div>
          {filteredClasses.length > 0 && (
            <span className="text-xs text-muted-foreground font-medium">
              Showing {filteredClasses.length} of {classes.length} Classes
            </span>
          )}
        </div>

        <ClassSectionWorkspace
          classes={filteredClasses}
          wings={wings}
          teachers={teachers}
          onAddClass={handleOpenAddClass}
          onRenameClass={handleRenameClass}
          onDeleteClass={handleDeleteClass}
          onOpenChangeWing={handleOpenChangeWing}
          onAddSection={handleOpenAddSection}
          onRenameSection={handleRenameSection}
          onDeleteSection={handleDeleteSection}
          onManageSubjectsForSection={handleManageSubjectsForSection}
          onAssignClassTeacher={handleOpenAssignClassTeacher}
          onAssignSubjectTeacher={handleAssignSubjectTeacher}
        />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. Modals & Dialogs                                           */}
      {/* ------------------------------------------------------------- */}

      {/* Add Class Dialog */}
      <AddClassDialog
        isOpen={isAddClassOpen}
        onClose={() => setIsAddClassOpen(false)}
        wings={wings}
        onAddClass={(payload) => createClassMutation.mutate(payload)}
      />

      {/* Add Section Dialog */}
      <AddSectionDialog
        isOpen={isAddSectionOpen}
        onClose={() => {
          setIsAddSectionOpen(false)
          setTargetClassForSection(null)
        }}
        targetClass={targetClassForSection}
        onAddSection={(classId, payload) =>
          createSectionMutation.mutate({ classId, payload })
        }
      />

      {/* Add Wing Dialog */}
      <AddWingDialog
        isOpen={isAddWingOpen}
        onClose={() => setIsAddWingOpen(false)}
        classes={classes}
        wings={wings}
        onAddWing={(payload) => createWingMutation.mutate(payload)}
      />

      {/* Manage Section Subjects Dialog */}
      <SectionSubjectsDialog
        isOpen={isSectionSubjectsOpen}
        onClose={() => {
          setIsSectionSubjectsOpen(false)
          setSectionSubjectTarget({ class: null, section: null })
        }}
        targetClass={sectionSubjectTarget.class}
        targetSection={sectionSubjectTarget.section}
        allSubjects={subjects}
        onSaveAssignments={(classId, sectionId, subjectIds) => {
          assignSectionSubjectsMutation.mutate({
            classId,
            sectionId,
            subjectIds,
          })
        }}
      />

      {/* Change Class Wing Dialog */}
      <ChangeClassWingDialog
        isOpen={isChangeWingOpen}
        onClose={() => {
          setIsChangeWingOpen(false)
          setTargetClassForWing(null)
        }}
        targetClass={targetClassForWing}
        wings={wings}
        onSaveWingAssignment={handleSaveWingAssignment}
      />

      {/* Manage Wing Classes Dialog */}
      <ManageWingClassesDialog
        isOpen={isManageWingClassesOpen}
        onClose={() => {
          setIsManageWingClassesOpen(false)
          setTargetWingForClasses(null)
        }}
        targetWing={targetWingForClasses}
        classes={classes}
        wings={wings}
        onSaveWingClasses={handleSaveWingClasses}
      />

      {/* Assign Class Teacher Dialog */}
      <AssignClassTeacherDialog
        isOpen={isAssignClassTeacherOpen}
        onClose={() => {
          setIsAssignClassTeacherOpen(false)
          setTargetSectionForClassTeacher({ class: null, section: null })
        }}
        targetClass={targetSectionForClassTeacher.class}
        targetSection={targetSectionForClassTeacher.section}
        teachers={teachers}
        onAssignTeacher={handleSaveClassTeacher}
        isPending={assignClassTeacherMutation.isPending}
      />

      {/* Generic Confirmation Modal */}
      <ConfirmDeleteDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        isLoading={confirmDialog.isLoading}
      />
    </div>
  )
}
