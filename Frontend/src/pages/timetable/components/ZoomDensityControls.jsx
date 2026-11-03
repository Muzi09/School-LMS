import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

export function ZoomControls({
  zoomLevel = 100,
  onZoomChange,
  className,
}) {
  const handleZoomOut = () => {
    onZoomChange(Math.max(60, zoomLevel - 10))
  }

  const handleZoomIn = () => {
    onZoomChange(Math.min(130, zoomLevel + 10))
  }

  const handleZoomReset = () => {
    onZoomChange(100)
  }

  return (
    <div
      className={cn(
        "flex items-center h-9 px-1 rounded-xl border border-border/80 bg-background shadow-2xs shrink-0",
        className
      )}
    >
      <button
        type="button"
        onClick={handleZoomOut}
        disabled={zoomLevel <= 60}
        className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
        aria-label="Zoom out"
        title="Zoom out"
      >
        <Minus className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={handleZoomReset}
        className="min-w-[42px] px-1 text-center text-xs font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
        title="Click to reset zoom to 100%"
      >
        {zoomLevel}%
      </button>

      <button
        type="button"
        onClick={handleZoomIn}
        disabled={zoomLevel >= 130}
        className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
        aria-label="Zoom in"
        title="Zoom in"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}

// Backward compatibility export
export const ZoomDensityControls = ZoomControls
