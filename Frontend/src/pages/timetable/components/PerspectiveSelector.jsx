import { useState } from "react"
import { ChevronDown, GraduationCap, LayoutDashboard, UserCheck, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger, PopoverDialog } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export const PERSPECTIVES = [
  {
    id: "class-wise",
    shortLabel: "Class-wise",
    title: "Class-wise Timetables",
    iconBg: "bg-primary/10 text-primary",
    description: "View & edit schedules grouped by class & section",
    icon: GraduationCap,
  },
  {
    id: "teacher-wise",
    shortLabel: "Teacher-wise",
    title: "Teacher-wise Timetables",
    iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    description: "Faculty rosters, lectures, free hours & workloads",
    icon: UserCheck,
  },
  {
    id: "live-dashboard",
    shortLabel: "Live Dashboard",
    title: "Live Dashboard",
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    description: "Real-time timeline, 36 class operations & available faculty",
    icon: LayoutDashboard,
  },
]

export function PerspectiveSelector({ currentPerspective = "class-wise", onChange }) {
  const [isOpen, setIsOpen] = useState(false)

  const activeItem =
    PERSPECTIVES.find(
      (p) =>
        p.id === currentPerspective ||
        (p.id === "class-wise" && (!currentPerspective || currentPerspective === "class"))
    ) || PERSPECTIVES[0]

  return (
    <PopoverTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        type="button"
        variant="outline"
        size="default"
        className={cn(
          "h-9 px-3 rounded-xl border flex items-center gap-2 text-xs font-semibold shadow-2xs cursor-pointer transition-all",
          isOpen
            ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/40"
            : "border-border/80 bg-background hover:bg-muted/50 text-foreground"
        )}
      >
        <activeItem.icon className="size-4 text-primary shrink-0" />
        <span className="truncate max-w-[130px] font-bold">
          {activeItem.shortLabel}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform duration-200 shrink-0",
            isOpen && "rotate-180"
          )}
        />
      </Button>

      <Popover
        placement="bottom start"
        className="w-80 p-2.5 rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl z-50 space-y-1.5"
      >
        <PopoverDialog className="outline-hidden space-y-1.5">
          <div className="flex items-center gap-2 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Layers className="size-3.5 text-muted-foreground shrink-0" />
            <span>Select Timetable Perspective</span>
          </div>

          <div className="space-y-1">
            {PERSPECTIVES.map((item) => {
              const isSelected =
                item.id === currentPerspective ||
                (item.id === "class-wise" &&
                  (!currentPerspective ||
                    currentPerspective === "class" ||
                    currentPerspective === "class-wise"))
              const Icon = item.icon

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChange?.(item.id)
                    setIsOpen(false)
                  }}
                  className={cn(
                    "w-full text-left p-2.5 rounded-xl cursor-pointer flex items-start gap-3 transition-all",
                    isSelected
                      ? "bg-primary/10 text-primary border border-primary/25 shadow-2xs"
                      : "hover:bg-muted/60 text-foreground border border-transparent"
                  )}
                >
                  <div
                    className={cn(
                      "size-8.5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                      item.iconBg
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-bold block truncate">
                      {item.title}
                    </span>
                    <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                      {item.description}
                    </p>
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
