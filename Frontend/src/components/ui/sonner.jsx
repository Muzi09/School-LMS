import { Toaster as Sonner } from "sonner"

const Toaster = ({ ...props }) => {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      richColors
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl font-sans",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error:
            "group-[.toaster]:!bg-destructive/10 group-[.toaster]:!text-destructive group-[.toaster]:!border-destructive/30",
          success:
            "group-[.toaster]:!bg-emerald-500/10 group-[.toaster]:!text-emerald-700 dark:group-[.toaster]:!text-emerald-300 group-[.toaster]:!border-emerald-500/30",
          warning:
            "group-[.toaster]:!bg-amber-500/10 group-[.toaster]:!text-amber-800 dark:group-[.toaster]:!text-amber-300 group-[.toaster]:!border-amber-500/30",
          info:
            "group-[.toaster]:!bg-blue-500/10 group-[.toaster]:!text-blue-800 dark:group-[.toaster]:!text-blue-300 group-[.toaster]:!border-blue-500/30",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
