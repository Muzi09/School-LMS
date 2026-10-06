import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  SlidersHorizontal,
  BookOpen,
  Shield,
  Palette,
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/PageHeader"

import { schoolConfigService } from "@/api/schoolConfigService"
import { SubjectsPanel } from "./SubjectsPanel"
import { HousesPanel } from "./HousesPanel"
import { CustomizationPanel } from "./CustomizationPanel"
import {
  SubjectDialog,
  AddHouseDialog,
  ConfirmDeleteDialog,
} from "./Dialogs"

export function SchoolConfiguration() {
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

  // Normalize configuration data
  const classes = useMemo(() => config?.classes || [], [config?.classes])
  const subjects = useMemo(() => config?.subjects || [], [config?.subjects])
  const houses = useMemo(() => config?.houses || [], [config?.houses])
  const customization = useMemo(() => config?.customization || {}, [config?.customization])

  // -------------------------------------------------------------
  // Navigation State
  // -------------------------------------------------------------
  const [activeTab, setActiveTab] = useState("subjects") // "subjects" | "houses" | "customization"

  // -------------------------------------------------------------
  // Dialog Open States
  // -------------------------------------------------------------
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState(null)
  const [isAddHouseOpen, setIsAddHouseOpen] = useState(false)

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

  // 1. Subject Mutations
  const saveSubjectMutation = useMutation({
    mutationFn: (payload) => {
      if (payload.id) {
        return schoolConfigService.updateSubject(payload.id, payload)
      }
      return schoolConfigService.createSubject(payload)
    },
    onSuccess: (_, vars) => {
      invalidateConfig()
      toast.success(vars.id ? "Subject updated successfully." : "Subject created successfully.")
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save subject.")
    },
  })

  const deleteSubjectMutation = useMutation({
    mutationFn: (subjectId) => schoolConfigService.deleteSubject(subjectId),
    onSuccess: () => {
      invalidateConfig()
      toast.success("Subject deleted successfully.")
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete subject.")
    },
  })

  // 2. House Mutations
  const createHouseMutation = useMutation({
    mutationFn: (payload) => schoolConfigService.createHouse(payload),
    onSuccess: () => {
      invalidateConfig()
      toast.success("House added successfully.")
    },
    onError: (err) => {
      toast.error(err.message || "Failed to add house.")
    },
  })

  const updateHouseMutation = useMutation({
    mutationFn: ({ houseId, payload }) => schoolConfigService.updateHouse(houseId, payload),
    onSuccess: () => {
      invalidateConfig()
      toast.success("House updated successfully.")
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update house.")
    },
  })

  const deleteHouseMutation = useMutation({
    mutationFn: (houseId) => schoolConfigService.deleteHouse(houseId),
    onSuccess: () => {
      invalidateConfig()
      toast.success("House deleted successfully.")
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete house.")
    },
  })

  // 3. Customization Mutations
  const updateCustomizationMutation = useMutation({
    mutationFn: (payload) => schoolConfigService.updateCustomization(payload),
    onSuccess: () => {
      invalidateConfig()
      toast.success("School customization updated successfully.")
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update customization.")
    },
  })

  // -------------------------------------------------------------
  // Handlers for UI Subcomponents
  // -------------------------------------------------------------

  // Subject Actions
  const handleOpenAddSubject = () => {
    setEditingSubject(null)
    setIsSubjectDialogOpen(true)
  }

  const handleEditSubject = (sub) => {
    setEditingSubject(sub)
    setIsSubjectDialogOpen(true)
  }

  const handleDeleteSubject = (sub) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete Subject '${sub.name}'?`,
      description: `Are you sure you want to delete '${sub.name}'? It will be removed from all class and section curricula.`,
      confirmLabel: "Delete Subject",
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }))
        try {
          await deleteSubjectMutation.mutateAsync(sub.id)
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        } catch {
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }))
        }
      },
    })
  }

  // House Actions
  const handleOpenAddHouse = () => {
    setIsAddHouseOpen(true)
  }

  const handleUpdateHouse = (houseId, payload) => {
    updateHouseMutation.mutate({ houseId, payload })
  }

  const handleDeleteHouse = (h) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete House '${h.name}'?`,
      description: `Are you sure you want to delete '${h.name}'?`,
      confirmLabel: "Delete House",
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }))
        try {
          await deleteHouseMutation.mutateAsync(h.id)
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        } catch {
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }))
        }
      },
    })
  }

  // Customization
  const handleSaveCustomization = (payload) => {
    updateCustomizationMutation.mutate(payload)
  }

  const handleUploadEmblem = async (formData) => {
    return await schoolConfigService.uploadEmblem(formData)
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

        {/* Tab Buttons Skeleton */}
        <div className="flex gap-2">
          <div className="h-10 w-44 rounded-xl bg-muted/60 animate-pulse" />
          <div className="h-10 w-36 rounded-xl bg-muted/60 animate-pulse" />
          <div className="h-10 w-48 rounded-xl bg-muted/60 animate-pulse" />
        </div>

        {/* Panel Skeleton */}
        <div className="h-96 rounded-2xl bg-card border border-border animate-pulse shadow-xs" />
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
      {/* 1. Page Header */}
      <PageHeader
        icon={SlidersHorizontal}
        title="School Configuration"
        description="Configure school-wide curriculum subjects, student houses, and institution branding & customization."
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        onCreate={
          activeTab === "subjects"
            ? handleOpenAddSubject
            : activeTab === "houses" && houses.length < 4
            ? handleOpenAddHouse
            : undefined
        }
        createLabel={
          activeTab === "subjects"
            ? "Add Subject"
            : activeTab === "houses" && houses.length < 4
            ? "Add House"
            : undefined
        }
      />

      {/* 2. Top Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("subjects")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === "subjects"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-card text-muted-foreground border border-border hover:text-foreground hover:bg-accent/50"
          }`}
        >
          <BookOpen className="size-3.5" />
          Curriculum & Subjects
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === "subjects"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {subjects.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("houses")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === "houses"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-card text-muted-foreground border border-border hover:text-foreground hover:bg-accent/50"
          }`}
        >
          <Shield className="size-3.5" />
          School Houses
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === "houses"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {houses.length}/4
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("customization")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === "customization"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-card text-muted-foreground border border-border hover:text-foreground hover:bg-accent/50"
          }`}
        >
          <Palette className="size-3.5" />
          Branding & Customization
        </button>
      </div>

      {/* 3. Tab Content Display */}
      {activeTab === "subjects" && (
        <SubjectsPanel
          subjects={subjects}
          classes={classes}
          onAddSubject={handleOpenAddSubject}
          onEditSubject={handleEditSubject}
          onDeleteSubject={handleDeleteSubject}
        />
      )}

      {activeTab === "houses" && (
        <HousesPanel
          houses={houses}
          onAddHouse={handleOpenAddHouse}
          onUpdateHouse={(hid, p) => handleUpdateHouse(hid, p)}
          onDeleteHouse={handleDeleteHouse}
        />
      )}

      {activeTab === "customization" && (
        <CustomizationPanel
          customization={customization}
          onSaveCustomization={handleSaveCustomization}
          onUploadEmblem={handleUploadEmblem}
          isSaving={updateCustomizationMutation.isPending}
        />
      )}

      {/* 4. Modals & Dialogs */}
      {/* Add / Edit Subject Dialog */}
      <SubjectDialog
        isOpen={isSubjectDialogOpen}
        onClose={() => {
          setIsSubjectDialogOpen(false)
          setEditingSubject(null)
        }}
        subject={editingSubject}
        classes={classes}
        onSaveSubject={(payload) => saveSubjectMutation.mutate(payload)}
      />

      {/* Add House Dialog */}
      <AddHouseDialog
        isOpen={isAddHouseOpen}
        onClose={() => setIsAddHouseOpen(false)}
        onAddHouse={(payload) => createHouseMutation.mutate(payload)}
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
