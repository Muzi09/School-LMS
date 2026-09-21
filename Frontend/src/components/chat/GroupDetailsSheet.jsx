import { useState, useEffect } from "react"
import {
  Users,
  Megaphone,
  UserPlus,
  UserMinus,
  LogOut,
  Edit2,
  Check,
  X,
  ShieldAlert,
  Crown,
  Search,
  Loader2,
} from "lucide-react"
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { chatService } from "@/api/chatService"

export function GroupDetailsSheet({
  isOpen,
  onOpenChange,
  conversation,
  currentUserId,
  onConversationUpdated,
  onLeaveSuccess,
}) {
  const [details, setDetails] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [newName, setNewName] = useState("")
  const [isSavingName, setIsSavingName] = useState(false)

  // Add participants sub-modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addSearchTerm, setAddSearchTerm] = useState("")
  const [addSearchResults, setAddSearchResults] = useState([])
  const [selectedToAdd, setSelectedToAdd] = useState([])
  const [isSearchingAdd, setIsSearchingAdd] = useState(false)
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false)

  // Leave group / Transfer ownership
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false)
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState("")
  const [isLeaving, setIsLeaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const isGroup = conversation?.type === "GROUP"
  const isBroadcast = conversation?.type === "BROADCAST"

  // Fetch complete details whenever sheet opens
  useEffect(() => {
    if (!isOpen || !conversation?.id || conversation.type === "DIRECT") return

    let isSubscribed = true

    // Fetch asynchronously without synchronous state call in body
    chatService
      .getConversationDetails(conversation.id)
      .then((data) => {
        if (isSubscribed) {
          setDetails(data)
          setNewName(data.name || "")
          setIsLoading(false)
        }
      })
      .catch((err) => {
        console.error("Failed to load conversation details:", err)
        if (isSubscribed) {
          setErrorMsg("Failed to load details.")
          setIsLoading(false)
        }
      })

    return () => {
      isSubscribed = false
    }
  }, [isOpen, conversation?.id, conversation?.type])

  const isAdmin =
    details?.created_by_id === currentUserId ||
    details?.participants?.some(
      (p) => p.user_id === currentUserId && p.role === "ADMIN"
    )

  // Save new name
  const handleSaveName = async () => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === details?.name) {
      setIsEditingName(false)
      return
    }

    setIsSavingName(true)
    try {
      const updated = await chatService.updateConversation(conversation.id, { name: trimmed })
      setDetails((prev) => ({ ...prev, name: updated.name }))
      setIsEditingName(false)
      onConversationUpdated?.(updated)
    } catch (err) {
      console.error("Failed to update name:", err)
      setErrorMsg("Failed to update conversation name.")
    } finally {
      setIsSavingName(false)
    }
  }

  // Search members to add
  useEffect(() => {
    if (!isAddModalOpen) return

    const timer = setTimeout(async () => {
      setIsSearchingAdd(true)
      try {
        const results = await chatService.searchUsers(addSearchTerm)
        // Filter out existing participants
        const existingIds = new Set(details?.participants?.map((p) => p.user_id) || [])
        const filtered = (results || []).filter((u) => !existingIds.has(u.id))
        setAddSearchResults(filtered)
      } catch (err) {
        console.error("Failed to search users:", err)
      } finally {
        setIsSearchingAdd(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [addSearchTerm, isAddModalOpen, details?.participants])

  // Submit adding participants
  const handleAddParticipantsSubmit = async () => {
    if (selectedToAdd.length === 0) return

    setIsSubmittingAdd(true)
    try {
      const updated = await chatService.addParticipants(
        conversation.id,
        selectedToAdd.map((u) => u.id)
      )
      setDetails(updated)
      setSelectedToAdd([])
      setIsAddModalOpen(false)
      onConversationUpdated?.(updated)
    } catch (err) {
      console.error("Failed to add participants:", err)
      setErrorMsg(err.response?.data?.detail || "Failed to add participants.")
    } finally {
      setIsSubmittingAdd(false)
    }
  }

  // Remove a participant
  const handleRemoveParticipant = async (userId) => {
    if (!window.confirm("Are you sure you want to remove this member?")) return

    try {
      const updated = await chatService.removeParticipant(conversation.id, userId)
      setDetails(updated)
      onConversationUpdated?.(updated)
    } catch (err) {
      console.error("Failed to remove participant:", err)
      setErrorMsg(err.response?.data?.detail || "Failed to remove member.")
    }
  }

  // Leave group
  const handleLeaveGroup = async () => {
    setIsLeaving(true)
    try {
      await chatService.leaveGroup(
        conversation.id,
        selectedNewOwnerId ? parseInt(selectedNewOwnerId) : null
      )
      setIsLeaveModalOpen(false)
      onOpenChange(false)
      onLeaveSuccess?.(conversation.id)
    } catch (err) {
      console.error("Failed to leave group:", err)
      setErrorMsg(err.response?.data?.detail || "Failed to leave group.")
    } finally {
      setIsLeaving(false)
    }
  }

  const otherMembersForTransfer =
    details?.participants?.filter((p) => p.user_id !== currentUserId) || []

  return (
    <>
      <Sheet isOpen={isOpen} onOpenChange={onOpenChange} side="right" className="sm:max-w-md w-full">
        <SheetHeader className="border-b border-border/80 pb-4">
          <div className="flex items-center gap-2">
            <div
              className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${
                isBroadcast
                  ? "bg-amber-500/10 text-amber-500"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {isBroadcast ? <Megaphone className="size-5" /> : <Users className="size-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-semibold truncate">
                {isBroadcast ? "Broadcast Channel" : "Group Details"}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {isBroadcast
                  ? "One-way announcement channel"
                  : `${details?.participants?.length || 0} participants`}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-sm">Loading details...</span>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20 flex items-center justify-between">
                  <span>{errorMsg}</span>
                  <button
                    type="button"
                    onClick={() => setErrorMsg("")}
                    className="size-4 hover:opacity-75"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )}

              {/* Group Name & Rename */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {isBroadcast ? "Channel Name" : "Group Name"}
                  </span>
                  {isAdmin && !isEditingName && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setIsEditingName(true)}
                      className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                      title="Rename"
                    >
                      <Edit2 className="size-3.5" />
                    </Button>
                  )}
                </div>

                {isEditingName ? (
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      maxLength={100}
                      className="h-8.5 rounded-xl text-sm"
                      autoFocus
                    />
                    <Button
                      size="icon-sm"
                      onClick={handleSaveName}
                      disabled={isSavingName || !newName.trim()}
                      className="size-8.5 rounded-xl shrink-0"
                    >
                      {isSavingName ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setNewName(details?.name || "")
                        setIsEditingName(false)
                      }}
                      className="size-8.5 rounded-xl shrink-0"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-base font-bold text-foreground break-words">
                    {details?.name || "Untitled"}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-medium">
                    {details?.type}
                  </Badge>
                  <span>
                    Created by {details?.creator?.first_name} {details?.creator?.last_name}
                  </span>
                </div>
              </div>

              {/* Participant Roster */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      {isBroadcast ? "Recipients" : "Participants"} (
                      {details?.participants?.length || 0})
                    </h4>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddModalOpen(true)}
                      className="rounded-xl h-8 px-2.5 text-xs gap-1.5 font-medium"
                    >
                      <UserPlus className="size-3.5" />
                      <span>Add</span>
                    </Button>
                  )}
                </div>

                <div className="space-y-1 divide-y divide-border/40">
                  {details?.participants?.map((p) => {
                    const u = p.user
                    const initials = `${u?.first_name?.[0] || ""}${u?.last_name?.[0] || ""}`.toUpperCase()
                    const isMemberAdmin = p.role === "ADMIN"
                    const isSelf = p.user_id === currentUserId

                    return (
                      <div
                        key={p.user_id}
                        className="flex items-center justify-between gap-3 py-2.5 px-2 rounded-xl hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <Avatar className="size-9 rounded-xl">
                              <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-xs">
                                {initials || "U"}
                              </AvatarFallback>
                            </Avatar>
                            {u?.is_online && (
                              <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                            )}
                          </div>

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-foreground truncate">
                                {u?.first_name} {u?.last_name}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  (You)
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground truncate">
                              {u?.role_name || u?.email || "Member"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isMemberAdmin && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 h-5 font-semibold gap-1 text-primary bg-primary/10 border-primary/20"
                            >
                              <Crown className="size-2.5" />
                              Admin
                            </Badge>
                          )}

                          {isAdmin && !isSelf && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleRemoveParticipant(p.user_id)}
                              title="Remove member"
                              className="size-7 rounded-lg text-destructive/70 hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                            >
                              <UserMinus className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Leave Group Action (Group only) */}
              {isGroup && (
                <div className="pt-4 border-t border-border/60">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (isAdmin && otherMembersForTransfer.length > 0) {
                        setSelectedNewOwnerId(String(otherMembersForTransfer[0].user_id))
                      }
                      setIsLeaveModalOpen(true)
                    }}
                    className="w-full rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 gap-2 h-10"
                  >
                    <LogOut className="size-4" />
                    <span>Leave Group</span>
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Sheet>

      {/* Add Participants Sub-Dialog */}
      <Dialog
        isOpen={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Add Members</DialogTitle>
          <DialogDescription>
            Search and select school members to add to {details?.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-2">
          {selectedToAdd.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-1 bg-muted/30 rounded-xl border border-border/50">
              {selectedToAdd.map((u) => (
                <Badge
                  key={u.id}
                  variant="secondary"
                  className="pl-2 pr-1 py-1 h-6 rounded-lg gap-1 text-xs"
                >
                  <span className="truncate max-w-[100px]">
                    {u.first_name} {u.last_name}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedToAdd(selectedToAdd.filter((sel) => sel.id !== u.id))
                    }
                    className="size-3.5 flex items-center justify-center hover:opacity-75"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search members to add..."
              value={addSearchTerm}
              onChange={(e) => setAddSearchTerm(e.target.value)}
              className="pl-9 pr-4 h-9.5 rounded-xl text-xs"
            />
          </div>

          <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto pr-1">
            {isSearchingAdd ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-xs">Searching directory...</span>
              </div>
            ) : addSearchResults.length > 0 ? (
              addSearchResults.map((u) => {
                const isSelected = selectedToAdd.some((sel) => sel.id === u.id)
                const initials = `${u.first_name?.[0] || ""}${u.last_name?.[0] || ""}`.toUpperCase()
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedToAdd(selectedToAdd.filter((sel) => sel.id !== u.id))
                      } else {
                        setSelectedToAdd([...selectedToAdd, u])
                      }
                    }}
                    className={`flex items-center gap-3 p-2 rounded-xl transition-all text-left w-full cursor-pointer ${
                      isSelected
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/70 border border-transparent"
                    }`}
                  >
                    <Avatar className="size-8 rounded-xl shrink-0">
                      <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {u.first_name} {u.last_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {u.role_name || u.email}
                      </p>
                    </div>
                    <div
                      className={`size-4.5 rounded-md border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/30 bg-background"
                      }`}
                    >
                      {isSelected && <Check className="size-3 stroke-[3]" />}
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {addSearchTerm ? "No matching members found." : "Type to search members."}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsAddModalOpen(false)}
            disabled={isSubmittingAdd}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAddParticipantsSubmit}
            disabled={isSubmittingAdd || selectedToAdd.length === 0}
            className="rounded-xl gap-1.5"
          >
            {isSubmittingAdd && <Loader2 className="size-4 animate-spin" />}
            <span>Add Selected ({selectedToAdd.length})</span>
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Leave Group Dialog */}
      <Dialog
        isOpen={isLeaveModalOpen}
        onOpenChange={setIsLeaveModalOpen}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="size-5" />
            <DialogTitle>Leave Group</DialogTitle>
          </div>
          <DialogDescription>
            {isAdmin && otherMembersForTransfer.length > 0
              ? "You are the Group Admin. Please choose a new group admin before leaving."
              : "Are you sure you want to leave this group? You will no longer receive new messages."}
          </DialogDescription>
        </DialogHeader>

        {isAdmin && otherMembersForTransfer.length > 0 && (
          <div className="space-y-2 my-2">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Transfer Ownership To
            </label>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {otherMembersForTransfer.map((p) => {
                const u = p.user
                const isSelected = String(p.user_id) === String(selectedNewOwnerId)
                return (
                  <button
                    key={p.user_id}
                    type="button"
                    onClick={() => setSelectedNewOwnerId(String(p.user_id))}
                    className={`flex items-center justify-between w-full p-2 rounded-xl text-left cursor-pointer transition-all ${
                      isSelected
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/70 border border-transparent"
                    }`}
                  >
                    <span className="text-xs font-medium text-foreground">
                      {u?.first_name} {u?.last_name}
                    </span>
                    {isSelected && <Check className="size-4 text-primary" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsLeaveModalOpen(false)}
            disabled={isLeaving}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleLeaveGroup}
            disabled={
              isLeaving ||
              (isAdmin && otherMembersForTransfer.length > 0 && !selectedNewOwnerId)
            }
            className="rounded-xl gap-1.5"
          >
            {isLeaving && <Loader2 className="size-4 animate-spin" />}
            <span>Confirm & Leave</span>
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}

export default GroupDetailsSheet
