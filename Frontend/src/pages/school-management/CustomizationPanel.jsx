import { useState, useRef } from "react"
import { Palette, Upload, Trash2, Check, Loader2, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { THEME_COLOR_PRESETS } from "@/constants"
import { validateEmblemFile } from "@/validations"
import { toast } from "sonner"

function CustomizationForm({
  customization = {},
  onSaveCustomization,
  onUploadEmblem,
  isSaving = false,
}) {
  const [primaryColor, setPrimaryColor] = useState(customization.primary_color || "#2563EB")
  const [emblemUrl, setEmblemUrl] = useState(customization.emblem_url || "")
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateEmblemFile(file)
    if (!validation.isValid) {
      toast.error(validation.error)
      return
    }

    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append("file", file)
      const res = await onUploadEmblem(formData)
      if (res?.emblem_url) {
        setEmblemUrl(res.emblem_url)
        toast.success("Emblem uploaded successfully! Click 'Save Customization' to apply.")
      }
    } catch (err) {
      toast.error(err.message || "Failed to upload emblem image.")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleRemoveEmblem = () => {
    setEmblemUrl("")
  }

  const handleSave = () => {
    // Validate hex
    const cleanHex = primaryColor.trim()
    if (cleanHex && !/^#[0-9A-Fa-f]{6}$/.test(cleanHex)) {
      toast.error("Primary color must be a valid 6-character HEX color e.g. #2563EB")
      return
    }

    onSaveCustomization({
      primary_color: cleanHex ? cleanHex.toUpperCase() : null,
      emblem_url: emblemUrl ? emblemUrl.trim() : null,
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              School Customization
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
              Visual Brand
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Personalize your school&apos;s visual brand, primary accent theme color, and institutional emblem.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving || isUploading}
          size="sm"
          className="h-8.5 text-xs font-semibold gap-1.5 shadow-xs cursor-pointer self-start sm:self-center shrink-0"
        >
          {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          Save Customization
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ======================================================== */}
        {/* Left: Primary Accent Color                               */}
        {/* ======================================================== */}
        <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground">Primary Theme Color</label>
            <div className="flex items-center gap-2">
              <span
                className="size-4 rounded-full border border-border shadow-xs"
                style={{ backgroundColor: primaryColor }}
              />
              <span className="text-xs font-mono font-bold text-foreground uppercase">
                {primaryColor}
              </span>
            </div>
          </div>

          {/* Hex Input */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                #
              </span>
              <Input
                value={primaryColor.replace(/^#/, "")}
                onChange={(e) => setPrimaryColor(`#${e.target.value}`)}
                maxLength={6}
                placeholder="2563EB"
                className="h-9 pl-6 text-xs font-mono font-bold uppercase bg-background border-border text-foreground rounded-xl"
              />
            </div>
            <input
              type="color"
              value={primaryColor.length === 7 ? primaryColor : "#2563EB"}
              onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
              className="size-9 rounded-xl cursor-pointer bg-background border border-border p-0.5 shrink-0"
              title="Pick Color"
            />
          </div>

          {/* Preset Swatches */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-semibold text-muted-foreground">Presets:</span>
            <div className="flex flex-wrap gap-2">
              {THEME_COLOR_PRESETS.map((preset) => {
                const isSelected = primaryColor.toUpperCase() === preset.value.toUpperCase()
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setPrimaryColor(preset.value.toUpperCase())}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary/10 border-primary text-foreground ring-1 ring-primary/40"
                        : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    }`}
                  >
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: preset.value }}
                    />
                    <span>{preset.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* Right: School Emblem                                      */}
        {/* ======================================================== */}
        <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground">School Emblem</label>
            <span className="text-[10px] text-muted-foreground">PNG, JPG, WEBP (Max 5 MB)</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Emblem Preview Box */}
            <div className="size-20 rounded-xl border-2 border-dashed border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
              {emblemUrl ? (
                <img
                  src={emblemUrl}
                  alt="School Emblem"
                  className="size-full object-contain p-1"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <ImageIcon className="size-6" />
                  <span className="text-[9px] mt-1 font-mono">None</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2 flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="h-8.5 text-xs font-semibold gap-1.5 shadow-2xs cursor-pointer w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="size-3.5" /> {emblemUrl ? "Change Emblem" : "Upload Emblem"}
                  </>
                )}
              </Button>

              {emblemUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveEmblem}
                  className="h-7 text-xs text-destructive hover:bg-destructive/10 cursor-pointer w-full"
                >
                  <Trash2 className="size-3 mr-1" /> Remove Emblem
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CustomizationPanel(props) {
  const key = `${props.customization?.primary_color || ""}-${props.customization?.emblem_url || ""}`
  return <CustomizationForm key={key} {...props} />
}
