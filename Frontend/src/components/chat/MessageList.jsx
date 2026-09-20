import { useEffect, useRef, useMemo } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { MessageBubble } from "./MessageBubble"
import { TypingIndicator } from "./TypingIndicator"
import { getDateDivider } from "@/lib/chatDate"

export function MessageList({
  messages,
  currentUserId,
  isLoading,
  isTyping = false,
  onRetryMessage,
}) {
  const containerRef = useRef(null)
  const scrollBottomRef = useRef(null)

  // Scroll to bottom when message count changes or finishes loading
  useEffect(() => {
    if (!isLoading && scrollBottomRef.current) {
      scrollBottomRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages?.length, isLoading])

  // When recipient starts typing, only scroll if user is already near bottom (preserve scroll position if reading history)
  useEffect(() => {
    if (!isLoading && isTyping && containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 120
      if (isNearBottom && scrollBottomRef.current) {
        scrollBottomRef.current.scrollIntoView({ behavior: "smooth" })
      }
    }
  }, [isTyping, isLoading])

  // Pre-calculate message items with date dividers immutably
  const itemsWithDividers = useMemo(() => {
    if (!messages || messages.length === 0) return []
    const items = []
    let lastDateStr = null

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      const msgDateStr = msg.created_at ? new Date(msg.created_at).toDateString() : null
      if (msgDateStr && msgDateStr !== lastDateStr) {
        lastDateStr = msgDateStr
        items.push({
          type: "divider",
          id: `div-${msgDateStr}-${i}`,
          label: getDateDivider(msg.created_at),
        })
      }
      items.push({
        type: "message",
        id: msg.id || msg.temp_id || `msg-${i}`,
        message: msg,
      })
    }

    return items
  }, [messages])

  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <div className="flex items-start gap-2 max-w-[60%]">
          <Skeleton className="h-10 w-48 rounded-2xl" />
        </div>
        <div className="flex items-end gap-2 max-w-[60%] ml-auto justify-end">
          <Skeleton className="h-14 w-56 rounded-2xl" />
        </div>
        <div className="flex items-start gap-2 max-w-[60%]">
          <Skeleton className="h-8 w-36 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!messages || messages.length === 0) {
    if (isTyping) {
      return (
        <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="pt-1">
            <TypingIndicator />
          </div>
          <div ref={scrollBottomRef} />
        </div>
      )
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground select-none">
        <p className="text-sm">No messages yet.</p>
        <p className="text-xs text-muted-foreground/80 mt-1">
          Say hello to start the conversation!
        </p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
      {itemsWithDividers.map((item) => {
        if (item.type === "divider") {
          return (
            <div key={item.id} className="flex items-center justify-center my-4">
              <span className="text-[11px] font-medium tracking-wide uppercase px-2.5 py-0.5 rounded-full bg-muted/80 text-muted-foreground border border-border/40 select-none">
                {item.label}
              </span>
            </div>
          )
        }

        const isOutgoing = item.message.sender_id === currentUserId
        return (
          <MessageBubble
            key={item.id}
            message={item.message}
            isOutgoing={isOutgoing}
            onRetry={onRetryMessage}
          />
        )
      })}
      {isTyping && (
        <div className="pt-1">
          <TypingIndicator />
        </div>
      )}
      <div ref={scrollBottomRef} />
    </div>
  )
}
