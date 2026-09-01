import React, { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useFormik } from "formik"
import * as Yup from "yup"
import {
  Mail,
  Server,
  Lock,
  Eye,
  EyeOff,
  Shield,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  KeyRound,
} from "lucide-react"
import { superAdminService } from "@/api/superAdminService"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function SmtpConfigModal({ isOpen, onClose, existingConfig = null }) {
  const queryClient = useQueryClient()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const isPasswordAlreadySet = Boolean(existingConfig?.is_password_set)

  const validationSchema = Yup.object().shape({
    smtp_host: Yup.string().trim().required("SMTP Host is required"),
    smtp_port: Yup.number()
      .typeError("Port must be a valid number")
      .integer("Port must be an integer")
      .min(1, "Minimum port is 1")
      .max(65535, "Maximum port is 65535")
      .required("Port is required"),
    smtp_username: Yup.string().trim().required("Username / Login is required"),
    smtp_password: isPasswordAlreadySet
      ? Yup.string().nullable()
      : Yup.string().trim().required("Password is required for initial setup"),
    from_email: Yup.string()
      .trim()
      .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format")
      .required("From Email is required"),
    from_name: Yup.string().trim().required("From Name is required"),
    security: Yup.string().oneOf(["TLS", "SSL", "NONE"]).required("Security mode is required"),
  })

  const formik = useFormik({
    initialValues: {
      smtp_host: existingConfig?.smtp_host || "",
      smtp_port: existingConfig?.smtp_port || 587,
      smtp_username: existingConfig?.smtp_username || "",
      smtp_password: "",
      from_email: existingConfig?.from_email || "",
      from_name: existingConfig?.from_name || "School LMS Platform",
      security: existingConfig?.security || "TLS",
    },
    validationSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setServerError("")
      setSuccessMessage("")

      try {
        const payload = {
          smtp_host: values.smtp_host.trim(),
          smtp_port: Number(values.smtp_port),
          smtp_username: values.smtp_username.trim(),
          smtp_password: values.smtp_password ? values.smtp_password.trim() : null,
          from_email: values.from_email.trim().toLowerCase(),
          from_name: values.from_name.trim(),
          security: values.security,
          is_active: true,
        }

        await superAdminService.saveSmtpConfig(payload)
        await queryClient.invalidateQueries({ queryKey: ["superAdminSmtpConfig"] })
        setSuccessMessage("SMTP configuration saved successfully!")
        setTimeout(() => {
          onClose()
        }, 1200)
      } catch (err) {
        setServerError(err?.message || "Failed to save SMTP configuration.")
      }
    },
  })

  if (!isOpen) return null

  const isPending = formik.isSubmitting

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-lg bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/70 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-xs">
              <Mail className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground tracking-tight">
                SMTP Email Server Config
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure your outgoing email settings for sending Principal invitations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Close"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={formik.handleSubmit} className="p-6 space-y-4">
          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="size-4.5 shrink-0 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          {serverError && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2.5">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span className="leading-tight">{serverError}</span>
            </div>
          )}

          {/* Server Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label htmlFor="smtp_host" className="text-xs font-semibold text-foreground block mb-1">
                SMTP Host
              </label>
              <div className="relative">
                <Server className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="smtp_host"
                  name="smtp_host"
                  value={formik.values.smtp_host}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={cn(
                    "pl-9 h-10 text-sm",
                    formik.touched.smtp_host && formik.errors.smtp_host && "border-destructive ring-1 ring-destructive/30"
                  )}
                />
              </div>
              {formik.touched.smtp_host && formik.errors.smtp_host && (
                <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                  {formik.errors.smtp_host}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="smtp_port" className="text-xs font-semibold text-foreground block mb-1">
                Port
              </label>
              <Input
                id="smtp_port"
                name="smtp_port"
                type="number"
                value={formik.values.smtp_port}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={cn(
                  "h-10 text-sm font-mono",
                  formik.touched.smtp_port && formik.errors.smtp_port && "border-destructive ring-1 ring-destructive/30"
                )}
              />
              {formik.touched.smtp_port && formik.errors.smtp_port && (
                <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                  {formik.errors.smtp_port}
                </p>
              )}
            </div>
          </div>

          {/* Username & Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="smtp_username" className="text-xs font-semibold text-foreground block mb-1">
                SMTP Username
              </label>
              <Input
                id="smtp_username"
                name="smtp_username"
                value={formik.values.smtp_username}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={cn(
                  "h-10 text-sm",
                  formik.touched.smtp_username && formik.errors.smtp_username && "border-destructive ring-1 ring-destructive/30"
                )}
              />
              {formik.touched.smtp_username && formik.errors.smtp_username && (
                <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                  {formik.errors.smtp_username}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="smtp_password" className="text-xs font-semibold text-foreground block mb-1">
                SMTP Password {isPasswordAlreadySet && <span className="text-muted-foreground font-normal">(Leave blank to keep current)</span>}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="smtp_password"
                  name="smtp_password"
                  type={showPassword ? "text" : "password"}
                  value={formik.values.smtp_password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={cn(
                    "pl-9 pr-9 h-10 text-sm",
                    formik.touched.smtp_password && formik.errors.smtp_password && "border-destructive ring-1 ring-destructive/30"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-1"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {formik.touched.smtp_password && formik.errors.smtp_password && (
                <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                  {formik.errors.smtp_password}
                </p>
              )}
            </div>
          </div>

          {/* From Email & From Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="from_email" className="text-xs font-semibold text-foreground block mb-1">
                From Email Address
              </label>
              <Input
                id="from_email"
                name="from_email"
                type="email"
                value={formik.values.from_email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={cn(
                  "h-10 text-sm",
                  formik.touched.from_email && formik.errors.from_email && "border-destructive ring-1 ring-destructive/30"
                )}
              />
              {formik.touched.from_email && formik.errors.from_email && (
                <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                  {formik.errors.from_email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="from_name" className="text-xs font-semibold text-foreground block mb-1">
                From Sender Name
              </label>
              <Input
                id="from_name"
                name="from_name"
                value={formik.values.from_name}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={cn(
                  "h-10 text-sm",
                  formik.touched.from_name && formik.errors.from_name && "border-destructive ring-1 ring-destructive/30"
                )}
              />
              {formik.touched.from_name && formik.errors.from_name && (
                <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                  {formik.errors.from_name}
                </p>
              )}
            </div>
          </div>

          {/* Security Mode */}
          <div>
            <label htmlFor="security" className="text-xs font-semibold text-foreground block mb-1">
              Encryption / Security Type
            </label>
            <select
              id="security"
              name="security"
              value={formik.values.security}
              onChange={(e) => {
                formik.handleChange(e)
                // Auto adjust default port if user switches security type
                if (e.target.value === "SSL" && formik.values.smtp_port === 587) {
                  formik.setFieldValue("smtp_port", 465)
                } else if (e.target.value === "TLS" && formik.values.smtp_port === 465) {
                  formik.setFieldValue("smtp_port", 587)
                }
              }}
              onBlur={formik.handleBlur}
              className="w-full h-10 rounded-xl border border-input bg-card px-3.5 py-2 text-sm text-foreground transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 cursor-pointer"
            >
              <option value="TLS">TLS (STARTTLS — Recommended for Port 587 / 25)</option>
              <option value="SSL">SSL (Direct SSL/TLS — Recommended for Port 465)</option>
              <option value="NONE">None (Plain / Insecure)</option>
            </select>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-[11px] text-muted-foreground flex items-start gap-2">
            <KeyRound className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Security Assurance:</strong> Your SMTP password is encrypted using symmetric Fernet encryption at rest and is never exposed in API responses or browser storage.
            </span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              className="h-9 px-4 text-xs font-medium rounded-xl border-border inline-flex items-center justify-center whitespace-nowrap"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="h-9 px-5 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              <span>{isPending ? "Saving..." : "Save Configuration"}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SmtpConfigModal
