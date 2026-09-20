import { createPortal } from "react-dom"
import { RotateCcw, Plus, GripVertical, Check, X, Edit3, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function Step2Classes({
  classesList,
  editingClassIdx,
  setEditingClassIdx,
  editingClassName,
  setEditingClassName,
  isAddingClass,
  setIsAddingClass,
  newClassName,
  setNewClassName,
  newClassPosition,
  setNewClassPosition,
  targetClassAnchor,
  setTargetClassAnchor,
  classDragState,
  classesContainerRef,
  handleClassDragStart,
  handleSaveEditClass,
  handleDeleteClass,
  handleResetClassesToDefault,
  handleAddClass,
}) {
  return (
    <div className="space-y-5">
      <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">Step 2: School Classes</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
            Your school starts with Nursery through Class 12. You can rename, reorder, add, or remove classes.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetClassesToDefault}
            className="h-8 text-xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground border-border hover:bg-muted/50"
            title="Reset classes to initial state & default order"
          >
            <RotateCcw className="size-3.5" /> Reset to Default
          </Button>
          {!isAddingClass && (
            <Button
              type="button"
              onClick={() => {
                setIsAddingClass(true)
                setNewClassName("")
              }}
              size="sm"
              className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <Plus className="size-3.5" /> Add Class
            </Button>
          )}
        </div>
      </div>

      {/* Inline Add Class Form - Single-Row Layout (matching Wings) */}
      {isAddingClass && (
        <div className="p-3.5 rounded-2xl border border-primary/40 bg-card shadow-xs flex flex-wrap items-center gap-2 animate-in fade-in-50 duration-150">
          <Input
            type="text"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAddClass()
              } else if (e.key === "Escape") {
                setIsAddingClass(false)
              }
            }}
            className="h-8 text-xs flex-1 min-w-[160px]"
            autoFocus
          />

          <select
            value={newClassPosition}
            onChange={(e) => setNewClassPosition(e.target.value)}
            className="h-8 rounded-lg border border-input bg-card px-2.5 text-xs text-foreground cursor-pointer focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30 outline-none shrink-0"
          >
            <option value="end">Insert at End</option>
            <option value="start">Insert at Beginning</option>
            <option value="after">Insert After...</option>
            <option value="before">Insert Before...</option>
          </select>

          {["after", "before"].includes(newClassPosition) && (
            <select
              value={targetClassAnchor}
              onChange={(e) => setTargetClassAnchor(e.target.value)}
              className="h-8 rounded-lg border border-input bg-card px-2.5 text-xs text-foreground cursor-pointer focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30 outline-none shrink-0"
            >
              {classesList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <Button
            type="button"
            size="sm"
            onClick={handleAddClass}
            className="h-8 text-xs font-semibold gap-1 cursor-pointer shrink-0"
          >
            <Plus className="size-3.5" /> Add
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsAddingClass(false)}
            className="h-8 text-xs cursor-pointer shrink-0"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Classes Compact Rows with Smooth Real-time Physical Displacement Drag and Drop */}
      <div
        ref={classesContainerRef}
        className="relative space-y-1.5 p-1 select-none"
      >
        {classesList.map((clsName, idx) => {
          const isEditing = editingClassIdx === idx
          const { isDragging, dragIndex, targetIndex, itemHeight } = classDragState
          const isThisItemDragging = isDragging && dragIndex === idx

          let translateY = 0
          if (isDragging && dragIndex !== null && targetIndex !== null) {
            if (dragIndex < targetIndex) {
              // Dragging downwards: cards between dragIndex + 1 and targetIndex slide up
              if (idx > dragIndex && idx <= targetIndex) {
                translateY = -itemHeight
              }
            } else if (dragIndex > targetIndex) {
              // Dragging upwards: cards between targetIndex and dragIndex - 1 slide down
              if (idx >= targetIndex && idx < dragIndex) {
                translateY = itemHeight
              }
            }
          }

          // When this item is being actively dragged, render an in-place placeholder holding its slot
          if (isThisItemDragging) {
            return (
              <div
                key={`${clsName}-${idx}`}
                data-class-item="true"
                style={{
                  height: classDragState.cardHeight ? `${classDragState.cardHeight}px` : undefined,
                }}
                className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-2.5 sm:p-3 text-xs select-none transition-all duration-200"
              >
                <div className="flex items-center gap-2.5 opacity-0">
                  <div className="p-1">
                    <GripVertical className="size-4" />
                  </div>
                  <span className="size-6">{idx + 1}</span>
                  <span className="text-sm font-semibold">{clsName}</span>
                </div>
              </div>
            )
          }

          return (
            <div
              key={`${clsName}-${idx}`}
              data-class-item="true"
              style={{
                transform: translateY ? `translate3d(0, ${translateY}px, 0)` : undefined,
                transition: "transform 220ms cubic-bezier(0.2, 0, 0, 1)",
              }}
              className={`group flex items-center justify-between min-h-[50px] p-2.5 sm:p-3 rounded-xl border bg-card text-xs select-none will-change-transform ${
                isEditing ? "border-primary/50 ring-1 ring-primary/30" : "border-border hover:bg-muted/20"
              }`}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-2">
                {/* Drag Handle with pointer events */}
                <div
                  onPointerDown={(e) => handleClassDragStart(e, idx)}
                  className={`text-muted-foreground/50 hover:text-foreground active:text-primary p-1 rounded-md hover:bg-muted/50 cursor-grab active:cursor-grabbing touch-none select-none ${
                    isEditing ? "opacity-30 cursor-not-allowed pointer-events-none" : ""
                  }`}
                  title="Drag to reorder"
                >
                  <GripVertical className="size-4" />
                </div>

                <span className="size-6 rounded-md bg-muted/60 text-muted-foreground font-mono flex items-center justify-center text-[11px] font-bold shrink-0">
                  {idx + 1}
                </span>

                {isEditing ? (
                  <Input
                    type="text"
                    value={editingClassName}
                    onChange={(e) => setEditingClassName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleSaveEditClass(idx)
                      } else if (e.key === "Escape") {
                        setEditingClassIdx(null)
                      }
                    }}
                    className="h-8 text-xs font-semibold flex-1 max-w-sm"
                    autoFocus
                  />
                ) : (
                  <span className="font-semibold text-foreground text-sm truncate">{clsName}</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isEditing ? (
                  <>
                    {/* Save Icon (Green Tick) */}
                    <button
                      type="button"
                      onClick={() => handleSaveEditClass(idx)}
                      className="size-7 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-colors cursor-pointer"
                      title="Save"
                      aria-label="Save"
                    >
                      <Check className="size-4 stroke-[2.5]" />
                    </button>

                    {/* Cancel Icon (Red Cross) */}
                    <button
                      type="button"
                      onClick={() => setEditingClassIdx(null)}
                      className="size-7 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-colors cursor-pointer"
                      title="Cancel"
                      aria-label="Cancel"
                    >
                      <X className="size-4 stroke-[2.5]" />
                    </button>
                  </>
                ) : (
                  <>
                    {/* Edit Icon Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingClassIdx(idx)
                        setEditingClassName(clsName)
                      }}
                      className="size-7 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center justify-center transition-colors cursor-pointer"
                      title={`Edit ${clsName}`}
                      aria-label={`Edit ${clsName}`}
                    >
                      <Edit3 className="size-3.5" />
                    </button>

                    {/* Delete Icon Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteClass(idx)}
                      className="size-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors cursor-pointer"
                      title={`Delete ${clsName}`}
                      aria-label={`Delete ${clsName}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Fixed Portal Drag Overlay to prevent clipping & overflow */}
      {classDragState.isDragging &&
        classDragState.dragIndex !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: `${classDragState.cardTop + (classDragState.currentY - classDragState.startY)}px`,
              left: `${classDragState.cardLeft}px`,
              width: `${classDragState.cardWidth}px`,
              height: classDragState.cardHeight ? `${classDragState.cardHeight}px` : undefined,
              zIndex: 99999,
              pointerEvents: "none",
              boxShadow:
                "0 20px 30px -4px rgba(0, 0, 0, 0.45), 0 8px 16px -4px rgba(0, 0, 0, 0.3)",
            }}
            className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl border border-primary ring-2 ring-primary/40 bg-card text-xs select-none shadow-2xl opacity-98"
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-2">
              <div className="text-primary p-1 rounded-md">
                <GripVertical className="size-4" />
              </div>
              <span className="size-6 rounded-md bg-primary/20 text-primary font-mono flex items-center justify-center text-[11px] font-bold shrink-0">
                {(classDragState.targetIndex ?? classDragState.dragIndex) + 1}
              </span>
              <span className="font-semibold text-foreground text-sm truncate">
                {classesList[classDragState.dragIndex]}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 opacity-60">
              <div className="size-7 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground">
                <Edit3 className="size-3.5" />
              </div>
              <div className="size-7 rounded-lg flex items-center justify-center text-muted-foreground">
                <Trash2 className="size-3.5" />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default Step2Classes
