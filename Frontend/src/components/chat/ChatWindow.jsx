import { useState, useEffect } from "react"
import { ArrowLeft, Users, Megaphone, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { formatLastSeen } from "@/lib/chatDate"
import { MessageList } from "./MessageList"
import { MessageComposer } from "./MessageComposer"

export function ChatWindow({
  conversation,
  messages,
  currentUserId,
  isLoadingMessages,
  isTyping = false,
  typingText = null,
  onSendMessage,
  onRetryMessage,
  onTypingStart,
  onTypingStop,
  onBack,
  onOpenDetails,
  isMobile,
}) {
  const isGroup = conversation?.type === "GROUP"
  const isBroadcast = conversation?.type === "BROADCAST"
  const isDirect = !isGroup && !isBroadcast

  const otherUser = conversation?.other_participant || {}
  const initials = isDirect
    ? `${otherUser.first_name?.[0] || ""}${otherUser.last_name?.[0] || ""}`.toUpperCase()
    : (conversation?.name || "G")
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()

  // For direct chat, track online and last seen status
  const [statusText, setStatusText] = useState(() =>
    otherUser.is_online ? "Online" : formatLastSeen(otherUser.last_seen_at)
  )

  useEffect(() => {
    if (!isDirect) return
    const update = () => {
      setStatusText(otherUser.is_online ? "Online" : formatLastSeen(otherUser.last_seen_at))
    }
    update()
    if (otherUser.is_online || !otherUser.last_seen_at) return
    const interval = setInterval(update, 10000)
    return () => clearInterval(interval)
  }, [isDirect, otherUser.is_online, otherUser.last_seen_at])

  // Can the current user send messages in this conversation?
  // Recipients of broadcasts cannot send messages.
  const isBroadcastRecipient = isBroadcast && conversation?.created_by_id !== currentUserId
  const canSendMessage = !isBroadcastRecipient

  return (
    <div className="flex flex-col h-full min-h-0 bg-background relative overflow-hidden">
      {/* Header */}
      <div className="p-3 px-4 border-b border-border/80 bg-card/50 backdrop-blur-xs flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
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
              <AvatarFallback
                className={`rounded-xl font-semibold text-xs transition-colors ${
                  isBroadcast
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : isGroup
                    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {isBroadcast ? (
                  <Megaphone className="size-5" />
                ) : isGroup ? (
                  <Users className="size-5" />
                ) : (
                  initials || "U"
                )}
              </AvatarFallback>
            </Avatar>

            {isDirect && otherUser.is_online && (
              <span
                title="Online"
                className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
              />
            )}
          </div>

          <div
            className={`flex flex-col min-w-0 ${
              !isDirect && onOpenDetails ? "cursor-pointer select-none group" : ""
            }`}
            onClick={() => !isDirect && onOpenDetails?.()}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {isDirect
                  ? `${otherUser.first_name || ""} ${otherUser.last_name || ""}`.trim() || "User"
                  : conversation?.name || (isGroup ? "Group Chat" : "Broadcast Channel")}
              </span>
              {isDirect && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-normal">
                  {otherUser.role_name || "Member"}
                </Badge>
              )}
              {isGroup && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-normal">
                  Group
                </Badge>
              )}
              {isBroadcast && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-normal border-amber-500/30 text-amber-600 bg-amber-500/10"
                >
                  Broadcast
                </Badge>
              )}
            </div>

            {/* Subtitle */}
            {isDirect ? (
              statusText ? (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  {statusText}
                </span>
              ) : null
            ) : isGroup ? (
              <span className="text-[11px] text-muted-foreground hover:underline">
                {conversation?.participants?.length
                  ? `${conversation.participants.length} participants`
                  : "Tap for group details"}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                {conversation?.participants?.length
                  ? `${Math.max(0, conversation.participants.length - 1)} recipients`
                  : "One-way announcement channel"}
              </span>
            )}
          </div>
        </div>

        {/* Details button for Groups & Broadcasts */}
        {!isDirect && onOpenDetails && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onOpenDetails}
            title={isBroadcast ? "Broadcast Details" : "Group Details"}
            className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
          >
            <Info className="size-4" />
          </Button>
        )}
      </div>

      {/* Message Stream */}
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        isLoading={isLoadingMessages}
        isTyping={isTyping}
        typingText={typingText}
        isGroup={isGroup}
        onRetryMessage={onRetryMessage}
      />

      {/* Composer OR Broadcast Read-Only Notice */}
      {canSendMessage ? (
        <MessageComposer
          onSendMessage={onSendMessage}
          conversationId={conversation?.id}
          onTypingStart={onTypingStart}
          onTypingStop={onTypingStop}
        />
      ) : (
        <div className="p-4 border-t border-border/80 bg-muted/40 text-center select-none flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Megaphone className="size-4 text-amber-500 shrink-0" />
          <span>Only the broadcast creator can send messages in this channel.</span>
        </div>
      )}
    </div>
  )
}

export default ChatWindow
