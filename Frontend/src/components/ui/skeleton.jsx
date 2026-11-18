import { cn } from "@/lib/utils"

function Skeleton({
  className = undefined,
  ...props
}) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-2xl bg-muted", className)}
      {...props} />
  );
}

export { Skeleton }
