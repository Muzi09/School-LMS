import { RotateCcw, Plus, AlertCircle, GripVertical, Check, X, Edit3, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function Step5Wings({
  wingsList,
  unassignedClasses,
  editingWingIdx,
  editingWingNameVal,
  setEditingWingNameVal,
  isAddingCustomWing,
  setIsAddingCustomWing,
  newCustomWingName,
  setNewCustomWingName,
  dragOverArea,
  setDragOverArea,
  handleResetWingsToDefault,
  handleAddCustomWing,
  handleStartEditWing,
  handleSaveEditWing,
  handleCancelEditWing,
  handleDeleteWing,
  handleRemoveClassFromWing,
  handleWingClassDragStart,
  handleWingClassDragOver,
  handleWingClassDrop,
  handleWingClassDragEnd,
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Step 5: Academic Wings</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
            Organize classes into academic wings. Drag and drop classes between wings or into the unassigned pool.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetWingsToDefault}
            className="h-8 text-xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground border-border hover:bg-muted/50"
            title="Reset to default 5 wings mapping"
          >
            <RotateCcw className="size-3.5" /> Reset to Default
          </Button>
          {!isAddingCustomWing && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setIsAddingCustomWing(true)
                setNewCustomWingName("")
              }}
              className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <Plus className="size-3.5" /> Add Wing
            </Button>
          )}
        </div>
      </div>

      {/* Add Custom Wing Inline Form */}
      {isAddingCustomWing && (
        <div className="p-3.5 rounded-2xl border border-primary/40 bg-card shadow-xs flex items-center gap-2 animate-in fade-in-50 duration-150">
          <Input
            type="text"
            value={newCustomWingName}
            onChange={(e) => setNewCustomWingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAddCustomWing()
              } else if (e.key === "Escape") {
                setIsAddingCustomWing(false)
              }
            }}
            className="h-8 text-xs flex-1 min-w-0"
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddCustomWing}
            className="h-8 text-xs font-semibold cursor-pointer"
          >
            <Plus className="size-3.5 mr-1" /> Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsAddingCustomWing(false)}
            className="h-8 text-xs cursor-pointer"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Unassigned Classes Section (Only shown at top if any class is unassigned) */}
      {unassignedClasses.length > 0 && (
        <div
          onDragOver={(e) => handleWingClassDragOver(e, "unassigned")}
          onDragLeave={() => setDragOverArea(null)}
          onDrop={(e) => handleWingClassDrop(e, null)}
          className={`p-4 rounded-2xl border transition-all duration-150 space-y-3 ${
            dragOverArea === "unassigned"
              ? "border-amber-500/80 bg-amber-500/10 ring-2 ring-amber-500/20"
              : "border-amber-500/30 bg-amber-500/5 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-amber-500/20">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-amber-500" />
              <span className="font-bold text-foreground text-sm">Unassigned Classes</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold">
                {unassignedClasses.length} {unassignedClasses.length === 1 ? "class" : "classes"}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Drag into any wing below to assign
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {unassignedClasses.map((clsName) => (
              <div
                key={clsName}
                draggable
                onDragStart={(e) => handleWingClassDragStart(e, null, clsName)}
                onDragEnd={handleWingClassDragEnd}
                className="group flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-amber-500/40 bg-card hover:border-amber-500 hover:shadow-xs text-xs font-semibold text-foreground transition-all select-none shadow-2xs cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="size-3 text-muted-foreground group-hover:text-amber-500 shrink-0" />
                <span className="truncate flex-1 min-w-0">{clsName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wings Cards List */}
      <div className="space-y-3">
        {wingsList.map((wing, wingIdx) => {
          const isEditingThisWing = editingWingIdx === wingIdx
          const isDragOver = dragOverArea === `wing-${wingIdx}`
          const wingClasses = wing.classes || []

          return (
            <div
              key={wing.id || wing.name || wingIdx}
              onDragOver={(e) => handleWingClassDragOver(e, `wing-${wingIdx}`)}
              onDragLeave={() => setDragOverArea(null)}
              onDrop={(e) => handleWingClassDrop(e, wingIdx)}
              className={`p-4 rounded-2xl border transition-all duration-150 space-y-3 shadow-2xs ${
                isDragOver
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border bg-card/60 hover:bg-card/90"
              }`}
            >
              {/* Wing Row Header */}
              <div className="flex items-center justify-between gap-2 min-h-[32px] h-[32px] border-b border-border/50 pb-2.5">
                {isEditingThisWing ? (
                  <div className="flex items-center justify-between w-full">
                    <Input
                      type="text"
                      value={editingWingNameVal}
                      onChange={(e) => setEditingWingNameVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleSaveEditWing(wingIdx)
                        } else if (e.key === "Escape") {
                          handleCancelEditWing()
                        }
                      }}
                      className="h-6 text-xs font-semibold px-1.5 py-0 flex-1 min-w-0 mr-1 rounded-md border-primary/40 focus-visible:ring-1 focus-visible:ring-primary/40"
                      autoFocus
                    />
                    <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-border/60">
                      <button
                        type="button"
                        onClick={() => handleSaveEditWing(wingIdx)}
                        className="size-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-colors cursor-pointer"
                        title="Save Wing Name"
                        aria-label="Save Wing Name"
                      >
                        <Check className="size-3.5 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditWing}
                        className="size-6 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-colors cursor-pointer"
                        title="Cancel"
                        aria-label="Cancel"
                      >
                        <X className="size-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm">{wing.name}</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                        {wingClasses.length} {wingClasses.length === 1 ? "class" : "classes"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEditWing(wingIdx, wing.name)}
                        className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center justify-center transition-colors cursor-pointer"
                        title={`Rename ${wing.name}`}
                        aria-label={`Rename ${wing.name}`}
                      >
                        <Edit3 className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWing(wingIdx)}
                        className="size-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors cursor-pointer"
                        title={`Delete ${wing.name}`}
                        aria-label={`Delete ${wing.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Child Classes in Wing */}
              {wingClasses.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {wingClasses.map((clsName) => (
                    <div
                      key={clsName}
                      draggable
                      onDragStart={(e) => handleWingClassDragStart(e, wingIdx, clsName)}
                      onDragEnd={handleWingClassDragEnd}
                      className="group flex items-center justify-between h-8 px-2.5 rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-primary/40 text-xs font-semibold text-foreground transition-all select-none shadow-2xs cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <GripVertical className="size-3 text-muted-foreground group-hover:text-primary shrink-0" />
                        <span className="truncate">{clsName}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveClassFromWing(wingIdx, clsName)}
                        className="size-5 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-1"
                        title={`Remove ${clsName} from ${wing.name}`}
                        aria-label={`Remove ${clsName}`}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-12 rounded-xl border border-dashed border-border/80 flex items-center justify-center text-xs text-muted-foreground bg-muted/10">
                  Drag and drop classes here to assign to {wing.name}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Step5Wings
