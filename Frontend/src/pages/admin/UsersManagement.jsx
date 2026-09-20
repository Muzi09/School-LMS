import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useFormik } from "formik"
import {
  Users,
  ShieldCheck,
  Briefcase,
  Lock,
  Mail,
  Phone,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Loader2,
  UserPlus,
} from "lucide-react"
import { adminService } from "@/api/adminService"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ModalHeader } from "@/components/common/ModalHeader"
import { PageHeader } from "@/components/common/PageHeader"
import { formatDateTime } from "@/lib/utils"
import { userValidationSchema } from "@/validations"

export function PlatformUsersManagement() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState(0) // 0 = ADMIN, 4 = SALES_PERSON
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const { data: platformUsers, isLoading } = useQuery({
    queryKey: ["adminPlatformUsers"],
    queryFn: adminService.getPlatformUsers,
  })

  const createMutation = useMutation({
    mutationFn: ({ values, role }) => adminService.createPlatformUser(values, role),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["adminPlatformUsers"] })
      queryClient.invalidateQueries({ queryKey: ["adminStats"] })
      queryClient.invalidateQueries({ queryKey: ["superAdminPlatformUsers"] })
      queryClient.invalidateQueries({ queryKey: ["superAdminStats"] })
      setSuccessMessage(
        `Successfully created ${selectedRole === 0 ? "Admin" : "Sales Person"} account for ${data.first_name} ${data.last_name}!`
      )
      formik.resetForm()
      setTimeout(() => {
        setIsModalOpen(false)
        setSuccessMessage(null)
      }, 1200)
    },
    onError: (err) => {
      setServerError(err.message || "Failed to create user account.")
    },
  })

  const formik = useFormik({
    initialValues: {
      first_name: "",
      last_name: "",
      email: "",
      login_mobile: "",
      password: "",
    },
    validationSchema: userValidationSchema,
    onSubmit: (values) => {
      setServerError(null)
      setSuccessMessage(null)
      createMutation.mutate({ values, role: selectedRole })
    },
  })

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setServerError(null)
    setSuccessMessage(null)
    formik.resetForm()
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={Users}
        iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
        title="Platform Administrators & Sales"
        description="Manage Admin platform administrators and Sales Person representatives."
      >
        <Button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="h-9 px-4 text-sm font-medium rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
        >
          <UserPlus className="size-4" />
          <span>Create Platform User</span>
        </Button>
      </PageHeader>

      {/* Platform Users Table */}
      <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !platformUsers || platformUsers.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Users className="size-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="text-base font-semibold text-foreground">No Platform Users Found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Create an additional Admin or Sales Person account to collaborate on the platform.
            </p>
            <Button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-4 h-9 px-4 text-xs font-medium rounded-xl bg-amber-600 hover:bg-amber-700 text-white inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="size-3.5" />
              <span>Create Platform User</span>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="px-6 py-3.5">User</th>
                  <th className="px-6 py-3.5">Role</th>
                  <th className="px-6 py-3.5">Contact Details</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Registered Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70 text-sm">
                {platformUsers.map((u) => {
                  const isAdmin = u.role === 0
                  return (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`size-10 rounded-xl border flex items-center justify-center font-bold text-sm ${
                              isAdmin
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                                : "bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                            }`}
                          >
                            {u.first_name?.[0]}
                            {u.last_name?.[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">
                              {u.first_name} {u.last_name}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              ID: {u.id.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <Badge
                          variant="outline"
                          className={`gap-1 text-xs py-0.5 whitespace-nowrap ${
                            isAdmin
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                              : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30"
                          }`}
                        >
                          {isAdmin ? (
                            <>
                              <ShieldCheck className="size-3.5" /> Admin
                            </>
                          ) : (
                            <>
                              <Briefcase className="size-3.5" /> Sales Person
                            </>
                          )}
                        </Badge>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-foreground text-xs">
                            <Mail className="size-3 text-muted-foreground" />
                            <span>{u.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-mono">
                            <Phone className="size-3 text-muted-foreground" />
                            <span>{u.login_mobile}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <Badge
                          variant="outline"
                          className={`gap-1 text-xs py-0.5 whitespace-nowrap ${
                            u.is_active
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                              : "bg-destructive/10 text-destructive border-destructive/30"
                          }`}
                        >
                          {u.is_active ? (
                            <>
                              <CheckCircle2 className="size-3.5" /> Active
                            </>
                          ) : (
                            <>
                              <AlertCircle className="size-3.5" /> Inactive
                            </>
                          )}
                        </Badge>
                      </td>

                      <td className="px-6 py-4 text-xs font-mono text-foreground">
                        {u.created_at ? formatDateTime(u.created_at) : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Platform User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200">
          <div className="relative w-full max-w-lg bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <ModalHeader
              icon={UserPlus}
              iconClassName="bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
              title="Create Platform User"
              description="Register a new Admin or Sales Person platform account"
              onClose={handleCloseModal}
            />

            {/* Modal Body */}
            <div className="p-6 space-y-4">
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

              {/* Role Selector */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-2">Select User Role</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRole(0)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      selectedRole === 0
                        ? "border-amber-500 bg-amber-500/10 shadow-xs"
                        : "border-border bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="size-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <ShieldCheck className="size-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-foreground">Admin</div>
                      <div className="text-[10px] text-muted-foreground">Full Platform Access</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole(4)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      selectedRole === 4
                        ? "border-cyan-500 bg-cyan-500/10 shadow-xs"
                        : "border-border bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="size-8 rounded-lg bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                      <Briefcase className="size-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-foreground">Sales Person</div>
                      <div className="text-[10px] text-muted-foreground">Sales Role</div>
                    </div>
                  </button>
                </div>
              </div>

              <form onSubmit={formik.handleSubmit} className="space-y-4 pt-1">
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">First Name</label>
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
                    <label className="text-xs font-semibold text-foreground block mb-1">Last Name</label>
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
                  <label className="text-xs font-semibold text-foreground block mb-1">Email Address</label>
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
                  <label className="text-xs font-semibold text-foreground block mb-1">Mobile Number</label>
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

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Initial Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formik.values.password}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      className="pl-9 pr-10 h-10 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {formik.touched.password && formik.errors.password && (
                    <p className="text-[11px] font-medium text-destructive mt-1 leading-tight">
                      {formik.errors.password}
                    </p>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
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
                    className="h-9 px-5 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shadow-xs"
                  >
                    {createMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                    <span>
                      {createMutation.isPending
                        ? "Creating..."
                        : `Create ${selectedRole === 0 ? "Admin" : "Sales Person"}`}
                    </span>
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PlatformUsersManagement
