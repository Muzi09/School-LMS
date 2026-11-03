import { useState } from "react"
import { ChevronDown, Layers } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger, PopoverDialog } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function WingSelector({
  wings = [],
  selectedWingIds = [],
  onSelectWingIds,
}) {
  const [isOpen, setIsOpen] = useState(false)

  // Active wing is the selected one, or default to the first wing
  const activeWing =
    wings.find((w) => selectedWingIds.includes(w.id)) || wings[0] || null

  const displayLabel = activeWing?.name || "Select Wing"
  const activeClassesCount = activeWing?.classes?.length ?? (activeWing?.total_classes || 0)
  const activeSectionsCount =
    activeWing?.total_sections ??
    (activeWing?.classes?.reduce((acc, c) => acc + (c.sections?.length || 0), 0) || 0)

  const handleSelectWing = (wingId) => {
    onSelectWingIds([wingId])
    setIsOpen(false)
  }

  return (
    <PopoverTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        type="button"
        variant="outline"
        className={cn(
          "h-9 px-3 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all cursor-pointer shadow-2xs",
          isOpen
            ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/40"
            : "border-border/80 bg-background text-foreground hover:bg-muted/50"
        )}
      >
        <Layers className="size-4 text-primary shrink-0" />
        <span className="font-bold truncate max-w-[130px]">{displayLabel}</span>
        {activeWing && (
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-bold shrink-0">
              {activeClassesCount} {activeClassesCount === 1 ? "Class" : "Classes"}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-semibold shrink-0">
              {activeSectionsCount} {activeSectionsCount === 1 ? "Section" : "Sections"}
            </Badge>
          </div>
        )}
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform duration-200 shrink-0",
            isOpen && "rotate-180"
          )}
        />
      </Button>

      <Popover
        placement="bottom start"
        className="w-max min-w-[var(--trigger-width,260px)] max-w-sm p-2.5 rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl z-50 space-y-1.5"
      >
        <PopoverDialog className="outline-hidden space-y-1.5">
          {/* Header without border-bottom */}
          <div className="flex items-center gap-2 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Layers className="size-3.5 text-muted-foreground shrink-0" />
            <span>Select Wing</span>
          </div>

          {/* Wings list */}
          <div className="space-y-1 max-h-80 overflow-y-auto pr-0.5">
            {wings.map((wing) => {
              const isSelected = activeWing?.id === wing.id
              const classesCount = wing.classes?.length ?? (wing.total_classes || 0)
              const sectionsCount =
                wing.total_sections ??
                (wing.classes?.reduce((acc, c) => acc + (c.sections?.length || 0), 0) || 0)

              return (
                <button
                  key={wing.id}
                  type="button"
                  onClick={() => handleSelectWing(wing.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl cursor-pointer flex items-center justify-between gap-3 transition-all",
                    isSelected
                      ? "bg-primary/10 text-primary border border-primary/25 shadow-2xs font-semibold"
                      : "hover:bg-muted/60 text-foreground border border-transparent"
                  )}
                >
                  <span className="text-xs font-bold truncate">
                    {wing.name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 h-4.5 font-semibold"
                      )}
                    >
                      {classesCount} {classesCount === 1 ? "Class" : "Classes"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0.5 h-4.5 font-semibold"
                    >
                      {sectionsCount} {sectionsCount === 1 ? "Section" : "Sections"}
                    </Badge>
                  </div>
                </button>
              )
            })}
          </div>
        </PopoverDialog>
      </Popover>
    </PopoverTrigger>
  )
}
