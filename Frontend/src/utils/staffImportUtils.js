import { downloadBlob } from "@/lib/download"

export const SPECIMEN_COLUMNS = [
  "first_name",
  "last_name",
  "login_mobile",
  "email",
  "gender",
  "date_of_birth (YYYY-MM-DD)",
  "designation",
  "staff_type",
  "wings",
  "timings",
]

export function validateXlsxFileClient(file) {
  if (!file) return { isValid: false, error: "No file selected." }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { isValid: false, error: "Only Excel (.xlsx) files are supported." }
  }
  if (!file.size || file.size > 10 * 1024 * 1024) {
    return { isValid: false, error: "Upload a non-empty workbook of at most 10 MB." }
  }
  return { isValid: true, error: null }
}

export const MOCK_STAFF_RECORDS = [
  {
    first_name: "Rajesh",
    last_name: "Sharma",
    login_mobile: "9876543210",
    email: "rajesh.sharma@school.edu",
    gender: "Male",
    "date_of_birth (YYYY-MM-DD)": "1988-06-15",
    designation: "PGT Commerce",
    staff_type: "Academic",
    wings: "Senior",
    timings: "08:00-14:00",
  },
  {
    first_name: "Priya",
    last_name: "Patel",
    login_mobile: "9876543211",
    email: "priya.patel@school.edu",
    gender: "Female",
    "date_of_birth (YYYY-MM-DD)": "1992-09-22",
    designation: "Coordinator",
    staff_type: "Both",
    wings: "Primary, Middle",
    timings: "08:00-12:30, 14:00-16:30",
  },
  {
    first_name: "Amit",
    last_name: "Verma",
    login_mobile: "9876543212",
    email: "amit.verma@school.edu",
    gender: "Male",
    "date_of_birth (YYYY-MM-DD)": "1985-12-05",
    designation: "Accountant",
    staff_type: "Non-Academic",
    wings: "",
    timings: "09:00-17:00",
  },
]

export const INSTRUCTIONS_DATA = [
  { "Column Name": "first_name", Required: "Yes", Description: "Staff member's first name", "Accepted Format / Values": "1-100 characters text", Example: "Rajesh" },
  { "Column Name": "last_name", Required: "Yes", Description: "Staff member's last name", "Accepted Format / Values": "1-100 characters text", Example: "Sharma" },
  { "Column Name": "login_mobile", Required: "Yes", Description: "Mobile phone number used for login", "Accepted Format / Values": "10-15 digits only, no spaces or special symbols", Example: "9876543210" },
  { "Column Name": "email", Required: "Yes", Description: "Official email address (used for invitation link)", "Accepted Format / Values": "Valid email format, must be unique across all users", Example: "rajesh.sharma@school.edu" },
  { "Column Name": "gender", Required: "Yes", Description: "Staff member gender", "Accepted Format / Values": "Text value: 'Male', 'Female', or 'Other'", Example: "Male" },
  { "Column Name": "date_of_birth (YYYY-MM-DD)", Required: "Yes", Description: "Date of birth in YYYY-MM-DD format", "Accepted Format / Values": "YYYY-MM-DD format", Example: "1988-06-15" },
  { "Column Name": "designation", Required: "No", Description: "Staff designation (defaults to 'Teacher')", "Accepted Format / Values": "Text", Example: "PGT Commerce" },
  { "Column Name": "staff_type", Required: "No", Description: "Staff classification", "Accepted Format / Values": "'Academic', 'Non-Academic', or 'Both' (defaults to 'Academic')", Example: "Academic" },
  { "Column Name": "wings", Required: "Yes (if Academic)", Description: "School wings for academic staff. Mandatory if school has wings.", "Accepted Format / Values": "Comma-separated wing names (e.g. 'Primary, Middle')", Example: "Senior" },
  { "Column Name": "timings", Required: "No", Description: "Working hours / shifts for timetable", "Accepted Format / Values": "'HH:MM-HH:MM' or comma-separated for split shifts", Example: "08:00-14:00" },
]

export const EXCEL_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

/**
 * Generate official sample XLSX template on the client as a genuine Excel Blob.
 */
export async function generateSampleStaffXlsx(filename = "staff_bulk_import_sample.xlsx") {
  const XLSX = await import("xlsx")
  const workbook = XLSX.utils.book_new()

  // Sheet 1: Staff_Import_Template with headers and 3 mock records
  const templateSheet = XLSX.utils.json_to_sheet(MOCK_STAFF_RECORDS, {
    header: SPECIMEN_COLUMNS,
  })
  templateSheet["!cols"] = [
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 28 },
    { wch: 16 },
    { wch: 26 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 25 },
  ]
  XLSX.utils.book_append_sheet(workbook, templateSheet, "Staff_Import_Template")

  // Sheet 2: Instructions
  const instructionsSheet = XLSX.utils.json_to_sheet(INSTRUCTIONS_DATA)
  instructionsSheet["!cols"] = [
    { wch: 24 },
    { wch: 16 },
    { wch: 50 },
    { wch: 50 },
    { wch: 28 },
  ]
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions")

  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  const blob = new Blob([wbout], { type: EXCEL_MIME_TYPE })
  downloadBlob(blob, filename)
}

/**
 * Generate and download an XLSX error report containing rejected/duplicate rows plus error reasons.
 */
export async function exportErrorReportXlsx(rows = []) {
  const errorRows = rows.filter((r) => r.status === "DUPLICATE" || r.status === "INVALID" || (r.errors && r.errors.length > 0))
  if (errorRows.length === 0) return
  const XLSX = await import("xlsx")

  const data = errorRows.map((r) => ({
    Row: r.row_number,
    "First Name": r.data?.first_name || "",
    "Last Name": r.data?.last_name || "",
    "Login Mobile": r.data?.login_mobile || "",
    Email: r.data?.email || "",
    Gender: r.data?.gender || "",
    "Date of Birth": r.data?.date_of_birth || "",
    Designation: r.data?.designation || r.data?.tag || "Teacher",
    "Staff Type": r.data?.staff_type || "Academic",
    Wings: r.data?.wings || "",
    Timings: r.data?.timings || "",
    Status: r.status,
    "Error Reason": (r.errors || []).join("; "),
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Rejected_Staff_Rows")
  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  const blob = new Blob([wbout], { type: EXCEL_MIME_TYPE })
  downloadBlob(blob, `staff_import_errors_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

/**
 * Generate and download an XLSX results report of created staff records and setup URLs.
 */
export async function exportResultsXlsx(results = []) {
  const XLSX = await import("xlsx")
  const data = results.map((r) => ({
    "Staff ID": r.roll_no || "",
    Name: r.name || "",
    Designation: r.designation || r.tag || "Teacher",
    "Staff Type": r.staff_type || "Academic",
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
  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  const blob = new Blob([wbout], { type: EXCEL_MIME_TYPE })
  downloadBlob(blob, `staff_import_results_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
