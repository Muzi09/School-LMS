import { ArrowDown, ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"

export function moveItem(items, index, direction) {
  const reordered = [...items]
  const target = index + direction
  if (target < 0 || target >= items.length) return reordered
  const [item] = reordered.splice(index, 1)
  reordered.splice(target, 0, item)
  return reordered
}

export function OrderButtons({ name, index, count, disabled, onMove }) {
  return (
    <span className="inline-flex shrink-0 gap-1">
      <Button type="button" variant="ghost" size="icon-sm"
        aria-label={`Move ${name} up`} isDisabled={disabled || index === 0}
        onPress={() => onMove(-1)}>
        <ArrowUp />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm"
        aria-label={`Move ${name} down`} isDisabled={disabled || index === count - 1}
        onPress={() => onMove(1)}>
        <ArrowDown />
      </Button>
    </span>
  )
}
