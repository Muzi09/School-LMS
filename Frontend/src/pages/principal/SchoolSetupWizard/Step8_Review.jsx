import {
  Building2,
  BookOpen,
  Compass,
  Shield,
  KeyRound,
  CheckCircle2,
  Edit3,
} from "lucide-react"
import {
  INITIAL_DEFAULT_SECTIONS,
  SENIOR_SECONDARY_DEFAULT_SECTIONS,
} from "@/constants"

export function Step8Review({
  schoolName,
  schoolCode,
  schoolEmail,
  schoolPhone,
  getFullFormattedAddress,
  emblemUploadedUrl,
  classesList,
  classSectionMap,
  getAllUniqueSubjectsAcrossAllClasses,
  wingsList,
  useHouses,
  housesList,
  setCurrentStep,
}) {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-lg font-bold text-foreground">Step 8: Review &amp; Finish Setup</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
          Verify your configured school structure. Click any Edit link to return directly to that step.
        </p>
      </div>

      <div className="space-y-4">
        {/* 1. School Profile */}
        <div className="p-4 rounded-2xl border border-border bg-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <Building2 className="size-4 text-primary" />
              <span>School Profile &amp; Identity</span>
            </div>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <Edit3 className="size-3" /> Edit
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block">School Name</span>
              <strong className="text-foreground">{schoolName}</strong>
            </div>
            <div>
              <span className="text-muted-foreground block">Affiliation Code</span>
              <strong className="font-mono text-foreground">{schoolCode}</strong>
            </div>
            <div>
              <span className="text-muted-foreground block">Email</span>
              <span className="text-foreground truncate block">{schoolEmail}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Phone</span>
              <span className="font-mono text-foreground">{schoolPhone}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-border/60 text-xs flex justify-between items-center">
            <div>
              <span className="text-muted-foreground block mb-0.5">Address</span>
              <p className="text-foreground font-medium">{getFullFormattedAddress()}</p>
            </div>
            {emblemUploadedUrl && (
              <img
                src={emblemUploadedUrl}
                alt="Emblem"
                className="size-8 object-contain rounded border border-border bg-muted/20 p-0.5"
              />
            )}
          </div>
        </div>

        {/* 2. Academic Structure */}
        <div className="p-4 rounded-2xl border border-border bg-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <BookOpen className="size-4 text-primary" />
              <span>Academic Structure</span>
            </div>
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <Edit3 className="size-3" /> Edit
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-muted/20 border border-border">
              <span className="text-muted-foreground block font-medium">Classes Configured</span>
              <strong className="text-foreground text-sm mt-0.5 block">{classesList.length} Classes</strong>
              <span className="text-[11px] text-muted-foreground">
                {classesList[0]} → {classesList[classesList.length - 1]}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-muted/20 border border-border">
              <span className="text-muted-foreground block font-medium">Sections</span>
              <strong className="text-foreground text-sm mt-0.5 block">
                {Array.from(new Set(Object.values(classSectionMap).flat())).join(", ") ||
                  [...INITIAL_DEFAULT_SECTIONS, ...SENIOR_SECONDARY_DEFAULT_SECTIONS].join(", ")}
              </strong>
              <span className="text-[11px] text-muted-foreground">Applied across classes</span>
            </div>

            <div className="p-3 rounded-xl bg-muted/20 border border-border">
              <span className="text-muted-foreground block font-medium">Subject Library</span>
              <strong className="text-foreground text-sm mt-0.5 block">
                {getAllUniqueSubjectsAcrossAllClasses().length} Subjects
              </strong>
              <span className="text-[11px] text-muted-foreground">Assigned to grade levels</span>
            </div>
          </div>
        </div>

        {/* 3. Wings & Houses */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Wings Card */}
          <div className="p-4 rounded-2xl border border-border bg-card space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                <Compass className="size-4 text-primary" />
                <span>Academic Wings</span>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <Edit3 className="size-3" /> Edit
              </button>
            </div>
            {wingsList.length > 0 ? (
              <div className="space-y-1.5 text-xs max-h-[160px] overflow-y-auto pr-1">
                {wingsList.map((w) => (
                  <div key={w.name} className="flex justify-between items-start text-muted-foreground gap-2">
                    <span className="font-semibold text-foreground shrink-0">{w.name}:</span>
                    <span className="text-right">
                      {w.classes && w.classes.length > 0 ? (
                        w.classes.join(", ")
                      ) : (
                        <span className="italic text-muted-foreground">No classes assigned</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No wings configured</p>
            )}
          </div>

          {/* Houses Card */}
          <div className="p-4 rounded-2xl border border-border bg-card space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                <Shield className="size-4 text-primary" />
                <span>School Houses</span>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(6)}
                className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <Edit3 className="size-3" /> Edit
              </button>
            </div>
            {useHouses && housesList.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {housesList.map((h) => (
                  <span
                    key={h.name}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border border-border bg-muted/40"
                  >
                    {h.emblem_url || h.emblem ? (
                      <img src={h.emblem_url || h.emblem} alt="" className="size-3.5 object-contain" />
                    ) : (
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: h.color }} />
                    )}
                    {h.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No houses configured (Skipped)</p>
            )}
          </div>
        </div>

        {/* 4. Credentials */}
        <div className="p-4 rounded-2xl border border-border bg-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <KeyRound className="size-4 text-primary" />
              <span>Security Credentials</span>
            </div>
            <button
              type="button"
              onClick={() => setCurrentStep(7)}
              className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <Edit3 className="size-3" /> Edit
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span className="text-foreground font-medium">Master Password Configured</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span className="text-foreground font-medium">Quick Login PIN Configured</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Step8Review
