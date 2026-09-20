import {
  Palette,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Mail,
  Phone,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { INDIAN_STATES, THEME_COLOR_PRESETS } from "@/constants"

export function Step1Profile({
  emblemUploadError,
  emblemInputRef,
  handleEmblemFileChange,
  emblemPreviewUrl,
  isUploadingEmblem,
  handleRemoveEmblem,
  schoolName,
  setSchoolName,
  schoolCode,
  setSchoolCode,
  schoolEmail,
  schoolPhone,
  addressStreet,
  setAddressStreet,
  addressLandmark,
  setAddressLandmark,
  addressCity,
  setAddressCity,
  addressState,
  setAddressState,
  addressPincode,
  setAddressPincode,
  primaryColor,
  setPrimaryColor,
}) {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-lg font-bold text-foreground">Step 1: School Profile &amp; Identity</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
          Provide institution details, campus address, and optional emblem and theme color.
        </p>
      </div>

      {/* 1. School Emblem Upload */}
      <div className="p-4.5 rounded-2xl border border-border bg-muted/20 space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="size-4 text-primary" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">
            School Emblem / Crest (Optional)
          </span>
        </div>

        {emblemUploadError && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>{emblemUploadError}</span>
          </div>
        )}

        <input
          ref={emblemInputRef}
          type="file"
          accept="image/png, image/jpeg, image/jpg, image/webp"
          onChange={handleEmblemFileChange}
          className="hidden"
        />

        {emblemPreviewUrl ? (
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl border border-border bg-muted/30 flex items-center justify-center p-1 overflow-hidden shadow-2xs">
                <img
                  src={emblemPreviewUrl}
                  alt="Emblem Preview"
                  className="size-full object-contain"
                />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-500" /> Emblem Uploaded
                </div>
                <div className="text-[11px] text-muted-foreground">Ready for portal header &amp; reports</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => emblemInputRef.current?.click()}
                disabled={isUploadingEmblem}
                className="text-xs h-8 cursor-pointer"
              >
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveEmblem}
                disabled={isUploadingEmblem}
                className="text-xs h-8 text-destructive hover:bg-destructive/10 cursor-pointer"
              >
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => emblemInputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/40 transition-all rounded-xl p-4 text-center cursor-pointer flex flex-col items-center justify-center gap-1.5"
          >
            <div className="size-9 rounded-xl bg-card flex items-center justify-center text-muted-foreground shadow-2xs">
              {isUploadingEmblem ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <Upload className="size-4" />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                {isUploadingEmblem ? "Uploading Emblem..." : "Click to upload School Emblem / Crest"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                PNG (transparent recommended), JPG, WEBP (Max 5 MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. School Details */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">School Name</label>
            <Input
              type="text"
              maxLength={255}
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="h-10 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">Affiliation Code</label>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={7}
              value={schoolCode}
              onChange={(e) => {
                const numericOnly = e.target.value.replace(/\D/g, "").slice(0, 7)
                setSchoolCode(numericOnly)
              }}
              className="h-10 text-sm font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">Official School Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="email"
                readOnly
                value={schoolEmail}
                className="pl-9 h-10 text-sm bg-muted/50 cursor-not-allowed text-foreground border-border select-all"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">Official Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="tel"
                readOnly
                value={schoolPhone}
                className="pl-9 h-10 text-sm font-mono bg-muted/50 cursor-not-allowed text-foreground border-border select-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Address Fields */}
      <div className="space-y-4 pt-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-foreground block mb-1">Street / Building / Area</label>
            <Input
              type="text"
              value={addressStreet}
              onChange={(e) => setAddressStreet(e.target.value)}
              className="h-10 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">Landmark (Optional)</label>
            <Input
              type="text"
              value={addressLandmark}
              onChange={(e) => setAddressLandmark(e.target.value)}
              className="h-10 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">City / District</label>
            <Input
              type="text"
              value={addressCity}
              onChange={(e) => setAddressCity(e.target.value)}
              className="h-10 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">State / Union Territory</label>
            <select
              value={addressState}
              onChange={(e) => setAddressState(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground cursor-pointer focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 outline-none"
            >
              {INDIAN_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">PIN Code (6 Digits)</label>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={addressPincode}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/\D/g, "").slice(0, 6)
                setAddressPincode(cleaned)
              }}
              className="h-10 text-sm font-mono tracking-wider"
            />
          </div>
        </div>
      </div>

      {/* 4. Theme Color */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-primary" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              Portal Theme Accent (Optional)
            </span>
          </div>
          {primaryColor && (
            <button
              type="button"
              onClick={() => setPrimaryColor("#FFFFFF")}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="size-3" /> Reset Default
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative size-10 shrink-0 rounded-xl overflow-hidden border border-border shadow-xs cursor-pointer">
              <input
                type="color"
                value={primaryColor || "#FFFFFF"}
                onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
                className="absolute inset-0 size-full scale-150 cursor-pointer border-0 p-0"
              />
            </div>
            <Input
              type="text"
              maxLength={7}
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
              className="h-10 w-28 text-sm font-mono uppercase tracking-wider"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 flex-1">
            {THEME_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setPrimaryColor(preset.value.toUpperCase())}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all cursor-pointer ${
                  primaryColor.toUpperCase() === preset.value.toUpperCase()
                    ? "border-primary bg-primary/10 font-bold text-foreground ring-1 ring-primary/40"
                    : "border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: preset.value }} />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Step1Profile
