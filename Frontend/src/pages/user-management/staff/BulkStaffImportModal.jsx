import React, { useState, useRef, useMemo } from "react"
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Copy,
  Check,
  Loader2,
  ArrowRight,
  ArrowLeft,
  FileText,
  Mail,
  ShieldCheck,
  Info,
  ExternalLink,
  ShieldAlert,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip"
import { ModalHeader } from "@/components/common/ModalHeader"
import {
  downloadStaffImportSampleApi,
  previewBulkStaffImportApi,
  createBulkStaffImportApi,
} from "@/api/staffService"
import {
  validateXlsxFileClient,
  downloadBlob,
  exportErrorReportXlsx,
  exportResultsXlsx,
  EXPECTED_COLUMNS,
} from "@/utils/staffImportUtils"
import { cn } from "@/lib/utils"

export function BulkStaffImportModal({ isOpen, onClose, onImportSuccess }) {
  // Wizard steps: 1 = Upload, 2 = Review, 3 = Complete
  const [currentStep, setCurrentStep] = useState(1)

  // Step 1 states
  const [selectedFile, setSelectedFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [clientValidation, setClientValidation] = useState(null)
  const [isDownloadingSample, setIsDownloadingSample] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const fileInputRef = useRef(null)

  // Step 2 states (Preview)
  const [previewData, setPreviewData] = useState(null)
  const [reviewTabFilter, setReviewTabFilter] = useState("ALL") // "ALL" | "READY" | "DUPLICATES" | "INVALID"
  const [showConfirmCreate, setShowConfirmCreate] = useState(false)

  // Step 3 states (Creation & Results)
  const [isCreating, setIsCreating] = useState(false)
  const [creationResult, setCreationResult] = useState(null)
  const [copiedLinksMap, setCopiedLinksMap] = useState({})
  const [isAllCopied, setIsAllCopied] = useState(false)
  const [generalError, setGeneralError] = useState("")

  // Reset state when modal is closed
  const handleModalClose = () => {
    if (isCreating) return // prevent close during submission
    setSelectedFile(null)
    setClientValidation(null)
    setPreviewData(null)
    setCreationResult(null)
    setCopiedLinksMap({})
    setIsAllCopied(false)
    setGeneralError("")
    setCurrentStep(1)
    setReviewTabFilter("ALL")
    setShowConfirmCreate(false)
    onClose()
  }

  // Handle Download Sample XLSX
  const handleDownloadSample = async () => {
    try {
      setIsDownloadingSample(true)
      const res = await downloadStaffImportSampleApi()
      const blob = new Blob([res.data || res], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      downloadBlob(blob, "staff_bulk_import_sample.xlsx")
    } catch (err) {
      alert(err.response?.data?.detail || err.message || "Failed to download sample XLSX template.")
    } finally {
      setIsDownloadingSample(false)
    }
  }

  // Handle File Selection
  const handleFileChange = async (file) => {
    setGeneralError("")
    if (!file) return

    setSelectedFile(file)
    setIsAnalyzing(true)

    try {
      const validation = await validateXlsxFileClient(file)
      setClientValidation(validation)
    } catch (err) {
      setClientValidation({
        isValid: false,
        error: err.message || "Failed to validate file structure.",
        missingColumns: [],
        unexpectedColumns: [],
        rowCount: 0,
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      handleFileChange(files[0])
    }
  }

  // Proceed to Step 2 (Server-side dry-run validation)
  const handleProceedToReview = async () => {
    if (!selectedFile || !clientValidation?.isValid) return
    setIsAnalyzing(true)
    setGeneralError("")

    try {
      const res = await previewBulkStaffImportApi(selectedFile)
      const data = res?.data || res
      setPreviewData(data)
      setCurrentStep(2)
    } catch (err) {
      const errDetail = err.response?.data?.detail || err.message || "Failed to parse and validate file on server."
      setGeneralError(errDetail)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Execute Bulk Account Creation
  const handleExecuteImport = async () => {
    if (!selectedFile || !previewData || previewData.valid_rows === 0) return
    setShowConfirmCreate(false)
    setIsCreating(true)
    setGeneralError("")
    setCurrentStep(3)

    try {
      const res = await createBulkStaffImportApi(selectedFile)
      const data = res?.data || res
      setCreationResult(data)
      if (onImportSuccess) {
        onImportSuccess()
      }
    } catch (err) {
      const errDetail = err.response?.data?.detail || err.message || "Failed to execute bulk staff import."
      setGeneralError(errDetail)
    } finally {
      setIsCreating(false)
    }
  }

  // Copy single setup link
  const handleCopyLink = (rowNumber, url) => {
    if (!url) return
    navigator.clipboard.writeText(url)
    setCopiedLinksMap((prev) => ({ ...prev, [rowNumber]: true }))
    setTimeout(() => {
      setCopiedLinksMap((prev) => ({ ...prev, [rowNumber]: false }))
    }, 2000)
  }

  // Copy all setup links in a clean shareable message
  const handleCopyAllLinks = () => {
    if (!creationResult?.results) return
    const createdItems = creationResult.results.filter((r) => r.created && r.setup_url)
    if (createdItems.length === 0) return

    const lines = createdItems.map((r) => `${r.name} - ${r.roll_no}\n${r.setup_url}`).join("\n\n")

    navigator.clipboard.writeText(lines)
    setIsAllCopied(true)
    setTimeout(() => setIsAllCopied(false), 2500)
  }

  // Filtered rows for Step 2 preview table
  const filteredPreviewRows = useMemo(() => {
    if (!previewData?.rows) return []
    if (reviewTabFilter === "READY") {
      return previewData.rows.filter((r) => r.status === "VALID")
    }
    if (reviewTabFilter === "DUPLICATES") {
      return previewData.rows.filter((r) => r.status === "DUPLICATE")
    }
    if (reviewTabFilter === "INVALID") {
      return previewData.rows.filter((r) => r.status === "INVALID")
    }
    return previewData.rows
  }, [previewData, reviewTabFilter])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200"
        onClick={handleModalClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh] animate-in fade-in-0 zoom-in-95 duration-200">
        <ModalHeader
          title="Bulk Staff Import"
          description="Create multiple staff accounts simultaneously via an XLSX spreadsheet."
          onClose={handleModalClose}
        />

        {/* 3-Step Wizard Navigation Indicator */}
        <div className="border-b border-border bg-muted/40 px-6 py-3.5">
          <div className="flex items-center justify-between mx-auto">
            {/* Step 1 */}
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "size-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                  currentStep === 1
                    ? "bg-primary text-primary-foreground shadow-xs ring-4 ring-primary/20"
                    : currentStep > 1
                      ? "bg-emerald-600 text-white"
                      : "bg-muted text-muted-foreground border border-border"
                )}
              >
                {currentStep > 1 ? <Check className="size-4" /> : "1"}
              </div>
              <div className="hidden sm:block">
                <span
                  className={cn(
                    "text-sm font-semibold block",
                    currentStep === 1 ? "text-primary font-bold" : "text-foreground"
                  )}
                >
                  Upload Excel File
                </span>
                <span className="text-[11px] text-muted-foreground block">Select & Upload</span>
              </div>
            </div>

            <div className={cn("h-0.5 flex-1 mx-3 sm:mx-4 transition-colors", currentStep > 1 ? "bg-emerald-600" : "bg-border")} />

            {/* Step 2 */}
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "size-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                  currentStep === 2
                    ? "bg-primary text-primary-foreground shadow-xs ring-4 ring-primary/20"
                    : currentStep > 2
                      ? "bg-emerald-600 text-white"
                      : "bg-muted text-muted-foreground border border-border"
                )}
              >
                {currentStep > 2 ? <Check className="size-4" /> : "2"}
              </div>
              <div className="hidden sm:block">
                <span
                  className={cn(
                    "text-sm font-semibold block",
                    currentStep === 2 ? "text-primary font-bold" : "text-foreground"
                  )}
                >
                  Review Import
                </span>
                <span className="text-[11px] text-muted-foreground block">Validate & Preview</span>
              </div>
            </div>

            <div className={cn("h-0.5 flex-1 mx-3 sm:mx-4 transition-colors", currentStep > 2 ? "bg-emerald-600" : "bg-border")} />

            {/* Step 3 */}
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "size-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                  currentStep === 3
                    ? "bg-primary text-primary-foreground shadow-xs ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground border border-border"
                )}
              >
                3
              </div>
              <div className="hidden sm:block">
                <span
                  className={cn(
                    "text-sm font-semibold block",
                    currentStep === 3 ? "text-primary font-bold" : "text-foreground"
                  )}
                >
                  Complete
                </span>
                <span className="text-[11px] text-muted-foreground block">Accounts & Setup Links</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Top Error Alert if server error */}
          {generalError && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-3 animate-in fade-in-0">
              <AlertCircle className="size-5 shrink-0 mt-0.5" />
              <div className="flex-1 whitespace-pre-line">{generalError}</div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setGeneralError("")}
                className="size-6 text-destructive hover:bg-destructive/10"
              >
                <X className="size-4" />
              </Button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 1: UPLOAD XLSX */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in-0 duration-200">
              {/* Instructions and Download Template Box */}
              <div className="p-4 sm:p-5 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-semibold text-sm">
                    <FileSpreadsheet className="size-4" />
                    <span>Download Official Sample Template</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadSample}
                  disabled={isDownloadingSample}
                  className="h-9 px-4 font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/70 border-blue-300 dark:border-blue-800 gap-2 shrink-0 cursor-pointer shadow-2xs"
                >
                  {isDownloadingSample ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  <span>Download Sample XLSX</span>
                </Button>
              </div>

              {/* Upload Dropzone & Stateful Container */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileChange(e.target.files[0])
                    }
                  }}
                />

                {/* 1. Validating State */}
                {isAnalyzing ? (
                  <div
                    className="relative w-full rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-6 sm:p-8 flex flex-col items-center justify-center text-center min-h-[250px] sm:min-h-[260px] transition-all duration-200 animate-in fade-in-0"
                  >
                    <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-2xs mb-2.5">
                      <Loader2 className="size-6 animate-spin" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">Validating file structure...</p>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      {selectedFile?.name || "Reading worksheet and columns..."}
                    </p>
                  </div>
                ) : selectedFile && clientValidation && !clientValidation.isValid ? (
                  /* 2. Invalid File State (Replaces the dropzone in the exact same footprint) */
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDragging(true)
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={cn(
                      "relative w-full rounded-2xl border-2 border-dashed border-destructive/40 bg-destructive/5 p-6 sm:p-7 flex flex-col items-center justify-center text-center min-h-[250px] sm:min-h-[260px] transition-all duration-200 animate-in fade-in-0",
                      isDragging && "border-destructive bg-destructive/10 scale-[0.99]"
                    )}
                  >
                    <div className="flex items-center gap-2 text-destructive font-semibold text-sm sm:text-base">
                      <AlertTriangle className="size-5 shrink-0" />
                      <span>File structure doesn't match the expected staff import template</span>
                    </div>

                    <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>

                    <div className="my-2.5 space-y-2 max-w-lg w-full">
                      {clientValidation.missingColumns?.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-foreground/80 block">Missing columns</span>
                          <div className="flex flex-wrap items-center justify-center gap-1.5">
                            {clientValidation.missingColumns.map((col) => (
                              <span
                                key={col}
                                className="px-2.5 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-destructive/15 text-destructive border border-destructive/30 shadow-2xs"
                              >
                                {col}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {clientValidation.unexpectedColumns?.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-foreground/80 block">Unexpected columns</span>
                          <div className="flex flex-wrap items-center justify-center gap-1.5">
                            {clientValidation.unexpectedColumns.map((col) => (
                              <span
                                key={col}
                                className="px-2.5 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shadow-2xs"
                              >
                                {col}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {!clientValidation.missingColumns?.length && !clientValidation.unexpectedColumns?.length && clientValidation.error && (
                        <p className="text-xs text-destructive whitespace-pre-line max-w-md mx-auto">
                          {clientValidation.error}
                        </p>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                      Download the sample template and use its column names exactly.
                    </p>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-8 px-4 text-xs font-semibold gap-1.5 cursor-pointer shadow-2xs border-border bg-card hover:bg-accent text-foreground"
                    >
                      <UploadCloud className="size-3.5" />
                      <span>Replace file</span>
                    </Button>
                  </div>
                ) : selectedFile && clientValidation && clientValidation.isValid ? (
                  /* 3. Valid Upload State */
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDragging(true)
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={cn(
                      "relative w-full rounded-2xl border-2 border-dashed border-emerald-500/50 bg-emerald-500/5 p-6 sm:p-7 flex flex-col items-center justify-center text-center min-h-[250px] sm:min-h-[260px] transition-all duration-200 animate-in fade-in-0",
                      isDragging && "border-emerald-500 bg-emerald-500/10 scale-[0.99]"
                    )}
                  >
                    <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-2xs mb-2.5">
                      <CheckCircle2 className="size-6" />
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-bold text-foreground font-mono">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB • {clientValidation.rowCount} staff record{clientValidation.rowCount === 1 ? "" : "s"} found
                      </p>
                    </div>

                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      <Check className="size-3.5" />
                      <span>File structure verified • Ready for review</span>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-3 h-7 px-3 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Choose a different file
                    </Button>
                  </div>
                ) : (
                  /* 4. Initial Empty Upload State */
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDragging(true)
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "relative w-full rounded-2xl border-2 border-dashed p-6 sm:p-8 flex flex-col items-center justify-center text-center min-h-[250px] sm:min-h-[260px] cursor-pointer transition-all duration-200",
                      isDragging
                        ? "border-primary bg-primary/5 scale-[0.99]"
                        : "border-border hover:border-primary/50 hover:bg-muted/40"
                    )}
                  >
                    <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-2xs mb-2.5">
                      <UploadCloud className="size-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        Click to select an XLSX file or drag & drop here
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Only <span className="font-semibold text-foreground">.xlsx</span> files are supported (up to 10 MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: REVIEW IMPORT */}
          {/* ========================================================================= */}
          {currentStep === 2 && previewData && (
            <div className="space-y-6 animate-in fade-in-0 duration-200">



              {/* Informational & Warning Banners */}
              <div className="space-y-2.5">


                <>
                  {!previewData.is_smtp_configured && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-sm flex items-start gap-2.5">
                      <ShieldAlert className="size-4.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <p className="font-semibold text-foreground">Email Setup is not completed</p>
                        <p className="text-muted-foreground mt-0.5">
                          The Staff member will not receive their first-login link automatically. You can still create the account, and you will be provided a secure setup link to share with them manually after creation.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Total */}
                <div className="p-4 rounded-xl bg-card border border-border/80 shadow-2xs">
                  <span className="text-xs text-muted-foreground font-medium block">Total Rows</span>
                  <span className="text-2xl font-bold text-foreground tracking-tight mt-0.5 block">
                    {previewData.total_rows}
                  </span>
                </div>

                {/* Ready */}
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">Ready to Create</span>
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tracking-tight mt-0.5 block">
                    {previewData.valid_rows}
                  </span>
                </div>

                {/* Duplicates */}
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold">Duplicates</span>
                    <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-2xl font-bold text-amber-700 dark:text-amber-400 tracking-tight mt-0.5 block">
                    {previewData.duplicate_rows}
                  </span>
                </div>

                {/* Invalid */}
                <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-rose-700 dark:text-rose-400 font-semibold">Invalid Rows</span>
                    <AlertCircle className="size-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <span className="text-2xl font-bold text-rose-700 dark:text-rose-400 tracking-tight mt-0.5 block">
                    {previewData.invalid_rows}
                  </span>
                </div>
              </div>



              {/* Preview Table Header & Filter Tabs */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl w-fit">
                    <button
                      type="button"
                      onClick={() => setReviewTabFilter("ALL")}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                        reviewTabFilter === "ALL"
                          ? "bg-card text-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      All ({previewData.total_rows})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewTabFilter("READY")}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                        reviewTabFilter === "READY"
                          ? "bg-card text-emerald-600 dark:text-emerald-400 shadow-2xs"
                          : "text-muted-foreground hover:text-emerald-600"
                      )}
                    >
                      Ready ({previewData.valid_rows})
                    </button>
                    {previewData.duplicate_rows > 0 && (
                      <button
                        type="button"
                        onClick={() => setReviewTabFilter("DUPLICATES")}
                        className={cn(
                          "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                          reviewTabFilter === "DUPLICATES"
                            ? "bg-card text-amber-600 dark:text-amber-400 shadow-2xs"
                            : "text-muted-foreground hover:text-amber-600"
                        )}
                      >
                        Duplicates ({previewData.duplicate_rows})
                      </button>
                    )}
                    {previewData.invalid_rows > 0 && (
                      <button
                        type="button"
                        onClick={() => setReviewTabFilter("INVALID")}
                        className={cn(
                          "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                          reviewTabFilter === "INVALID"
                            ? "bg-card text-rose-600 dark:text-rose-400 shadow-2xs"
                            : "text-muted-foreground hover:text-rose-600"
                        )}
                      >
                        Invalid ({previewData.invalid_rows})
                      </button>
                    )}
                  </div>

                  {/* Optional UX Improvement: Download Error Report */}
                  {(previewData.duplicate_rows > 0 || previewData.invalid_rows > 0) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => exportErrorReportXlsx(previewData.rows)}
                      className="h-8 px-3 text-xs font-medium gap-1.5 cursor-pointer shadow-2xs border-border"
                    >
                      <Download className="size-3.5" />
                      <span>Download Error Report</span>
                    </Button>
                  )}
                </div>

                {/* Table Container */}
                <div className="border border-border/80 rounded-xl overflow-hidden bg-card">
                  <div className="overflow-x-auto max-h-72 divide-y divide-border">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-muted/70 sticky top-0 z-10 text-muted-foreground font-semibold">
                        <tr>
                          <th className="py-2.5 px-3 w-12 text-center">Row</th>
                          <th className="py-2.5 px-3">Name</th>
                          <th className="py-2.5 px-3">Email</th>
                          <th className="py-2.5 px-3">Mobile</th>
                          <th className="py-2.5 px-3">Gender</th>
                          <th className="py-2.5 px-3">DOB</th>
                          <th className="py-2.5 px-3 w-24">Status</th>
                          <th className="py-2.5 px-3">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredPreviewRows.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-muted-foreground">
                              No records match this filter.
                            </td>
                          </tr>
                        ) : (
                          filteredPreviewRows.map((r) => {
                            const isReady = r.status === "VALID"
                            const isDup = r.status === "DUPLICATE"
                            return (
                              <tr
                                key={r.row_number}
                                className={cn(
                                  "hover:bg-muted/40 transition-colors",
                                  isReady ? "" : isDup ? "bg-amber-500/5" : "bg-rose-500/5"
                                )}
                              >
                                <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">
                                  {r.row_number}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-foreground whitespace-nowrap">
                                  {r.data.first_name} {r.data.last_name}
                                </td>
                                <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[150px]">
                                  {r.data.email || "—"}
                                </td>
                                <td className="py-2.5 px-3 text-muted-foreground font-mono whitespace-nowrap">
                                  {r.data.login_mobile || "—"}
                                </td>
                                <td className="py-2.5 px-3 text-muted-foreground capitalize whitespace-nowrap">
                                  {r.data.gender || "—"}
                                </td>
                                <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                                  {r.data.date_of_birth || "—"}
                                </td>
                                <td className="py-2.5 px-3">
                                  {isReady && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                      Ready
                                    </span>
                                  )}
                                  {isDup && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                      Duplicate
                                    </span>
                                  )}
                                  {!isReady && !isDup && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                      Invalid
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  {r.errors?.length > 0 ? (
                                    <TooltipTrigger delay={0}>
                                      <div
                                        tabIndex={0}
                                        role="button"
                                        className={cn(
                                          "inline-flex items-center gap-1.5 max-w-[240px] text-xs font-normal cursor-pointer focus:outline-hidden group/reason",
                                          isDup ? "text-amber-700 dark:text-amber-400" : "text-rose-700 dark:text-rose-400"
                                        )}
                                      >
                                        <Info className="size-3.5 shrink-0 group-hover/reason:scale-110 transition-transform" />
                                        <span className="truncate group-hover/reason:underline">{r.errors[0]}</span>
                                      </div>
                                      <Tooltip
                                        placement="top"
                                        className="z-50 max-w-sm p-3 rounded-xl bg-popover text-popover-foreground border border-border shadow-2xl block text-left"
                                      >
                                        <div className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">
                                          {r.errors.length === 1 ? "Validation Reason" : `All Reasons (${r.errors.length})`}
                                        </div>
                                        <ul className="list-disc list-inside space-y-1 text-xs text-foreground">
                                          {r.errors.map((err, idx) => (
                                            <li key={idx} className="leading-snug">
                                              {err}
                                            </li>
                                          ))}
                                        </ul>
                                      </Tooltip>
                                    </TooltipTrigger>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: CREATION & COMPLETION */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in-0 duration-200">
              {isCreating ? (
                <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                    <Loader2 className="size-8 animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Creating Staff Accounts...</h3>
                    <p className="text-xs text-muted-foreground max-w-md">
                      Creating user profiles, generating secure onboarding tokens, and sending invitation emails. Please wait...
                    </p>
                  </div>
                </div>
              ) : creationResult ? (
                <div className="space-y-6">
                  {/* Results Banner */}
                  <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                        <CheckCircle2 className="size-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-foreground">Staff Import Complete</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {creationResult.created_count} staff accounts created successfully.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-emerald-500/20">
                      <div>
                        <span className="text-[11px] text-muted-foreground block">Accounts Created</span>
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          {creationResult.created_count}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground block">Invitations Sent</span>
                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {creationResult.email_sent_count}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground block">Manual Sharing Needed</span>
                        <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                          {creationResult.email_failed_count}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground block">Ignored / Failed</span>
                        <span className="text-lg font-bold text-slate-500">
                          {creationResult.duplicate_count + creationResult.invalid_count + creationResult.failed_count}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar: Copy All Links + Download Results */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Share the setup links with staff members who did not receive an invitation email
                    </p>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopyAllLinks}
                        disabled={creationResult.created_count === 0}
                        className="h-8 px-3 text-xs font-semibold gap-1.5 cursor-pointer shadow-2xs border-border"
                      >
                        {isAllCopied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                        <span>{isAllCopied ? "Copied All Links!" : "Copy All Links"}</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => exportResultsXlsx(creationResult.results)}
                        className="h-8 px-3 text-xs font-semibold gap-1.5 cursor-pointer shadow-2xs border-border"
                      >
                        <Download className="size-3.5" />
                        <span>Download Results</span>
                      </Button>
                    </div>
                  </div>

                  {/* Created Staff Results Table */}
                  <div className="border border-border/80 rounded-xl overflow-hidden bg-card">
                    <div className="overflow-x-auto max-h-72 divide-y divide-border">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-muted/70 sticky top-0 z-10 text-muted-foreground font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Staff Member</th>
                            <th className="py-2.5 px-3 font-mono">Staff ID</th>
                            <th className="py-2.5 px-3">Email</th>
                            <th className="py-2.5 px-3 w-24">Status</th>
                            <th className="py-2.5 px-3 w-28">Invitation</th>
                            <th className="py-2.5 px-3 text-right">Setup Link</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {creationResult.results
                            ?.filter((r) => r.created)
                            .map((r) => {
                              const isCopied = copiedLinksMap[r.row_number]
                              return (
                                <tr key={r.row_number} className="hover:bg-muted/40 transition-colors">
                                  <td className="py-2.5 px-3 font-medium text-foreground">
                                    {r.name}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono font-semibold text-foreground">
                                    {r.roll_no}
                                  </td>
                                  <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[150px]">
                                    {r.email}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                      Created
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    {r.email_sent ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                                        <Mail className="size-3" />
                                        <span>Email Sent</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                        <span>Manual Share</span>
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    {r.setup_url && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleCopyLink(r.row_number, r.setup_url)}
                                        className="h-7 px-2.5 text-xs font-semibold gap-1.5 cursor-pointer shadow-2xs border-border"
                                      >
                                        {isCopied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                                        <span>{isCopied ? "Copied" : "Copy Link"}</span>
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="border-t border-border bg-card px-6 py-4 flex items-center justify-between">
          {currentStep === 1 && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleModalClose}
                className="h-9 px-4 text-sm font-medium cursor-pointer"
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={handleProceedToReview}
                disabled={!selectedFile || !clientValidation?.isValid || isAnalyzing}
                className="h-9 px-5 text-sm font-semibold gap-2 shadow-xs cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Analyzing File...</span>
                  </>
                ) : (
                  <>
                    <span>Next</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </>
          )}

          {currentStep === 2 && previewData && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="h-9 px-4 text-xs font-medium gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleModalClose}
                  className="h-9 px-4 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  disabled={previewData.valid_rows === 0 || isCreating}
                  onClick={() => {
                    if (previewData.valid_rows >= 10) {
                      setShowConfirmCreate(true)
                    } else {
                      handleExecuteImport()
                    }
                  }}
                  className="h-9 px-5 text-xs font-bold gap-2 shadow-xs cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <span>
                    {previewData.valid_rows === 0
                      ? "No Valid Rows to Create"
                      : `Create ${previewData.valid_rows} Staff`}
                  </span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </>
          )}

          {currentStep === 3 && (
            <div className="w-full flex items-center justify-end">
              <Button
                type="button"
                onClick={handleModalClose}
                disabled={isCreating}
                className="h-9 px-6 text-xs font-semibold shadow-xs cursor-pointer"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog for large imports */}
      {showConfirmCreate && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in-0 zoom-in-95">
            <div className="size-12 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
              <ShieldCheck className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">Confirm Bulk Creation</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You are about to create <span className="font-bold text-foreground">{previewData?.valid_rows} staff accounts</span>.
                Each staff member will be placed in Pending Activation and issued a secure onboarding setup link. Continue?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowConfirmCreate(false)}
                className="h-8 px-4 text-xs font-medium cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleExecuteImport}
                className="h-8 px-5 text-xs font-bold shadow-xs cursor-pointer"
              >
                Yes, Create {previewData?.valid_rows} Staff
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
