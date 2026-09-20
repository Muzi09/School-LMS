import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatChatTimestamp } from "@/lib/chatDate"

export function ConversationItem({ conversation, isActive, onSelect }) {
  const otherUser = conversation.other_participant || {}
  const initials = `${otherUser.first_name?.[0] || ""}${otherUser.last_name?.[0] || ""}`.toUpperCase()
  const lastMsg = conversation.last_message
  const unreadCount = conversation.unread_count || 0
  const formattedTime = formatChatTimestamp(lastMsg?.created_at || conversation.updated_at)

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation)}
      className={cn(
        "flex items-center gap-3 w-full p-3 rounded-2xl text-left transition-all cursor-pointer select-none",
        isActive
          ? "bg-primary/10 border border-primary/20 shadow-xs"
          : "hover:bg-muted/60 border border-transparent"
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="size-11 rounded-xl">
          <AvatarFallback
            className={cn(
              "rounded-xl font-semibold text-xs transition-colors",
              isActive ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
            )}
          >
            {initials || "U"}
          </AvatarFallback>
        </Avatar>
        {otherUser.is_online && (
          <span
            title="Online"
            className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-card"
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span
            className={cn(
              "text-sm truncate font-medium",
              isActive ? "text-primary font-semibold" : "text-foreground"
            )}
          >
            {otherUser.first_name} {otherUser.last_name}
          </span>
          {formattedTime && (
            <span className="text-[11px] text-muted-foreground shrink-0 font-normal">
              {formattedTime}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "text-xs truncate",
              unreadCount > 0
                ? "font-semibold text-foreground"
                : "text-muted-foreground font-normal"
            )}
          >
            {lastMsg?.content || "No messages yet"}
          </p>

          {unreadCount > 0 && (
            <Badge
              variant="default"
              className="size-5 p-0 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0 shadow-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </button>
  )
}
