import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { MessageList } from "./MessageList"
import { MessageComposer } from "./MessageComposer"

export function ChatWindow({
  conversation,
  messages,
  currentUserId,
  isLoadingMessages,
  isTyping = false,
  onSendMessage,
  onRetryMessage,
  onTypingStart,
  onTypingStop,
  onBack,
  isMobile,
}) {
  const otherUser = conversation?.other_participant || {}
  const initials = `${otherUser.first_name?.[0] || ""}${otherUser.last_name?.[0] || ""}`.toUpperCase()

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Header */}
      <div className="p-3 px-4 border-b border-border/80 bg-card/50 backdrop-blur-xs flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {isMobile && onBack && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onBack}
              className="rounded-xl shrink-0 -ml-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-5" />
              <span className="sr-only">Back to conversations</span>
            </Button>
          )}

          <div className="relative shrink-0">
            <Avatar className="size-10 rounded-xl">
              <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-xs">
                {initials || "U"}
              </AvatarFallback>
            </Avatar>
            {otherUser.is_online && (
              <span
                title="Online"
                className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
              />
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground truncate">
                {otherUser.first_name} {otherUser.last_name}
              </span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-normal">
                {otherUser.role_name || "Member"}
              </Badge>
            </div>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span
                className={`size-1.5 rounded-full ${
                  otherUser.is_online ? "bg-emerald-500" : "bg-muted-foreground/40"
                }`}
              />
              {otherUser.is_online ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Message Stream */}
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        isLoading={isLoadingMessages}
        isTyping={isTyping}
        onRetryMessage={onRetryMessage}
      />

      {/* Composer */}
      <MessageComposer
        onSendMessage={onSendMessage}
        conversationId={conversation?.id}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
      />
    </div>
  )
}
