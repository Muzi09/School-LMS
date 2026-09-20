import { createPortal } from "react-dom"
import {
  GraduationCap,
  CheckCircle2,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Copy,
  RotateCcw,
  Award,
  Plus,
  Check,
  GripVertical,
  ArrowRightLeft,
  Edit3,
  Trash2,
  Split,
  Combine,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { getDefaultSubjectsForClass, getDefaultSectionsForClass } from "@/constants"

export function Step4Subjects({
  classesList,
  classSectionMap,
  classSubjectConfig,
  subjectSearchQuery,
  setSubjectSearchQuery,
  collapsedClassMap,
  setCollapsedClassMap,
  unifyModalState,
  setUnifyModalState,
  editingSubjectState,
  setEditingSubjectState,
  editingSubjectNameVal,
  setEditingSubjectNameVal,
  addingSubjectInline,
  setAddingSubjectInline,
  addingSubjectInputVal,
  setAddingSubjectInputVal,
  setAddingSubjectCategoryVal,
  copyClassModal,
  setCopyClassModal,
  subjectFeedbackMessage,
  setSubjectFeedbackMessage,
  draggedSubject,
  setDraggedSubject,
  dragOverCategory,
  setDragOverCategory,
  handleToggleClassShared,
  handleConfirmUnifyShared,
  handleAddSubjectToClassOrSection,
  handleStartEditSubject,
  handleSaveEditSubjectForClassOrSection,
  handleDeleteSubjectFromClassOrSection,
  handleMoveSubjectCategory,
  handleReorderSubjects,
  handleResetClassSubjectsToDefault,
  handleCopySubjectsToTarget,
  getAllUniqueSubjectsAcrossAllClasses,
}) {
  const renderSubjectBucket = ({
    className,
    sectionName,
    category,
    categoryLabel,
    categoryIcon: CatIcon,
    accentColor,
    badgeBg,
    subjects,
    otherCategory,
    otherCategoryLabel,
  }) => {
    const isAdding =
      addingSubjectInline?.className === className &&
      addingSubjectInline?.sectionName === sectionName &&
      addingSubjectInline?.category === category

    const isDragOverThisBucket =
      dragOverCategory?.className === className &&
      dragOverCategory?.sectionName === sectionName &&
      dragOverCategory?.category === category

    return (
      <div
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = "move"
          if (
            dragOverCategory?.className !== className ||
            dragOverCategory?.sectionName !== sectionName ||
            dragOverCategory?.category !== category
          ) {
            setDragOverCategory({ className, sectionName, category })
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            if (
              dragOverCategory?.className === className &&
              dragOverCategory?.sectionName === sectionName &&
              dragOverCategory?.category === category
            ) {
              setDragOverCategory(null)
            }
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragOverCategory(null)
          if (!draggedSubject) return

          if (
            draggedSubject.className === className &&
            draggedSubject.sectionName === sectionName
          ) {
            if (draggedSubject.category === category) {
              handleReorderSubjects(
                className,
                sectionName,
                category,
                draggedSubject.index,
                subjects.length - 1
              )
            } else {
              handleMoveSubjectCategory(
                className,
                sectionName,
                draggedSubject.category,
                category,
                draggedSubject.index
              )
            }
          }
          setDraggedSubject(null)
        }}
        className={`rounded-xl border p-3.5 space-y-3 transition-all duration-200 ${
          isDragOverThisBucket
            ? "border-primary/60 bg-primary/5 ring-2 ring-primary/20 shadow-xs"
            : "border-border/70 bg-card/60"
        }`}
      >
        {/* Bucket Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CatIcon className={`size-4 ${accentColor}`} />
            <span className="text-xs font-bold text-foreground">{categoryLabel}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeBg}`}>
              {subjects.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setAddingSubjectInline({ className, sectionName, category })
              setAddingSubjectInputVal("")
              setAddingSubjectCategoryVal(category)
            }}
            className="text-[11px] font-semibold text-primary hover:text-primary/80 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="size-3" />
            <span>Add</span>
          </button>
        </div>

        {/* Inline Add Subject Input matching Section tab */}
        {isAdding && (
          <div className="flex items-center justify-between w-full h-9 min-h-9 max-h-9 px-2.5 rounded-xl border border-primary/50 ring-1 ring-primary/30 bg-card shadow-sm animate-in fade-in-50 duration-150 select-none box-border overflow-hidden">
            <input
              type="text"
              placeholder={`Subject name...`}
              value={addingSubjectInputVal}
              onChange={(e) => setAddingSubjectInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAddSubjectToClassOrSection(
                    className,
                    sectionName,
                    category,
                    addingSubjectInputVal
                  )
                } else if (e.key === "Escape") {
                  setAddingSubjectInline(null)
                  setAddingSubjectInputVal("")
                }
              }}
              className="h-6 text-xs font-semibold px-1.5 py-0 flex-1 min-w-0 mr-1 rounded-md border border-primary/40 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary"
              autoFocus
            />
            <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-border/60">
              <button
                type="button"
                onClick={() =>
                  handleAddSubjectToClassOrSection(
                    className,
                    sectionName,
                    category,
                    addingSubjectInputVal
                  )
                }
                className="size-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-colors cursor-pointer"
                title="Save Subject"
                aria-label="Save Subject"
              >
                <Check className="size-3.5 stroke-[2.5]" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingSubjectInline(null)
                  setAddingSubjectInputVal("")
                }}
                className="size-6 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-colors cursor-pointer"
                title="Cancel"
                aria-label="Cancel"
              >
                <X className="size-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}

        {/* Subjects List */}
        {subjects.length > 0 ? (
          <div className="space-y-1.5 min-h-[44px]">
            {subjects.map((sub, idx) => {
              const isEditing =
                editingSubjectState?.className === className &&
                editingSubjectState?.sectionName === sectionName &&
                editingSubjectState?.category === category &&
                editingSubjectState?.index === idx

              if (isEditing) {
                return (
                  <div
                    key={`${sub}-${idx}`}
                    className="group flex items-center justify-between w-full h-9 min-h-9 max-h-9 px-2.5 rounded-xl border border-primary/50 ring-1 ring-primary/30 bg-card text-xs font-semibold text-foreground shadow-sm select-none box-border overflow-hidden"
                  >
                    <input
                      type="text"
                      value={editingSubjectNameVal}
                      onChange={(e) => setEditingSubjectNameVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleSaveEditSubjectForClassOrSection(
                            className,
                            sectionName,
                            category,
                            idx,
                            editingSubjectNameVal
                          )
                        } else if (e.key === "Escape") {
                          setEditingSubjectState(null)
                          setEditingSubjectNameVal("")
                        }
                      }}
                      className="h-6 text-xs font-semibold px-2 py-0 flex-1 min-w-0 mr-1.5 rounded-md border border-primary/40 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary"
                      autoFocus
                    />

                    {/* Right-aligned Save (Green Tick) and Cancel (Red Cross) Icons */}
                    <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-border/60">
                      <button
                        type="button"
                        onClick={() =>
                          handleSaveEditSubjectForClassOrSection(
                            className,
                            sectionName,
                            category,
                            idx,
                            editingSubjectNameVal
                          )
                        }
                        className="size-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-colors cursor-pointer"
                        title="Save"
                        aria-label="Save"
                      >
                        <Check className="size-3.5 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSubjectState(null)
                          setEditingSubjectNameVal("")
                        }}
                        className="size-6 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-colors cursor-pointer"
                        title="Cancel"
                        aria-label="Cancel"
                      >
                        <X className="size-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                )
              }

              const isBeingDragged =
                draggedSubject?.className === className &&
                draggedSubject?.sectionName === sectionName &&
                draggedSubject?.category === category &&
                draggedSubject?.index === idx

              return (
                <div
                  key={`${sub}-${idx}`}
                  draggable
                  onDragStart={(e) => {
                    setDraggedSubject({
                      className,
                      sectionName,
                      category,
                      index: idx,
                      name: sub,
                    })
                    e.dataTransfer.setData(
                      "text/plain",
                      JSON.stringify({
                        className,
                        sectionName,
                        category,
                        index: idx,
                        name: sub,
                      })
                    )
                    e.dataTransfer.effectAllowed = "move"
                  }}
                  onDragEnd={() => {
                    setDraggedSubject(null)
                    setDragOverCategory(null)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    e.dataTransfer.dropEffect = "move"
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!draggedSubject) return

                    if (
                      draggedSubject.className === className &&
                      draggedSubject.sectionName === sectionName
                    ) {
                      if (draggedSubject.category === category) {
                        handleReorderSubjects(
                          className,
                          sectionName,
                          category,
                          draggedSubject.index,
                          idx
                        )
                      } else {
                        handleMoveSubjectCategory(
                          className,
                          sectionName,
                          draggedSubject.category,
                          category,
                          draggedSubject.index
                        )
                      }
                    }
                    setDraggedSubject(null)
                    setDragOverCategory(null)
                  }}
                  className={`group flex items-center justify-between p-2 rounded-xl border text-xs select-none transition-all duration-150 ${
                    isBeingDragged
                      ? "opacity-40 border-dashed border-primary bg-primary/10"
                      : "border-border/70 bg-card hover:border-border hover:shadow-xs hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0 pr-1">
                    <span
                      className="text-muted-foreground/50 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing p-0.5 shrink-0"
                      title="Drag to reorder or move to other category"
                    >
                      <GripVertical className="size-3.5" />
                    </span>
                    <span className="font-semibold text-foreground truncate">{sub}</span>
                  </div>

                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 shrink-0 transition-opacity">
                    {/* Move between categories button */}
                    <button
                      type="button"
                      onClick={() =>
                        handleMoveSubjectCategory(
                          className,
                          sectionName,
                          category,
                          otherCategory,
                          idx
                        )
                      }
                      className="size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-primary flex items-center justify-center cursor-pointer transition-colors"
                      title={`Move to ${otherCategoryLabel}`}
                    >
                      <ArrowRightLeft className="size-3" />
                    </button>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => handleStartEditSubject(className, sectionName, category, idx, sub)}
                      className="size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
                      title={`Edit ${sub}`}
                      aria-label={`Edit ${sub}`}
                    >
                      <Edit3 className="size-3" />
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteSubjectFromClassOrSection(
                          className,
                          sectionName,
                          category,
                          idx
                        )
                      }
                      className="size-6 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center cursor-pointer transition-colors"
                      title={`Delete ${sub}`}
                      aria-label={`Delete ${sub}`}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="py-4 px-3 rounded-lg border border-dashed border-border/80 text-center text-muted-foreground/70 text-[11px] flex flex-col items-center justify-center gap-1 min-h-[58px]">
            <span>No {category === "academic" ? "academic" : "non-academic"} subjects assigned</span>
            <span className="text-[10px] text-muted-foreground/50">Drag subjects here or click + Add</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Step 4: Subject Assignment</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
            Configure and categorize Academic and Non-Academic subjects for every grade level or individual section.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <Badge variant="outline" className="text-xs px-2.5 py-1 font-semibold text-primary bg-primary/5 border-primary/20">
            <GraduationCap className="size-3.5 mr-1" />
            {getAllUniqueSubjectsAcrossAllClasses().length} Unique Subjects
          </Badge>
        </div>
      </div>

      {/* Feedback Toast Banner */}
      {subjectFeedbackMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span className="font-semibold">{subjectFeedbackMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSubjectFeedbackMessage(null)}
            className="text-emerald-600/70 hover:text-emerald-600 cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Search & Bulk Collapse Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/20 p-3 rounded-2xl border border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search classes or subjects..."
            value={subjectSearchQuery}
            onChange={(e) => setSubjectSearchQuery(e.target.value)}
            className="h-8.5 pl-8 text-xs bg-card"
          />
          {subjectSearchQuery && (
            <button
              type="button"
              onClick={() => setSubjectSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const allCollapsed = classesList.every((c) => collapsedClassMap[c] !== false)
              const next = {}
              classesList.forEach((c) => {
                next[c] = !allCollapsed
              })
              setCollapsedClassMap(next)
            }}
            className="h-8 text-xs cursor-pointer font-medium"
          >
            {classesList.every((c) => collapsedClassMap[c] !== false) ? "Expand All" : "Collapse All"}
          </Button>
        </div>
      </div>

      {/* Class Cards List */}
      <div className="space-y-4">
        {classesList
          .filter((cls) => {
            if (!subjectSearchQuery.trim()) return true
            const q = subjectSearchQuery.toLowerCase().trim()
            if (cls.toLowerCase().includes(q)) return true
            const conf = classSubjectConfig[cls]
            if (!conf) return false
            const sharedSubs = [...(conf.shared?.academic || []), ...(conf.shared?.nonAcademic || [])]
            if (sharedSubs.some((s) => s.toLowerCase().includes(q))) return true
            const secSubs = Object.values(conf.sections || {}).flatMap((s) => [...(s.academic || []), ...(s.nonAcademic || [])])
            return secSubs.some((s) => s.toLowerCase().includes(q))
          })
          .map((cls) => {
            const conf = classSubjectConfig[cls] || {
              isSameForAllSections: true,
              shared: getDefaultSubjectsForClass(cls),
              sections: {},
            }
            const isShared = conf.isSameForAllSections !== false
            const isCollapsed = collapsedClassMap[cls] !== false // Default: collapsed
            const configuredSections = classSectionMap[cls] && classSectionMap[cls].length > 0 ? classSectionMap[cls] : getDefaultSectionsForClass(cls)

            // Counts calculation
            let totalAcadCount = 0
            let totalNonAcadCount = 0
            if (isShared) {
              totalAcadCount = conf.shared?.academic?.length || 0
              totalNonAcadCount = conf.shared?.nonAcademic?.length || 0
            } else {
              configuredSections.forEach((s) => {
                const secConf = conf.sections?.[s] || { academic: [], nonAcademic: [] }
                totalAcadCount += secConf.academic?.length || 0
                totalNonAcadCount += secConf.nonAcademic?.length || 0
              })
            }
            const totalSubjectsCount = isShared
              ? totalAcadCount + totalNonAcadCount
              : configuredSections.reduce((acc, s) => {
                const secConf = conf.sections?.[s] || { academic: [], nonAcademic: [] }
                return acc + (secConf.academic?.length || 0) + (secConf.nonAcademic?.length || 0)
              }, 0)

            return (
              <div
                key={cls}
                className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden transition-all duration-200"
              >
                {/* Class Card Header: Single row layout with aligned actions */}
                <div className="p-3.5 sm:p-4 bg-card border-b border-border/70 flex items-center justify-between gap-3">
                  {/* Left: Chevron, Icon, Class Title & Badges */}
                  <div
                    className="flex items-center gap-2.5 sm:gap-3 min-w-0 cursor-pointer select-none"
                    onClick={() => setCollapsedClassMap((prev) => ({ ...prev, [cls]: isCollapsed ? false : true }))}
                  >
                    <button
                      type="button"
                      className="size-7 rounded-lg border border-border bg-muted/30 hover:bg-muted text-muted-foreground flex items-center justify-center cursor-pointer transition-colors shrink-0"
                      title={isCollapsed ? "Expand class" : "Collapse class"}
                      onClick={(e) => {
                        e.stopPropagation()
                        setCollapsedClassMap((prev) => ({ ...prev, [cls]: isCollapsed ? false : true }))
                      }}
                    >
                      {isCollapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                    </button>

                    <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                      <BookOpen className="size-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-foreground truncate">{cls}</h3>
                        <Badge variant="secondary" className="text-[11px] font-semibold shrink-0">
                          {isShared ? `${totalSubjectsCount} Subjects` : `${configuredSections.length} Sections`}
                        </Badge>
                        {isShared && (
                          <span className="text-[11px] text-muted-foreground hidden lg:inline-block truncate">
                            ({totalAcadCount} Academic • {totalNonAcadCount} Non-Academic)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Section Checkbox & Class Actions Next to Each Other in One Row */}
                  <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 flex-nowrap" onClick={(e) => e.stopPropagation()}>
                    {/* Same for All Sections Checkbox */}
                    <label
                      className="flex items-center gap-2 cursor-pointer select-none group text-xs font-semibold text-foreground hover:text-primary transition-colors shrink-0"
                      title="Toggle between shared subjects for all sections or section-specific subjects"
                    >
                      <input
                        type="checkbox"
                        checked={isShared}
                        onChange={() => handleToggleClassShared(cls)}
                        className="size-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                      />
                      <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors whitespace-nowrap">
                        Same for all sections
                      </span>
                    </label>

                    {/* Class Actions: Copy & Reset right next to checkbox */}
                    <div className="flex items-center gap-1 border-l border-border/70 pl-2 sm:pl-2.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCopyClassModal({ targetClass: cls, selectedSourceClass: "" })}
                        className="h-8 px-2 sm:px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1"
                        title={`Copy subjects from another class into ${cls}`}
                      >
                        <Copy className="size-3.5 text-primary" />
                        <span className="inline">Copy</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResetClassSubjectsToDefault(cls)}
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1"
                        title={`Reset ${cls} to default subjects`}
                      >
                        <RotateCcw className="size-3.5" />
                        <span className="hidden sm:inline">Reset</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Class Card Body */}
                {!isCollapsed && (
                  <div className="p-4 sm:p-5 space-y-4">
                    {/* CASE A: SHARED MODE (One Full-Width Area) */}
                    {isShared && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                        {/* Academic Column */}
                        {renderSubjectBucket({
                          className: cls,
                          sectionName: null,
                          category: "academic",
                          categoryLabel: "Academic Subjects",
                          categoryIcon: GraduationCap,
                          accentColor: "text-blue-600 dark:text-blue-400",
                          badgeBg: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
                          subjects: conf.shared?.academic || [],
                          otherCategory: "nonAcademic",
                          otherCategoryLabel: "Non-Academic",
                        })}

                        {/* Non-Academic Column */}
                        {renderSubjectBucket({
                          className: cls,
                          sectionName: null,
                          category: "nonAcademic",
                          categoryLabel: "Non-Academic Subjects",
                          categoryIcon: Award,
                          accentColor: "text-amber-600 dark:text-amber-400",
                          badgeBg: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
                          subjects: conf.shared?.nonAcademic || [],
                          otherCategory: "academic",
                          otherCategoryLabel: "Academic",
                        })}
                      </div>
                    )}

                    {/* CASE B: SECTION-SPECIFIC MODE (Split by Section with Smooth Animation) */}
                    {!isShared && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Split className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                            <span>
                              <strong>Section-Specific Mode Active:</strong> Subjects for each section of {cls} are managed independently.
                            </span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {configuredSections.map((sec) => {
                            const secData = conf.sections?.[sec] || {
                              academic: [...(conf.shared?.academic || [])],
                              nonAcademic: [...(conf.shared?.nonAcademic || [])],
                            }
                            const secTotal = (secData.academic?.length || 0) + (secData.nonAcademic?.length || 0)

                            return (
                              <div
                                key={sec}
                                className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3 transition-all duration-200"
                              >
                                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="size-2 rounded-full bg-primary" />
                                    <span className="text-xs font-bold text-foreground">
                                      {cls} – {sec}
                                    </span>
                                    <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                                      {secTotal} Subjects
                                    </Badge>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {/* Section Academic */}
                                  {renderSubjectBucket({
                                    className: cls,
                                    sectionName: sec,
                                    category: "academic",
                                    categoryLabel: "Academic",
                                    categoryIcon: GraduationCap,
                                    accentColor: "text-blue-600 dark:text-blue-400",
                                    badgeBg: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
                                    subjects: secData.academic || [],
                                    otherCategory: "nonAcademic",
                                    otherCategoryLabel: "Non-Academic",
                                  })}

                                  {/* Section Non-Academic */}
                                  {renderSubjectBucket({
                                    className: cls,
                                    sectionName: sec,
                                    category: "nonAcademic",
                                    categoryLabel: "Non-Academic",
                                    categoryIcon: Award,
                                    accentColor: "text-amber-600 dark:text-amber-400",
                                    badgeBg: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
                                    subjects: secData.nonAcademic || [],
                                    otherCategory: "academic",
                                    otherCategoryLabel: "Academic",
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
      </div>

      {/* UNIFICATION MODAL (when toggling OFF -> ON) */}
      {unifyModalState &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in-50 duration-200">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                  <Combine className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Unify Subjects for {unifyModalState.className}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Sections currently have different subject assignments. Choose how you would like to synchronize them to a single shared configuration.
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    handleConfirmUnifyShared(
                      unifyModalState.className,
                      "use_section",
                      unifyModalState.firstSection
                    )
                  }
                  className="w-full p-3 rounded-xl border border-border bg-muted/30 hover:bg-primary/5 hover:border-primary/40 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground group-hover:text-primary">
                      Use {unifyModalState.firstSection}&apos;s Subjects
                    </span>
                    <Badge variant="outline" className="text-[10px]">Recommended</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Applies the subject list from {unifyModalState.firstSection} to all sections of {unifyModalState.className}.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleConfirmUnifyShared(unifyModalState.className, "merge")
                  }
                  className="w-full p-3 rounded-xl border border-border bg-muted/30 hover:bg-primary/5 hover:border-primary/40 text-left transition-all cursor-pointer group"
                >
                  <span className="text-xs font-bold text-foreground group-hover:text-primary block">
                    Merge All Unique Subjects
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Combines every unique subject configured across all sections into the shared list.
                  </p>
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setUnifyModalState(null)}
                  className="h-9 text-xs cursor-pointer"
                >
                  Cancel (Keep Section-Specific)
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* COPY CLASS SUBJECTS MODAL (Select class to copy FROM) */}
      {copyClassModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in-50 duration-200">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                    <Copy className="size-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      Copy Subjects into {copyClassModal.targetClass}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Select a class below to duplicate its Academic and Non-Academic subjects into <strong>{copyClassModal.targetClass}</strong>.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCopyClassModal(null)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded-lg hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-foreground block">
                  Select Source Class:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[250px] overflow-y-auto p-1">
                  {classesList
                    .filter((c) => c !== copyClassModal.targetClass)
                    .map((c) => {
                      const cConf = classSubjectConfig[c]
                      const acadCount = cConf?.shared?.academic?.length || 0
                      const nonAcadCount = cConf?.shared?.nonAcademic?.length || 0
                      const totalCount = acadCount + nonAcadCount
                      const isSelected = copyClassModal.selectedSourceClass === c

                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() =>
                            setCopyClassModal((prev) => ({
                              ...prev,
                              selectedSourceClass: c,
                            }))
                          }
                          className={`flex items-start gap-2.5 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            isSelected
                              ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary/30"
                              : "bg-muted/20 border-border hover:bg-muted/50 hover:border-border/80"
                          }`}
                        >
                          <div
                            className={`size-4 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 ${
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "border border-muted-foreground/40"
                            }`}
                          >
                            {isSelected && <div className="size-1.5 rounded-full bg-white" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-foreground truncate">{c}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {totalCount} subjects ({acadCount} Acad • {nonAcadCount} Non-Acad)
                            </div>
                          </div>
                        </button>
                      )
                    })}
                </div>
              </div>

              {copyClassModal.selectedSourceClass && (
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-1 animate-in fade-in duration-150">
                  <span className="font-semibold text-foreground">Subjects preview from {copyClassModal.selectedSourceClass}:</span>
                  <div className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    {[
                      ...(classSubjectConfig[copyClassModal.selectedSourceClass]?.shared?.academic || []),
                      ...(classSubjectConfig[copyClassModal.selectedSourceClass]?.shared?.nonAcademic || [])
                    ].join(", ") || "No subjects configured"}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCopyClassModal(null)}
                  className="h-9 text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!copyClassModal.selectedSourceClass}
                  onClick={() =>
                    handleCopySubjectsToTarget(
                      copyClassModal.selectedSourceClass,
                      copyClassModal.targetClass
                    )
                  }
                  className="h-9 text-xs font-bold cursor-pointer gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Copy className="size-3.5" />
                  Copy into {copyClassModal.targetClass}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default Step4Subjects
