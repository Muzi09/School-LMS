import { useState, useMemo, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import {
  CalendarDays,
  Clock,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/PageHeader"
import { useAuth } from "@/context/AuthContext"
import { Permission, hasPermission } from "@/lib/permissions"
import {
  useTimetables,
  useActiveTimetable,
  useActivateTimetable,
  useClassWiseTimetable,
} from "@/hooks/useTimetable"

import { TimetableHeader } from "./components/TimetableHeader"
import { PerspectiveSelector } from "./components/PerspectiveSelector"
import { ClassWiseGridView } from "./components/ClassWiseGridView"
import { BellScheduleSetupModal } from "./components/BellScheduleSetupModal"
import { CreateTimetableModal } from "./components/CreateTimetableModal"
import { parseSearchTokens } from "./searchUtils"
import { toast } from "sonner"

export function TimeTable() {
  const { user } = useAuth()
  const canManage = hasPermission(user?.role, Permission.MANAGE_TIMETABLE)
  const [searchParams, setSearchParams] = useSearchParams()

  // 1. Perspective State (synced to URL query param)
  const perspective = searchParams.get("perspective") || "class-wise"

  const handlePerspectiveChange = (newPerspective) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set("perspective", newPerspective)
      return next
    })
  }

  // 2. Timetable Selection State (synced to URL query param)
  const {
    data: timetables = [],
    isLoading: isTimetablesLoading,
    refetch: refetchTimetables,
  } = useTimetables()
  const { data: activeTimetable, refetch: refetchActiveTimetable } = useActiveTimetable()
  const activateTimetableMutation = useActivateTimetable()

  const urlTimetableId = searchParams.get("timetable_id")
  const selectedTimetableId = useMemo(() => {
    if (urlTimetableId && timetables.some((t) => t.id === urlTimetableId)) {
      return urlTimetableId
    }
    if (activeTimetable?.id) {
      return activeTimetable.id
    }
    if (timetables.length > 0) {
      return timetables[0].id
    }
    return null
  }, [urlTimetableId, timetables, activeTimetable])

  const handleSelectTimetable = (timetableId) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set("timetable_id", timetableId)
      return next
    })
  }

  const currentTimetable = useMemo(() => {
    return timetables.find((t) => t.id === selectedTimetableId) || timetables[0] || null
  }, [selectedTimetableId, timetables])

  // Active timetable check
  const isViewingActiveTimetable = useMemo(() => {
    if (!selectedTimetableId) return true
    return currentTimetable ? Boolean(currentTimetable.is_active) : true
  }, [selectedTimetableId, currentTimetable])

  const handleQuickActivate = async () => {
    if (!selectedTimetableId) return
    try {
      await activateTimetableMutation.mutateAsync(selectedTimetableId)
      toast.success("Timetable activated successfully.")
    } catch {
      toast.error("Failed to activate timetable.")
    }
  }

  // 3. Wing Selection State (synced to URL)
  const urlWing = searchParams.get("wing")
  const selectedWingIds = useMemo(() => {
    if (!urlWing || urlWing === "ALL") return []
    return urlWing.split(",").filter(Boolean)
  }, [urlWing])

  const handleSelectWingIds = (wingIds) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (wingIds.length === 0 || !wingIds[0]) {
        next.delete("wing")
      } else {
        next.set("wing", wingIds[0])
      }
      return next
    })
  }

  // 4. Search and Filters State (persisted across navigation)
  const [searchQuery, setSearchQuery] = useState(() => {
    return sessionStorage.getItem("timetable_search_query") || ""
  })

  const handleSearchChange = (query) => {
    setSearchQuery(query)
    if (query) {
      sessionStorage.setItem("timetable_search_query", query)
    } else {
      sessionStorage.removeItem("timetable_search_query")
    }
  }

  const searchTokens = useMemo(() => {
    return parseSearchTokens(searchQuery)
  }, [searchQuery])

  // 5. Assign Mode (Edit Mode) State (persisted across navigation)
  const [isAssignMode, setIsAssignMode] = useState(() => {
    return (
      searchParams.get("edit") === "true" ||
      sessionStorage.getItem("timetable_edit_mode") === "true"
    )
  })
  const [assignBarProps, setAssignBarProps] = useState(null)

  useEffect(() => {
    sessionStorage.setItem("timetable_edit_mode", isAssignMode ? "true" : "false")
  }, [isAssignMode])

  const handleToggleAssignMode = () => {
    setIsAssignMode((prev) => {
      const next = !prev
      sessionStorage.setItem("timetable_edit_mode", next ? "true" : "false")
      return next
    })
  }

  // 6. Zoom Settings (persisted to localStorage)
  const [zoomLevel, setZoomLevel] = useState(() => {
    const saved = localStorage.getItem("timetable_zoom")
    return saved ? parseInt(saved, 10) : 100
  })

  const handleZoomChange = (newZoom) => {
    setZoomLevel(newZoom)
    localStorage.setItem("timetable_zoom", String(newZoom))
  }

  // 7. Modals
  const [isBellSetupOpen, setIsBellSetupOpen] = useState(false)
  const [isCreateTimetableOpen, setIsCreateTimetableOpen] = useState(false)

  // 8. Class-wise Timetable Data Query
  const {
    data: timetableData,
    isLoading: isClassWiseLoading,
    isError: isClassWiseError,
    refetch: refetchClassWise,
  } = useClassWiseTimetable({
    timetableId: selectedTimetableId,
    wingId: null, // Load all wings so selector has full wing/class/section data
  })

  const wingsData = useMemo(() => timetableData?.wings || [], [timetableData?.wings])

  // Active wing ID: from URL or default to the first wing
  const activeWingId = useMemo(() => {
    if (selectedWingIds.length > 0) return selectedWingIds[0]
    return wingsData[0]?.id || null
  }, [selectedWingIds, wingsData])

  // Restore scroll position and highlight slot if returning from Manage School
  useEffect(() => {
    if (isClassWiseLoading || !timetableData) return

    const savedY = sessionStorage.getItem("timetable_scroll_y")
    const savedX = sessionStorage.getItem("timetable_scroll_x")
    const savedSlotKey = sessionStorage.getItem("timetable_scroll_slot_key")

    if (savedY !== null || savedSlotKey) {
      const timer = setTimeout(() => {
        let scrolled = false
        if (savedSlotKey) {
          const el = document.querySelector(`[data-slot-key="${savedSlotKey}"]`)
          if (el) {
            el.scrollIntoView({ behavior: "instant", block: "center" })
            el.classList.add("ring-2", "ring-primary", "ring-offset-2", "transition-all")
            setTimeout(() => {
              el.classList.remove("ring-2", "ring-primary", "ring-offset-2", "transition-all")
            }, 2000)
            scrolled = true
          }
        }
        if (!scrolled && savedY !== null) {
          window.scrollTo({
            top: parseInt(savedY, 10),
            left: parseInt(savedX || "0", 10),
            behavior: "instant",
          })
        }
        sessionStorage.removeItem("timetable_scroll_slot_key")
        sessionStorage.removeItem("timetable_scroll_y")
        sessionStorage.removeItem("timetable_scroll_x")
      }, 120)

      return () => clearTimeout(timer)
    }
  }, [isClassWiseLoading, timetableData])

  const handleRefreshAll = () => {
    refetchClassWise()
    refetchTimetables()
    refetchActiveTimetable()
  }

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-200 pb-12">
      {/* 1. Common Application Page Header with Description, Refresh, Timetable Selector & Bell Timings */}
      <PageHeader
        icon={CalendarDays}
        title="Timetable Management"
        description="Plan and configure academic bell schedules, manage class-wise timetables, and assign faculty."
        onRefresh={handleRefreshAll}
        isRefreshing={isTimetablesLoading || isClassWiseLoading}
        actions={
          <>
            <PerspectiveSelector
              currentPerspective={perspective}
              onChange={handlePerspectiveChange}
            />

            {canManage && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBellSetupOpen(true)}
                className="h-9 px-3.5 rounded-xl border border-border/80 bg-background hover:bg-muted/60 text-foreground flex items-center gap-2 text-xs font-semibold shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
                title="Configure period frames and bell schedules"
              >
                <Clock className="size-3.5 text-primary" />
                <span>Set Bell Timings</span>
              </Button>
            )}
          </>
        }
      />

      {/* 2. Non-Active Timetable Persistent Banner */}
      {!isViewingActiveTimetable && (
        <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 rounded-2xl text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Draft Mode:</strong> You are viewing an inactive timetable schedule. Changes made here will not affect live student and faculty rosters.
            </span>
          </div>

          {canManage && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleQuickActivate}
              disabled={activateTimetableMutation.isPending}
              className="border-amber-500/40 text-amber-900 dark:text-amber-100 hover:bg-amber-500/15 font-semibold text-xs h-7 px-3 shrink-0"
            >
              Set as Active
            </Button>
          )}
        </div>
      )}

      {/* 3. Sticky Contextual Timetable Controls Header */}
      <TimetableHeader
        timetables={timetables}
        selectedTimetableId={selectedTimetableId}
        onSelectTimetable={handleSelectTimetable}
        onCreateNewTimetable={() => setIsCreateTimetableOpen(true)}
        wings={wingsData}
        selectedWingIds={activeWingId ? [activeWingId] : []}
        onSelectWingIds={handleSelectWingIds}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        canManage={canManage}
        isAssignMode={isAssignMode}
        onToggleAssignMode={handleToggleAssignMode}
        assignBarProps={assignBarProps}
        zoomLevel={zoomLevel}
        onZoomChange={handleZoomChange}
      />

      {/* 4. Timetable Body Content */}
      <ClassWiseGridView
        timetableData={timetableData}
        isLoading={isTimetablesLoading || isClassWiseLoading}
        isError={isClassWiseError}
        onRetry={refetchClassWise}
        selectedWingId={activeWingId || "ALL"}
        searchQuery={searchQuery}
        searchTokens={searchTokens}
        isAssignMode={isAssignMode}
        onToggleAssignMode={handleToggleAssignMode}
        onAssignBarPropsChange={setAssignBarProps}
        zoom={zoomLevel}
        onOpenBellSetup={() => setIsBellSetupOpen(true)}
        onCreateNewTimetable={() => setIsCreateTimetableOpen(true)}
      />

      {/* 5. Modals */}
      {/* Bell Schedule Setup Modal */}
      {isBellSetupOpen && selectedTimetableId && (
        <BellScheduleSetupModal
          isOpen={isBellSetupOpen}
          onClose={() => setIsBellSetupOpen(false)}
          timetableId={selectedTimetableId}
          wings={wingsData}
          onSaved={() => {
            refetchClassWise()
            toast.success("Bell schedule setups saved successfully.")
          }}
        />
      )}

      {/* Create New Timetable Modal */}
      {isCreateTimetableOpen && (
        <CreateTimetableModal
          isOpen={isCreateTimetableOpen}
          onClose={() => setIsCreateTimetableOpen(false)}
          existingTimetables={timetables}
          onCreated={(newTt) => {
            handleSelectTimetable(newTt.id)
          }}
        />
      )}
    </div>
  )
}

export default TimeTable
