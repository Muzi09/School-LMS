import React from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import {
  Building2,
  GraduationCap,
  CheckCircle2,
  Clock,
  Users,
  UserPlus,
  ArrowRight,
} from "lucide-react"
import { adminService } from "@/api/adminService"
import { Button } from "@/components/ui/button"

export function AdminDashboard() {
  const navigate = useNavigate()

  const { data: stats, isLoading } = useQuery({
    queryKey: ["adminStats"],
    queryFn: adminService.getDashboardStats,
  })

  const { data: principals, isLoading: isPrincipalsLoading } = useQuery({
    queryKey: ["adminPrincipals"],
    queryFn: adminService.getPrincipals,
  })

  const statCards = [
    {
      title: "Total Schools",
      value: stats?.total_schools ?? 0,
      icon: Building2,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      title: "Active Schools",
      value: stats?.total_active_schools ?? 0,
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      title: "Total Principals",
      value: stats?.total_principals ?? 0,
      icon: GraduationCap,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/20",
    },
    {
      title: "Pending Setups",
      value: stats?.total_pending_setups ?? 0,
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      title: "Sales Persons",
      value: stats?.total_sales_persons ?? 0,
      icon: Users,
      color: "text-cyan-600 dark:text-cyan-400",
      bg: "bg-cyan-500/10 border-cyan-500/20",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Top Banner / Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-xs">
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
              <Building2 className="size-5" />
            </div>
            <span>Platform Overview</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1 leading-normal">
            Manage school tenancies, onboard new principals, and monitor platform health.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.title}
              className="p-5 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {card.title}
                </span>
                <div className={`size-8 rounded-xl flex items-center justify-center border ${card.bg} ${card.color}`}>
                  <Icon className="size-4" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {isLoading ? "—" : card.value}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Principals Section */}
      <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden">
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-foreground">Recent Principals</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Latest onboarded and pending school administrators
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate("/admin/principals")}
            className="h-8 px-3 text-xs font-medium border-border inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <span>View All</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>

        <div className="p-6">
          {isPrincipalsLoading ? (
            <div className="flex justify-center py-8">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !principals || principals.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-muted-foreground">No principals created yet.</p>
              <Button
                type="button"
                onClick={() => navigate("/admin/principals")}
                className="mt-3 h-9 px-4 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-xl inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <UserPlus className="size-3.5" />
                <span>Invite First Principal</span>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {principals.slice(0, 5).map((p) => (
                <div key={p.id} className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-sm">
                      {p.first_name?.[0]}{p.last_name?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {p.first_name} {p.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{p.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-medium text-foreground">
                        {p.school_name || "School Setup Pending"}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground">{p.login_mobile}</p>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${
                        p.school_setup_completed
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {p.school_setup_completed ? "Active & Setup Complete" : "Pending Setup"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Backward compatibility alias
export const SuperAdminDashboard = AdminDashboard

export default AdminDashboard
