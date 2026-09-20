import { Shield, Plus, Check, X, Pipette, Upload, Loader2, Edit3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CURATED_HOUSE_PALETTE } from "@/constants"

export function Step6Houses({
  useHouses,
  setUseHouses,
  housesList,
  editingHouseIdx,
  houseFormName,
  setHouseFormName,
  houseFormColor,
  setHouseFormColor,
  houseFormEmblem,
  setHouseFormEmblem,
  isUploadingHouseEmblem,
  houseEmblemError,
  houseEmblemInputRef,
  normalizeHexColor,
  isColorUsedByOtherHouse,
  handleStartEditHouse,
  handleSaveHouseInline,
  handleCancelHouseEdit,
  handleHouseEmblemUpload,
  handleNextStep,
}) {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">Step 6: School Houses (Optional)</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
            Configure 4 houses for student activities with custom colors and emblems.
          </p>
        </div>
      </div>

      {!useHouses ? (
        <div className="p-6 rounded-2xl border border-border bg-muted/20 text-center space-y-3">
          <Shield className="size-10 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-sm font-bold text-foreground">Does your school use houses?</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Houses are optional and can be configured later anytime in School Settings.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleNextStep()}
              className="text-xs h-9 cursor-pointer"
            >
              Skip for now
            </Button>
            <Button
              type="button"
              onClick={() => setUseHouses(true)}
              className="text-xs h-9 font-bold cursor-pointer"
            >
              <Plus className="size-4 mr-1" /> Set up Houses
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* House Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            {housesList.map((h, idx) => {
              const isEditing = editingHouseIdx === idx

              if (isEditing) {
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border-2 border-primary/40 bg-card/95 shadow-sm space-y-3 animate-in fade-in-50 duration-150"
                  >
                    {/* Row 1: Name input with save / cancel buttons */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Input
                          type="text"
                          placeholder="House name"
                          value={houseFormName}
                          onChange={(e) => setHouseFormName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveHouseInline()
                            if (e.key === "Escape") handleCancelHouseEdit()
                          }}
                          className="h-8 text-xs font-semibold pr-2"
                          autoFocus
                        />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={handleSaveHouseInline}
                          className="size-7 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/60 flex items-center justify-center transition-colors cursor-pointer"
                          title="Save Changes"
                        >
                          <Check className="size-3.5 stroke-[2.5]" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelHouseEdit}
                          className="size-7 rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/60 flex items-center justify-center transition-colors cursor-pointer"
                          title="Cancel"
                        >
                          <X className="size-3.5 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Color selection - Single row with Curated Colors & Custom Picker */}
                    <div className="space-y-1 pt-0.5">
                      <div className="text-[11px] text-muted-foreground font-medium">
                        <span>Color</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto py-0.5">
                        {CURATED_HOUSE_PALETTE.map((pal) => {
                          const isSelected = normalizeHexColor(houseFormColor) === pal.hex
                          const isUsed = isColorUsedByOtherHouse(pal.hex, idx)

                          return (
                            <button
                              key={pal.hex}
                              type="button"
                              disabled={isUsed}
                              onClick={() => setHouseFormColor(pal.hex)}
                              className={`size-6 rounded-md border flex items-center justify-center relative shrink-0 transition-opacity ${
                                isUsed
                                  ? "opacity-20 cursor-not-allowed border-transparent"
                                  : "cursor-pointer border-black/10 dark:border-white/20 hover:opacity-90"
                              }`}
                              style={{ backgroundColor: pal.hex }}
                              title={isUsed ? `${pal.name} (Used by another house)` : pal.name}
                            >
                              {isSelected && <Check className="size-3.5 text-white stroke-[2.5] drop-shadow-xs" />}
                            </button>
                          )
                        })}

                        {/* Custom Color Trigger Button in Same Row */}
                        {(() => {
                          const isCustomActive = !CURATED_HOUSE_PALETTE.some(
                            (pal) => pal.hex === normalizeHexColor(houseFormColor)
                          )
                          return (
                            <label
                              className="size-6 rounded-md border border-black/10 dark:border-white/20 relative flex items-center justify-center cursor-pointer shrink-0 transition-opacity hover:opacity-90"
                              style={{
                                background: isCustomActive
                                  ? houseFormColor
                                  : "conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)",
                              }}
                              title="Custom Color"
                            >
                              <input
                                type="color"
                                value={houseFormColor}
                                onChange={(e) => setHouseFormColor(e.target.value.toUpperCase())}
                                className="absolute inset-0 opacity-0 cursor-pointer size-full"
                              />
                              {isCustomActive ? (
                                <Check className="size-3.5 text-white stroke-[2.5] drop-shadow-xs" />
                              ) : (
                                <Pipette className="size-3 text-white drop-shadow-sm" />
                              )}
                            </label>
                          )
                        })()}
                      </div>
                    </div>

                    {/* Row 3: Emblem upload / preview with selected color background */}
                    <div className="pt-0.5">
                      <input
                        ref={houseEmblemInputRef}
                        type="file"
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        onChange={(e) => {
                          handleHouseEmblemUpload(e)
                          e.target.value = ""
                        }}
                        className="hidden"
                      />

                      {houseEmblemError && (
                        <p className="text-[11px] text-destructive mb-1.5">{houseEmblemError}</p>
                      )}

                      {houseFormEmblem ? (
                        <div className="flex items-center justify-between p-2 rounded-xl border border-border bg-muted/20 transition-all">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="size-9 rounded-lg flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
                              <img
                                src={houseFormEmblem}
                                alt="Emblem Preview"
                                className="size-full object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs text-foreground font-semibold truncate block">
                                Emblem Attached
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => houseEmblemInputRef.current?.click()}
                              className="text-[11px] text-primary hover:underline px-1 py-0.5 cursor-pointer font-semibold"
                            >
                              Change
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setHouseFormEmblem("")
                                if (houseEmblemInputRef.current) houseEmblemInputRef.current.value = ""
                              }}
                              className="text-[11px] text-destructive hover:underline px-1 py-0.5 cursor-pointer font-semibold"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => houseEmblemInputRef.current?.click()}
                          disabled={isUploadingHouseEmblem}
                          className="w-full h-8 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-muted/40 text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isUploadingHouseEmblem ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Upload className="size-3.5" />
                          )}
                          <span>{isUploadingHouseEmblem ? "Uploading..." : "Upload Emblem (Optional)"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-border bg-card flex items-center justify-between gap-3 text-xs shadow-2xs hover:border-border/80 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {h.emblem_url || h.emblem ? (
                      <div className="size-11 rounded-lg flex items-center justify-center shrink-0 overflow-hidden p-0.5">
                        <img
                          src={h.emblem_url || h.emblem}
                          alt={h.name}
                          className="size-full object-contain"
                        />
                      </div>
                    ) : (
                      <div
                        className="size-11 rounded-lg border flex items-center justify-center shrink-0 shadow-2xs"
                        style={{
                          backgroundColor: `${h.color}15`,
                          borderColor: `${h.color}35`,
                        }}
                      >
                        <Shield className="size-5" style={{ color: h.color }} />
                      </div>
                    )}
                    <div className="min-w-0 flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: h.color }}
                        title="House Color"
                      />
                      <span className="font-bold text-foreground text-sm truncate">{h.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEditHouse(idx)}
                      className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors cursor-pointer"
                      title={`Edit ${h.name}`}
                    >
                      <Edit3 className="size-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default Step6Houses
