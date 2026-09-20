import { cn } from "@/lib/utils"

/**
 * Compact animated three-dot typing indicator for 1-to-1 chat.
 * Conforms to accessibility standards with screen-reader text and respects prefers-reduced-motion.
 * Displays only the subtle bouncing dots without showing user names.
 */
export function TypingIndicator({ className }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col max-w-[82%] sm:max-w-[70%] mr-auto items-start select-none",
        className
      )}
    >
      <span className="sr-only">User is typing</span>
      <div
        aria-hidden="true"
        className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-bl-xs bg-muted text-foreground border border-border/40 shadow-xs"
      >
        <span className="size-2 rounded-full bg-muted-foreground/70 animate-bounce motion-reduce:animate-none [animation-delay:-0.32s]" />
        <span className="size-2 rounded-full bg-muted-foreground/70 animate-bounce motion-reduce:animate-none [animation-delay:-0.16s]" />
        <span className="size-2 rounded-full bg-muted-foreground/70 animate-bounce motion-reduce:animate-none" />
      </div>
    </div>
  )
}

export default TypingIndicator
