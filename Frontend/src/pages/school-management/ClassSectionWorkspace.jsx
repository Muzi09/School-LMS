import { useState, useMemo } from "react"
import {
  GraduationCap,
  Trash2,
  Plus,
  Edit2,
  UserPlus,
  BookOpen,
  ArrowLeftRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import { InlineEditInput } from "./InlineEditInput"

const SUBJECT_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-cyan-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-pink-500",
  "bg-amber-500",
  "bg-indigo-500",
]

function SingleClassCard({
  schoolClass,
  wings = [],
  teachers = [],
  onRenameClass,
  onDeleteClass,
  onOpenChangeWing,
  onAddSection,
  onRenameSection,
  onDeleteSection,
  onManageSubjectsForSection,
  onAssignClassTeacher,
  onAssignSubjectTeacher,
}) {
  const [isRenamingClass, setIsRenamingClass] = useState(false)
  const [renamedClassName, setRenamedClassName] = useState("")

  const [editingSectionId, setEditingSectionId] = useState(null)
  const [editingSectionName, setEditingSectionName] = useState("")

  const teacherComboboxOptions = useMemo(() => {
    return [
      {
        value: "",
        label: "Unassigned",
        description: "No teacher assigned",
      },
      ...teachers.map((tch) => ({
        value: String(tch.id),
        label: tch.name,
        description: tch.department
          ? `${tch.department}${tch.designation ? ` • ${tch.designation}` : ""}`
          : (tch.email || null),
      })),
    ]
  }, [teachers])

  const handleStartRenameClass = () => {
    setIsRenamingClass(true)
    setRenamedClassName(schoolClass.name)
  }

  const handleSaveRenameClass = () => {
    const trimmed = renamedClassName.trim()
    if (trimmed && trimmed !== schoolClass.name) {
      onRenameClass(schoolClass.id, trimmed)
    }
    setIsRenamingClass(false)
  }

  const handleStartRenameSection = (sec) => {
    setEditingSectionId(sec.id)
    setEditingSectionName(sec.name)
  }

  const handleSaveRenameSection = (sec) => {
    const trimmed = editingSectionName.trim()
    if (trimmed && trimmed !== sec.name) {
      onRenameSection(schoolClass.id, sec.id, trimmed)
    }
    setEditingSectionId(null)
  }

  // Always maintain strict, deterministic natural section order so cards never jump around
  const sections = useMemo(() => {
    const list = [...(schoolClass.sections || [])]
    return list.sort((a, b) => {
      const nameCompare = (a.name || "").localeCompare(b.name || "", undefined, {
        numeric: true,
        sensitivity: "base",
      })
      if (nameCompare !== 0) return nameCompare
      if (a.created_at && b.created_at) {
        return new Date(a.created_at) - new Date(b.created_at)
      }
      return String(a.id || "").localeCompare(String(b.id || ""))
    })
  }, [schoolClass.sections])

  const currentWing = wings.find((w) => w.id === schoolClass.wing_id)

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xs">
      {/* Header: Class Name, Wing Badge & Edit/Delete on Left; Sections Count & Add Section on Right */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
        {/* Left Side: Class Name, Edit/Delete, and Wing Badge Button */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {isRenamingClass ? (
            <InlineEditInput
              value={renamedClassName}
              onChange={setRenamedClassName}
              onSave={handleSaveRenameClass}
              onCancel={() => setIsRenamingClass(false)}
              placeholder="Class name..."
              saveTitle="Save name"
              className="w-48 sm:w-56"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">
                {schoolClass.name}
              </h3>
              <button
                type="button"
                onClick={handleStartRenameClass}
                className="size-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
                title="Rename Class"
              >
                <Edit2 className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => onDeleteClass(schoolClass)}
                className="size-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center cursor-pointer"
                title="Delete Class"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          )}

          {/* Wing Badge Button - Click to change/unassign wing */}
          <button
            type="button"
            onClick={() => onOpenChangeWing?.(schoolClass)}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-muted hover:bg-accent text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer"
            title="Click to reassign to another wing or unassign"
          >
            <span className="size-1.5 rounded-full bg-primary" />
            <span>{currentWing ? currentWing.name : "Unassigned Wing"}</span>
            <ArrowLeftRight className="size-2.5 ml-0.5 text-muted-foreground" />
          </button>
        </div>

        {/* Right Side: Sections Count Chip & Add Section Button */}
        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold text-muted-foreground bg-muted border border-border">
            {sections.length} {sections.length === 1 ? "section" : "sections"}
          </span>

          <Button
            onClick={() => onAddSection(schoolClass)}
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="size-3.5" /> Add Section
          </Button>
        </div>
      </div>

      {/* Sections Cards - Take available width with proper max width */}
      <div className="flex flex-wrap gap-4 items-stretch">
        {sections.length === 0 ? (
          <div className="w-full py-6 px-4 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground">
            No sections configured for {schoolClass.name}. Click &quot;Add Section&quot; to create one.
          </div>
        ) : (
          sections.map((sec) => {
            const isEditingThisSection = editingSectionId === sec.id
            const sectionSubjects = sec.subjects || schoolClass.subjects || []
            const hasClassTeacher = Boolean(sec.class_teacher || sec.class_teacher_id)
            const classTeacherName = sec.class_teacher?.name || (sec.class_teacher_id ? "Assigned Staff" : "")
            const classTeacherSubtitle = sec.class_teacher?.designation || sec.class_teacher?.department || "Class Teacher"

            return (
              <div
                key={sec.id}
                className="flex-1 min-w-[280px] max-w-[360px] p-4 rounded-xl border border-border bg-card space-y-3 shadow-xs flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Section Title Header */}
                  <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-border/80">
                    {isEditingThisSection ? (
                      <InlineEditInput
                        value={editingSectionName}
                        onChange={setEditingSectionName}
                        onSave={() => handleSaveRenameSection(sec)}
                        onCancel={() => setEditingSectionId(null)}
                        placeholder="Section name..."
                        saveTitle="Save section"
                        autoFocus
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                            Section {sec.name}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.2 rounded bg-muted font-bold">
                            {sectionSubjects.length}
                          </span>
                        </div>

                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleStartRenameSection(sec)}
                            className="size-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
                            title="Rename Section"
                          >
                            <Edit2 className="size-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSection(schoolClass.id, sec)}
                            className="size-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center cursor-pointer"
                            title="Delete Section"
                          >
                            <Trash2 className="size-2.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* CLASS TEACHER Card */}
                  <div className="p-3 rounded-xl border border-border/80 bg-muted/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <GraduationCap className="size-3.5 text-primary" />
                        <span>Class Teacher</span>
                      </div>
                      {hasClassTeacher ? (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Assigned
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAssignClassTeacher?.(schoolClass, sec)}
                          className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer"
                          title="Click to assign class teacher"
                        >
                          Unassigned
                        </button>
                      )}
                    </div>

                    {hasClassTeacher ? (
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <div className="flex items-center gap-2 truncate min-w-0">
                          <div className="size-7 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                            {classTeacherName.charAt(0).toUpperCase() || "T"}
                          </div>
                          <div className="truncate min-w-0">
                            <div className="text-xs font-semibold text-foreground truncate" title={classTeacherName}>
                              {classTeacherName}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">{classTeacherSubtitle}</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onAssignClassTeacher?.(schoolClass, sec)}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted hover:bg-accent text-foreground border border-border transition-colors cursor-pointer shrink-0"
                        >
                          Manage
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAssignClassTeacher?.(schoolClass, sec)}
                        className="w-full text-left p-2 rounded-lg border border-dashed border-border/80 hover:border-primary/50 hover:bg-primary/5 transition-all group cursor-pointer flex items-center gap-2"
                      >
                        <div className="size-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-colors shrink-0">
                          <UserPlus className="size-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-muted-foreground group-hover:text-primary transition-colors leading-tight">
                            Class teacher not assigned. Click to assign.
                          </div>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* SUBJECTS Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-foreground">
                      <span>SUBJECTS ({sectionSubjects.length})</span>
                      <button
                        type="button"
                        onClick={() => onManageSubjectsForSection(schoolClass, { ...sec, subjects: sectionSubjects })}
                        className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                      >
                        Manage
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto scrollbar-thin pr-0.5">
                      {sectionSubjects.length === 0 ? (
                        <div className="text-[11px] text-muted-foreground italic py-2 text-center">
                          No subjects assigned
                        </div>
                      ) : (
                        sectionSubjects.map((sub, sIdx) => {
                          const dotColor = SUBJECT_COLORS[sIdx % SUBJECT_COLORS.length]
                          const isActivity = !sub.is_academic || sub.category === "non_academic"
                          const assignedTeacherId = sub.teacher_id || sub.teacher?.id || ""
                          const subjectTeacherOptions =
                            assignedTeacherId &&
                            !teacherComboboxOptions.some((o) => o.value === String(assignedTeacherId))
                              ? [
                                  ...teacherComboboxOptions,
                                  {
                                    value: String(assignedTeacherId),
                                    label: sub.teacher?.name || "Assigned Teacher",
                                    description: sub.teacher?.designation || null,
                                  },
                                ]
                              : teacherComboboxOptions

                          return (
                            <div
                              key={sub.id || sIdx}
                              data-subject-card
                              className="px-2.5 py-1.5 rounded-lg border border-border/70 bg-background hover:bg-accent/40 flex items-center justify-between gap-1.5 transition-colors relative"
                            >
                              <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                                <span className={`size-1.5 rounded-full ${dotColor} shrink-0`} />
                                <span className="text-xs font-medium text-foreground truncate" title={sub.name}>
                                  {sub.name}
                                </span>
                                {isActivity && (
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 rounded shrink-0">
                                    Activity
                                  </span>
                                )}
                              </div>

                              <div className="shrink-0 max-w-[130px]">
                                <Combobox
                                  value={assignedTeacherId ? String(assignedTeacherId) : ""}
                                  onValueChange={(newVal) =>
                                    onAssignSubjectTeacher?.(sec.id, sub.id, newVal ? newVal : null)
                                  }
                                  options={subjectTeacherOptions}
                                  placeholder="Assign"
                                  clearable={true}
                                  showDescriptionInTrigger={false}
                                  anchorSelector="[data-subject-card]"
                                  className="h-6 text-[10px] px-2 py-0 rounded font-medium border-border/70 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground font-mono w-auto min-w-[72px]"
                                  popoverClassName="max-h-56 shadow-xl"
                                />
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export function ClassSectionWorkspace({
  classes = [],
  wings = [],
  teachers = [],
  onAddClass,
  onRenameClass,
  onDeleteClass,
  onOpenChangeWing,
  onAddSection,
  onRenameSection,
  onDeleteSection,
  onManageSubjectsForSection,
  onAssignClassTeacher,
  onAssignSubjectTeacher,
}) {
  if (classes.length === 0) {
    return (
      <div className="p-8 rounded-2xl border border-border bg-card text-center space-y-3 shadow-xs">
        <BookOpen className="size-10 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">No classes associated with this wing yet.</p>
        <Button onClick={onAddClass} size="sm" className="cursor-pointer">
          <Plus className="size-3.5 mr-1" /> Add Class
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {classes.map((cls) => (
        <SingleClassCard
          key={cls.id}
          schoolClass={cls}
          wings={wings}
          teachers={teachers}
          onRenameClass={onRenameClass}
          onDeleteClass={onDeleteClass}
          onOpenChangeWing={onOpenChangeWing}
          onAddSection={onAddSection}
          onRenameSection={onRenameSection}
          onDeleteSection={onDeleteSection}
          onManageSubjectsForSection={onManageSubjectsForSection}
          onAssignClassTeacher={onAssignClassTeacher}
          onAssignSubjectTeacher={onAssignSubjectTeacher}
        />
      ))}
    </div>
  )
}
