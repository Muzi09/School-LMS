import { useState, useRef } from "react"
import PropTypes from "prop-types"
import { Shield, Plus, Edit2, Trash2, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CURATED_HOUSE_PALETTE } from "@/constants"
import { InlineEditInput } from "./InlineEditInput"

function EditingHouseCard({
  house,
  formName,
  setFormName,
  formColor,
  setFormColor,
  onSave,
  onCancel,
}) {
  const cardRef = useRef(null)

  return (
    <div
      ref={cardRef}
      className="p-4 rounded-xl border border-primary/50 ring-1 ring-primary/30 bg-card space-y-3 shadow-xs"
    >
      <InlineEditInput
        value={formName}
        onChange={setFormName}
        onSave={() => onSave(house)}
        onCancel={onCancel}
        placeholder="House name..."
        saveTitle="Save house"
        clickOutsideRef={cardRef}
        autoFocus
      />

      {/* Color Selector */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          House Color
        </label>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {CURATED_HOUSE_PALETTE.map((pal) => (
            <button
              key={pal.name}
              type="button"
              onClick={() => setFormColor(pal.hex)}
              style={{ backgroundColor: pal.hex }}
              className={`size-5 rounded-full cursor-pointer transition-transform ${
                formColor.toUpperCase() === pal.hex.toUpperCase()
                  ? "scale-125 ring-2 ring-primary shadow-xs"
                  : "hover:scale-110 opacity-70 hover:opacity-100"
              }`}
              title={pal.name}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

EditingHouseCard.propTypes = {
  house: PropTypes.object.isRequired,
  formName: PropTypes.string.isRequired,
  setFormName: PropTypes.func.isRequired,
  formColor: PropTypes.string.isRequired,
  setFormColor: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}

export function HousesPanel({
  houses = [],
  onAddHouse,
  onUpdateHouse,
  onDeleteHouse,
}) {
  const [editingHouseId, setEditingHouseId] = useState(null)
  const [formName, setFormName] = useState("")
  const [formColor, setFormColor] = useState("#EF4444")

  const handleStartEdit = (h) => {
    setEditingHouseId(h.id)
    setFormName(h.name)
    setFormColor(h.color || "#EF4444")
  }

  const handleSaveEdit = (h) => {
    const trimmed = formName.trim()
    if (trimmed) {
      onUpdateHouse(h.id, {
        name: trimmed,
        color: formColor,
      })
    }
    setEditingHouseId(null)
  }

  const handleCancelEdit = () => {
    setEditingHouseId(null)
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              School Houses
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
              {houses.length} / 4
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure up to 4 school houses for student co-curricular activities, athletics, and competitions.
          </p>
        </div>

        {houses.length < 4 && (
          <Button
            onClick={onAddHouse}
            size="sm"
            className="h-8.5 text-xs font-semibold gap-1.5 shadow-xs cursor-pointer self-start sm:self-center shrink-0"
          >
            <Plus className="size-3.5" /> Add House
          </Button>
        )}
      </div>

      {/* Houses Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {houses.length === 0 ? (
          <div className="col-span-full py-8 text-center text-xs text-muted-foreground italic">
            No houses configured yet. Click &quot;Add House&quot; to set up student houses.
          </div>
        ) : (
          houses.map((h) => {
            const isEditing = editingHouseId === h.id

            if (isEditing) {
              return (
                <EditingHouseCard
                  key={h.id}
                  house={h}
                  formName={formName}
                  setFormName={setFormName}
                  formColor={formColor}
                  setFormColor={setFormColor}
                  onSave={handleSaveEdit}
                  onCancel={handleCancelEdit}
                />
              )
            }

            return (
              <div
                key={h.id}
                className="group p-4 rounded-xl border border-border/80 bg-card hover:bg-accent/30 hover:border-border transition-all flex flex-col justify-between space-y-3 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="size-7 rounded-xl shadow-xs flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: h.color || "#EF4444" }}
                    >
                      <Shield className="size-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground tracking-tight">
                        {h.name}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                        <span
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: h.color || "#EF4444" }}
                        />
                        <span>{h.color || "#EF4444"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(h)}
                      className="size-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
                      title="Edit House"
                    >
                      <Edit2 className="size-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteHouse(h)}
                      className="size-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center cursor-pointer"
                      title="Delete House"
                    >
                      <Trash2 className="size-2.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border/80 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <ImageIcon className="size-3 text-muted-foreground" />
                    <span>Emblem: {h.emblem_url ? "Custom" : "Standard"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStartEdit(h)}
                    className="text-[10px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    Edit color
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
