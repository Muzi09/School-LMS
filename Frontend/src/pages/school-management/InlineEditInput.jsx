import { useEffect, useRef } from "react"
import PropTypes from "prop-types"
import { Check, X } from "lucide-react"

/**
 * Standard inline editing & adding field used across the School Management pages.
 * Follows the Manage Subjects Modal Add Subject field styling & behavior.
 * Automatically stops editing/adding and keeps changes unsaved on click-away or Escape.
 */
export function InlineEditInput({
  value,
  onChange,
  onSave,
  onCancel,
  placeholder = "Enter value...",
  saveTitle = "Save",
  cancelTitle = "Cancel",
  className = "",
  inputClassName = "",
  autoFocus = true,
  maxLength,
  disabled = false,
  disableSave = false,
  clickOutsideRef,
}) {
  const selfRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      const targetEl = clickOutsideRef?.current || selfRef.current
      if (targetEl && !targetEl.contains(e.target)) {
        onCancel?.()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("touchstart", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
    }
  }, [clickOutsideRef, onCancel])

  const handleSave = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (!disabled && !disableSave) {
      onSave?.()
    }
  }

  const handleCancel = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    onCancel?.()
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSave(e)
    } else if (e.key === "Escape") {
      e.preventDefault()
      handleCancel(e)
    }
  }

  return (
    <div
      ref={selfRef}
      onClick={(e) => e.stopPropagation()}
      className={`flex items-center justify-between w-full h-8 px-2 rounded-lg border border-primary/50 ring-1 ring-primary/30 bg-background shadow-xs select-none ${className}`}
    >
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={maxLength}
        disabled={disabled}
        className={`h-6 text-xs font-medium px-1 flex-1 min-w-0 mr-1 bg-transparent text-foreground focus:outline-none ${inputClassName}`}
        autoFocus={autoFocus}
      />
      <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-border/60">
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || disableSave}
          className="size-5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer"
          title={saveTitle}
        >
          <Check className="size-3 stroke-[2.5]" />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="size-5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-colors cursor-pointer"
          title={cancelTitle}
        >
          <X className="size-3 stroke-[2.5]" />
        </button>
      </div>
    </div>
  )
}

InlineEditInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  onSave: PropTypes.func,
  onCancel: PropTypes.func,
  placeholder: PropTypes.string,
  saveTitle: PropTypes.string,
  cancelTitle: PropTypes.string,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  autoFocus: PropTypes.bool,
  maxLength: PropTypes.number,
  disabled: PropTypes.bool,
  disableSave: PropTypes.bool,
  clickOutsideRef: PropTypes.object,
}

export default InlineEditInput
