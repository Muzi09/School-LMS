import { useState } from "react"
import { BookOpen, Plus, Search, Edit2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function SubjectsPanel({
  subjects = [],
  classes = [],
  onAddSubject,
  onEditSubject,
  onDeleteSubject,
}) {
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState("all") // "all" | "academic" | "non_academic"

  const filteredSubjects = subjects.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.code && s.code.toLowerCase().includes(search.toLowerCase()))
    if (!matchesSearch) return false

    if (filterCategory === "academic") {
      return s.is_academic && s.category !== "non_academic"
    }
    if (filterCategory === "non_academic") {
      return !s.is_academic || s.category === "non_academic"
    }
    return true
  })

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Subjects Directory
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
              {subjects.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure school-wide curriculum, academic subjects, and co-curricular activities.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <Button
            onClick={onAddSubject}
            size="sm"
            className="h-8.5 text-xs font-semibold gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="size-3.5" /> Add Subject
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subjects..."
            className="h-9 pl-10 pr-3 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground rounded-xl"
          />
        </div>

        <div className="flex items-center gap-1 self-start sm:self-auto bg-muted/50 p-1 rounded-xl border border-border text-xs">
          <button
            type="button"
            onClick={() => setFilterCategory("all")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterCategory === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({subjects.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory("academic")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterCategory === "academic"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Academic
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory("non_academic")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterCategory === "non_academic"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Activities
          </button>
        </div>
      </div>

      {/* Subjects Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredSubjects.length === 0 ? (
          <div className="col-span-full py-8 text-center text-xs text-muted-foreground italic">
            No subjects match your query.
          </div>
        ) : (
          filteredSubjects.map((sub) => {
            const isActivity = !sub.is_academic || sub.category === "non_academic"
            const assignedCount = (sub.assigned_class_ids || []).length

            return (
              <div
                key={sub.id}
                className="group p-3.5 rounded-xl border border-border/80 bg-card hover:bg-accent/30 hover:border-border transition-all flex flex-col justify-between space-y-2 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="space-y-1 truncate">
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className={`size-2 rounded-full shrink-0 ${
                          isActivity ? "bg-amber-500" : "bg-primary"
                        }`}
                      />
                      <span className="text-xs font-bold text-foreground truncate" title={sub.name}>
                        {sub.name}
                      </span>
                    </div>
                    {sub.code && (
                      <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.2 rounded bg-muted">
                        {sub.code}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditSubject(sub)}
                      className="size-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
                      title="Edit Subject"
                    >
                      <Edit2 className="size-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSubject(sub)}
                      className="size-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center cursor-pointer"
                      title="Delete Subject"
                    >
                      <Trash2 className="size-2.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border/80 text-[10px]">
                  <span
                    className={`font-semibold uppercase tracking-wider ${
                      isActivity
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {isActivity ? "Activity" : "Academic"}
                  </span>
                  <span className="text-muted-foreground font-mono">
                    {assignedCount} / {classes.length} classes
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
