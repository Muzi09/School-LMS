import React, { useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ShieldCheck,
  LayoutDashboard,
  GraduationCap,
  Users,
  LogOut,
  Sun,
  Moon,
  Building2,
  Mail,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useTheme } from "@/context/ThemeContext"
import { adminService } from "@/api/adminService"
import { Button } from "@/components/ui/button"
import { SmtpConfigModal } from "@/components/admin/SmtpConfigModal"

export function AdminLayout() {
  const { user, logout } = useAuth()
  const { resolvedTheme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false)

  const { data: smtpConfig } = useQuery({
    queryKey: ["adminSmtpConfig"],
    queryFn: adminService.getSmtpConfig,
    staleTime: 30 * 1000,
  })

  const isSmtpConfigured = Boolean(smtpConfig?.is_configured)

  const handleLogout = () => {
    logout()
    navigate("/admin/login", { replace: true })
  }

  const navItems = [
    {
      label: "Dashboard",
      to: "/admin/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Principals & Schools",
      to: "/admin/principals",
      icon: GraduationCap,
    },
    {
      label: "Platform Admins",
      to: "/admin/users",
      icon: Users,
    },
  ]

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Admin Fixed Sidebar */}
      <aside className="w-64 h-full border-r border-border bg-card flex flex-col shrink-0 z-20">
        {/* Brand Header */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-border shrink-0">
          <div className="size-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-xs">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-foreground">Platform Admin</h1>
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
              Admin Portal
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5">
          <div className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Platform Management
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold shadow-xs border border-amber-500/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`
                }
              >
                <Icon className="size-4.5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Admin User Footer */}
        <div className="p-4 border-t border-border bg-muted/20 shrink-0">
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="size-8 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center text-xs shrink-0">
                {user?.first_name?.[0]}
                {user?.last_name?.[0]}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-foreground truncate leading-tight">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="flex-1 text-xs h-8 border-border inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              {resolvedTheme === "dark" ? <Sun className="size-3.5 text-amber-400" /> : <Moon className="size-3.5" />}
              <span>{resolvedTheme === "dark" ? "Light" : "Dark"}</span>
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleLogout}
              className="flex-1 text-xs h-8 inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <LogOut className="size-3.5" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 shrink-0 border-b border-border bg-card/40 backdrop-blur-xs flex items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <Building2 className="size-4 text-primary" />
            <span>School LMS Central Platform</span>
          </div>

          <div className="flex items-center gap-3">
            {/* SMTP Configuration Button (Red & Pulsing if not configured) */}
            <button
              type="button"
              onClick={() => setIsSmtpModalOpen(true)}
              className={
                isSmtpConfigured
                  ? "h-8 px-3 text-xs font-medium rounded-xl border border-border bg-card hover:bg-muted text-foreground inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-all shadow-2xs cursor-pointer"
                  : "h-8 px-3 text-xs font-semibold rounded-xl bg-destructive/10 text-destructive border border-destructive/40 hover:bg-destructive/20 inline-flex items-center justify-center gap-2 whitespace-nowrap animate-pulse transition-all shadow-xs cursor-pointer"
              }
              title={isSmtpConfigured ? "SMTP Email Server Configured" : "SMTP Configuration Required for Principal Invitations"}
            >
              {isSmtpConfigured ? (
                <>
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span>SMTP Config</span>
                </>
              ) : (
                <>
                  <span className="relative flex size-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                    <span className="relative inline-flex rounded-full size-2 bg-destructive"></span>
                  </span>
                  <span>SMTP Config</span>
                </>
              )}
            </button>

            <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-2.5 py-1 rounded-md border border-border hidden sm:inline-block">
              Logged in as: <strong className="text-foreground">{user?.email}</strong>
            </span>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-muted/15">
          <div className="mx-auto max-w-6xl">
            <Outlet context={{ isSmtpConfigured, openSmtpModal: () => setIsSmtpModalOpen(true) }} />
          </div>
        </main>
      </div>

      {/* Admin SMTP Configuration Modal */}
      <SmtpConfigModal
        isOpen={isSmtpModalOpen}
        onClose={() => setIsSmtpModalOpen(false)}
        existingConfig={smtpConfig}
      />
    </div>
  )
}

// Backward compatibility alias
export const SuperAdminLayout = AdminLayout

export default AdminLayout
