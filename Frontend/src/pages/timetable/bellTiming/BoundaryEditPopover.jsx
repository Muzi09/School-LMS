import React from "react"
import { DraggableBoundaryTimeChip } from "./DraggableBoundaryTimeChip"

/**
 * Backward compatibility alias: BoundaryEditPopover now renders the DraggableBoundaryTimeChip.
 */
export function BoundaryEditPopover(props) {
  return <DraggableBoundaryTimeChip {...props} />
}

export default BoundaryEditPopover
