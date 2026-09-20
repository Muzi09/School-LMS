import { MessageSquare, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

export function EmptyChatState({ onNewChat }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-background/50 select-none">
      <div className="flex items-center justify-center size-16 rounded-3xl bg-primary/10 text-primary mb-4 shadow-sm">
        <MessageSquare className="size-8" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-foreground mb-1">
        Select a conversation
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Choose a conversation from the sidebar or start a new 1-to-1 direct message with any teacher, student, or staff member.
      </p>
      {onNewChat && (
        <Button onClick={onNewChat} className="rounded-xl gap-2 font-medium">
          <Plus className="size-4" />
          New Conversation
        </Button>
      )}
    </div>
  )
}
