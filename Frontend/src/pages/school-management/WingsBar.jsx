import { useState } from "react"
import { Layers, Plus, Edit2, Trash2, Settings2 } from "lucide-react"
import { InlineEditInput } from "./InlineEditInput"

const WING_COLORS = [
  { dot: "bg-emerald-500", text: "text-emerald-500" },
  { dot: "bg-sky-500", text: "text-sky-500" },
  { dot: "bg-indigo-500", text: "text-indigo-500" },
  { dot: "bg-amber-500", text: "text-amber-500" },
  { dot: "bg-purple-500", text: "text-purple-500" },
  { dot: "bg-rose-500", text: "text-rose-500" },
]

export function WingsBar({
  wings = [],
  classes = [],
  selectedWingId,
  onSelectWing,
  onAddWing,
  onUpdateWing,
  onDeleteWing,
  onOpenChangeWing,
  onOpenManageClasses,
}) {
  const [editingWingId, setEditingWingId] = useState(null)
  const [editingWingName, setEditingWingName] = useState("")

  // Calculate unassigned classes
  const assignedClassIdSet = new Set()
  wings.forEach((w) => {
    ;(w.class_ids || []).forEach((cid) => assignedClassIdSet.add(cid))
  })
  const unassignedClasses = classes.filter((c) => !assignedClassIdSet.has(c.id))

  const handleStartEdit = (w, e) => {
    e.stopPropagation()
    setEditingWingId(w.id)
    setEditingWingName(w.name)
  }

  const handleSaveEdit = (w) => {
    const trimmed = editingWingName.trim()
    if (trimmed && trimmed !== w.name) {
      onUpdateWing(w.id, { name: trimmed })
    }
    setEditingWingId(null)
    setEditingWingName("")
  }

  const handleCancelEdit = () => {
    setEditingWingId(null)
    setEditingWingName("")
  }

  return (
    <div className="space-y-3">
      {/* Title */}
      <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-muted-foreground">
        <Layers className="size-4 text-primary" />
        <span>Academic Wings</span>
      </div>

      {/* Wrap wing filters so the page keeps the only scrollbar. */}
      <div className="flex flex-wrap items-stretch gap-2">
        {/* All Classes Card - No chips, same fixed height as other cards */}
        <div
          role="button"
          tabIndex={0}
          aria-pressed={selectedWingId === "all"}
          onClick={() => onSelectWing("all")}
          onKeyDown={(event) => {
            if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault()
              onSelectWing("all")
            }
          }}
          className={`min-w-[145px] p-3 rounded-lg border cursor-pointer transition-colors flex flex-col justify-between gap-1 ${
            selectedWingId === "all"
              ? "bg-card border-primary ring-1 ring-primary/40 shadow-xs"
              : "bg-card border-border hover:border-primary/40 hover:bg-accent/30 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary shrink-0" />
              <span className="text-xs font-bold text-foreground">All Classes</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 font-mono">
              {classes.length}
            </span>
          </div>

          <div className="text-[11px] text-muted-foreground font-medium">
            {classes.length} {classes.length === 1 ? "class" : "classes"} configured
          </div>
        </div>

        {/* Wing Cards - Same fixed height */}
        {wings.map((w, idx) => {
          const colorTheme = WING_COLORS[idx % WING_COLORS.length]
          const isSelected = selectedWingId === w.id
          const isEditing = editingWingId === w.id

          // Find class objects in this wing
          const wingClasses = classes.filter((c) => (w.class_ids || []).includes(c.id))

          return (
            <div
              key={w.id}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              onClick={() => onSelectWing(w.id)}
              onKeyDown={(event) => {
                if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault()
                  onSelectWing(w.id)
                }
              }}
              className={`group min-w-[165px] p-3 rounded-lg border cursor-pointer transition-colors flex flex-col justify-between gap-1 ${
                isSelected
                  ? "bg-card border-primary ring-1 ring-primary/40 shadow-xs"
                  : "bg-card border-border hover:border-primary/40 hover:bg-accent/30 shadow-xs"
              }`}
            >
              {/* Header: Dot + Name + Count + Action Icons */}
              <div className="flex items-center justify-between gap-1 w-full">
                {isEditing ? (
                  <InlineEditInput
                    value={editingWingName}
                    onChange={setEditingWingName}
                    onSave={() => handleSaveEdit(w)}
                    onCancel={handleCancelEdit}
                    placeholder="Wing name..."
                    saveTitle="Save name"
                    autoFocus
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`size-2 rounded-full ${colorTheme.dot} shrink-0`} />
                      <span className="text-xs font-bold text-foreground truncate" title={w.name}>
                        {w.name}
                      </span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono text-muted-foreground bg-muted font-bold shrink-0">
                        {wingClasses.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenManageClasses?.(w)
                        }}
                        className="size-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
                        title={`Manage classes for ${w.name}`}
                      >
                        <Settings2 className="size-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleStartEdit(w, e)}
                        className="size-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
                        title="Rename Wing"
                      >
                        <Edit2 className="size-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteWing(w)
                        }}
                        className="size-5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center cursor-pointer"
                        title="Delete Wing"
                      >
                        <Trash2 className="size-2.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Class chips inside: with quick unassign & click to move */}
              <div className="flex flex-wrap gap-1 items-start content-start w-full">
                {wingClasses.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground italic">No classes</span>
                ) : (
                  wingClasses.map((cls) => (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenChangeWing?.(cls)
                      }}
                      className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground hover:text-foreground hover:bg-accent/60 cursor-pointer transition-colors"
                      title={`Click to reassign ${cls.name} or unassign from wing`}
                    >
                      <span className="truncate max-w-[80px]">{cls.name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )
        })}

        {unassignedClasses.length > 0 && (
        <div
          role="button"
          tabIndex={0}
          aria-pressed={selectedWingId === "unassigned"}
          onClick={() => onSelectWing("unassigned")}
          onKeyDown={(event) => {
            if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault()
              onSelectWing("unassigned")
            }
          }}
          className={`min-w-[170px] p-3 rounded-lg border cursor-pointer transition-colors flex flex-col justify-between gap-1 ${
            selectedWingId === "unassigned"
              ? "bg-card border-primary ring-1 ring-primary/40 shadow-xs"
              : "bg-card border-border hover:border-primary/40 hover:bg-accent/30 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-muted-foreground shrink-0" />
              <span className="text-xs font-bold text-foreground">Wing assignment needed</span>
            </div>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono text-muted-foreground bg-muted font-bold">
              {unassignedClasses.length}
            </span>
          </div>

          {/* Click unassigned class to assign to a wing */}
          <div className="flex flex-wrap gap-1 items-start content-start w-full">
            {unassignedClasses.length === 0 ? (
              <span className="text-[11px] text-muted-foreground italic">No classes</span>
            ) : (
              unassignedClasses.map((cls) => (
                <button
                  key={cls.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenChangeWing?.(cls)
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
                  title={`Click to assign ${cls.name} to an academic wing`}
                >
                  <span className="truncate max-w-[70px]">{cls.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
        )}

        {/* Add Wing Button - Same fixed height */}
        <button
          type="button"
          onClick={onAddWing}
          className="min-w-[130px] p-3 rounded-lg border border-dashed border-border hover:border-primary/50 bg-card/60 hover:bg-card text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 transition-colors cursor-pointer group"
        >
          <div className="size-6 rounded-full border border-dashed border-border group-hover:border-primary flex items-center justify-center">
            <Plus className="size-3.5 group-hover:scale-110 transition-transform" />
          </div>
          <span className="text-xs font-semibold">Add Wing</span>
        </button>
      </div>
    </div>
  )
}
