import React from "react"
import { Toaster as Sonner } from "sonner"
import { useTheme } from "@/context/ThemeContext"

const Toaster = ({ ...props }) => {
  let resolvedTheme = "light"
  try {
    const themeContext = useTheme()
    resolvedTheme = themeContext?.resolvedTheme || "light"
  } catch {
    resolvedTheme = "light"
  }

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-2xl group-[.toaster]:rounded-xl group-[.toaster]:font-sans group-[.toaster]:!py-2.5 group-[.toaster]:!px-3.5 group-[.toaster]:border group-[.toaster]:opacity-100 group-[.toaster]:[&_[data-title]]:!text-sm group-[.toaster]:[&_[data-title]]:!font-semibold group-[.toaster]:[&_[data-icon]]:!shrink-0",
          title: "group-[.toast]:!font-semibold group-[.toast]:!text-sm leading-snug",
          description: "group-[.toast]:!text-xs group-[.toast]:opacity-90 leading-relaxed",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:text-xs group-[.toast]:font-semibold group-[.toast]:rounded-lg group-[.toast]:px-2.5 group-[.toast]:py-1",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:text-xs group-[.toast]:rounded-lg group-[.toast]:px-2.5 group-[.toast]:py-1",
          // Error: Solid light red (no transparency), crisp dark red text
          error:
            "group-[.toaster]:!bg-red-50 group-[.toaster]:!text-red-950 group-[.toaster]:!border-red-200 dark:group-[.toaster]:!bg-red-950 dark:group-[.toaster]:!text-red-100 dark:group-[.toaster]:!border-red-800 group-[.toaster]:[&_[data-icon]]:!text-red-600 dark:group-[.toaster]:[&_[data-icon]]:!text-red-400 group-[.toaster]:[&_[data-description]]:!text-red-800 dark:group-[.toaster]:[&_[data-description]]:!text-red-200",
          // Success: Solid light green (no transparency), crisp dark green text
          success:
            "group-[.toaster]:!bg-emerald-50 group-[.toaster]:!text-emerald-950 group-[.toaster]:!border-emerald-200 dark:group-[.toaster]:!bg-emerald-950 dark:group-[.toaster]:!text-emerald-100 dark:group-[.toaster]:!border-emerald-800 group-[.toaster]:[&_[data-icon]]:!text-emerald-600 dark:group-[.toaster]:[&_[data-icon]]:!text-emerald-400 group-[.toaster]:[&_[data-description]]:!text-emerald-800 dark:group-[.toaster]:[&_[data-description]]:!text-emerald-200",
          // Warning: Solid light orange/amber (no transparency), crisp dark amber text
          warning:
            "group-[.toaster]:!bg-amber-50 group-[.toaster]:!text-amber-950 group-[.toaster]:!border-amber-200 dark:group-[.toaster]:!bg-amber-950 dark:group-[.toaster]:!text-amber-100 dark:group-[.toaster]:!border-amber-800 group-[.toaster]:[&_[data-icon]]:!text-amber-600 dark:group-[.toaster]:[&_[data-icon]]:!text-amber-400 group-[.toaster]:[&_[data-description]]:!text-amber-800 dark:group-[.toaster]:[&_[data-description]]:!text-amber-200",
          // Info: Solid light blue (no transparency), crisp dark blue text
          info:
            "group-[.toaster]:!bg-blue-50 group-[.toaster]:!text-blue-950 group-[.toaster]:!border-blue-200 dark:group-[.toaster]:!bg-blue-950 dark:group-[.toaster]:!text-blue-100 dark:group-[.toaster]:!border-blue-800 group-[.toaster]:[&_[data-icon]]:!text-blue-600 dark:group-[.toaster]:[&_[data-icon]]:!text-blue-400 group-[.toaster]:[&_[data-description]]:!text-blue-800 dark:group-[.toaster]:[&_[data-description]]:!text-blue-200",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
