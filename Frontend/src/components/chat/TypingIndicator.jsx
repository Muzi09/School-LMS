import { cn } from "@/lib/utils"

/**
 * Animated typing indicator.
 * - DIRECT: Subtle bouncing dots without names.
 * - GROUP: Shows user names (e.g. "Sarah is typing...") alongside subtle bouncing dots.
 */
export function TypingIndicator({ typingText, className }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col max-w-[82%] sm:max-w-[70%] mr-auto items-start select-none",
        className
      )}
    >
      <span className="sr-only">{typingText || "User is typing"}</span>

      {typingText ? (
        <div
          aria-hidden="true"
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl rounded-bl-xs bg-muted text-foreground border border-border/40 shadow-xs text-xs"
        >
          <span className="font-medium text-foreground text-xs">{typingText}</span>
          <div className="flex items-center gap-1 shrink-0 pt-0.5">
            <span className="size-1.5 rounded-full bg-primary/70 animate-bounce motion-reduce:animate-none [animation-delay:-0.32s]" />
            <span className="size-1.5 rounded-full bg-primary/70 animate-bounce motion-reduce:animate-none [animation-delay:-0.16s]" />
            <span className="size-1.5 rounded-full bg-primary/70 animate-bounce motion-reduce:animate-none" />
          </div>
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-bl-xs bg-muted text-foreground border border-border/40 shadow-xs overflow-hidden"
        >
          <span className="size-2 rounded-full bg-muted-foreground/70 animate-bounce motion-reduce:animate-none [animation-delay:-0.32s]" />
          <span className="size-2 rounded-full bg-muted-foreground/70 animate-bounce motion-reduce:animate-none [animation-delay:-0.16s]" />
          <span className="size-2 rounded-full bg-muted-foreground/70 animate-bounce motion-reduce:animate-none" />
        </div>
      )}
    </div>
  )
}

export default TypingIndicator
