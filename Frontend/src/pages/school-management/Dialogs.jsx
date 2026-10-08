import { useState, useMemo, useEffect, useRef } from "react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Combobox } from "@/components/ui/combobox"
import {
  AlertCircle,
  Trash2,
  Check,
  Search,
  GraduationCap,
  X,
  BookOpen,
  Award,
  Plus,
  ArrowRightLeft,
  Edit2,
  Combine,
  Split,
} from "lucide-react"
import { toast } from "sonner"
import { schoolConfigService } from "@/api/schoolConfigService"
import { CURATED_HOUSE_PALETTE } from "@/constants"
import { InlineEditInput } from "./InlineEditInput"

// ==============================================================
// 1. Add Class Dialog
// ==============================================================
function AddClassForm({ onClose, onAddClass, wings = [] }) {
  const [name, setName] = useState("")
  const [wingId, setWingId] = useState("")
  const [sections, setSections] = useState([])
  const [isAddingSection, setIsAddingSection] = useState(true)
  const [newSectionName, setNewSectionName] = useState("")
  const [editingIndex, setEditingIndex] = useState(null)
  const [editingName, setEditingName] = useState("")
  const [sameForAllSections, setSameForAllSections] = useState(true)
  const [focusSectionInput, setFocusSectionInput] = useState(false)

  const classNameInputRef = useRef(null)

  useEffect(() => {
    // Focus Class Name field when the modal opens
    const timer = setTimeout(() => {
      classNameInputRef.current?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const wingOptions = useMemo(() => {
    return [
      { value: "", label: "Unassigned (No Wing)" },
      ...wings.map((w) => ({
        value: String(w.id),
        label: w.name,
      })),
    ]
  }, [wings])

  const handleSaveNewSection = () => {
    const trimmed = newSectionName.trim()
    if (!trimmed) return
    if (sections.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`Section '${trimmed}' is already added.`)
      return
    }
    setSections((prev) => [...prev, trimmed])
    setNewSectionName("")
    setIsAddingSection(false)
  }

  const handleStartEdit = (idx) => {
    setEditingIndex(idx)
    setEditingName(sections[idx])
  }

  const handleSaveEdit = (idx) => {
    const trimmed = editingName.trim()
    if (!trimmed) return
    if (sections.some((s, i) => i !== idx && s.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`Section '${trimmed}' already exists.`)
      return
    }
    setSections((prev) => prev.map((s, i) => (i === idx ? trimmed : s)))
    setEditingIndex(null)
    setEditingName("")
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setEditingName("")
  }

  const handleRemoveSection = (idxToRemove) => {
    if (editingIndex === idxToRemove) {
      handleCancelEdit()
    }
    setSections((prev) => prev.filter((_, idx) => idx !== idxToRemove))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return

    let finalSections = [...sections]

    // If currently editing a section when submitting, commit edit
    if (editingIndex !== null && editingName.trim()) {
      const trimmed = editingName.trim()
      if (!finalSections.some((s, i) => i !== editingIndex && s.toLowerCase() === trimmed.toLowerCase())) {
        finalSections[editingIndex] = trimmed
      }
    }

    // If new section name is pending in input, include it
    const pendingSection = newSectionName.trim()
    if (
      pendingSection &&
      !finalSections.some((s) => s.toLowerCase() === pendingSection.toLowerCase())
    ) {
      finalSections.push(pendingSection)
    }

    if (finalSections.length === 0) {
      toast.error("Please add at least one section for this class.")
      return
    }

    onAddClass({
      name: name.trim(),
      wing_id: wingId || null,
      initial_sections: finalSections,
      same_for_all_sections: sameForAllSections,
    })
    onClose()
  }

  return (
    <>
      <div className="flex flex-col gap-1 pb-1">
        <h3 className="text-base font-bold text-foreground">Add New Class</h3>
        <p className="text-xs text-muted-foreground">
          Create an academic class and optionally place it into an academic wing.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">Class Name</label>
          <Input
            ref={classNameInputRef}
            id="class-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Class 1, Grade 10"
            className="h-10 text-sm rounded-xl px-3.5"
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="class-wing-select" className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">
            Wing Assignment (Optional)
          </label>
          <Combobox
            id="class-wing-select"
            name="wing_id"
            options={wingOptions}
            value={wingId ? String(wingId) : ""}
            onValueChange={(val) => setWingId(val || "")}
            placeholder="Select an academic wing"
            className="w-full h-10 text-sm rounded-xl bg-background border border-border"
            
          />
        </div>

        {/* Same for All Sections Checkbox */}
        <label className="flex items-center gap-2 cursor-pointer select-none group py-0.5">
          <input
            type="checkbox"
            checked={sameForAllSections}
            onChange={(e) => setSameForAllSections(e.target.checked)}
            className="size-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
          />
          <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
            Same for all sections (sections share same subjects)
          </span>
        </label>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">
              Sections {sections.length > 0 && `(${sections.length})`}
            </label>
            {!isAddingSection && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => {
                  setIsAddingSection(true)
                  setFocusSectionInput(true)
                  setNewSectionName("")
                }}
                className="h-7 text-xs gap-1 font-semibold cursor-pointer shadow-2xs"
              >
                <Plus className="size-3" /> Add Section
              </Button>
            )}
          </div>

          {/* List of sections displayed as rows */}
          {sections.length > 0 && (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-0.5">
              {sections.map((secName, idx) => {
                const isEditing = editingIndex === idx

                if (isEditing) {
                  return (
                    <InlineEditInput
                      key={idx}
                      value={editingName}
                      onChange={setEditingName}
                      onSave={() => handleSaveEdit(idx)}
                      onCancel={handleCancelEdit}
                      placeholder="Section name..."
                      saveTitle="Save section"
                      disableSave={!editingName.trim()}
                      autoFocus
                    />
                  )
                }

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted/30 transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="size-7 rounded-lg bg-primary/10 border border-primary/20 text-primary font-mono font-bold text-xs flex items-center justify-center shrink-0">
                        {secName}
                      </span>
                      <span className="text-xs sm:text-sm font-medium text-foreground truncate">
                        Section {secName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(idx)}
                        className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer transition-colors"
                        title="Edit section"
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveSection(idx)}
                        className="size-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center cursor-pointer transition-colors"
                        title="Delete section"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Empty state when no sections created yet and add input is closed */}
          {sections.length === 0 && !isAddingSection && (
            <div className="p-3.5 rounded-xl border border-dashed border-border text-center bg-muted/20 space-y-2">
              <p className="text-xs text-muted-foreground">
                No sections added yet. A class requires at least one section.
              </p>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => {
                  setIsAddingSection(true)
                  setFocusSectionInput(true)
                  setNewSectionName("")
                }}
                className="h-7 text-xs gap-1.5 font-medium rounded-lg cursor-pointer mx-auto"
              >
                <Plus className="size-3" /> Add First Section
              </Button>
            </div>
          )}

          {/* Add Section row */}
          {isAddingSection && (
            <InlineEditInput
              value={newSectionName}
              onChange={setNewSectionName}
              onSave={handleSaveNewSection}
              onCancel={() => {
                setIsAddingSection(false)
                setFocusSectionInput(false)
                setNewSectionName("")
              }}
              placeholder="Section name"
              saveTitle="Add section"
              disableSave={!newSectionName.trim()}
              autoFocus={focusSectionInput}
            />
          )}
        </div>

        <div className="pt-2 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-10 px-5 text-sm font-medium rounded-xl cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!name.trim() || (sections.length === 0 && !newSectionName.trim())}
            className="h-10 px-6 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
          >
            Add Class
          </Button>
        </div>
      </form>
    </>
  )
}

export function AddClassDialog({ isOpen, onClose, onAddClass, wings = [] }) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl z-10 flex flex-col p-6 animate-in fade-in-0 zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </button>
        <AddClassForm onClose={onClose} onAddClass={onAddClass} wings={wings} />
      </div>
    </div>
  )
}

// ==============================================================
// 2. Add Section Dialog
// ==============================================================
function AddSectionForm({ onClose, onAddSection, targetClass }) {
  const [sections, setSections] = useState([])
  const [isAddingSection, setIsAddingSection] = useState(true)
  const [newSectionName, setNewSectionName] = useState("")

  const existingSectionNames = useMemo(() => {
    return (targetClass?.sections || []).map((s) => s.name)
  }, [targetClass?.sections])

  const handleSaveNewSection = () => {
    const trimmed = newSectionName.trim()
    if (!trimmed) return
    if (
      existingSectionNames.some((s) => s.toLowerCase() === trimmed.toLowerCase()) ||
      sections.some((s) => s.toLowerCase() === trimmed.toLowerCase())
    ) {
      toast.error(`Section '${trimmed}' already exists in ${targetClass?.name}.`)
      return
    }
    setSections((prev) => [...prev, trimmed])
    setNewSectionName("")
  }

  const handleRemoveSection = (idxToRemove) => {
    setSections((prev) => prev.filter((_, idx) => idx !== idxToRemove))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!targetClass) return

    let finalSections = [...sections]
    const pendingSection = newSectionName.trim()
    if (
      pendingSection &&
      !existingSectionNames.some((s) => s.toLowerCase() === pendingSection.toLowerCase()) &&
      !finalSections.some((s) => s.toLowerCase() === pendingSection.toLowerCase())
    ) {
      finalSections.push(pendingSection)
    }

    if (finalSections.length === 0) {
      toast.error("Please add at least one section.")
      return
    }

    finalSections.forEach((secName) => {
      onAddSection(targetClass.id, { name: secName })
    })
    onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base font-bold">Add Section</DialogTitle>
        <DialogDescription className="text-xs">
          Add one or more sections to {targetClass?.name}.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        {existingSectionNames.length > 0 && (
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Current Sections
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {existingSectionNames.map((s, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-muted text-muted-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">
              New Sections to Create {sections.length > 0 && `(${sections.length})`}
            </label>
            {!isAddingSection && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => {
                  setIsAddingSection(true)
                  setNewSectionName("")
                }}
                className="h-7 text-xs gap-1 font-semibold cursor-pointer shadow-2xs"
              >
                <Plus className="size-3" /> Add
              </Button>
            )}
          </div>

          {/* List of new sections */}
          {sections.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-border bg-muted/20 items-center">
              {sections.map((secName, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-background border border-primary/30 text-primary shadow-2xs"
                >
                  <span className="font-mono">{secName}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSection(idx)}
                    className="size-3.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center cursor-pointer transition-colors"
                    title="Remove section"
                  >
                    <X className="size-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Add Section row */}
          {isAddingSection && (
            <InlineEditInput
              value={newSectionName}
              onChange={setNewSectionName}
              onSave={handleSaveNewSection}
              onCancel={() => {
                setIsAddingSection(false)
                setNewSectionName("")
              }}
              placeholder="Section name"
              saveTitle="Add section"
              disableSave={!newSectionName.trim()}
              autoFocus
            />
          )}
        </div>

        <DialogFooter className="pt-2 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-10 px-5 text-sm font-medium rounded-xl cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={sections.length === 0 && !newSectionName.trim()}
            className="h-10 px-6 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
          >
            {sections.length > 1 ? `Create ${sections.length} Sections` : "Create Section"}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function AddSectionDialog({ isOpen, onClose, onAddSection, targetClass }) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-md"
    >
      {isOpen && (
        <AddSectionForm
          onClose={onClose}
          onAddSection={onAddSection}
          targetClass={targetClass}
        />
      )}
    </Dialog>
  )
}

// ==============================================================
// 3. Add Wing Dialog
// ==============================================================
function AddWingForm({ onClose, onAddWing, classes = [], wings = [] }) {
  const [name, setName] = useState("")
  const [selectedClassIds, setSelectedClassIds] = useState([])

  const toggleClass = (cid) => {
    setSelectedClassIds((prev) =>
      prev.includes(cid) ? prev.filter((id) => id !== cid) : [...prev, cid]
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onAddWing({
      name: name.trim(),
      class_ids: selectedClassIds,
    })
    onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base font-bold">Add Academic Wing</DialogTitle>
        <DialogDescription className="text-xs">
          Create an academic wing (e.g. Primary, Middle, Secondary) and assign classes. Selecting a class from another wing will move it here.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">Wing Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Primary Wing, Senior Secondary"
            className="h-10 text-sm rounded-xl px-3.5"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">Assign Classes</label>
            <span className="text-[11px] font-mono text-muted-foreground">
              {selectedClassIds.length} of {classes.length} selected
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[55vh] sm:max-h-[480px] overflow-y-auto p-2 rounded-xl border border-border bg-muted/20">
            {classes.map((cls) => {
              const isChecked = selectedClassIds.includes(cls.id)
              const existingWing = wings.find((w) => (w.class_ids || []).includes(cls.id))

              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => toggleClass(cls.id)}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs text-left cursor-pointer transition-colors ${
                    isChecked
                      ? "bg-primary/10 border border-primary/40 text-primary font-medium"
                      : "bg-card hover:bg-accent/40 text-foreground border border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div
                      className={`size-3.5 rounded flex items-center justify-center border shrink-0 ${
                        isChecked
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/40"
                      }`}
                    >
                      {isChecked && <Check className="size-2.5" />}
                    </div>
                    <span className="truncate">{cls.name}</span>
                  </div>

                  {existingWing && (
                    <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded font-mono shrink-0 ml-1">
                      in {existingWing.name}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <DialogFooter className="pt-2 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-10 px-5 text-sm font-medium rounded-xl cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!name.trim()}
            className="h-10 px-6 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
          >
            Create Wing
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function AddWingDialog({ isOpen, onClose, onAddWing, classes = [], wings = [] }) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-2xl"
    >
      {isOpen && (
        <AddWingForm
          onClose={onClose}
          onAddWing={onAddWing}
          classes={classes}
          wings={wings}
        />
      )}
    </Dialog>
  )
}

// ==============================================================
// 4. Add / Edit Subject Dialog
// ==============================================================
function SubjectForm({ onClose, subject, onSaveSubject, classes = [] }) {
  const isEditing = Boolean(subject?.id)
  const [name, setName] = useState(subject?.name || "")
  const [code, setCode] = useState(subject?.code || "")
  const [category, setCategory] = useState(subject?.category || "academic")
  const [isAcademic, setIsAcademic] = useState(
    subject?.is_academic !== undefined ? subject.is_academic : true
  )
  const [assignedClassIds, setAssignedClassIds] = useState(
    subject?.assigned_class_ids || []
  )

  const toggleClass = (cid) => {
    setAssignedClassIds((prev) =>
      prev.includes(cid) ? prev.filter((id) => id !== cid) : [...prev, cid]
    )
  }

  const selectAllClasses = () => {
    if (assignedClassIds.length === classes.length) {
      setAssignedClassIds([])
    } else {
      setAssignedClassIds(classes.map((c) => c.id))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return

    onSaveSubject({
      id: subject?.id,
      name: name.trim(),
      code: code.trim() || null,
      category,
      is_academic: isAcademic,
      assigned_class_ids: assignedClassIds,
    })
    onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base font-bold">
          {isEditing ? "Edit Subject" : "Add Subject"}
        </DialogTitle>
        <DialogDescription className="text-xs">
          Configure subject details and school-wide class assignments.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">Subject Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mathematics"
              className="h-10 text-sm rounded-xl px-3.5"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">Code (Optional)</label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. MATH101"
              className="h-10 text-sm rounded-xl px-3.5"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">Category</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setCategory("academic")
                setIsAcademic(true)
              }}
              className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                category === "academic"
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent/40"
              }`}
            >
              Academic
            </button>
            <button
              type="button"
              onClick={() => {
                setCategory("non_academic")
                setIsAcademic(false)
              }}
              className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                category === "non_academic"
                  ? "bg-amber-600 text-white border-amber-500 shadow-xs"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent/40"
              }`}
            >
              Activity / Non-Academic
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">Class Assignments</label>
            <button
              type="button"
              onClick={selectAllClasses}
              className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
            >
              {assignedClassIds.length === classes.length ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 rounded-xl border border-border bg-muted/20">
            {classes.map((cls) => {
              const isChecked = assignedClassIds.includes(cls.id)
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => toggleClass(cls.id)}
                  className={`flex items-center gap-2 p-1.5 rounded-lg text-xs text-left cursor-pointer transition-colors ${
                    isChecked
                      ? "bg-primary/10 border border-primary/40 text-primary font-medium"
                      : "bg-card hover:bg-accent/40 text-foreground border border-border"
                  }`}
                >
                  <div
                    className={`size-3.5 rounded flex items-center justify-center border ${
                      isChecked
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {isChecked && <Check className="size-2.5" />}
                  </div>
                  <span className="truncate">{cls.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        <DialogFooter className="pt-2 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-10 px-5 text-sm font-medium rounded-xl cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!name.trim()}
            className="h-10 px-6 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
          >
            {isEditing ? "Save Changes" : "Create Subject"}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function SubjectDialog({
  isOpen,
  onClose,
  subject,
  onSaveSubject,
  classes = [],
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-md"
    >
      {isOpen && (
        <SubjectForm
          onClose={onClose}
          subject={subject}
          onSaveSubject={onSaveSubject}
          classes={classes}
        />
      )}
    </Dialog>
  )
}

// ==============================================================
// 5. Add House Dialog
// ==============================================================
function AddHouseForm({ onClose, onAddHouse }) {
  const [name, setName] = useState("")
  const [color, setColor] = useState("#EF4444")

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onAddHouse({
      name: name.trim(),
      color,
    })
    onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base font-bold">Add School House</DialogTitle>
        <DialogDescription className="text-xs">
          Set up a house for athletics and competitions (max 4).
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">House Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Red House, Phoenix"
            className="h-10 text-sm rounded-xl px-3.5"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">House Color</label>
          <div className="flex flex-wrap gap-2 pt-1">
            {CURATED_HOUSE_PALETTE.map((pal) => (
              <button
                key={pal.name}
                type="button"
                onClick={() => setColor(pal.hex)}
                style={{ backgroundColor: pal.hex }}
                className={`size-6 rounded-full cursor-pointer transition-transform ${
                  color.toUpperCase() === pal.hex.toUpperCase()
                    ? "scale-125 ring-2 ring-primary shadow-xs"
                    : "hover:scale-110 opacity-70 hover:opacity-100"
                }`}
                title={pal.name}
              />
            ))}
          </div>
        </div>

        <DialogFooter className="pt-2 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-10 px-5 text-sm font-medium rounded-xl cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!name.trim()}
            className="h-10 px-6 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
          >
            Add House
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function AddHouseDialog({ isOpen, onClose, onAddHouse }) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-sm"
    >
      {isOpen && <AddHouseForm onClose={onClose} onAddHouse={onAddHouse} />}
    </Dialog>
  )
}

// ==============================================================
// 6. Section Subjects Assignment Dialog (Onboarding Wizard Style)
// ==============================================================
function SectionSubjectsForm({
  onClose,
  targetClass,
  targetSection,
  allSubjects = [],
  onSaveAssignments,
  onSubjectSplitChange,
}) {
  // Only subjects assigned in onboarding / currently configured for this section
  const initialAssigned = useMemo(() => {
    if (!targetSection) return []
    const secSubs =
      targetSection.subjects && targetSection.subjects.length > 0
        ? targetSection.subjects
        : targetClass?.subjects || []

    return secSubs.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code || null,
      category: s.category || (s.is_academic ? "academic" : "non_academic"),
      is_academic: s.is_academic !== undefined ? s.is_academic : s.category === "academic",
      is_split: s.is_split || false,
      parent_id: s.parent_id || null,
      child_subjects: s.child_subjects || [],
    }))
  }, [targetSection, targetClass])

  const [subjectsList, setSubjectsList] = useState(() => initialAssigned)
  const [addingCategory, setAddingCategory] = useState(null) // "academic" | "non_academic" | null
  const [addingInputVal, setAddingInputVal] = useState("")
  const [editingSubjectKey, setEditingSubjectKey] = useState(null) // id or tempId
  const [editingSubjectName, setEditingSubjectName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [splitDialogSubject, setSplitDialogSubject] = useState(null)

  // Open split dialog for academic subject
  const handleOpenSplitModal = async (sub) => {
    if (sub._isNew || !sub.id) {
      try {
        const created = await schoolConfigService.createSubject({
          name: sub.name,
          category: sub.category,
          is_academic: sub.is_academic,
          assigned_class_ids: targetClass?.id ? [targetClass.id] : [],
          assigned_section_ids: targetSection?.id ? [targetSection.id] : [],
        })
        if (created?.id) {
          const updatedSub = { ...sub, ...created, _isNew: false }
          setSubjectsList((prev) =>
            prev.map((s) =>
              (s.id && s.id === created.id) || (s.tempId && s.tempId === sub.tempId)
                ? updatedSub
                : s
            )
          )
          setSplitDialogSubject(updatedSub)
        }
      } catch (err) {
        toast.error(err.message || "Failed to initialize subject before splitting.")
      }
    } else {
      setSplitDialogSubject(sub)
    }
  }

  const handleSplitSuccess = (updatedSub) => {
    setSubjectsList((prev) =>
      prev.map((s) => (s.id === updatedSub.id ? { ...s, ...updatedSub } : s))
    )
    onSubjectSplitChange?.()
  }

  // Buckets
  const academicSubjects = useMemo(() => {
    return subjectsList.filter((s) => s.category === "academic" || s.is_academic === true)
  }, [subjectsList])

  const nonAcademicSubjects = useMemo(() => {
    return subjectsList.filter(
      (s) => s.category === "non_academic" || (s.category !== "academic" && s.is_academic === false)
    )
  }, [subjectsList])

  // Switch category between Academic and Non-Academic
  const handleSwitchCategory = (targetSub) => {
    setSubjectsList((prev) =>
      prev.map((s) => {
        const matches = s.id ? s.id === targetSub.id : s.tempId === targetSub.tempId
        if (matches) {
          const currentlyAcademic = s.category === "academic" || s.is_academic === true
          const nextCategory = currentlyAcademic ? "non_academic" : "academic"
          const nextIsAcad = !currentlyAcademic
          return {
            ...s,
            category: nextCategory,
            is_academic: nextIsAcad,
            _categoryChanged: true,
          }
        }
        return s
      })
    )
  }

  // Remove subject from this section
  const handleRemoveSubject = (targetSub) => {
    if (editingSubjectKey === (targetSub.id || targetSub.tempId)) {
      setEditingSubjectKey(null)
      setEditingSubjectName("")
    }
    setSubjectsList((prev) =>
      prev.filter((s) => (s.id ? s.id !== targetSub.id : s.tempId !== targetSub.tempId))
    )
  }

  // Edit subject name inline
  const handleStartEditSubject = (sub) => {
    setEditingSubjectKey(sub.id || sub.tempId)
    setEditingSubjectName(sub.name)
  }

  const handleSaveEditSubject = (sub) => {
    const trimmed = (editingSubjectName || "").trim()
    if (!trimmed) return
    const key = sub.id || sub.tempId

    if (trimmed.toLowerCase() !== sub.name.toLowerCase()) {
      if (
        subjectsList.some(
          (s) =>
            (s.id || s.tempId) !== key &&
            s.name.toLowerCase() === trimmed.toLowerCase()
        )
      ) {
        toast.error(`Subject "${trimmed}" is already in this list.`)
        return
      }
    }

    setSubjectsList((prev) =>
      prev.map((s) => {
        const matches = s.id ? s.id === sub.id : s.tempId === sub.tempId
        if (matches) {
          return {
            ...s,
            name: trimmed,
            _nameChanged: trimmed !== sub.name,
          }
        }
        return s
      })
    )
    setEditingSubjectKey(null)
    setEditingSubjectName("")
  }

  const handleCancelEditSubject = () => {
    setEditingSubjectKey(null)
    setEditingSubjectName("")
  }

  // Add subject inline - adds on the first index (index 0)
  const handleAddSubject = (category) => {
    const trimmed = (addingInputVal || "").trim()
    if (!trimmed) return

    // Prevent duplicate in this section
    if (subjectsList.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`Subject "${trimmed}" is already assigned to this section.`)
      return
    }

    const isAcad = category === "academic"
    const existingInCatalog = allSubjects.find(
      (s) => s.name.toLowerCase() === trimmed.toLowerCase()
    )

    let newSub
    if (existingInCatalog) {
      newSub = {
        ...existingInCatalog,
        category,
        is_academic: isAcad,
        _categoryChanged: existingInCatalog.is_academic !== isAcad,
      }
    } else {
      newSub = {
        id: null,
        tempId: `new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: trimmed,
        code: null,
        category,
        is_academic: isAcad,
        _isNew: true,
      }
    }

    // Always add on the first index
    setSubjectsList((prev) => [newSub, ...prev])
    setAddingCategory(null)
    setAddingInputVal("")
  }

  // Save changes
  const handleSave = async () => {
    setIsSaving(true)
    try {
      // If currently editing a subject name, commit the change first
      let currentSubjectsList = [...subjectsList]
      if (editingSubjectKey && editingSubjectName.trim()) {
        const trimmed = editingSubjectName.trim()
        currentSubjectsList = currentSubjectsList.map((s) => {
          if ((s.id || s.tempId) === editingSubjectKey && trimmed !== s.name) {
            return { ...s, name: trimmed, _nameChanged: true }
          }
          return s
        })
      }

      const finalSubjectIds = []
      for (const sub of currentSubjectsList) {
        if (sub._isNew) {
          const res = await schoolConfigService.createSubject({
            name: sub.name,
            category: sub.category,
            is_academic: sub.is_academic,
            assigned_class_ids: [targetClass.id],
            assigned_section_ids: [targetSection.id],
          })
          if (res?.id) {
            finalSubjectIds.push(res.id)
          }
        } else {
          finalSubjectIds.push(sub.id)
          if (sub._categoryChanged || sub._nameChanged) {
            await schoolConfigService.updateSubject(sub.id, {
              name: sub.name,
              category: sub.category,
              is_academic: sub.is_academic,
            })
          }
        }
      }

      await onSaveAssignments(targetClass.id, targetSection.id, finalSubjectIds)
      onClose()
    } catch (err) {
      toast.error(err.message || "Failed to update section subjects.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2 flex-wrap">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <span>Manage Subjects</span>
            <span className="text-muted-foreground font-normal text-xs">
              ({targetClass?.name} {targetClass?.same_for_all_sections !== false ? "– All Sections" : `– Section ${targetSection?.name}`})
            </span>
          </DialogTitle>
          {targetClass?.same_for_all_sections !== false ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
              Shared across all sections
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
              Section-specific
            </span>
          )}
        </div>
        <DialogDescription className="text-xs">
          {targetClass?.same_for_all_sections !== false
            ? `Organize subjects for ${targetClass?.name}. Since 'Same for all sections' is active, updates will apply to all sections.`
            : `Organize subjects specifically for ${targetClass?.name} - Section ${targetSection?.name}.`}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
        {/* 1. Academic Subjects Bucket */}
        <div className="rounded-xl border border-border/80 bg-card/60 p-3.5 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-blue-500" />
                <span className="text-xs font-bold text-foreground">Academic Subjects</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                  {academicSubjects.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAddingCategory("academic")
                  setAddingInputVal("")
                }}
                className="text-[11px] font-semibold text-primary hover:text-primary/80 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="size-3" />
                <span>Add</span>
              </button>
            </div>

            {/* Inline Add Input for Academic */}
            {addingCategory === "academic" && (
              <InlineEditInput
                value={addingInputVal}
                onChange={setAddingInputVal}
                onSave={() => handleAddSubject("academic")}
                onCancel={() => {
                  setAddingCategory(null)
                  setAddingInputVal("")
                }}
                placeholder="Subject name"
                saveTitle="Add"
                disableSave={!addingInputVal.trim()}
                autoFocus
              />
            )}

            {/* Academic Subjects List */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
              {academicSubjects.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground/70 italic border border-dashed border-border/60 rounded-xl">
                  No academic subjects
                </div>
              ) : (
                academicSubjects.map((sub, idx) => {
                  const key = sub.id || sub.tempId || idx
                  const isEditing = editingSubjectKey === (sub.id || sub.tempId)

                  if (isEditing) {
                    return (
                      <InlineEditInput
                        key={key}
                        value={editingSubjectName}
                        onChange={setEditingSubjectName}
                        onSave={() => handleSaveEditSubject(sub)}
                        onCancel={handleCancelEditSubject}
                        placeholder="Subject name..."
                        saveTitle="Save name"
                        disableSave={!editingSubjectName.trim()}
                        autoFocus
                      />
                    )
                  }

                  return (
                    <div
                      key={key}
                      className="group flex flex-col p-2 rounded-xl border border-border/70 bg-card hover:border-border hover:shadow-xs hover:bg-muted/30 text-xs transition-all duration-150 gap-1"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 flex-1 min-w-0 pr-1">
                          <span className="font-semibold text-foreground truncate" title={sub.name}>
                            {sub.name}
                          </span>
                          {sub.code && (
                            <span className="text-[10px] font-mono text-muted-foreground px-1 py-0.2 rounded bg-muted">
                              {sub.code}
                            </span>
                          )}
                          {sub.is_split && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                              <Split className="size-2.5" />
                              <span>Split ({sub.child_subjects?.length || 0})</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleStartEditSubject(sub)}
                            className="size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
                            title="Edit subject name"
                          >
                            <Edit2 className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenSplitModal(sub)}
                            className={`size-6 rounded-md flex items-center justify-center cursor-pointer transition-colors ${
                              sub.is_split
                                ? "bg-primary/10 text-primary hover:bg-primary/20"
                                : "hover:bg-muted text-muted-foreground hover:text-primary"
                            }`}
                            title={sub.is_split ? "Manage split parts" : "Split subject into parts"}
                          >
                            <Split className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSubject(sub)}
                            className="size-6 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center cursor-pointer transition-colors"
                            title="Remove subject"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>

                      {/* If split, display child parts pills */}
                      {sub.is_split && sub.child_subjects && sub.child_subjects.length > 0 && (
                        <div className="mt-0.5 pt-1.5 border-t border-border/50 flex items-center gap-1.5 flex-wrap">
                          {sub.child_subjects.map((c) => (
                            <span
                              key={c.id || c.name}
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-foreground border border-border/60"
                            >
                              {c.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* 2. Non-Academic Subjects Bucket */}
        <div className="rounded-xl border border-border/80 bg-card/60 p-3.5 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Award className="size-4 text-amber-500" />
                <span className="text-xs font-bold text-foreground">Non-Academic Subjects</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                  {nonAcademicSubjects.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAddingCategory("non_academic")
                  setAddingInputVal("")
                }}
                className="text-[11px] font-semibold text-primary hover:text-primary/80 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="size-3" />
                <span>Add</span>
              </button>
            </div>

            {/* Inline Add Input for Non-Academic */}
            {addingCategory === "non_academic" && (
              <InlineEditInput
                value={addingInputVal}
                onChange={setAddingInputVal}
                onSave={() => handleAddSubject("non_academic")}
                onCancel={() => {
                  setAddingCategory(null)
                  setAddingInputVal("")
                }}
                placeholder="Subject name"
                saveTitle="Add"
                disableSave={!addingInputVal.trim()}
                autoFocus
              />
            )}

            {/* Non-Academic Subjects List */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
              {nonAcademicSubjects.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground/70 italic border border-dashed border-border/60 rounded-xl">
                  No non-academic subjects
                </div>
              ) : (
                nonAcademicSubjects.map((sub, idx) => {
                  const key = sub.id || sub.tempId || idx
                  const isEditing = editingSubjectKey === (sub.id || sub.tempId)

                  if (isEditing) {
                    return (
                      <InlineEditInput
                        key={key}
                        value={editingSubjectName}
                        onChange={setEditingSubjectName}
                        onSave={() => handleSaveEditSubject(sub)}
                        onCancel={handleCancelEditSubject}
                        placeholder="Subject name..."
                        saveTitle="Save name"
                        disableSave={!editingSubjectName.trim()}
                        autoFocus
                      />
                    )
                  }

                  return (
                    <div
                      key={key}
                      className="group flex items-center justify-between p-2 rounded-xl border border-border/70 bg-card hover:border-border hover:shadow-xs hover:bg-muted/30 text-xs transition-all duration-150"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0 pr-1">
                        <span className="font-semibold text-foreground truncate" title={sub.name}>
                          {sub.name}
                        </span>
                        {sub.code && (
                          <span className="text-[10px] font-mono text-muted-foreground px-1 py-0.2 rounded bg-muted">
                            {sub.code}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleStartEditSubject(sub)}
                          className="size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
                          title="Edit subject name"
                        >
                          <Edit2 className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubject(sub)}
                          className="size-6 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center cursor-pointer transition-colors"
                          title="Remove subject"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <DialogFooter className="pt-4 border-t border-border/80 flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSaving}
          className="h-10 px-5 text-sm font-medium rounded-xl cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="h-10 px-6 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer gap-1.5"
        >
          {isSaving ? "Saving..." : "Save Subject Assignments"}
        </Button>
      </DialogFooter>

      {/* Split Subject Dialog */}
      {splitDialogSubject && (
        <SplitSubjectDialog
          isOpen={Boolean(splitDialogSubject)}
          onClose={() => setSplitDialogSubject(null)}
          subject={splitDialogSubject}
          onSplitSuccess={handleSplitSuccess}
        />
      )}
    </>
  )
}

// ==============================================================
// 6b. Split Academic Subject Dialog
// ==============================================================
function SplitSubjectForm({ subject, onClose, onSplitSuccess }) {
  const [parts, setParts] = useState(() => {
    if (subject?.is_split && subject?.child_subjects && subject.child_subjects.length > 0) {
      return subject.child_subjects.map((c) => c.name)
    }
    return ["", ""]
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handlePartChange = (index, value) => {
    setParts((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const handleAddPart = () => {
    setParts((prev) => [...prev, ""])
  }

  const handleRemovePart = (index) => {
    if (parts.length <= 2) {
      toast.warning("A split subject requires at least 2 parts.")
      return
    }
    setParts((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    const cleaned = parts.map((p) => (p || "").trim()).filter(Boolean)
    if (cleaned.length < 2) {
      toast.error("Please provide at least 2 part names (e.g. Physics, Chemistry, Biology).")
      return
    }

    const lower = cleaned.map((p) => p.toLowerCase())
    if (new Set(lower).size !== lower.length) {
      toast.error("Part names must be unique within the split subject.")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await schoolConfigService.splitSubject(subject.id, cleaned)
      toast.success(res?.message || `Split "${subject.name}" into ${cleaned.length} parts.`)
      onSplitSuccess?.({
        ...subject,
        is_split: true,
        child_subjects: res?.child_subjects || [],
      })
      onClose()
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Failed to split subject."
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUnsplit = async () => {
    setIsSubmitting(true)
    try {
      const res = await schoolConfigService.unsplitSubject(subject.id)
      toast.success(res?.message || `Reverted "${subject.name}" to a unified subject.`)
      onSplitSuccess?.({
        ...subject,
        is_split: false,
        child_subjects: [],
      })
      onClose()
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Failed to unsplit subject."
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Split className="size-4" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-base font-bold truncate">
              Split Subject: {subject?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Divide into 2 or more parts so different teachers can be assigned to each part.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-3 py-2">

        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          {parts.map((partVal, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground w-14 shrink-0">
                Part {idx + 1}
              </span>
              <Input
                value={partVal}
                onChange={(e) => handlePartChange(idx, e.target.value)}
                className="h-9 text-xs flex-1 rounded-lg"
                autoFocus={idx === 0 && !partVal}
              />
              <button
                type="button"
                onClick={() => handleRemovePart(idx)}
                disabled={parts.length <= 2}
                className={`size-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                  parts.length <= 2
                    ? "opacity-30 cursor-not-allowed text-muted-foreground"
                    : "hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                }`}
                title={parts.length <= 2 ? "Minimum 2 parts required" : "Remove part"}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddPart}
          className="w-full text-xs h-8 gap-1.5 border-dashed border-border/80 hover:border-primary/50 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Plus className="size-3" />
          <span>Add Another Part</span>
        </Button>
      </div>

      <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 pt-2 border-t border-border/60">
        <div>
          {subject?.is_split && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleUnsplit}
              disabled={isSubmitting}
              className="h-9 px-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              Un-split Subject
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 px-4 text-xs font-medium rounded-xl cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="h-9 px-5 text-xs font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
          >
            {isSubmitting ? "Saving..." : "Save Split Parts"}
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}

export function SplitSubjectDialog({ isOpen, onClose, subject, onSplitSuccess }) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-md"
    >
      {isOpen && subject && (
        <SplitSubjectForm
          subject={subject}
          onClose={onClose}
          onSplitSuccess={onSplitSuccess}
        />
      )}
    </Dialog>
  )
}

export function SectionSubjectsDialog({
  isOpen,
  onClose,
  targetClass,
  targetSection,
  allSubjects = [],
  onSaveAssignments,
  onSubjectSplitChange,
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-2xl"
    >
      {isOpen && targetClass && targetSection && (
        <SectionSubjectsForm
          onClose={onClose}
          targetClass={targetClass}
          targetSection={targetSection}
          allSubjects={allSubjects}
          onSaveAssignments={onSaveAssignments}
          onSubjectSplitChange={onSubjectSplitChange}
        />
      )}
    </Dialog>
  )
}

// ==============================================================
// 7. Generic Confirmation Dialog
// ==============================================================
export function ConfirmDeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Deletion",
  description = "Are you sure you want to delete this item? This action cannot be undone.",
  confirmLabel = "Delete",
  isLoading = false,
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-sm"
    >
      <DialogHeader className="space-y-2">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-5 shrink-0" />
          <DialogTitle className="text-base font-bold text-foreground">{title}</DialogTitle>
        </div>
        <DialogDescription className="text-xs leading-relaxed">
          {description}
        </DialogDescription>
      </DialogHeader>

      <DialogFooter className="pt-4 border-t border-border/80 flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isLoading}
          className="h-10 px-5 text-sm font-medium rounded-xl cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={onConfirm}
          disabled={isLoading}
          className="h-10 px-6 text-sm font-semibold rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm gap-1.5 cursor-pointer"
        >
          <Trash2 className="size-4" />
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

// ==============================================================
// 8. Change Class Wing Assignment Dialog
// ==============================================================
function ChangeClassWingForm({ onClose, targetClass, wings = [], onSaveWingAssignment }) {
  const [selectedWingId, setSelectedWingId] = useState(targetClass?.wing_id || "")

  const handleSave = () => {
    onSaveWingAssignment(targetClass.id, selectedWingId ? selectedWingId : null)
    onClose()
  }

  const handleQuickUnassign = () => {
    onSaveWingAssignment(targetClass.id, null)
    onClose()
  }

  const currentWing = wings.find((w) => w.id === targetClass?.wing_id)

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <ArrowRightLeft className="size-4" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-base font-bold truncate">
              Wing Assignment: {targetClass?.name}
            </DialogTitle>
            <DialogDescription className="text-xs truncate">
              Move this class to another wing or unassign it completely.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-3 py-2 min-w-0">
        <div className="space-y-1.5 min-w-0">
          <label className="text-xs font-semibold text-foreground">Select Academic Wing</label>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {/* Unassigned Option */}
            <button
              type="button"
              onClick={() => setSelectedWingId("")}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs text-left cursor-pointer transition-all ${
                selectedWingId === ""
                  ? "bg-primary/10 border-primary/40 text-foreground font-semibold shadow-xs"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="size-2 rounded-full bg-muted-foreground/60 shrink-0" />
                <span className="truncate">Unassigned (No Wing)</span>
              </div>
              {selectedWingId === "" && <Check className="size-3.5 text-primary shrink-0" />}
            </button>

            {/* Wing Options */}
            {wings.map((w) => {
              const isSelected = selectedWingId === w.id
              const isCurrent = targetClass?.wing_id === w.id
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedWingId(w.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs text-left cursor-pointer transition-all ${
                    isSelected
                      ? "bg-primary/10 border-primary/40 text-foreground font-semibold shadow-xs"
                      : "bg-card border-border text-foreground hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="size-2 rounded-full bg-primary shrink-0" />
                    <span className="truncate">{w.name}</span>
                    {isCurrent && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono font-normal shrink-0">
                        Current
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div>
          {currentWing ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleQuickUnassign}
              className="h-9 px-3 text-xs sm:text-sm font-medium text-destructive hover:bg-destructive/10 rounded-xl cursor-pointer w-full sm:w-auto"
            >
              Unassign from Wing
            </Button>
          ) : (
            <span className="hidden sm:inline-block" />
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 sm:h-10 px-4 text-xs sm:text-sm font-medium rounded-xl cursor-pointer flex-1 sm:flex-initial"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="h-9 sm:h-10 px-5 text-xs sm:text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer flex-1 sm:flex-initial"
          >
            Save Assignment
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}

export function ChangeClassWingDialog({
  isOpen,
  onClose,
  targetClass,
  wings = [],
  onSaveWingAssignment,
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-md"
    >
      {isOpen && targetClass && (
        <ChangeClassWingForm
          onClose={onClose}
          targetClass={targetClass}
          wings={wings}
          onSaveWingAssignment={onSaveWingAssignment}
        />
      )}
    </Dialog>
  )
}

// ==============================================================
// 9. Manage Wing Classes Dialog
// ==============================================================
function ManageWingClassesForm({
  onClose,
  targetWing,
  classes = [],
  wings = [],
  onSaveWingClasses,
}) {
  const [selectedClassIds, setSelectedClassIds] = useState(() => targetWing?.class_ids || [])

  const toggleClass = (cid) => {
    setSelectedClassIds((prev) =>
      prev.includes(cid) ? prev.filter((id) => id !== cid) : [...prev, cid]
    )
  }

  const handleSave = () => {
    onSaveWingClasses(targetWing.id, selectedClassIds)
    onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base font-bold">
          Manage Classes: {targetWing?.name}
        </DialogTitle>
        <DialogDescription className="text-xs">
          Select which classes belong to this wing. Selecting a class from another wing will move it here. Unselecting removes it.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 py-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">Assigned Classes</label>
            <span className="text-[11px] font-mono text-muted-foreground">
              {selectedClassIds.length} of {classes.length} selected
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[55vh] sm:max-h-[480px] overflow-y-auto p-2 rounded-xl border border-border bg-muted/20">
            {classes.map((cls) => {
              const isChecked = selectedClassIds.includes(cls.id)
              const otherWing = wings.find(
                (w) => w.id !== targetWing.id && (w.class_ids || []).includes(cls.id)
              )
              const isCurrentlyHere = (targetWing.class_ids || []).includes(cls.id)

              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => toggleClass(cls.id)}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs text-left cursor-pointer transition-colors ${
                    isChecked
                      ? "bg-primary/10 border border-primary/40 text-primary font-medium"
                      : "bg-card hover:bg-accent/40 text-foreground border border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div
                      className={`size-3.5 rounded flex items-center justify-center border shrink-0 ${
                        isChecked
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/40"
                      }`}
                    >
                      {isChecked && <Check className="size-2.5" />}
                    </div>
                    <span className="truncate">{cls.name}</span>
                  </div>

                  {!isCurrentlyHere && otherWing && (
                    <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded font-mono shrink-0 ml-1">
                      in {otherWing.name}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <DialogFooter className="pt-2 flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="h-10 px-5 text-sm font-medium rounded-xl cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          className="h-10 px-6 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
        >
          Save Classes
        </Button>
      </DialogFooter>
    </>
  )
}

export function ManageWingClassesDialog({
  isOpen,
  onClose,
  targetWing,
  classes = [],
  wings = [],
  onSaveWingClasses,
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-2xl"
    >
      {isOpen && targetWing && (
        <ManageWingClassesForm
          onClose={onClose}
          targetWing={targetWing}
          classes={classes}
          wings={wings}
          onSaveWingClasses={onSaveWingClasses}
        />
      )}
    </Dialog>
  )
}

// ==============================================================
// 10. Assign Class Teacher Dialog
// ==============================================================
function AssignClassTeacherForm({
  onClose,
  targetClass,
  targetSection,
  teachers = [],
  onAssignTeacher,
  isPending = false,
}) {
  const [searchQuery, setSearchQuery] = useState("")

  const effectiveAssignedId =
    targetSection?.class_teacher_id || targetSection?.class_teacher?.id || null

  const currentTeacher =
    (effectiveAssignedId && teachers.find((t) => String(t.id) === String(effectiveAssignedId))) ||
    targetSection?.class_teacher ||
    null

  // Ensure assigned teacher is included in teacher list even if missing from teachers array
  const allTeachers = useMemo(() => {
    if (currentTeacher && !teachers.some((t) => String(t.id) === String(currentTeacher.id))) {
      return [currentTeacher, ...teachers]
    }
    return teachers
  }, [teachers, currentTeacher])

  const sortedAndFilteredTeachers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const list = q
      ? allTeachers.filter(
          (t) =>
            t.name?.toLowerCase().includes(q) ||
            t.email?.toLowerCase().includes(q) ||
            t.roll_no?.toLowerCase().includes(q)
        )
      : [...allTeachers]

    list.sort((a, b) => {
      if (effectiveAssignedId) {
        const aIsCurrent = String(a.id) === String(effectiveAssignedId)
        const bIsCurrent = String(b.id) === String(effectiveAssignedId)
        if (aIsCurrent && !bIsCurrent) return -1
        if (!aIsCurrent && bIsCurrent) return 1
      }
      return (a.name || "").localeCompare(b.name || "")
    })

    return list
  }, [allTeachers, searchQuery, effectiveAssignedId])

  const handleSelect = (teacherId) => {
    onAssignTeacher(targetSection.id, teacherId)
  }

  const handleUnassign = () => {
    onAssignTeacher(targetSection.id, null)
  }

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <GraduationCap className="size-4" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold">Assign Class Teacher</DialogTitle>
            <DialogDescription className="text-xs">
              {targetClass?.name} - Section {targetSection?.name}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>      <div className="space-y-3 py-1 w-full min-w-0">
        {/* Search Input */}
        <div className="relative w-full min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff by name, email, staff ID..."
            className="h-10 text-sm rounded-xl pl-10 pr-9 bg-background w-full min-w-0"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Staff List */}
        <div className="space-y-1.5 max-h-[320px] overflow-y-auto scrollbar-thin pr-1 w-full min-w-0">
          {teachers.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No staff members found in this school.
            </div>
          ) : sortedAndFilteredTeachers.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No staff members matching &quot;{searchQuery}&quot;
            </div>
          ) : (
            sortedAndFilteredTeachers.map((t) => {
              const isAssigned = Boolean(effectiveAssignedId && String(t.id) === String(effectiveAssignedId))

              return (
                <div
                  key={t.id}
                  onClick={() => !isAssigned && handleSelect(t.id)}
                  className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 w-full min-w-0 ${
                    isAssigned
                      ? "border-emerald-500/40 bg-emerald-500/10 cursor-default"
                      : "border-border/70 bg-card hover:bg-accent/60 hover:border-primary/40 cursor-pointer"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`size-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                        isAssigned
                          ? "bg-emerald-500 text-white"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {t.name ? t.name.charAt(0).toUpperCase() : "T"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
                        <span className="truncate">{t.name}</span>
                        {isAssigned && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                            Current
                          </span>
                        )}
                      </div>
                      <div
                        className="text-[11px] text-muted-foreground truncate"
                        title={`${t.email || "No email"}${t.roll_no ? ` • ${t.roll_no}` : ""}`}
                      >
                        {t.email || "No email"}
                        {t.roll_no ? ` • ${t.roll_no}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isAssigned ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUnassign()
                        }}
                        disabled={isPending}
                        className="h-7 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                      >
                        Unassign
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelect(t.id)
                        }}
                        disabled={isPending}
                        className="h-7 text-xs font-semibold cursor-pointer"
                      >
                        Assign
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <DialogFooter className="pt-2 w-full flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="h-10 px-5 text-sm font-medium rounded-xl cursor-pointer"
        >
          Close
        </Button>
      </DialogFooter>
    </>
  )
}

export function AssignClassTeacherDialog({
  isOpen,
  onClose,
  targetClass,
  targetSection,
  teachers = [],
  onAssignTeacher,
  isPending = false,
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-lg"
    >
      {isOpen && targetSection && (
        <AssignClassTeacherForm
          onClose={onClose}
          targetClass={targetClass}
          targetSection={targetSection}
          teachers={teachers}
          onAssignTeacher={onAssignTeacher}
          isPending={isPending}
        />
      )}
    </Dialog>
  )
}

// ==============================================================
// 10. Unify Subjects Dialog (When toggling Same for all sections to ON)
// ==============================================================
export function UnifySubjectsDialog({
  isOpen,
  onClose,
  targetClass,
  onConfirmUnify,
  isPending = false,
}) {
  const sections = useMemo(() => {
    return targetClass?.sections || []
  }, [targetClass])

  const [selectedSectionId, setSelectedSectionId] = useState(() => {
    return sections[0]?.id || ""
  })
  const [strategy, setStrategy] = useState("use_section") // "use_section" | "merge"

  useEffect(() => {
    if (sections.length > 0 && !selectedSectionId) {
      setSelectedSectionId(sections[0].id)
    }
  }, [sections, selectedSectionId])

  if (!isOpen || !targetClass) return null

  const selectedSection = sections.find((s) => s.id === selectedSectionId) || sections[0]

  const handleConfirm = () => {
    onConfirmUnify({
      classId: targetClass.id,
      sameForAllSections: true,
      sourceSectionId: strategy === "use_section" ? selectedSection?.id : null,
      mergeAll: strategy === "merge",
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl z-10 flex flex-col p-6 animate-in fade-in-0 zoom-in-95 duration-200 space-y-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </button>

        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
            <Combine className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              Unify Subjects for {targetClass.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Sections in this class currently have different subject assignments. Choose how you would like to synchronize them to a single shared configuration.
            </p>
          </div>
        </div>

        <div className="space-y-2.5 pt-1">
          {/* Option 1: Use Section's subjects */}
          <div
            onClick={() => setStrategy("use_section")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              strategy === "use_section"
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border bg-muted/20 hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="unifyStrategy"
                  checked={strategy === "use_section"}
                  onChange={() => setStrategy("use_section")}
                  className="size-3.5 accent-primary cursor-pointer"
                />
                <span>Use Section&apos;s Subjects</span>
              </label>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Recommended
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground pl-5.5 leading-relaxed">
              Applies one section&apos;s subjects to all sections of {targetClass.name}.
            </p>

            {strategy === "use_section" && sections.length > 1 && (
              <div className="mt-2.5 pl-5.5 space-y-1">
                <label className="text-[11px] font-semibold text-foreground block">
                  Select base section:
                </label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  className="w-full h-8 text-xs rounded-lg border border-border bg-background px-2 font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      Section {sec.name} ({sec.subjects?.length || 0} subjects)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Option 2: Merge all unique subjects */}
          <div
            onClick={() => setStrategy("merge")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              strategy === "merge"
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border bg-muted/20 hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-foreground flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="unifyStrategy"
                  checked={strategy === "merge"}
                  onChange={() => setStrategy("merge")}
                  className="size-3.5 accent-primary cursor-pointer"
                />
                <span>Merge All Unique Subjects</span>
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground pl-5.5 leading-relaxed">
              Combines every unique subject configured across all sections into the shared list.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/80">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
            className="h-9 px-4 text-xs font-medium rounded-xl cursor-pointer"
          >
            Cancel (Keep Separate)
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="h-9 px-5 text-xs font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
          >
            {isPending ? "Unifying..." : "Unify Subjects"}
          </Button>
        </div>
      </div>
    </div>
  )
}
