import React, { useState, useMemo, useRef, useEffect } from "react"
import {
  Printer,
  Layers,
  GraduationCap,
  UserCheck,
  Check,
  Search,
  Filter,
  CheckSquare,
  Square,
  Eye,
  Settings,
  Layout,
  Palette,
  FileText,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { TimetablePrintView } from "./TimetablePrintView"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function PrintTimetableModal({
  isOpen,
  onClose,
  schoolName = "School",
  timetable,
  wings = [],
  sections = [],
  teachers = [],
  setups = [],
  entries = [],
}) {
  const [activeTab, setActiveTab] = useState("configure") // "configure" | "preview"
  const [scope, setScope] = useState("both") // "classwise" | "teacherwise" | "both"
  const [selectedWingId, setSelectedWingId] = useState("ALL")

  // Class Selection
  const [classSearch, setClassSearch] = useState("")
  const [selectedSectionIds, setSelectedSectionIds] = useState(() => {
    return new Set(sections.map((s) => s.id))
  })

  // Teacher Selection
  const [teacherSearch, setTeacherSearch] = useState("")
  const [selectedTeacherIds, setSelectedTeacherIds] = useState(() => {
    return new Set(teachers.map((t) => t.id))
  })

  // Print Settings
  const [orientation, setOrientation] = useState("landscape") // "landscape" | "portrait"
  const [pageBreak, setPageBreak] = useState("always") // "always" | "auto"
  const [colorMode, setColorMode] = useState("color") // "color" | "bw"
  const [includeHeader, setIncludeHeader] = useState(true)

  const printAreaRef = useRef(null)

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

  // Sections actually selected to print
  const printableSections = useMemo(() => {
    if (scope === "teacherwise") return []
    return sections.filter((s) => selectedSectionIds.has(s.id))
  }, [sections, selectedSectionIds, scope])

  // Teachers actually selected to print
  const printableTeachers = useMemo(() => {
    if (scope === "classwise") return []
    return teachers.filter((t) => selectedTeacherIds.has(t.id))
  }, [teachers, selectedTeacherIds, scope])

  // Selection handlers
  const handleToggleSection = (sectionId) => {
    setSelectedSectionIds((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  const handleSelectAllSections = () => {
    setSelectedSectionIds(new Set(filteredSectionsByWing.map((s) => s.id)))
  }

  const handleClearAllSections = () => {
    setSelectedSectionIds(new Set())
  }

  const handleToggleTeacher = (teacherId) => {
    setSelectedTeacherIds((prev) => {
      const next = new Set(prev)
      if (next.has(teacherId)) next.delete(teacherId)
      else next.add(teacherId)
      return next
    })
  }

  const handleSelectAllTeachers = () => {
    setSelectedTeacherIds(new Set(teachers.map((t) => t.id)))
  }

  const handleClearAllTeachers = () => {
    setSelectedTeacherIds(new Set())
  }

  // Robust isolated iframe printing
  const handlePrint = () => {
    if (printableSections.length === 0 && printableTeachers.length === 0) {
      toast.error("Please select at least one class or teacher to print.")
      return
    }

    const printElement = printAreaRef.current
    if (!printElement) {
      toast.error("Printable content not ready. Please try again.")
      return
    }

    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "0"
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) {
      toast.error("Could not initialize print window.")
      document.body.removeChild(iframe)
      return
    }

    // Extract tailwind stylesheets & injected styles
    const styles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
      .map((el) => el.outerHTML)
      .join("\n")

    doc.open()
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${timetable?.name || "Timetable"} - Print</title>
          ${styles}
          <style>
            @page {
              size: ${orientation};
              margin: 8mm;
            }
            body {
              background: white !important;
              color: black !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              font-family: system-ui, -apple-system, sans-serif;
            }
            .break-after-page {
              page-break-after: ${pageBreak === "always" ? "always" : "auto"} !important;
              break-after: ${pageBreak === "always" ? "page" : "auto"} !important;
            }
            .break-inside-avoid {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            table {
              border-collapse: collapse !important;
              width: 100% !important;
            }
            th, td {
              border: 1px solid #94a3b8 !important;
            }
          </style>
        </head>
        <body>
          <div style="padding: 10px;">
            ${printElement.innerHTML}
          </div>
        </body>
      </html>
    `)
    doc.close()

    iframe.contentWindow?.focus()
    setTimeout(() => {
      try {
        iframe.contentWindow?.print()
      } catch (e) {
        console.error("Print error:", e)
      } finally {
        setTimeout(() => {
          document.body.removeChild(iframe)
        }, 1000)
      }
    }, 400)
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
      <div className="relative w-full max-w-4xl max-h-[82vh] sm:max-h-[85vh] flex flex-col bg-card border border-border shadow-2xl rounded-2xl z-10 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/80 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Printer className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Print Timetable Schedules</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Toggle Tab */}
            <div className="flex items-center gap-1 p-1 bg-muted rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab("configure")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  activeTab === "configure"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Settings className="size-3.5" />
                <span>Configure</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  activeTab === "preview"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Eye className="size-3.5" />
                <span>Preview ({printableSections.length + printableTeachers.length})</span>
              </button>
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
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin">
          {activeTab === "configure" ? (
            <>
              {/* 1. Print Scope Selection (without descriptive subtext) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="size-3.5 text-primary" />
                  <span>Print Scope</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Both */}
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
                    <span>Both Schedules</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary">
                      All
                    </span>
                  </button>

                  {/* Class-wise */}
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

                  {/* Teacher-wise */}
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

              {/* 2. Layout & Print Settings Bar */}
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/80 space-y-3">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Layout className="size-3.5 text-primary" />
                  <span>Page Layout & Print Options</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  {/* Orientation */}
                  <div className="space-y-1">
                    <span className="text-muted-foreground font-semibold">Orientation</span>
                    <select
                      value={orientation}
                      onChange={(e) => setOrientation(e.target.value)}
                      className="w-full bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-semibold text-foreground cursor-pointer"
                    >
                      <option value="landscape">Landscape (Recommended)</option>
                      <option value="portrait">Portrait</option>
                    </select>
                  </div>

                  {/* Page Break */}
                  <div className="space-y-1">
                    <span className="text-muted-foreground font-semibold">Pagination</span>
                    <select
                      value={pageBreak}
                      onChange={(e) => setPageBreak(e.target.value)}
                      className="w-full bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-semibold text-foreground cursor-pointer"
                    >
                      <option value="always">1 Schedule Per Page</option>
                      <option value="auto">Continuous Flow</option>
                    </select>
                  </div>

                  {/* Color Mode */}
                  <div className="space-y-1">
                    <span className="text-muted-foreground font-semibold">Color Mode</span>
                    <select
                      value={colorMode}
                      onChange={(e) => setColorMode(e.target.value)}
                      className="w-full bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-semibold text-foreground cursor-pointer"
                    >
                      <option value="color">Full Color (Subject Palettes)</option>
                      <option value="bw">Black & White (High Contrast)</option>
                    </select>
                  </div>

                  {/* Header Toggle */}
                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="incl-hdr"
                      checked={includeHeader}
                      onChange={(e) => setIncludeHeader(e.target.checked)}
                      className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="incl-hdr" className="font-semibold text-foreground cursor-pointer select-none">
                      School Banner
                    </label>
                  </div>
                </div>
              </div>

              {/* 3. Class Selection (if Class-wise or Both) */}
              {(scope === "classwise" || scope === "both") && (
                <div className="space-y-2.5 p-3.5 rounded-xl border border-border/80 bg-card">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <GraduationCap className="size-4 text-primary" />
                      <span className="text-xs font-bold text-foreground">Select Classes to Print</span>
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

                  {/* Search & Wing filter row */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <div className="relative flex-1">
                      <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={classSearch}
                        onChange={(e) => setClassSearch(e.target.value)}
                        placeholder="Search class or section (e.g. 6 A)..."
                        className="h-8 pl-8 text-xs rounded-lg"
                      />
                    </div>
                    {wings.length > 0 && (
                      <select
                        value={selectedWingId}
                        onChange={(e) => setSelectedWingId(e.target.value)}
                        className="text-xs font-semibold bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-foreground cursor-pointer outline-none shrink-0"
                      >
                        <option value="ALL">All Wings</option>
                        {wings.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Section selection grid */}
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
                        No classes found.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 4. Teacher Selection (if Teacher-wise or Both) */}
              {(scope === "teacherwise" || scope === "both") && (
                <div className="space-y-2.5 p-3.5 rounded-xl border border-border/80 bg-card">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="size-4 text-sky-600 dark:text-sky-400" />
                      <span className="text-xs font-bold text-foreground">Select Faculty Members to Print</span>
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

                  {/* Teacher List */}
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
            </>
          ) : (
            /* PREVIEW TAB */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/80 text-xs">
                <span className="font-semibold text-muted-foreground">
                  Showing preview for <strong>{printableSections.length}</strong> classes and{" "}
                  <strong>{printableTeachers.length}</strong> teachers in <strong>{orientation}</strong> layout.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setActiveTab("configure")}
                  className="h-7 text-xs font-semibold cursor-pointer"
                >
                  Change Selections
                </Button>
              </div>

              <div className="p-4 border rounded-xl bg-slate-50 overflow-auto max-h-[50vh] shadow-inner">
                <TimetablePrintView
                  schoolName={schoolName}
                  timetableTitle={timetable?.name || "Timetable"}
                  academicYear={timetable?.academic_year || "2026-2027"}
                  printScope={scope}
                  selectedSections={printableSections}
                  selectedTeachers={printableTeachers}
                  setups={setups}
                  entries={entries}
                  pageBreak={pageBreak}
                  colorMode={colorMode}
                  includeHeader={includeHeader}
                />
              </div>
            </div>
          )}

          {/* Hidden printable target container (always rendered for printing) */}
          <div className="hidden">
            <TimetablePrintView
              ref={printAreaRef}
              schoolName={schoolName}
              timetableTitle={timetable?.name || "Timetable"}
              academicYear={timetable?.academic_year || "2026-2027"}
              printScope={scope}
              selectedSections={printableSections}
              selectedTeachers={printableTeachers}
              setups={setups}
              entries={entries}
              pageBreak={pageBreak}
              colorMode={colorMode}
              includeHeader={includeHeader}
            />
          </div>
        </div>

        {/* Footer: Pinned at the bottom, 100% visible */}
        <div className="px-5 py-3.5 border-t border-border/80 bg-muted/20 shrink-0 flex items-center justify-between gap-2.5">
          <div className="text-xs text-muted-foreground font-medium">
            Selected: <strong className="text-foreground">{printableSections.length}</strong> classes,{" "}
            <strong className="text-foreground">{printableTeachers.length}</strong> teachers
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={onClose}
              className="h-9 px-4 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="default"
              onClick={handlePrint}
              className="h-9 px-5 text-xs font-bold gap-2 cursor-pointer shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Printer className="size-4" />
              <span>Print Schedules</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
