import * as XLSX from "xlsx"

export const EXPECTED_COLUMNS = [
  "first_name",
  "last_name",
  "login_mobile",
  "email",
  "gender",
  "date_of_birth",
]

export const COLUMN_LABELS = {
  first_name: "First Name",
  last_name: "Last Name",
  login_mobile: "Mobile Number",
  email: "Email Address",
  gender: "Gender (Male / Female / Other)",
  date_of_birth: "Date of Birth (YYYY-MM-DD)",
}

/**
 * Perform immediate client-side structural and header validation on selected XLSX file.
 */
export async function validateXlsxFileClient(file) {
  if (!file) {
    return {
      isValid: false,
      error: "No file selected.",
      missingColumns: [],
      unexpectedColumns: [],
      rowCount: 0,
    }
  }

  // 1. Check extension
  const fileName = file.name || ""
  if (!fileName.toLowerCase().endsWith(".xlsx")) {
    return {
      isValid: false,
      error: "Invalid file format. Only Excel (.xlsx) files are supported.",
      missingColumns: [],
      unexpectedColumns: [],
      rowCount: 0,
    }
  }

  // 2. Check file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return {
      isValid: false,
      error: "File size exceeds the 10 MB limit. Please upload a smaller file.",
      missingColumns: [],
      unexpectedColumns: [],
      rowCount: 0,
    }
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array" })

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        isValid: false,
        error: "The uploaded workbook contains no worksheets.",
        missingColumns: [],
        unexpectedColumns: [],
        rowCount: 0,
      }
    }

    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    // Convert sheet to array of rows
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false })

    if (!rows || rows.length === 0) {
      return {
        isValid: false,
        error: "The uploaded file is empty or missing headers.",
        missingColumns: EXPECTED_COLUMNS,
        unexpectedColumns: [],
        rowCount: 0,
      }
    }

    const rawHeaders = rows[0] || []
    // Filter trailing empty headers
    while (rawHeaders.length > 0 && (rawHeaders[rawHeaders.length - 1] === undefined || rawHeaders[rawHeaders.length - 1] === null || String(rawHeaders[rawHeaders.length - 1]).trim() === "")) {
      rawHeaders.pop()
    }

    if (rawHeaders.length === 0) {
      return {
        isValid: false,
        error: "Invalid file format. Header row is missing or empty.",
        missingColumns: EXPECTED_COLUMNS,
        unexpectedColumns: [],
        rowCount: 0,
      }
    }

    const stringHeaders = rawHeaders.map((h) => String(h ?? ""))
    const seen = new Set()
    const duplicateHeaders = []
    const unexpectedColumns = []
    const casingOrSpacingErrors = []

    stringHeaders.forEach((h) => {
      const clean = h.trim()
      if (!clean) return

      if (seen.has(clean)) {
        duplicateHeaders.push(clean)
      }
      seen.add(clean)

      if (h !== clean) {
        casingOrSpacingErrors.push(`Header '${h}' contains leading or trailing spaces`)
      } else if (h !== h.toLowerCase()) {
        casingOrSpacingErrors.push(`Header '${h}' must be all lowercase`)
      }

      if (!EXPECTED_COLUMNS.includes(clean)) {
        unexpectedColumns.push(clean)
      }
    })

    const missingColumns = EXPECTED_COLUMNS.filter((col) => !seen.has(col))

    if (duplicateHeaders.length > 0) {
      return {
        isValid: false,
        error: `Duplicate column headers found: ${duplicateHeaders.join(", ")}`,
        missingColumns,
        unexpectedColumns,
        rowCount: rows.length - 1,
      }
    }

    if (missingColumns.length > 0 || unexpectedColumns.length > 0 || casingOrSpacingErrors.length > 0) {
      let errorMsg = "Invalid file format. The uploaded file does not match the Staff Import template."
      if (casingOrSpacingErrors.length > 0) {
        errorMsg += `\n${casingOrSpacingErrors.join("; ")}`
      }
      return {
        isValid: false,
        error: errorMsg,
        missingColumns,
        unexpectedColumns,
        rowCount: Math.max(0, rows.length - 1),
      }
    }

    const dataRowCount = Math.max(0, rows.length - 1)
    if (dataRowCount === 0) {
      return {
        isValid: false,
        error: "The uploaded file does not contain any staff records.",
        missingColumns: [],
        unexpectedColumns: [],
        rowCount: 0,
      }
    }

    return {
      isValid: true,
      error: null,
      missingColumns: [],
      unexpectedColumns: [],
      rowCount: dataRowCount,
    }
  } catch (err) {
    return {
      isValid: false,
      error: `Could not parse XLSX file: ${err.message || "Workbook may be corrupt or unreadable."}`,
      missingColumns: [],
      unexpectedColumns: [],
      rowCount: 0,
    }
  }
}

/**
 * Trigger download of Blob data in the browser.
 */
export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}

/**
 * Generate and download an XLSX error report containing rejected/duplicate rows plus error reasons.
 */
export function exportErrorReportXlsx(rows = []) {
  const errorRows = rows.filter((r) => r.status === "DUPLICATE" || r.status === "INVALID" || (r.errors && r.errors.length > 0))
  if (errorRows.length === 0) return

  const data = errorRows.map((r) => ({
    Row: r.row_number,
    "First Name": r.data?.first_name || "",
    "Last Name": r.data?.last_name || "",
    "Login Mobile": r.data?.login_mobile || "",
    Email: r.data?.email || "",
    Gender: r.data?.gender || "",
    "Date of Birth": r.data?.date_of_birth || "",
    Status: r.status,
    "Error Reason": (r.errors || []).join("; "),
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Rejected_Staff_Rows")
  XLSX.writeFile(workbook, `staff_import_errors_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

/**
 * Generate and download an XLSX results report of created staff records and setup URLs.
 */
export function exportResultsXlsx(results = []) {
  const data = results.map((r) => ({
    "Staff ID": r.roll_no || "",
    Name: r.name || "",
    Email: r.email || "",
    Mobile: r.login_mobile || "",
    Status: r.status,
    Created: r.created ? "Yes" : "No",
    "Invitation Email Sent": r.email_sent ? "Yes" : "No",
    "Setup URL": r.setup_url || "",
    Notes: (r.errors || []).join("; "),
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Staff_Import_Results")
  XLSX.writeFile(workbook, `staff_import_results_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
