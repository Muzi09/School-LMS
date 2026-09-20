import * as React from "react"
import {
  DialogTrigger as DialogTriggerPrimitive,
  Popover as PopoverPrimitive,
  Dialog as DialogPrimitive,
} from "react-aria-components"

import { cn } from "@/lib/utils"

function PopoverTrigger({ ...props }) {
  return <DialogTriggerPrimitive data-slot="popover-trigger" {...props} />
}

function Popover({
  className,
  offset = 8,
  crossOffset = 0,
  placement = "bottom end",
  children,
  ...props
}) {
  return (
    <PopoverPrimitive
      data-slot="popover"
      offset={offset}
      crossOffset={crossOffset}
      placement={placement}
      className={cn(
        "z-50 origin-(--trigger-anchor-point) rounded-2xl border border-border bg-card text-card-foreground shadow-2xl ring-1 ring-foreground/5 outline-none duration-150 data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=top]:slide-in-from-bottom-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 dark:ring-foreground/10",
        className
      )}
      {...props}
    >
      {children}
    </PopoverPrimitive>
  )
}

function PopoverDialog({ className, children, ...props }) {
  return (
    <DialogPrimitive
      data-slot="popover-dialog"
      className={cn("outline-none flex flex-col max-h-[inherit]", className)}
      {...props}
    >
      {children}
    </DialogPrimitive>
  )
}

export { Popover, PopoverTrigger, PopoverDialog }
