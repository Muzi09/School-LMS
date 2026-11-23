import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import apiClient from "@/api/client"

export function RoomEditor({ section, subject, classLabel, allocated = true, onClose }) {
  const cache = useQueryClient()
  const current = subject ? section.room_overrides?.[subject.id] : section.room_number
  const [value, setValue] = useState(current || "")
  const review = section.room_reviews?.[subject?.id]
  const save = useMutation({
    mutationFn: room => apiClient.put(
      `/school/sections/${section.id}${subject ? "/subjects/" + subject.id : ""}/room`,
      { room_number: room.trim() || null },
    ),
    onSuccess: async () => {
      await Promise.all(["schoolConfig", "timetable"].map(key => cache.invalidateQueries({ queryKey: [key] })))
      onClose()
    },
  })
  const title = subject ? "Subject room" : "Section room"
  return <Dialog isOpen onOpenChange={open => { if (!open && !save.isPending) onClose() }} isDismissable={!save.isPending}>
    <DialogHeader><DialogTitle>{title}</DialogTitle>
      <p className="text-sm text-muted-foreground">{[classLabel, section.name, subject?.name].filter(Boolean).join(" · ")}</p>
    </DialogHeader>
    <form className="grid gap-4" onSubmit={event => { event.preventDefault(); if (!save.isPending) save.mutate(value) }}>
      {review && <div className="space-y-2">
        <p>Previously saved rooms</p>
        <div className="flex flex-wrap gap-2">{review.labels.map(label => allocated ?
          <Button key={label} variant="outline" size="sm" onPress={() => setValue(label)}>{label}</Button> :
          <span key={label}>{label}</span>)}</div>
      </div>}
      {allocated ? <label className="grid gap-1">{title}
        <Input value={value} onChange={e => setValue(e.target.value)} maxLength={16} placeholder="e.g. B-12" autoFocus />
      </label> : <p>Assign this subject to the section again to set a subject room.</p>}
      {subject && <p className="text-xs text-muted-foreground">Section room · {section.room_number || "Not assigned"}</p>}
      {save.isError && <p role="alert" className="text-destructive">{save.error.message}</p>}
      <DialogFooter>
        {subject && <Button type="button" variant="outline" isDisabled={save.isPending} onPress={() => save.mutate("")}>Use section room</Button>}
        {allocated && <Button type="submit" isDisabled={save.isPending}>Save room</Button>}
      </DialogFooter>
    </form>
  </Dialog>
}
