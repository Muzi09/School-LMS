import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { GripVertical } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { moveItem } from "@/components/common/OrderButtons"
import { schoolConfigService } from "@/api/schoolConfigService"
import { cn } from "@/lib/utils"

export function StructureOrderDialog({ open, onOpenChange, wings, classes }) {
  const [level, setLevel] = useState("wings")
  const [wingId, setWingId] = useState("")
  const [classId, setClassId] = useState("")
  const [dragIndex, setDragIndex] = useState(null)
  const [dropIndex, setDropIndex] = useState(null)
  const queryClient = useQueryClient()
  const wing = wings.find(item => item.id === wingId) || wings[0]
  const schoolClass = classes.find(item => item.id === classId) || classes[0]
  const itemsByLevel = {
    wings,
    classes: wing ? classes.filter(item => item.wing_id === wing.id) : [],
    sections: schoolClass?.sections || [],
  }
  const items = itemsByLevel[level]
  const save = useMutation({
    mutationFn: (ids) => schoolConfigService.reorderStructure({
      wing: level === "classes" ? wing : null,
      schoolClass: level === "sections" ? schoolClass : null,
      ids,
    }),
    onSuccess: () => Promise.all(
      ["schoolConfig", "schoolClasses", "timetable"].map(key => queryClient.invalidateQueries({ queryKey: [key] })),
    ),
    onError: (error) => toast.error(error.message || "Failed to save display order."),
  })

  function clearDrag() {
    setDragIndex(null)
    setDropIndex(null)
  }

  function move(from, to) {
    if (from === to || save.isPending) return
    save.mutate(moveItem(items, from, to - from).map(item => item.id))
  }

  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange} className="gap-4 sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Set display order</DialogTitle>
        <DialogDescription>Drag a row by its handle or choose a position. Moves save automatically.</DialogDescription>
      </DialogHeader>

      <Tabs selectedKey={level} onSelectionChange={key => {
        clearDrag()
        save.reset()
        setLevel(key)
      }} isDisabled={save.isPending}>
        <TabsList aria-label="What to reorder" className="w-full">
          <TabsTrigger id="wings">Wings</TabsTrigger>
          <TabsTrigger id="classes">Classes</TabsTrigger>
          <TabsTrigger id="sections">Sections</TabsTrigger>
        </TabsList>
        <TabsContent key={level} id={level} className="space-y-3 pt-1">
          {level === "classes" && (
            <label className="grid gap-1.5 text-xs font-medium">
              Wing
              <select className="h-9 rounded-md border border-input bg-background px-2" value={wing?.id || ""}
                disabled={!wing || save.isPending} onChange={event => setWingId(event.target.value)}>
                {wings.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          )}
          {level === "sections" && (
            <label className="grid gap-1.5 text-xs font-medium">
              Class
              <select className="h-9 rounded-md border border-input bg-background px-2" value={schoolClass?.id || ""}
                disabled={!schoolClass || save.isPending} onChange={event => setClassId(event.target.value)}>
                {classes.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}{item.wing_name ? ` · ${item.wing_name}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {items.length ? (
            <div className="rounded-xl border">
              <div className="flex justify-between border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                <span className="capitalize">{level}</span>
                <span>Position</span>
              </div>
              <ol className="max-h-[45vh] divide-y overflow-auto">
                {items.map((item, index) => (
                  <li key={item.id}
                    className={cn("relative flex items-center gap-2 px-3 py-1.5",
                      dragIndex === index && "opacity-50",
                      dropIndex === index && dragIndex !== index && "after:absolute after:inset-x-0 after:h-0.5 after:bg-primary",
                      dragIndex > index ? "after:top-0" : "after:bottom-0",
                    )}
                    onDragOver={event => {
                      if (dragIndex === null) return
                      event.preventDefault()
                      event.dataTransfer.dropEffect = "move"
                      setDropIndex(index)
                    }}
                    onDrop={event => {
                      if (dragIndex === null) return
                      event.preventDefault()
                      move(dragIndex, index)
                      clearDrag()
                    }}>
                    <span aria-hidden="true" title={`Drag ${item.name}`} draggable={items.length > 1 && !save.isPending}
                      className="cursor-grab p-1 text-muted-foreground active:cursor-grabbing"
                      onDragStart={event => {
                        event.dataTransfer.effectAllowed = "move"
                        event.dataTransfer.setData("text/plain", item.id)
                        event.dataTransfer.setDragImage(event.currentTarget.parentElement, 12, 12)
                        setDragIndex(index)
                      }}
                      onDragEnd={clearDrag}>
                      <GripVertical className="pointer-events-none size-4" />
                    </span>
                    <span className="min-w-0 flex-1 break-words font-medium">{item.name}</span>
                    <select aria-label={`Position of ${item.name}`} value={index + 1}
                      disabled={items.length < 2 || save.isPending}
                      className="h-8 min-w-12 rounded-md border border-input bg-background px-1.5 text-sm tabular-nums"
                      onChange={event => move(index, Number(event.target.value) - 1)}>
                      {items.map((row, position) => <option key={row.id} value={position + 1}>{position + 1}</option>)}
                    </select>
                  </li>
                ))}
              </ol>
            </div>
          ) : <p className="rounded-xl border p-4 text-sm text-muted-foreground">No {level} to reorder.</p>}
          <p role="status" className="min-h-4 text-xs text-muted-foreground">
            {save.isPending ? "Saving order…" : save.isSuccess ? "Order saved" : ""}
          </p>
        </TabsContent>
      </Tabs>
    </Dialog>
  )
}
