import { useState, useEffect } from "react"
import { Search, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { chatService } from "@/api/chatService"

export function UserSearchModal({ isOpen, onOpenChange, onSelectUser }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const results = await chatService.searchUsers(searchTerm)
        setUsers(results || [])
      } catch (err) {
        console.error("Failed to search users:", err)
      } finally {
        setIsLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchTerm, isOpen])

  const handleOpenChange = (open) => {
    if (!open) {
      setSearchTerm("")
      setUsers([])
    }
    onOpenChange(open)
  }

  const handleSelect = (user) => {
    onSelectUser(user)
    handleOpenChange(false)
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={handleOpenChange} className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Start a Conversation</DialogTitle>
        <DialogDescription>
          Search for teachers, students, or staff members in your school.
        </DialogDescription>
      </DialogHeader>

      <div className="relative my-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="Search by name, email, or mobile..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 pr-4 h-10 rounded-xl"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1 max-h-[340px] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Searching directory...</span>
          </div>
        ) : users.length > 0 ? (
          users.map((u) => {
            const initials = `${u.first_name?.[0] || ""}${u.last_name?.[0] || ""}`.toUpperCase()
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => handleSelect(u)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/70 transition-colors text-left group w-full cursor-pointer focus:outline-hidden focus:bg-muted"
              >
                <div className="relative">
                  <Avatar className="size-10 rounded-xl">
                    <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {u.is_online && (
                    <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {u.first_name} {u.last_name}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-normal">
                      {u.role_name || "Member"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {u.email || "LMS Member"}
                  </p>
                </div>
              </button>
            )
          })
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {searchTerm ? "No users found matching your search." : "Type to search school members."}
          </div>
        )}
      </div>
    </Dialog>
  )
}
