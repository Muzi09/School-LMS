import React, { useState, useMemo, useEffect } from "react"
import {
  FileSpreadsheet,
  Layers,
  GraduationCap,
  UserCheck,
  Check,
  Search,
  Filter,
  Loader2,
  CheckSquare,
  Square,
  Palette,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useExportTimetableExcel } from "@/hooks/useTimetable"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function ExportTimetableModal({
  isOpen,
  onClose,
  timetable,
  wings = [],
  sections = [],
  teachers = [],
}) {
  const [scope, setScope] = useState("both") // "classwise" | "teacherwise" | "both"
  const [selectedWingId, setSelectedWingId] = useState("ALL")
  const [colorCoded, setColorCoded] = useState(true)

  // Class Selection State
  const [classSearch, setClassSearch] = useState("")
  const [selectedSectionIds, setSelectedSectionIds] = useState(() => {
    return new Set(sections.map((s) => s.id))
  })

  // Teacher Selection State
  const [teacherSearch, setTeacherSearch] = useState("")
  const [selectedTeacherIds, setSelectedTeacherIds] = useState(() => {
    return new Set(teachers.map((t) => t.id))
  })

  const exportMutation = useExportTimetableExcel()

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  // Filter sections by selected wing
  const filteredSectionsByWing = useMemo(() => {
    if (!selectedWingId || selectedWingId === "ALL") return sections
    const targetWing = wings.find((w) => String(w.id) === String(selectedWingId))
    if (!targetWing) return sections

    const wingClassIds = new Set((targetWing.classes || []).map((c) => c.id || c.class_id))
    return sections.filter((s) => wingClassIds.has(s.class_id))
  }, [sections, wings, selectedWingId])

  // Filter sections by search text
  const displayedSections = useMemo(() => {
    if (!classSearch.trim()) return filteredSectionsByWing
    const q = classSearch.toLowerCase().trim()
    return filteredSectionsByWing.filter((s) => {
      const clsName = (s.class_name || "").toLowerCase()
      const secName = (s.name || "").toLowerCase()
      return clsName.includes(q) || secName.includes(q) || `${clsName} ${secName}`.includes(q)
    })
  }, [filteredSectionsByWing, classSearch])

  // Filter teachers by search text
  const displayedTeachers = useMemo(() => {
    if (!teacherSearch.trim()) return teachers
    const q = teacherSearch.toLowerCase().trim()
    return teachers.filter((t) => {
      const name = `${t.first_name || ""} ${t.last_name || ""}`.toLowerCase()
      const dept = (t.department || t.designation || "").toLowerCase()
      return name.includes(q) || dept.includes(q)
    })
  }, [teachers, teacherSearch])

  // Toggle single section
  const handleToggleSection = (sectionId) => {
    setSelectedSectionIds((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  // Select / Deselect all sections
  const handleSelectAllSections = () => {
    setSelectedSectionIds(new Set(filteredSectionsByWing.map((s) => s.id)))
  }

  const handleClearAllSections = () => {
    setSelectedSectionIds(new Set())
  }

  // Toggle single teacher
  const handleToggleTeacher = (teacherId) => {
    setSelectedTeacherIds((prev) => {
      const next = new Set(prev)
      if (next.has(teacherId)) {
        next.delete(teacherId)
      } else {
        next.add(teacherId)
      }
      return next
    })
  }

  // Select / Deselect all teachers
  const handleSelectAllTeachers = () => {
    setSelectedTeacherIds(new Set(teachers.map((t) => t.id)))
  }

  const handleClearAllTeachers = () => {
    setSelectedTeacherIds(new Set())
  }

  // Handle Export submission
  const handleExport = async () => {
    if (!timetable?.id) {
      toast.error("No active timetable schedule found to export.")
      return
    }

    const exportSectionIds = scope === "teacherwise" ? null : Array.from(selectedSectionIds)
    const exportTeacherIds = scope === "classwise" ? null : Array.from(selectedTeacherIds)

    if (scope !== "teacherwise" && exportSectionIds && exportSectionIds.length === 0) {
      toast.error("Please select at least one class section to export.")
      return
    }

    if (scope !== "classwise" && exportTeacherIds && exportTeacherIds.length === 0) {
      toast.error("Please select at least one teacher to export.")
      return
    }

    try {
      const payload = {
        scope,
        wing_ids: selectedWingId && selectedWingId !== "ALL" ? [selectedWingId] : null,
        section_ids: exportSectionIds,
        teacher_ids: exportTeacherIds,
        color_coded: colorCoded,
      }

      const blob = await exportMutation.mutateAsync({
        timetableId: timetable.id,
        payload,
      })

      // Download file in browser
      const cleanName = (timetable.name || "Timetable").replace(/[^a-zA-Z0-9_-]/g, "_")
      const dateStr = new Date().toISOString().slice(0, 10)
      const fileName = `${cleanName}_${scope}_${dateStr}.xlsx`

      const url = window.URL.createObjectURL(new Blob([blob]))
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", fileName)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success("Excel spreadsheet downloaded successfully!")
      onClose()
    } catch (err) {
      console.error("Export error:", err)
      toast.error("Failed to generate timetable Excel export. Please try again.")
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in-0 duration-150">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-2xl max-h-[82vh] sm:max-h-[85vh] flex flex-col bg-card border border-border shadow-2xl rounded-2xl z-10 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/80 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Export Timetable to Excel</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin">
          {/* 1. Scope Selection (Radio Cards without descriptive subtext) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="size-3.5 text-primary" />
              <span>Select Export Format</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Both Option */}
              <button
                type="button"
                onClick={() => setScope("both")}
                className={cn(
                  "p-3 rounded-xl border text-center flex items-center justify-center gap-2 transition-all cursor-pointer font-bold text-xs",
                  scope === "both"
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/40 shadow-2xs"
                    : "border-border/80 text-foreground hover:bg-muted/40"
                )}
              >
                <span>Both</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary">
                  Recommended
                </span>
              </button>

              {/* Class-wise Option */}
              <button
                type="button"
                onClick={() => setScope("classwise")}
                className={cn(
                  "p-3 rounded-xl border text-center flex items-center justify-center gap-2 transition-all cursor-pointer font-bold text-xs",
                  scope === "classwise"
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/40 shadow-2xs"
                    : "border-border/80 text-foreground hover:bg-muted/40"
                )}
              >
                <GraduationCap className="size-4 text-primary" />
                <span>Class-wise</span>
              </button>

              {/* Teacher-wise Option */}
              <button
                type="button"
                onClick={() => setScope("teacherwise")}
                className={cn(
                  "p-3 rounded-xl border text-center flex items-center justify-center gap-2 transition-all cursor-pointer font-bold text-xs",
                  scope === "teacherwise"
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/40 shadow-2xs"
                    : "border-border/80 text-foreground hover:bg-muted/40"
                )}
              >
                <UserCheck className="size-4 text-primary" />
                <span>Teacher-wise</span>
              </button>
            </div>
          </div>

          {/* 2. Wing Selector Filter (without descriptive subtext) */}
          {wings.length > 0 && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/30 border border-border/60">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-bold text-foreground">Filter by Wing</span>
              </div>
              <select
                value={selectedWingId}
                onChange={(e) => setSelectedWingId(e.target.value)}
                className="text-xs font-semibold bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-foreground cursor-pointer outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Wings ({sections.length} classes)</option>
                {wings.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 3. Class Section Selector (Visible for Class-wise or Both) */}
          {(scope === "classwise" || scope === "both") && (
            <div className="space-y-2.5 p-3.5 rounded-xl border border-border/80 bg-card">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <GraduationCap className="size-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">Select Classes / Sections</span>
                  <Badge variant="outline" className="text-[10px] ml-1 font-semibold">
                    {selectedSectionIds.size} / {filteredSectionsByWing.length} selected
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={handleSelectAllSections}
                    className="h-7 text-xs font-medium cursor-pointer"
                  >
                    <CheckSquare className="size-3 mr-1" />
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={handleClearAllSections}
                    className="h-7 text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <Square className="size-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>

              {/* Quick Search */}
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  placeholder="Search class or section (e.g. 6 A, 10)..."
                  className="h-8 pl-8 text-xs rounded-lg"
                />
              </div>

              {/* Section Chips Grid */}
              <div className="max-h-36 overflow-y-auto p-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5 border border-border/50 rounded-lg bg-muted/15 scrollbar-thin">
                {displayedSections.map((sec) => {
                  const isSelected = selectedSectionIds.has(sec.id)
                  const label = `${sec.class_name || "Class"} ${sec.name}`
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => handleToggleSection(sec.id)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-all cursor-pointer text-left border",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                          : "bg-background text-foreground border-border/80 hover:bg-muted/60"
                      )}
                    >
                      <span className="truncate">{label}</span>
                      {isSelected && <Check className="size-3 shrink-0 ml-1" />}
                    </button>
                  )
                })}
                {displayedSections.length === 0 && (
                  <div className="col-span-full py-4 text-center text-xs text-muted-foreground">
                    No classes matching search.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. Teacher Selector (Visible for Teacher-wise or Both) */}
          {(scope === "teacherwise" || scope === "both") && (
            <div className="space-y-2.5 p-3.5 rounded-xl border border-border/80 bg-card">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="size-4 text-sky-600 dark:text-sky-400" />
                  <span className="text-xs font-bold text-foreground">Select Faculty Members</span>
                  <Badge variant="outline" className="text-[10px] ml-1 font-semibold">
                    {selectedTeacherIds.size} / {teachers.length} selected
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={handleSelectAllTeachers}
                    className="h-7 text-xs font-medium cursor-pointer"
                  >
                    <CheckSquare className="size-3 mr-1" />
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={handleClearAllTeachers}
                    className="h-7 text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <Square className="size-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>

              {/* Teacher Search */}
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  placeholder="Search teacher by name or department..."
                  className="h-8 pl-8 text-xs rounded-lg"
                />
              </div>

              {/* Teacher List Grid */}
              <div className="max-h-36 overflow-y-auto p-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 border border-border/50 rounded-lg bg-muted/15 scrollbar-thin">
                {displayedTeachers.map((t) => {
                  const isSelected = selectedTeacherIds.has(t.id)
                  const name = `${t.first_name || ""} ${t.last_name || ""}`.trim() || t.email
                  const dept = t.department || t.designation || ""
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleToggleTeacher(t.id)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-all cursor-pointer text-left border",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                          : "bg-background text-foreground border-border/80 hover:bg-muted/60"
                      )}
                    >
                      <div className="truncate min-w-0 pr-1">
                        <p className="truncate font-bold leading-tight">{name}</p>
                        {dept && (
                          <p
                            className={cn(
                              "text-[10px] truncate leading-tight",
                              isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                            )}
                          >
                            {dept}
                          </p>
                        )}
                      </div>
                      {isSelected && <Check className="size-3.5 shrink-0" />}
                    </button>
                  )
                })}
                {displayedTeachers.length === 0 && (
                  <div className="col-span-full py-4 text-center text-xs text-muted-foreground">
                    No teachers found.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. Color Grading Option */}
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/20 cursor-pointer">
            <input
              type="checkbox"
              checked={colorCoded}
              onChange={(e) => setColorCoded(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Palette className="size-3.5 text-primary" />
                <span className="text-xs font-bold text-foreground">Apply Subject Color Grading</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Applies matching pastel shades (Math in blue, English in green, Science in amber, etc.)
              </p>
            </div>
          </label>
        </div>

        {/* Footer: Pinned at the bottom, 100% visible */}
        <div className="px-5 py-3.5 border-t border-border/80 bg-muted/20 shrink-0 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onClose}
            disabled={exportMutation.isPending}
            className="h-9 px-4 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            size="default"
            onClick={handleExport}
            disabled={exportMutation.isPending}
            className="h-9 px-5 text-xs font-bold gap-2 cursor-pointer shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {exportMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Generating Excel...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="size-4" />
                <span>Download Excel (.xlsx)</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
