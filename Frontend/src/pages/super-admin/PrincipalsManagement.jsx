import React, { useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useFormik } from "formik"
import * as Yup from "yup"
import {
  GraduationCap,
  UserPlus,
  Mail,
  Phone,
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  X,
  AlertCircle,
  Link as LinkIcon,
} from "lucide-react"
import { superAdminService } from "@/api/superAdminService"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils"

const principalValidationSchema = Yup.object().shape({
  first_name: Yup.string().trim().max(50, "Max 50 characters").required("First name is required"),
  last_name: Yup.string().trim().max(50, "Max 50 characters").required("Last name is required"),
  email: Yup.string()
    .trim()
    .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format")
    .required("Email is required"),
  login_mobile: Yup.string()
    .trim()
    .matches(/^\d{5,20}$/, "Mobile must be between 5 and 20 digits")
    .required("Mobile number is required"),
})

export function PrincipalsManagement() {
  const queryClient = useQueryClient()
  const outletContext = useOutletContext() || {}
  const isSmtpConfigured = Boolean(outletContext.isSmtpConfigured)
  const openSmtpModal = outletContext.openSmtpModal || (() => {})

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [serverError, setServerError] = useState(null)
  const [successInfo, setSuccessInfo] = useState(null)

  const { data: principals, isLoading } = useQuery({
    queryKey: ["superAdminPrincipals"],
    queryFn: superAdminService.getPrincipals,
  })

  const createMutation = useMutation({
    mutationFn: superAdminService.createPrincipal,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["superAdminPrincipals"] })
      queryClient.invalidateQueries({ queryKey: ["superAdminStats"] })
      setSuccessInfo({
        name: `${data.first_name} ${data.last_name}`,
        email: data.email,
        url: data.onboarding_url,
      })
      formik.resetForm()
    },
    onError: (err) => {
      setServerError(err.message || "Failed to create principal account.")
    },
  })

  const formik = useFormik({
    initialValues: {
      first_name: "",
      last_name: "",
      email: "",
      login_mobile: "",
    },
    validationSchema: principalValidationSchema,
    onSubmit: (values) => {
      setServerError(null)
      createMutation.mutate(values)
    },
  })

  const handleCopyLink = (url, id) => {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setServerError(null)
    setSuccessInfo(null)
    formik.resetForm()
  }

  const handleInviteClick = () => {
    if (!isSmtpConfigured) {
      openSmtpModal()
      return
    }
    setIsModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Page Header matching Main Application */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-xs">
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
              <GraduationCap className="size-5" />
            </div>
            <span>Principals & School Onboarding</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1 leading-normal">
            Create principal accounts and initiate multi-tenant school onboarding invitations.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            type="button"
            onClick={handleInviteClick}
            className={`h-9 px-4 text-sm font-medium rounded-xl text-white shadow-xs inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
              !isSmtpConfigured
                ? "bg-amber-600/70 hover:bg-amber-600"
                : "bg-amber-600 hover:bg-amber-700"
            }`}
            title={!isSmtpConfigured ? "Configure SMTP to enable inviting principals" : "Invite Principal"}
          >
            <UserPlus className="size-4" />
            <span>Invite Principal</span>
          </Button>
        </div>
      </div>

      {/* SMTP Missing Warning Banner */}
      {!isSmtpConfigured && (
        <div className="p-4 sm:p-5 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs animate-in fade-in-0 duration-300">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-xl bg-destructive/20 text-destructive shrink-0 mt-0.5 sm:mt-0">
              <AlertCircle className="size-5" />
            </div>
            <div>
              <p className="font-bold text-foreground leading-tight">
                SMTP Configuration Required Before Inviting Principals
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Outgoing email settings must be configured to deliver invitation links and school onboarding tokens.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={openSmtpModal}
            className="h-9 px-4 text-xs font-semibold rounded-xl bg-destructive text-white hover:bg-destructive/90 shrink-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shadow-xs"
          >
            <Mail className="size-3.5" />
            <span>Configure SMTP Now</span>
          </Button>
        </div>
      )}

      {/* Principals List */}
      <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !principals || principals.length === 0 ? (
          <div className="text-center py-16 px-4">
            <GraduationCap className="size-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="text-base font-semibold text-foreground">No Principals Registered</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Start by inviting your first school principal. They will receive an email invitation with a school setup link.
            </p>
            <Button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-4 h-9 px-4 text-xs font-medium rounded-xl bg-amber-600 hover:bg-amber-700 text-white inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="size-3.5" />
              <span>Invite Principal</span>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="px-6 py-3.5">Principal</th>
                  <th className="px-6 py-3.5">Contact Info</th>
                  <th className="px-6 py-3.5">School</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Invited / Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70 text-sm">
                {principals.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-sm">
                          {p.first_name?.[0]}{p.last_name?.[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">
                            {p.first_name} {p.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            ID: {p.id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-foreground text-xs">
                          <Mail className="size-3 text-muted-foreground" />
                          <span>{p.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-mono">
                          <Phone className="size-3 text-muted-foreground" />
                          <span>{p.login_mobile}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {p.school_name ? (
                        <div>
                          <div className="font-medium text-foreground text-xs flex items-center gap-1.5">
                            <Building2 className="size-3.5 text-primary" />
                            {p.school_name}
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                            Code: {p.school_code || "—"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Not configured yet
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <Badge
                        variant="outline"
                        className={`gap-1 text-xs py-0.5 whitespace-nowrap ${
                          p.school_setup_completed
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {p.school_setup_completed ? (
                          <>
                            <CheckCircle2 className="size-3.5" /> Active & Completed
                          </>
                        ) : (
                          <>
                            <Clock className="size-3.5" /> Pending Setup
                          </>
                        )}
                      </Badge>
                    </td>

                    <td className="px-6 py-4 text-xs font-mono text-foreground">
                      {p.created_at ? formatDateTime(p.created_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Principal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200">
          <div className="relative w-full max-w-lg bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <UserPlus className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Invite New Principal</h3>
                  <p className="text-xs text-muted-foreground">
                    Principal will receive an onboarding invitation email
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="size-4.5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {successInfo ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <CheckCircle2 className="size-4.5" />
                      Invitation Sent Successfully!
                    </div>
                    <p className="text-xs mt-1 text-emerald-600 dark:text-emerald-400">
                      An invitation email has been triggered to <strong>{successInfo.email}</strong>.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <LinkIcon className="size-3.5 text-primary" /> Onboarding Setup Link:
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={successInfo.url}
                        className="flex-1 text-xs font-mono p-2 bg-background rounded-lg border border-border text-foreground"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyLink(successInfo.url, "modal-link")}
                        className="h-8 text-xs border-border inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        {copiedId === "modal-link" ? (
                          <>
                            <Check className="size-3.5 text-emerald-500" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5" /> Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-full h-10 text-sm font-medium rounded-xl bg-primary text-primary-foreground inline-flex items-center justify-center whitespace-nowrap mt-4"
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <form onSubmit={formik.handleSubmit} className="space-y-4">
                  {serverError && (
                    <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
                      <AlertCircle className="size-4 shrink-0 mt-0.5" />
                      <span>{serverError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-xs font-semibold text-foreground block mb-1">
                        First Name
                      </label>
                      <Input
                        type="text"
                        name="first_name"
                        maxLength={50}
                        value={formik.values.first_name}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        className="h-10 text-sm"
                      />
                      {formik.touched.first_name && formik.errors.first_name && (
                        <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                          {formik.errors.first_name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-foreground block mb-1">
                        Last Name
                      </label>
                      <Input
                        type="text"
                        name="last_name"
                        maxLength={50}
                        value={formik.values.last_name}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        className="h-10 text-sm"
                      />
                      {formik.touched.last_name && formik.errors.last_name && (
                        <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                          {formik.errors.last_name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        type="email"
                        name="email"
                        value={formik.values.email}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        className="pl-9 h-10 text-sm"
                      />
                    </div>
                    {formik.touched.email && formik.errors.email && (
                      <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                        {formik.errors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Mobile Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        name="login_mobile"
                        maxLength={20}
                        value={formik.values.login_mobile}
                        onChange={(e) => {
                          const onlyNums = e.target.value.replace(/\D/g, "")
                          formik.setFieldValue("login_mobile", onlyNums)
                        }}
                        onBlur={formik.handleBlur}
                        className="pl-9 h-10 text-sm font-mono"
                      />
                    </div>
                    {formik.touched.login_mobile && formik.errors.login_mobile && (
                      <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                        {formik.errors.login_mobile}
                      </p>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground leading-relaxed">
                    💡 <strong>Note:</strong> Super Admin does not set passwords or configure school details. The Principal will complete school setup and create their own Password & Quick Login PIN via the onboarding link.
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCloseModal}
                      className="h-9 px-4 text-xs font-medium rounded-xl border-border inline-flex items-center justify-center whitespace-nowrap"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="h-9 px-5 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      {createMutation.isPending ? "Creating..." : "Send Invitation"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default PrincipalsManagement
