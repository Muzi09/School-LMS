import React, { useMemo } from "react"
import {
  MaterialReactTable,
  useMaterialReactTable,
} from "material-react-table"
import { ThemeProvider, createTheme } from "@mui/material/styles"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { useTheme } from "@/context/ThemeContext"

/**
 * Common Material React Table (MRT v3) Component
 * Fully themed with application CSS variables and design tokens for a native shadcn aesthetic.
 */
export function DataTable({
  columns = [],
  data = [],
  isLoading = false,
  isFetching = false,
  isError = false,
  errorMessage = "An error occurred while loading data",
  rowCount,
  state = {},
  onPaginationChange,
  onGlobalFilterChange,
  onColumnFiltersChange,
  onSortingChange,
  manualPagination = false,
  manualFiltering = false,
  manualSorting = false,
  renderTopToolbarCustomActions,
  renderRowActions,
  enableRowActions = false,
  positionActionsColumn = "last",
  enableColumnOrdering = false,
  enableSorting = true,
  enablePagination = true,
  enableGlobalFilter = true,
  enableColumnFilters = false,
  enableDensityToggle = false,
  enableFullScreenToggle = false,
  enableHiding = false,
  initialState = { density: "compact" },
  muiTablePaperProps,
  ...restProps
}) {
  const { resolvedTheme } = useTheme()
  const isDark =
    resolvedTheme === "dark" ||
    (typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"))

  // Create MUI theme synchronized with dark/light mode and application font
  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: isDark ? "dark" : "light",
          background: {
            default: "transparent",
            paper: isDark ? "#171717" : "#ffffff",
          },
          text: {
            primary: isDark ? "#ededed" : "#171717",
            secondary: isDark ? "#a1a1aa" : "#71717a",
          },
          divider: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)",
          action: {
            hover: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
            selected: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
          },
        },
        typography: {
          fontFamily:
            "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: 13,
        },
        shape: {
          borderRadius: 12,
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
                backgroundColor: "var(--card)",
                color: "var(--card-foreground)",
              },
            },
          },
          MuiTableCell: {
            styleOverrides: {
              root: {
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.08)",
                color: "inherit",
              },
              head: {
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.03) !important" : "rgba(0, 0, 0, 0.03) !important",
                color: isDark ? "#a1a1aa !important" : "#71717a !important",
              },
            },
          },
          MuiTableRow: {
            styleOverrides: {
              root: {
                "&:hover": {
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.03) !important"
                    : "rgba(0, 0, 0, 0.02) !important",
                },
              },
              head: {
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.03) !important" : "rgba(0, 0, 0, 0.03) !important",
              },
            },
          },
          MuiTableHead: {
            styleOverrides: {
              root: {
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.03) !important" : "rgba(0, 0, 0, 0.03) !important",
              },
            },
          },
          MuiIconButton: {
            styleOverrides: {
              root: {
                color: "inherit",
                borderRadius: "8px",
                "&:hover": {
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.04)",
                },
              },
            },
          },
          MuiTablePagination: {
            styleOverrides: {
              root: {
                color: "inherit",
              },
              selectIcon: {
                color: "inherit",
              },
            },
          },
          MuiLinearProgress: {
            styleOverrides: {
              root: {
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
                "& .MuiLinearProgress-bar": {
                  backgroundColor: isDark ? "#ededed" : "#171717",
                },
              },
            },
          },
        },
      }),
    [isDark]
  )

  const table = useMaterialReactTable({
    columns,
    data,
    rowCount,
    manualPagination,
    manualFiltering,
    manualSorting,
    enableRowActions,
    positionActionsColumn,
    displayColumnDefOptions: {
      "mrt-row-actions": {
        header: "Actions",
        size: 100,
        muiTableHeadCellProps: {
          align: "right",
          sx: {
            textAlign: "right",
          },
        },
        muiTableBodyCellProps: {
          align: "right",
          sx: {
            textAlign: "right",
          },
        },
      },
    },
    mrtTheme: () => ({
      baseBackgroundColor: isDark ? "#171717" : "#ffffff",
      matchColor: isDark ? "#ffffff" : "#000000",
      menuBackgroundColor: isDark ? "#1e1e1e" : "#ffffff",
      pinnedRowBackgroundColor: isDark ? "#171717" : "#ffffff",
      selectedRowBackgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
    }),
    enableColumnOrdering,
    enableSorting,
    enablePagination,
    enableGlobalFilter,
    enableColumnFilters,
    enableDensityToggle,
    enableFullScreenToggle,
    enableHiding,
    renderTopToolbarCustomActions,
    renderRowActions,
    state: {
      isLoading: isLoading && data.length === 0,
      showProgressBars: isFetching,
      showAlertBanner: isError,
      ...state,
    },
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    onSortingChange,
    initialState: {
      density: "compact",
      pagination: { pageSize: 10, pageIndex: 0 },
      columnOrder: [
        ...columns.map((c) => c.id || c.accessorKey),
        "mrt-row-actions",
      ],
      ...initialState,
    },
    muiToolbarAlertBannerProps: isError
      ? {
          color: "error",
          children: errorMessage,
        }
      : undefined,
    muiTablePaperProps: {
      elevation: 0,
      sx: {
        borderRadius: "16px",
        border: isDark
          ? "1px solid rgba(255, 255, 255, 0.12)"
          : "1px solid rgba(0, 0, 0, 0.08)",
        overflow: "hidden",
        backgroundColor: "var(--card) !important",
        color: "var(--card-foreground) !important",
        boxShadow: isDark
          ? "0 1px 3px 0 rgba(0, 0, 0, 0.3)"
          : "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
      },
      ...muiTablePaperProps,
    },
    muiTableContainerProps: {
      sx: {
        backgroundColor: "var(--card) !important",
        maxHeight: "calc(100vh - 280px)",
      },
    },
    muiTableHeadProps: {
      sx: {
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.03) !important"
          : "rgba(0, 0, 0, 0.03) !important",
      },
    },
    muiTableHeadRowProps: {
      sx: {
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.03) !important"
          : "rgba(0, 0, 0, 0.03) !important",
      },
    },
    muiTableHeadCellProps: {
      sx: {
        fontWeight: 600,
        fontSize: "11px",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: isDark ? "#a1a1aa !important" : "#71717a !important",
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.03) !important"
          : "rgba(0, 0, 0, 0.03) !important",
        borderBottom: isDark
          ? "1px solid rgba(255, 255, 255, 0.1) !important"
          : "1px solid rgba(0, 0, 0, 0.08) !important",
        py: 1.25,
        "& .Mui-TableHeadCell-Content": {
          justifyContent: "space-between",
        },
        "& .Mui-TableHeadCell-Content-Labels": {
          color: "inherit",
        },
        "& .MuiTableSortLabel-root": {
          color: "inherit !important",
        },
        "& .MuiTableSortLabel-icon": {
          color: isDark ? "#a1a1aa !important" : "#71717a !important",
        },
      },
    },
    muiTableBodyProps: {
      sx: {
        backgroundColor: "var(--card) !important",
        "& tr:last-child td": {
          borderBottom: "none",
        },
      },
    },
    muiTableBodyCellProps: {
      sx: {
        fontSize: "12.5px",
        color: "var(--foreground) !important",
        py: 1.25,
        borderBottom: isDark
          ? "1px solid rgba(255, 255, 255, 0.06) !important"
          : "1px solid rgba(0, 0, 0, 0.06) !important",
      },
    },
    muiTableBodyRowProps: {
      sx: {
        backgroundColor: "var(--card) !important",
        transition: "background-color 0.15s ease",
        "&:hover": {
          backgroundColor: isDark
            ? "rgba(255, 255, 255, 0.035) !important"
            : "rgba(0, 0, 0, 0.02) !important",
        },
        "&.Mui-selected": {
          backgroundColor: isDark
            ? "rgba(255, 255, 255, 0.05) !important"
            : "rgba(0, 0, 0, 0.03) !important",
        },
        "&.Mui-selected:hover": {
          backgroundColor: isDark
            ? "rgba(255, 255, 255, 0.07) !important"
            : "rgba(0, 0, 0, 0.04) !important",
        },
      },
    },
    muiTopToolbarProps: {
      sx: {
        backgroundColor: "var(--card) !important",
        color: "var(--foreground) !important",
        p: 1.25,
        borderBottom: isDark
          ? "1px solid rgba(255, 255, 255, 0.06)"
          : "1px solid rgba(0, 0, 0, 0.06)",
      },
    },
    muiBottomToolbarProps: {
      sx: {
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.02) !important"
          : "rgba(0, 0, 0, 0.02) !important",
        borderTop: isDark
          ? "1px solid rgba(255, 255, 255, 0.08) !important"
          : "1px solid rgba(0, 0, 0, 0.08) !important",
        color: "var(--muted-foreground) !important",
      },
    },
    muiSearchTextFieldProps: {
      placeholder: "Search...",
      variant: "outlined",
      size: "small",
      sx: {
        "& .MuiOutlinedInput-root": {
          backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.02)",
          color: "var(--foreground)",
          fontSize: "12px",
          borderRadius: "8px",
          "& fieldset": {
            borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.15)",
          },
          "&:hover fieldset": {
            borderColor: isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)",
          },
        },
        "& .MuiSvgIcon-root": {
          color: "var(--muted-foreground)",
          fontSize: "18px",
        },
      },
    },
    muiPaginationProps: {
      rowsPerPageOptions: [5, 10, 20, 50],
      showFirstButton: true,
      showLastButton: true,
      sx: {
        color: "var(--muted-foreground)",
        fontSize: "12px",
      },
    },
    muiCircularProgressProps: {
      size: 32,
      sx: {
        color: "var(--foreground)",
      },
    },
    renderEmptyRowsFallback: () => (
      <Box sx={{ p: 5, textAlign: "center", color: "var(--muted-foreground)" }}>
        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "13px" }}>
          No records found
        </Typography>
      </Box>
    ),
    ...restProps,
  })

  return (
    <ThemeProvider theme={muiTheme}>
      <MaterialReactTable table={table} />
    </ThemeProvider>
  )
}

export default DataTable
