import { useState, useEffect } from "react"
import { Search, Loader2, Users, X, Check } from "lucide-react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { chatService } from "@/api/chatService"

export function CreateGroupModal({ isOpen, onOpenChange, onGroupCreated, currentUserId }) {
  const [name, setName] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  // Search directory as user types
  useEffect(() => {
    if (!isOpen) return

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await chatService.searchUsers(searchTerm)
        // Filter out current user from selection list
        const filtered = (results || []).filter((u) => u.id !== currentUserId)
        setSearchResults(filtered)
      } catch (err) {
        console.error("Failed to search users for group:", err)
      } finally {
        setIsSearching(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchTerm, isOpen, currentUserId])

  const handleOpenChange = (open) => {
    if (!open) {
      setName("")
      setSearchTerm("")
      setSearchResults([])
      setSelectedUsers([])
      setError("")
      setIsSubmitting(false)
    }
    onOpenChange(open)
  }

  const toggleUser = (user) => {
    setError("")
    if (selectedUsers.some((u) => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id))
    } else {
      setSelectedUsers([...selectedUsers, user])
    }
  }

  const removeUser = (userId) => {
    setSelectedUsers(selectedUsers.filter((u) => u.id !== userId))
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Please enter a group name.")
      return
    }
    if (trimmedName.length > 100) {
      setError("Group name must be 100 characters or less.")
      return
    }
    if (selectedUsers.length === 0) {
      setError("Please select at least one participant.")
      return
    }

    setIsSubmitting(true)
    setError("")
    try {
      const group = await chatService.createGroup({
        name: trimmedName,
        participant_ids: selectedUsers.map((u) => u.id),
      })
      onGroupCreated?.(group)
      handleOpenChange(false)
    } catch (err) {
      console.error("Failed to create group:", err)
      setError(err.response?.data?.detail || "Failed to create group. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={handleOpenChange} className="sm:max-w-lg">
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Users className="size-4" />
          </div>
          <div>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Collaborate and chat with multiple members in your school.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 my-2">
        {/* Group Name Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Group Name
          </label>
          <Input
            type="text"
            placeholder="e.g. Science Department, Grade 10 Teachers..."
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (error) setError("")
            }}
            maxLength={100}
            className="h-10 rounded-xl"
            autoFocus
          />
        </div>

        {/* Selected Participants Chips */}
        {selectedUsers.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Selected Participants ({selectedUsers.length})</span>
              <button
                type="button"
                onClick={() => setSelectedUsers([])}
                className="text-primary hover:underline cursor-pointer"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-muted/30 rounded-xl border border-border/50">
              {selectedUsers.map((u) => (
                <Badge
                  key={u.id}
                  variant="secondary"
                  className="pl-2 pr-1 py-1 h-7 rounded-lg gap-1.5 font-medium text-xs bg-background shadow-2xs border border-border/60"
                >
                  <span className="truncate max-w-[120px]">
                    {u.first_name} {u.last_name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeUser(u.id)
                    }}
                    className="size-4 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* User Search & Multi-Select List */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Add Participants
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search members by name or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 h-9.5 rounded-xl text-xs"
            />
          </div>

          <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto pr-1">
            {isSearching ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-xs">Searching members...</span>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((u) => {
                const isSelected = selectedUsers.some((sel) => sel.id === u.id)
                const initials = `${u.first_name?.[0] || ""}${u.last_name?.[0] || ""}`.toUpperCase()
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUser(u)}
                    className={`flex items-center gap-3 p-2 rounded-xl transition-all text-left w-full cursor-pointer ${
                      isSelected
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/70 border border-transparent"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="size-9 rounded-xl">
                        <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      {u.is_online && (
                        <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-medium text-foreground truncate">
                          {u.first_name} {u.last_name}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-normal">
                          {u.role_name || "Member"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {u.email || "LMS Member"}
                      </p>
                    </div>

                    <div
                      className={`size-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/30 bg-background"
                      }`}
                    >
                      {isSelected && <Check className="size-3.5 stroke-[3]" />}
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {searchTerm ? "No members found matching your search." : "Type to search school members."}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20">
            {error}
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !name.trim() || selectedUsers.length === 0}
            className="rounded-xl gap-1.5"
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            <span>Create Group ({selectedUsers.length})</span>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

export default CreateGroupModal
