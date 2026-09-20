import { useState, useMemo } from "react"
import { Search, Plus, WifiOff, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ConversationItem } from "./ConversationItem"

export function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenNewChat,
  isLoading,
  socketStatus,
  onRetryConnect,
}) {
  const [filterText, setFilterText] = useState("")

  const filteredConversations = useMemo(() => {
    if (!filterText.trim()) return conversations
    const term = filterText.toLowerCase()
    return conversations.filter((c) => {
      const name = `${c.other_participant?.first_name || ""} ${c.other_participant?.last_name || ""}`.toLowerCase()
      const lastMsg = (c.last_message?.content || "").toLowerCase()
      return name.includes(term) || lastMsg.includes(term)
    })
  }, [conversations, filterText])

  return (
    <div className="flex flex-col h-full border-r border-border bg-card/40">
      {/* Header */}
      <div className="p-3.5 border-b border-border/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Messages
          </h2>
          {socketStatus === "reconnecting" && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/30 text-amber-500 bg-amber-500/10 font-normal">
              Connecting...
            </Badge>
          )}
          {socketStatus === "disconnected" && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 font-normal gap-1">
              <WifiOff className="size-2.5" />
              Offline
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {socketStatus === "disconnected" && onRetryConnect && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRetryConnect}
              title="Reconnect chat"
              className="size-8 rounded-lg"
            >
              <RefreshCw className="size-3.5" />
            </Button>
          )}
          <Button
            size="sm"
            onClick={onOpenNewChat}
            className="rounded-xl h-8 px-2.5 gap-1.5 font-medium shadow-xs"
          >
            <Plus className="size-4" />
            <span>New Chat</span>
          </Button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="pl-8.5 pr-3 h-8.5 rounded-xl text-xs bg-muted/40"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="space-y-2 p-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2.5">
                <Skeleton className="size-11 rounded-xl shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length > 0 ? (
          filteredConversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeConversationId}
              onSelect={onSelectConversation}
            />
          ))
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground px-4">
            {filterText ? (
              "No conversations match your search."
            ) : (
              <div className="space-y-3">
                <p>No conversations yet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenNewChat}
                  className="rounded-xl text-xs gap-1.5"
                >
                  <Plus className="size-3.5" />
                  Start a conversation
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
