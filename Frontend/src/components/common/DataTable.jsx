import React, { useState, useMemo, useEffect, useRef } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from "@tanstack/react-table"
import {
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  SlidersHorizontal,
  AlertCircle,
  GripVertical,
  Maximize2,
  Minimize2,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Modern, accessible TanStack Table (v8) component.
 * Features:
 * - Controlled & Uncontrolled server/client pagination, sorting, and global filtering
 * - Drag-and-drop column reordering
 * - Column visibility toggling
 * - Table density switching (compact / default / comfortable)
 * - Animated loading skeletons & background fetching progress bar
 * - Polished empty and error states
 * - First-class row actions column
 * - Full dark & light mode styling using native Tailwind tokens
 */
export function DataTable({
  columns = [],
  data = [],
  isLoading = false,
  isFetching = false,
  isError = false,
  errorMessage = "An error occurred while loading data",
  rowCount,
  state: externalState = {},
  onPaginationChange,
  onGlobalFilterChange,
  onSortingChange,
  onColumnVisibilityChange,
  onColumnOrderChange,
  manualPagination = false,
  manualFiltering = false,
  manualSorting = false,
  renderTopToolbarCustomActions,
  renderRowActions,
  enableRowActions = false,
  positionActionsColumn = "last",
  enableColumnOrdering = true,
  enableSorting = true,
  enablePagination = true,
  enableGlobalFilter = true,
  enableHiding = true,
  enableDensityToggle = true,
  enableFullScreenToggle = false,
  initialState = {},
  searchPlaceholder = "Search records...",
  emptyMessage = "No records found",
  className = "",
}) {
  // Density state: "compact" | "default" | "comfortable"
  const [density, setDensity] = useState(
    initialState.density || "default"
  )
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false)
  const [isDensityMenuOpen, setIsDensityMenuOpen] = useState(false)

  // Internal search state if uncontrolled
  const [internalGlobalFilter, setInternalGlobalFilter] = useState(
    externalState.globalFilter || ""
  )
  const [internalSorting, setInternalSorting] = useState(
    externalState.sorting || []
  )
  const [internalPagination, setInternalPagination] = useState(
    externalState.pagination || { pageIndex: 0, pageSize: 10 }
  )
  const [columnVisibility, setColumnVisibility] = useState(
    externalState.columnVisibility || initialState.columnVisibility || {}
  )

  // Drag & drop column reordering state
  const [draggedColumnId, setDraggedColumnId] = useState(null)
  const [dragOverColumnId, setDragOverColumnId] = useState(null)

  const columnMenuRef = useRef(null)
  const densityMenuRef = useRef(null)

  // Sync internal search with external state when updated externally
  useEffect(() => {
    if (externalState.globalFilter !== undefined) {
      setInternalGlobalFilter(externalState.globalFilter)
    }
  }, [externalState.globalFilter])

  useEffect(() => {
    if (externalState.columnVisibility !== undefined) {
      setColumnVisibility(externalState.columnVisibility)
    }
  }, [externalState.columnVisibility])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        columnMenuRef.current &&
        !columnMenuRef.current.contains(event.target)
      ) {
        setIsColumnMenuOpen(false)
      }
      if (
        densityMenuRef.current &&
        !densityMenuRef.current.contains(event.target)
      ) {
        setIsDensityMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Adapt columns for TanStack Table & backward compatibility with MRT Cell/cell syntax
  const normalizedColumns = useMemo(() => {
    const cols = columns.map((col) => {
      const colCopy = { ...col }

      // Map MRT-style Cell prop to TanStack cell if not already present
      if (colCopy.Cell && !colCopy.cell) {
        colCopy.cell = (cellContext) =>
          colCopy.Cell({
            cell: cellContext.cell,
            row: cellContext.row,
            getValue: cellContext.getValue,
            table: cellContext.table,
          })
      }

      // Ensure id exists
      if (!colCopy.id) {
        if (typeof colCopy.accessorKey === "string") {
          colCopy.id = colCopy.accessorKey.replace(/\./g, "_")
        } else if (typeof colCopy.header === "string") {
          colCopy.id = colCopy.header.toLowerCase().replace(/\s+/g, "_")
        }
      }

      return colCopy
    })

    // Inject row actions column if enabled
    if (enableRowActions && renderRowActions) {
      const actionsColumn = {
        id: "__actions__",
        header: "Actions",
        enableSorting: false,
        enableHiding: false,
        size: 100,
        cell: ({ row, table }) => (
          <div className="flex items-center justify-end">
            {renderRowActions({ row, table })}
          </div>
        ),
      }

      if (positionActionsColumn === "first") {
        return [actionsColumn, ...cols]
      } else {
        return [...cols, actionsColumn]
      }
    }

    return cols
  }, [columns, enableRowActions, renderRowActions, positionActionsColumn])

  // Column ordering state
  const defaultColumnOrder = useMemo(
    () => normalizedColumns.map((col) => col.id || col.accessorKey),
    [normalizedColumns]
  )

  const [columnOrder, setColumnOrder] = useState(
    externalState.columnOrder || defaultColumnOrder
  )

  useEffect(() => {
    if (externalState.columnOrder) {
      setColumnOrder(externalState.columnOrder)
    } else {
      setColumnOrder(defaultColumnOrder)
    }
  }, [defaultColumnOrder, externalState.columnOrder])

  // Set up TanStack Table instance
  const table = useReactTable({
    data,
    columns: normalizedColumns,
    rowCount: manualPagination ? rowCount : undefined,
    state: {
      pagination: externalState.pagination ?? internalPagination,
      globalFilter: externalState.globalFilter ?? internalGlobalFilter,
      sorting: externalState.sorting ?? internalSorting,
      columnVisibility:
        externalState.columnVisibility ?? columnVisibility,
      columnOrder: externalState.columnOrder ?? columnOrder,
      ...externalState,
    },
    manualPagination,
    manualFiltering,
    manualSorting,
    enableSorting,
    enableHiding,
    onPaginationChange: onPaginationChange || setInternalPagination,
    onGlobalFilterChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater(externalState.globalFilter ?? internalGlobalFilter)
          : updater
      if (onGlobalFilterChange) {
        onGlobalFilterChange(next)
      } else {
        setInternalGlobalFilter(next)
      }
    },
    onSortingChange: onSortingChange || setInternalSorting,
    onColumnVisibilityChange:
      onColumnVisibilityChange || setColumnVisibility,
    onColumnOrderChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(columnOrder) : updater
      if (onColumnOrderChange) {
        onColumnOrderChange(next)
      } else {
        setColumnOrder(next)
      }
    },
    getCoreRowModel: getCoreRowModel(),
    ...(manualPagination ? {} : { getPaginationRowModel: getPaginationRowModel() }),
    ...(manualSorting ? {} : { getSortedRowModel: getSortedRowModel() }),
    ...(manualFiltering ? {} : { getFilteredRowModel: getFilteredRowModel() }),
  })

  // Drag & drop column reordering handlers
  const handleDragStart = (e, colId) => {
    if (!enableColumnOrdering || colId === "__actions__") return
    setDraggedColumnId(colId)
    e.dataTransfer.setData("text/plain", colId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e, colId) => {
    if (!enableColumnOrdering || colId === "__actions__" || draggedColumnId === colId) {
      return
    }
    e.preventDefault()
    setDragOverColumnId(colId)
    e.dataTransfer.dropEffect = "move"
  }

  const handleDragLeave = () => {
    setDragOverColumnId(null)
  }

  const handleDrop = (e, targetColId) => {
    e.preventDefault()
    setDragOverColumnId(null)
    if (
      !enableColumnOrdering ||
      !draggedColumnId ||
      draggedColumnId === targetColId ||
      targetColId === "__actions__"
    ) {
      setDraggedColumnId(null)
      return
    }

    const currentOrder = [...(table.getState().columnOrder || defaultColumnOrder)]
    const draggedIdx = currentOrder.indexOf(draggedColumnId)
    const targetIdx = currentOrder.indexOf(targetColId)

    if (draggedIdx > -1 && targetIdx > -1) {
      currentOrder.splice(draggedIdx, 1)
      currentOrder.splice(targetIdx, 0, draggedColumnId)
      table.setColumnOrder(currentOrder)
    }

    setDraggedColumnId(null)
  }

  const handleDragEnd = () => {
    setDraggedColumnId(null)
    setDragOverColumnId(null)
  }

  // Row padding classes based on density
  const cellPaddingClasses = useMemo(() => {
    switch (density) {
      case "compact":
        return "py-2 px-3 text-xs"
      case "comfortable":
        return "py-4 px-4 text-sm"
      case "default":
      default:
        return "py-3 px-3.5 text-sm"
    }
  }, [density])

  const headerPaddingClasses = useMemo(() => {
    switch (density) {
      case "compact":
        return "py-2 px-3 text-xs"
      case "comfortable":
        return "py-3.5 px-4 text-xs"
      case "default":
      default:
        return "py-2.5 px-3.5 text-xs"
    }
  }, [density])

  // Current pagination calculation
  const { pageIndex, pageSize } = table.getState().pagination || {
    pageIndex: 0,
    pageSize: 10,
  }
  const totalRows = manualPagination ? (rowCount ?? 0) : table.getFilteredRowModel().rows.length
  const totalPages = manualPagination
    ? Math.ceil(totalRows / pageSize) || 1
    : table.getPageCount() || 1
  const startRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1
  const endRow = Math.min((pageIndex + 1) * pageSize, totalRows)

  const activeSearch = externalState.globalFilter ?? internalGlobalFilter

  return (
    <div
      className={`flex flex-col bg-card rounded-2xl border border-border/80 shadow-xs overflow-hidden transition-all duration-200 ${
        isFullScreen ? "fixed inset-4 z-50 rounded-2xl shadow-2xl" : ""
      } ${className}`}
    >
      {/* Top Progress Bar for Background Fetching */}
      <div className="h-0.5 w-full bg-transparent overflow-hidden">
        {isFetching && (
          <div className="h-full w-full bg-primary animate-pulse transition-all" />
        )}
      </div>

      {/* Top Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 border-b border-border/60 bg-card">
        {/* Left Side: Search & Custom Actions */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          {enableGlobalFilter && (
            <div className="relative min-w-[200px] max-w-xs flex-1 sm:flex-initial">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={activeSearch || ""}
                onChange={(e) => table.setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-8 pl-8 pr-7 text-xs bg-muted/40 hover:bg-muted/60 focus:bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
              />
              {Boolean(activeSearch) && (
                <button
                  type="button"
                  onClick={() => table.setGlobalFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          )}

          {/* Custom Action Slots */}
          {renderTopToolbarCustomActions && (
            <div className="flex items-center gap-2">
              {renderTopToolbarCustomActions({ table })}
            </div>
          )}
        </div>

        {/* Right Side: Column Visibility, Density, Fullscreen */}
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
          {/* Density Menu */}
          {enableDensityToggle && (
            <div className="relative" ref={densityMenuRef}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsDensityMenuOpen((prev) => !prev)
                  setIsColumnMenuOpen(false)
                }}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                title="Table Density"
              >
                <SlidersHorizontal className="size-3.5" />
                <span className="hidden md:inline capitalize">{density}</span>
              </Button>

              {isDensityMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-36 bg-popover text-popover-foreground border border-border rounded-xl shadow-lg p-1 z-30 animate-in fade-in-0 zoom-in-95">
                  <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                    Row Density
                  </div>
                  {["compact", "default", "comfortable"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setDensity(d)
                        setIsDensityMenuOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-lg text-left capitalize transition-colors cursor-pointer ${
                        density === d
                          ? "bg-accent text-accent-foreground font-medium"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <span>{d}</span>
                      {density === d && <Check className="size-3.5 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Column Visibility Menu */}
          {enableHiding && (
            <div className="relative" ref={columnMenuRef}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsColumnMenuOpen((prev) => !prev)
                  setIsDensityMenuOpen(false)
                }}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                title="Customize Columns"
              >
                <Columns3 className="size-3.5" />
                <span className="hidden md:inline">Columns</span>
              </Button>

              {isColumnMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 max-h-72 overflow-y-auto bg-popover text-popover-foreground border border-border rounded-xl shadow-lg p-1.5 z-30 animate-in fade-in-0 zoom-in-95">
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-muted-foreground border-b border-border/50 mb-1">
                    <span>Toggle Columns</span>
                    <button
                      type="button"
                      onClick={() => table.toggleAllColumnsVisible(true)}
                      className="text-[10px] text-primary hover:underline"
                    >
                      Show All
                    </button>
                  </div>
                  {table
                    .getAllLeafColumns()
                    .filter((col) => col.id !== "__actions__")
                    .map((column) => {
                      const headerTitle =
                        typeof column.columnDef.header === "string"
                          ? column.columnDef.header
                          : column.id
                      return (
                        <label
                          key={column.id}
                          className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg hover:bg-muted text-foreground cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={column.getIsVisible()}
                            onChange={column.getToggleVisibilityHandler()}
                            className="size-3.5 rounded border-input text-primary focus:ring-ring cursor-pointer"
                          />
                          <span className="truncate">{headerTitle}</span>
                        </label>
                      )
                    })}
                </div>
              )}
            </div>
          )}

          {/* Full Screen Toggle */}
          {enableFullScreenToggle && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsFullScreen((prev) => !prev)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullScreen ? (
                <Minimize2 className="size-3.5" />
              ) : (
                <Maximize2 className="size-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Error State Banner */}
      {isError && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive border-b border-destructive/20 text-xs">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Table Container */}
      <div className="relative w-full overflow-x-auto min-h-[160px] max-h-[calc(100vh-280px)]">
        <table className="w-full caption-bottom text-left border-collapse">
          {/* Table Header */}
          <thead className="bg-muted/40 sticky top-0 z-10 backdrop-blur-xs border-b border-border/80">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isActions = header.column.id === "__actions__"
                  const isSortable = header.column.getCanSort()
                  const sortDir = header.column.getIsSorted()
                  const isDragged = draggedColumnId === header.column.id
                  const isDragOver = dragOverColumnId === header.column.id

                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      draggable={enableColumnOrdering && !isActions}
                      onDragStart={(e) => handleDragStart(e, header.column.id)}
                      onDragOver={(e) => handleDragOver(e, header.column.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, header.column.id)}
                      onDragEnd={handleDragEnd}
                      style={{
                        width: header.getSize() !== 150 ? header.getSize() : undefined,
                      }}
                      className={`${headerPaddingClasses} font-semibold uppercase tracking-wider text-muted-foreground transition-colors select-none ${
                        isActions ? "text-right" : ""
                      } ${
                        isDragOver
                          ? "border-l-2 border-primary bg-primary/10"
                          : ""
                      } ${isDragged ? "opacity-40" : ""}`}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={`flex items-center ${
                            isActions ? "justify-end" : "justify-between"
                          } ${
                            isSortable
                              ? "cursor-pointer hover:text-foreground"
                              : ""
                          }`}
                          onClick={
                            isSortable
                              ? header.column.getToggleSortingHandler()
                              : undefined
                          }
                        >
                          <span className="truncate">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </span>

                          {/* Right Controls: Drag Handle & Sort Indicator */}
                          {!isActions && (
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              {enableColumnOrdering && (
                                <GripVertical className="size-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" />
                              )}
                              {isSortable && (
                                <div>
                                  {sortDir === "asc" ? (
                                    <ArrowUp className="size-3.5 text-primary" />
                                  ) : sortDir === "desc" ? (
                                    <ArrowDown className="size-3.5 text-primary" />
                                  ) : (
                                    <ArrowUpDown className="size-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-border/50 bg-card">
            {isLoading ? (
              // Loading Skeleton Rows
              Array.from({ length: pageSize || 5 }).map((_, rIdx) => (
                <tr key={`skeleton-${rIdx}`} className="animate-pulse">
                  {table.getVisibleLeafColumns().map((col, cIdx) => (
                    <td
                      key={`skeleton-cell-${rIdx}-${cIdx}`}
                      className={cellPaddingClasses}
                    >
                      <Skeleton className="h-4 w-full max-w-[120px] rounded-md bg-muted/70" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              // Empty State
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="py-12 text-center text-muted-foreground text-xs"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="size-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
                      <Search className="size-5" />
                    </div>
                    <p className="font-medium text-foreground">{emptyMessage}</p>
                    {Boolean(activeSearch) && (
                      <p className="text-[11px] text-muted-foreground">
                        Try adjusting your search terms or filters
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              // Data Rows
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-muted/40 transition-colors group"
                >
                  {row.getVisibleCells().map((cell) => {
                    const isActions = cell.column.id === "__actions__"
                    return (
                      <td
                        key={cell.id}
                        className={`${cellPaddingClasses} text-foreground align-middle ${
                          isActions ? "text-right" : ""
                        }`}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {enablePagination && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-border/60 bg-muted/20 text-xs text-muted-foreground">
          {/* Result Count Indicator */}
          <div>
            {totalRows > 0 ? (
              <span>
                Showing <strong className="text-foreground">{startRow}</strong> to{" "}
                <strong className="text-foreground">{endRow}</strong> of{" "}
                <strong className="text-foreground">{totalRows}</strong> results
              </span>
            ) : (
              <span>0 results</span>
            )}
          </div>

          {/* Controls: Page Size & Navigation */}
          <div className="flex items-center gap-4 self-end sm:self-auto">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px]">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  table.setPageSize(Number(e.target.value))
                }}
                className="h-7 rounded-md border border-input bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              >
                {[5, 10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            {/* Page Navigation Buttons */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] mr-2">
                Page <strong className="text-foreground">{pageIndex + 1}</strong> of{" "}
                <strong className="text-foreground">{totalPages}</strong>
              </span>

              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => table.setPageIndex(0)}
                disabled={pageIndex === 0 || isLoading}
                title="First Page"
                className="h-7 w-7 rounded-md disabled:opacity-40"
              >
                <ChevronsLeft className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage() && pageIndex === 0 || isLoading}
                title="Previous Page"
                className="h-7 w-7 rounded-md disabled:opacity-40"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => table.nextPage()}
                disabled={pageIndex >= totalPages - 1 || isLoading}
                title="Next Page"
                className="h-7 w-7 rounded-md disabled:opacity-40"
              >
                <ChevronRight className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => table.setPageIndex(totalPages - 1)}
                disabled={pageIndex >= totalPages - 1 || isLoading}
                title="Last Page"
                className="h-7 w-7 rounded-md disabled:opacity-40"
              >
                <ChevronsRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DataTable
