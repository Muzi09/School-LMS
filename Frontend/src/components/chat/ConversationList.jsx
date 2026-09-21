import { useState, useMemo } from "react"
import {
  Search,
  Plus,
  WifiOff,
  RefreshCw,
  MessageSquare,
  Users,
  Megaphone,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { ConversationItem } from "./ConversationItem"

export function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenNewChat,
  onOpenNewGroup,
  onOpenNewBroadcast,
  isLoading,
  socketStatus,
  onRetryConnect,
  currentUserId,
}) {
  const [filterText, setFilterText] = useState("")
  const [typeFilter, setTypeFilter] = useState("ALL") // "ALL" | "DIRECT" | "GROUP" | "BROADCAST"

  const filteredConversations = useMemo(() => {
    let list = conversations || []

    // 1. Type filtering
    if (typeFilter !== "ALL") {
      list = list.filter((c) => {
        if (typeFilter === "DIRECT") return c.type === "DIRECT" || !c.type
        return c.type === typeFilter
      })
    }

    // 2. Search term filtering
    if (!filterText.trim()) return list
    const term = filterText.toLowerCase()

    return list.filter((c) => {
      const isDirect = c.type === "DIRECT" || !c.type
      const name = isDirect
        ? `${c.other_participant?.first_name || ""} ${c.other_participant?.last_name || ""}`.toLowerCase()
        : (c.name || "").toLowerCase()
      const lastMsg = (c.last_message?.content || "").toLowerCase()
      return name.includes(term) || lastMsg.includes(term)
    })
  }, [conversations, filterText, typeFilter])

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

          {/* New Chat Dropdown Menu */}
          <DropdownMenuTrigger>
            <Button
              size="sm"
              className="rounded-xl h-8 px-2.5 gap-1 font-medium shadow-xs"
            >
              <Plus className="size-4" />
              <span>New</span>
              <ChevronDown className="size-3 opacity-70" />
            </Button>
            <DropdownMenu className="w-48">
              <DropdownMenuItem onAction={onOpenNewChat} className="cursor-pointer gap-2">
                <MessageSquare className="size-4 text-primary" />
                <span>Direct Message</span>
              </DropdownMenuItem>
              <DropdownMenuItem onAction={onOpenNewGroup} className="cursor-pointer gap-2">
                <Users className="size-4 text-indigo-500" />
                <span>New Group</span>
              </DropdownMenuItem>
              <DropdownMenuItem onAction={onOpenNewBroadcast} className="cursor-pointer gap-2">
                <Megaphone className="size-4 text-amber-500" />
                <span>New Broadcast</span>
              </DropdownMenuItem>
            </DropdownMenu>
          </DropdownMenuTrigger>
        </div>
      </div>

      {/* Search Input & Category Filter Tabs */}
      <div className="p-3 border-b border-border/50 space-y-2">
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

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
          {[
            { id: "ALL", label: "All" },
            { id: "DIRECT", label: "Direct" },
            { id: "GROUP", label: "Groups" },
            { id: "BROADCAST", label: "Broadcasts" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTypeFilter(tab.id)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors shrink-0 cursor-pointer ${
                typeFilter === tab.id
                  ? "bg-primary/15 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
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
              currentUserId={currentUserId}
            />
          ))
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground px-4">
            {filterText || typeFilter !== "ALL" ? (
              <p>No conversations match your filter.</p>
            ) : (
              <div className="space-y-3">
                <p>No conversations yet.</p>
                <div className="flex flex-col gap-2 max-w-[200px] mx-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenNewChat}
                    className="rounded-xl text-xs gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    Start Direct Chat
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ConversationList
