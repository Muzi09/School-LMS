import { useState, useRef, useEffect } from "react"
import { SendHorizonal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const TYPING_HEARTBEAT_INTERVAL = 2000 // Send typing_start refresh every 2s while actively typing
const TYPING_INACTIVITY_DELAY = 2500 // Stop typing after 2.5s of no keypresses

export function MessageComposer({
  onSendMessage,
  conversationId,
  onTypingStart,
  onTypingStop,
  disabled = false,
}) {
  const [content, setContent] = useState("")
  const textareaRef = useRef(null)
  const isTypingRef = useRef(false)
  const lastTypingPingRef = useRef(0)
  const typingTimeoutRef = useRef(null)
  const onTypingStopRef = useRef(onTypingStop)
  const onTypingStartRef = useRef(onTypingStart)

  useEffect(() => {
    onTypingStopRef.current = onTypingStop
    onTypingStartRef.current = onTypingStart
  }, [onTypingStop, onTypingStart])

  // Stop typing and reset draft when conversation changes or unmounts
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
      if (isTypingRef.current) {
        isTypingRef.current = false
        lastTypingPingRef.current = 0
        onTypingStopRef.current?.()
      }
    }
  }, [conversationId])

  const stopTypingImmediately = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    if (isTypingRef.current) {
      isTypingRef.current = false
      lastTypingPingRef.current = 0
      onTypingStopRef.current?.()
    }
  }

  const canSend = content.trim().length > 0 && !disabled

  const handleSend = () => {
    const trimmed = content.trim()
    if (!trimmed || disabled) return
    stopTypingImmediately()
    onSendMessage(trimmed)
    setContent("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea and manage typing state
  const handleInput = (e) => {
    const value = e.target.value
    setContent(value)

    const target = e.target
    target.style.height = "auto"
    target.style.height = `${Math.min(target.scrollHeight, 140)}px`

    // If input was cleared entirely, immediately stop typing
    if (!value.trim()) {
      stopTypingImmediately()
      return
    }

    const now = Date.now()

    // Emit typing_start on first keystroke OR refresh every 2s while actively typing
    if (!isTypingRef.current || now - lastTypingPingRef.current > TYPING_HEARTBEAT_INTERVAL) {
      isTypingRef.current = true
      lastTypingPingRef.current = now
      onTypingStartRef.current?.()
    }

    // Reset inactivity timeout on each keystroke
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false
      lastTypingPingRef.current = 0
      onTypingStopRef.current?.()
      typingTimeoutRef.current = null
    }, TYPING_INACTIVITY_DELAY)
  }

  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [disabled])

  return (
    <div className="p-3 border-t border-border/80 bg-card/60 backdrop-blur-xs shrink-0">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            rows={1}
            maxLength={5000}
            value={content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            className="min-h-[44px] max-h-[140px] py-2.5 px-3.5 text-sm bg-muted/60 border border-border/50 rounded-2xl shadow-none"
          />
        </div>

        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={!canSend}
          title="Send message"
          className="size-11 rounded-2xl shrink-0 shadow-sm transition-transform active:scale-95"
        >
          <SendHorizonal className="size-5" />
          <span className="sr-only">Send</span>
        </Button>
      </div>
    </div>
  )
}
