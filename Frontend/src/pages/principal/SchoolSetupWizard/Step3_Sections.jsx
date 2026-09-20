import { createPortal } from "react-dom"
import { RotateCcw, Plus, GripVertical, Check, X, Edit3, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Step3Sections({
  classesList,
  classSectionMap,
  editingSectionState,
  setEditingSectionState,
  editingSectionNameVal,
  setEditingSectionNameVal,
  addingSectionForClass,
  setAddingSectionForClass,
  newSectionForClassName,
  setNewSectionForClassName,
  sectionDragState,
  handleResetAllClassSections,
  handleSectionDragStart,
  handleStartEditSection,
  handleSaveEditSectionForClass,
  handleDeleteSectionFromClass,
  handleAddSectionToClass,
}) {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Step 3: Class Sections</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
            Configure and organize sections for each class. Drag horizontally to reorder, edit names inline, delete sections, or add new ones.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResetAllClassSections}
          className="h-8 gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground border-border hover:bg-muted/50 text-xs self-start sm:self-center shrink-0"
          title="Reset all classes to default sections"
        >
          <RotateCcw className="size-3.5" /> Reset to Default
        </Button>
      </div>

      {/* Class Sections List */}
      <div className="space-y-4">
        {classesList.map((clsName) => {
          const sections = classSectionMap[clsName] || []
          const isAddingHere = addingSectionForClass === clsName

          return (
            <div
              key={clsName}
              className="p-4 rounded-2xl border border-border bg-card/60 hover:bg-card/90 transition-colors space-y-3 shadow-2xs"
            >
              {/* Class Row Header */}
              <div className="flex items-center justify-between gap-2 min-h-[32px] border-b border-border/50 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground text-sm">{clsName}</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                    {sections.length} {sections.length === 1 ? "section" : "sections"}
                  </span>
                </div>

                <Button
                  type="button"
                  variant={isAddingHere ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    if (isAddingHere) {
                      setAddingSectionForClass(null)
                      setNewSectionForClassName("")
                    } else {
                      setAddingSectionForClass(clsName)
                      setNewSectionForClassName("")
                      setEditingSectionState(null)
                    }
                  }}
                  className={`h-7 px-2 text-xs gap-1 cursor-pointer transition-colors ${
                    isAddingHere
                      ? "text-muted-foreground hover:text-foreground"
                      : "text-primary hover:text-primary hover:bg-primary/10"
                  }`}
                >
                  {isAddingHere ? (
                    <>
                      <X className="size-3.5" /> Cancel Adding
                    </>
                  ) : (
                    <>
                      <Plus className="size-3.5" /> Add Section
                    </>
                  )}
                </Button>
              </div>

              {/* Sections 4-in-a-Row Full-Width Grid */}
              <div
                data-sections-for={clsName}
                className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 auto-rows-[36px] items-stretch gap-2.5 w-full"
              >
                {sections.map((sec, secIdx) => {
                  const isThisDragging =
                    sectionDragState.isDragging &&
                    sectionDragState.className === clsName &&
                    sectionDragState.dragIndex === secIdx

                  const isClassDragging =
                    sectionDragState.isDragging && sectionDragState.className === clsName

                  let transformStyle = ""
                  if (isClassDragging && !isThisDragging) {
                    const { dragIndex, targetIndex, slotRects } = sectionDragState
                    if (
                      dragIndex !== null &&
                      targetIndex !== null &&
                      dragIndex !== targetIndex &&
                      slotRects &&
                      slotRects.length > secIdx
                    ) {
                      let destSlot = secIdx
                      if (dragIndex < targetIndex) {
                        if (secIdx > dragIndex && secIdx <= targetIndex) {
                          destSlot = secIdx - 1
                        }
                      } else if (dragIndex > targetIndex) {
                        if (secIdx >= targetIndex && secIdx < dragIndex) {
                          destSlot = secIdx + 1
                        }
                      }

                      if (destSlot !== secIdx && slotRects[destSlot] && slotRects[secIdx]) {
                        const origRect = slotRects[secIdx]
                        const destRect = slotRects[destSlot]
                        const dx = destRect.left - origRect.left
                        const dy = destRect.top - origRect.top
                        if (dx !== 0 || dy !== 0) {
                          transformStyle = `translate3d(${dx}px, ${dy}px, 0)`
                        }
                      }
                    }
                  }

                  const isEditing =
                    editingSectionState?.className === clsName &&
                    editingSectionState?.index === secIdx

                  if (isEditing) {
                    return (
                      <div
                        key={`${sec}-${secIdx}`}
                        data-section-item="true"
                        className="group/sec flex items-center justify-between w-full h-9 min-h-9 max-h-9 px-2.5 rounded-xl border border-primary/50 ring-1 ring-primary/30 bg-card text-xs font-semibold text-foreground shadow-sm select-none box-border overflow-hidden"
                      >
                        <input
                          type="text"
                          value={editingSectionNameVal}
                          onChange={(e) => setEditingSectionNameVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              handleSaveEditSectionForClass(clsName, secIdx)
                            } else if (e.key === "Escape") {
                              setEditingSectionState(null)
                            }
                          }}
                          className="h-6 text-xs font-semibold px-2 py-0 flex-1 min-w-0 mr-1.5 rounded-md border border-primary/40 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary"
                          autoFocus
                        />

                        {/* Right-aligned Save (Green Tick) and Cancel (Red Cross) Icons */}
                        <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-border/60">
                          <button
                            type="button"
                            onClick={() => handleSaveEditSectionForClass(clsName, secIdx)}
                            className="size-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-colors cursor-pointer"
                            title="Save"
                            aria-label="Save"
                          >
                            <Check className="size-3.5 stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSectionState(null)}
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

                  return (
                    <div
                      key={`${sec}-${secIdx}`}
                      data-section-item="true"
                      style={{
                        transform: transformStyle || undefined,
                        transition: isThisDragging ? "none" : "transform 180ms cubic-bezier(0.2, 0, 0, 1)",
                        opacity: isThisDragging ? 0 : 1,
                        pointerEvents: isThisDragging ? "none" : "auto",
                      }}
                      className="group/sec flex items-center justify-between w-full h-9 min-h-9 max-h-9 px-2.5 rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-primary/40 text-xs font-semibold text-foreground transition-all duration-150 select-none shadow-2xs box-border overflow-hidden"
                    >
                      {/* Horizontal Drag Handle */}
                      <div
                        onPointerDown={(e) => handleSectionDragStart(e, clsName, secIdx)}
                        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-primary transition-colors p-0.5 rounded touch-none shrink-0"
                        title="Drag to reorder"
                      >
                        <GripVertical className="size-3.5" />
                      </div>

                      {/* Section Name */}
                      <span className="text-xs font-semibold text-foreground truncate flex-1 min-w-0 px-1.5 text-left">
                        {sec}
                      </span>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-border/60">
                        <button
                          type="button"
                          onClick={() => handleStartEditSection(clsName, secIdx, sec)}
                          className="size-6 rounded-md hover:bg-muted hover:text-foreground text-muted-foreground flex items-center justify-center transition-colors cursor-pointer"
                          title={`Edit ${sec}`}
                          aria-label={`Edit ${sec}`}
                        >
                          <Edit3 className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSectionFromClass(clsName, secIdx)}
                          className="size-6 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground flex items-center justify-center transition-colors cursor-pointer"
                          title={`Delete ${sec}`}
                          aria-label={`Delete ${sec}`}
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Inline Add Section Form for this class */}
                {isAddingHere && (
                  <div className="flex items-center justify-between w-full h-9 min-h-9 max-h-9 px-2.5 rounded-xl border border-primary/50 ring-1 ring-primary/30 bg-card shadow-sm animate-in fade-in-50 duration-150 select-none box-border overflow-hidden">
                    <input
                      type="text"
                      value={newSectionForClassName}
                      onChange={(e) => setNewSectionForClassName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleAddSectionToClass(clsName)
                        } else if (e.key === "Escape") {
                          setAddingSectionForClass(null)
                          setNewSectionForClassName("")
                        }
                      }}
                      className="h-6 text-xs font-semibold px-1.5 py-0 flex-1 min-w-0 mr-1 rounded-md border border-primary/40 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary"
                      autoFocus
                    />
                    <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-border/60">
                      <button
                        type="button"
                        onClick={() => handleAddSectionToClass(clsName)}
                        className="size-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-colors cursor-pointer"
                        title="Add Section"
                        aria-label="Add Section"
                      >
                        <Check className="size-3.5 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingSectionForClass(null)
                          setNewSectionForClassName("")
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
              </div>
            </div>
          )
        })}
      </div>

      {/* Fixed Portal Drag Overlay for multi-row section drag */}
      {sectionDragState.isDragging &&
        sectionDragState.className &&
        sectionDragState.dragIndex !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: `${sectionDragState.cardTop + (sectionDragState.currentY - sectionDragState.startY)}px`,
              left: `${sectionDragState.cardLeft + (sectionDragState.currentX - sectionDragState.startX)}px`,
              width: `${sectionDragState.cardWidth}px`,
              height: `${sectionDragState.cardHeight || 36}px`,
              zIndex: 99999,
              pointerEvents: "none",
              boxShadow: "0 20px 30px -4px rgba(0, 0, 0, 0.45), 0 8px 16px -4px rgba(0, 0, 0, 0.3)",
            }}
            className="flex items-center justify-between h-9 px-2.5 rounded-xl border border-primary ring-2 ring-primary/40 bg-card text-xs font-semibold text-foreground select-none shadow-2xl opacity-98"
          >
            <div className="text-primary p-0.5 rounded shrink-0">
              <GripVertical className="size-3.5" />
            </div>
            <span className="text-xs font-semibold text-foreground truncate flex-1 min-w-0 px-1.5 text-left">
              {classSectionMap[sectionDragState.className]?.[sectionDragState.dragIndex]}
            </span>
            <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-border/60 opacity-60">
              <div className="size-6 rounded-md flex items-center justify-center text-muted-foreground">
                <Edit3 className="size-3" />
              </div>
              <div className="size-6 rounded-md flex items-center justify-center text-muted-foreground">
                <Trash2 className="size-3" />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default Step3Sections
