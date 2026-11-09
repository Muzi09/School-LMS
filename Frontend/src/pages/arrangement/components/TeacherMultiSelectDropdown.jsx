import React, { useState, useMemo } from "react"
import { Search, ChevronDown, Check, Users, UserCheck, X } from "lucide-react"
import { Popover, PopoverTrigger, PopoverDialog } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TEACHERS } from "../mockArrangementData"
import { cn } from "@/lib/utils"

export function TeacherMultiSelectDropdown({
  selectedTeacherIds = [],
  onToggleTeacher, // (teacherId) => void
  onSelectAll, // () => void
  onClearAll, // () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return TEACHERS
    const q = searchQuery.toLowerCase()
    return TEACHERS.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.department.toLowerCase().includes(q)
    )
  }, [searchQuery])

  // Get selected teachers objects
  const selectedTeachers = useMemo(() => {
    return TEACHERS.filter((t) => selectedTeacherIds.includes(t.id))
  }, [selectedTeacherIds])

  return (
    <PopoverTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "h-8 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs",
          isOpen
            ? "border-primary bg-primary/10 text-primary"
            : selectedTeacherIds.length > 0
            ? "border-border bg-background hover:bg-muted/60 text-foreground"
            : "border-dashed border-primary/50 text-primary hover:bg-primary/5"
        )}
      >
        <Users className="size-3.5 shrink-0 text-primary" />
        {selectedTeacherIds.length === 0 ? (
          <span className="font-semibold">+ Select Absent Teachers</span>
        ) : selectedTeacherIds.length === 1 ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate max-w-[140px] font-bold">
              {selectedTeachers[0]?.name}
            </span>
            <Badge variant="secondary" className="h-4.5 px-1.5 text-[10px] font-bold">
              1
            </Badge>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="font-bold">{selectedTeacherIds.length} Absent Teachers</span>
            <Badge variant="secondary" className="h-4.5 px-1.5 text-[10px] font-bold bg-primary/15 text-primary">
              {selectedTeacherIds.length}
            </Badge>
          </div>
        )}

        <ChevronDown className="size-3 text-muted-foreground ml-1 shrink-0" />
      </Button>

      <Popover
        placement="bottom start"
        className="w-88 p-2.5 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl z-50 space-y-2.5"
      >
        <PopoverDialog className="outline-hidden space-y-2">
          {/* Header & Quick Actions */}
          <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
            <div className="flex items-center gap-1.5">
              <UserCheck className="size-3.5 text-primary" />
              <span className="text-xs font-bold text-foreground">
                Mark Absent Teachers
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={onSelectAll}
                className="text-primary hover:underline font-semibold cursor-pointer"
              >
                Select All
              </button>
              <span className="text-border">|</span>
              <button
                type="button"
                onClick={onClearAll}
                className="text-muted-foreground hover:text-destructive font-semibold cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, subject, department..."
              className="pl-8 text-xs h-8 rounded-lg"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Teacher Selection List */}
          <div className="max-h-64 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
            {filteredTeachers.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No faculty matching "{searchQuery}"
              </div>
            ) : (
              filteredTeachers.map((teacher) => {
                const isSelected = selectedTeacherIds.includes(teacher.id)

                return (
                  <button
                    key={teacher.id}
                    type="button"
                    onClick={() => onToggleTeacher(teacher.id)}
                    className={cn(
                      "w-full text-left p-2 rounded-lg cursor-pointer flex items-center justify-between gap-2.5 transition-all text-xs border",
                      isSelected
                        ? "bg-primary/10 border-primary/40 text-foreground font-medium"
                        : "border-transparent hover:bg-muted/70 text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Checkbox Box */}
                      <div
                        className={cn(
                          "size-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/40 bg-background"
                        )}
                      >
                        {isSelected && <Check className="size-2.5 stroke-[3]" />}
                      </div>

                      <Avatar className="size-6 rounded-full shrink-0">
                        <AvatarImage src={teacher.avatar} alt={teacher.name} />
                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-bold">
                          {teacher.initials}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
                        <span className="font-bold truncate block text-xs">
                          {teacher.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate block">
                          {teacher.subject} • {teacher.department}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <Badge variant="outline" className="text-[9px] h-4.5 px-1.5 font-bold border-primary/30 text-primary bg-primary/5">
                        Selected
                      </Badge>
                    )}
                  </button>
                )
              })
            )}
          </div>

          {/* Popover Footer */}
          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {selectedTeacherIds.length} of {TEACHERS.length} teachers marked
            </span>
            <Button
              type="button"
              size="xs"
              variant="default"
              onClick={() => setIsOpen(false)}
              className="h-6.5 px-3 text-xs font-semibold rounded-md cursor-pointer"
            >
              Done
            </Button>
          </div>
        </PopoverDialog>
      </Popover>
    </PopoverTrigger>
  )
}

