import { useState, useEffect, useRef } from "react"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

export function SearchFilterBar({
  searchQuery = "",
  onSearchChange,
  className,
}) {
  const [localQuery, setLocalQuery] = useState(searchQuery)
  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery)
  const inputRef = useRef(null)

  // Sync external search changes during render
  if (prevSearchQuery !== searchQuery) {
    setPrevSearchQuery(searchQuery)
    setLocalQuery(searchQuery)
  }

  // Debounced search trigger (~150ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localQuery !== searchQuery) {
        onSearchChange?.(localQuery)
      }
    }, 150)
    return () => clearTimeout(handler)
  }, [localQuery, searchQuery, onSearchChange])

  // Global keyboard shortcuts: "/" focuses, "Esc" clears
  useEffect(() => {
    function handleKeyDown(e) {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault()
        inputRef.current?.focus()
      } else if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setLocalQuery("")
        onSearchChange?.("")
        inputRef.current?.blur()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onSearchChange])

  const handleClear = () => {
    setLocalQuery("")
    onSearchChange?.("")
    inputRef.current?.focus()
  }

  return (
    <div className={cn("relative w-full", className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        placeholder="Search"
        className="w-full h-9 pl-8 pr-8 rounded-xl border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary shadow-2xs"
        aria-label="Search timetable"
      />

      {localQuery && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Clear search"
          title="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
