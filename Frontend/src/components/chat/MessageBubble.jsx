import { Check, Clock, AlertCircle, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { formatMessageTime } from "@/lib/chatDate"

export function MessageBubble({ message, isOutgoing, isGroup = false, onRetry }) {
  const isFailed = message.status === "failed"
  const isSending = message.status === "sending"
  const isSystem = message.message_type === "SYSTEM"
  const timeFormatted = formatMessageTime(message.created_at)

  // 1. Render SYSTEM messages as centered subtle info chips
  if (isSystem) {
    return (
      <div className="flex items-center justify-center my-2.5 px-4 w-full">
        <span className="text-[11px] font-medium text-muted-foreground bg-muted/70 border border-border/50 rounded-full px-3.5 py-1 text-center max-w-[85%] leading-relaxed select-none">
          {message.content}
        </span>
      </div>
    )
  }

  // 2. Regular User Messages
  const senderName = message.sender
    ? `${message.sender.first_name || ""} ${message.sender.last_name || ""}`.trim()
    : null

  return (
    <div
      className={cn(
        "flex flex-col max-w-[82%] sm:max-w-[70%]",
        isOutgoing ? "ml-auto items-end" : "mr-auto items-start"
      )}
    >
      {/* Show sender name for incoming messages in group chats */}
      {!isOutgoing && isGroup && senderName && (
        <span className="text-[11px] font-semibold text-primary/80 mb-1 px-1">
          {senderName}
        </span>
      )}

      <div
        className={cn(
          "px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-xs transition-all",
          isOutgoing
            ? isFailed
              ? "bg-destructive/15 text-destructive border border-destructive/30 rounded-br-xs"
              : "bg-primary text-primary-foreground rounded-br-xs"
            : "bg-muted text-foreground border border-border/40 rounded-bl-xs"
        )}
        style={{
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}
      >
        {message.content}
      </div>

      {/* Footer / Status */}
      <div className="flex items-center gap-1.5 mt-1 px-1 text-[11px] text-muted-foreground select-none">
        {timeFormatted && <span>{timeFormatted}</span>}

        {isOutgoing && (
          <span className="flex items-center gap-1">
            {isSending && (
              <span title="Sending..." className="inline-flex items-center text-muted-foreground">
                <Clock className="size-3 animate-pulse" />
              </span>
            )}
            {isFailed && (
              <span className="inline-flex items-center gap-1 text-destructive font-medium">
                <AlertCircle className="size-3" />
                <span>Failed</span>
                {onRetry && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => onRetry(message)}
                    className="h-5 px-1.5 text-[10px] text-destructive hover:bg-destructive/10 rounded-md gap-1"
                  >
                    <RotateCcw className="size-2.5" />
                    Retry
                  </Button>
                )}
              </span>
            )}
            {!isSending && !isFailed && (
              <span
                title={message.is_read ? "Read" : "Delivered"}
                className={cn(
                  "inline-flex items-center transition-colors",
                  message.is_read ? "text-primary" : "text-white"
                )}
              >
                <Check className="size-3" />
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}

export default MessageBubble
