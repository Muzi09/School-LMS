import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/context/ThemeContext"
import { AuthProvider } from "@/context/AuthContext"
import { queryClient } from "@/lib/queryClient"

import {
  AdminRoute,
  PrincipalRoute,
  AdminLoginRoute,
  PrincipalLoginRoute,
  PermissionRoute,
  AppIndexRoute,
} from "@/components/auth/ProtectedRoute"
import { Permission } from "@/lib/permissions"

import { Toaster } from "@/components/ui/sonner"

const lazyNamed = (load, name) => lazy(() => load().then(module => ({ default: module[name] })))

const AppLayout = lazyNamed(() => import("@/components/layout/AppLayout"), "AppLayout")
const AdminLayout = lazyNamed(() => import("@/components/layout/AdminLayout"), "AdminLayout")
const AdminLogin = lazyNamed(() => import("@/pages/admin/Login"), "AdminLogin")
const AdminDashboard = lazyNamed(() => import("@/pages/admin/Dashboard"), "AdminDashboard")
const PrincipalsManagement = lazyNamed(() => import("@/pages/admin/PrincipalsManagement"), "PrincipalsManagement")
const PlatformUsersManagement = lazyNamed(() => import("@/pages/admin/UsersManagement"), "PlatformUsersManagement")
const PrincipalLogin = lazyNamed(() => import("@/pages/principal/Login"), "PrincipalLogin")
const SchoolSetupWizard = lazyNamed(() => import("@/pages/principal/SchoolSetupWizard"), "SchoolSetupWizard")
const StaffAccountSetup = lazyNamed(() => import("@/pages/staff/StaffAccountSetup"), "StaffAccountSetup")
const StaffList = lazyNamed(() => import("@/pages/user-management/staff/StaffList"), "StaffList")
const StudentList = lazyNamed(() => import("@/pages/user-management/students/StudentList"), "StudentList")
const ChatPage = lazyNamed(() => import("@/pages/chat/ChatPage"), "ChatPage")
const TimeTable = lazyNamed(() => import("@/pages/timetable/TimeTable"), "TimeTable")
const ManageSchool = lazyNamed(() => import("@/pages/school-management/ManageSchool"), "ManageSchool")

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="school-lms-theme">
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<p role="status" className="p-6 text-muted-foreground">Loading…</p>}>
              <Routes>
                {/* Admin Login (Only redirects if already Admin) */}
                <Route element={<AdminLoginRoute />}>
                  <Route path="/admin/login" element={<AdminLogin />} />
                </Route>

                {/* Common Login Route for Staff and Principal */}
                <Route element={<PrincipalLoginRoute />}>
                  <Route path="/login" element={<PrincipalLogin />} />
                </Route>
                <Route path="/principal/login" element={<Navigate to="/login" replace />} />

                {/* Staff First-Login One-Time Setup */}
                <Route path="/login/setup" element={<StaffAccountSetup />} />
                <Route path="/staff/setup" element={<Navigate to="/login/setup" replace />} />

                {/* Principal School Setup Onboarding Wizard */}
                <Route path="/principal/setup-school" element={<SchoolSetupWizard />} />

                {/* Admin Protected Portal */}
                <Route element={<AdminRoute />}>
                  <Route element={<AdminLayout />}>
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    <Route path="/admin/principals" element={<PrincipalsManagement />} />
                    <Route path="/admin/users" element={<PlatformUsersManagement />} />
                    <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                  </Route>
                </Route>

                {/* Legacy Super Admin URL Redirections */}
                <Route path="/super-admin/login" element={<Navigate to="/admin/login" replace />} />
                <Route path="/super-admin/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/super-admin/principals" element={<Navigate to="/admin/principals" replace />} />
                <Route path="/super-admin/users" element={<Navigate to="/admin/users" replace />} />
                <Route path="/super-admin/*" element={<Navigate to="/admin/dashboard" replace />} />

                {/* Principal & Staff Protected School Application */}
                <Route element={<PrincipalRoute />}>
                  <Route element={<AppLayout />}>
                    <Route index element={<AppIndexRoute />} />
                    <Route element={<PermissionRoute permission={Permission.MANAGE_STAFF} redirectTo="/students" />}>
                      <Route path="staff" element={<StaffList />} />
                      <Route path="manage-staff" element={<Navigate to="/staff" replace />} />
                    </Route>
                    <Route path="students" element={<StudentList />} />
                    <Route element={<PermissionRoute permission={Permission.MANAGE_SCHOOL} redirectTo="/" />}>
                      <Route path="manage-school" element={<ManageSchool />} />
                      <Route path="school-configuration" element={<Navigate to="/manage-school" replace />} />
                      <Route path="school-settings" element={<Navigate to="/manage-school" replace />} />
                    </Route>
                    <Route path="chat" element={<ChatPage />} />
                    <Route element={<PermissionRoute permission={Permission.VIEW_TIMETABLE} redirectTo="/" />}>
                      <Route path="timetable" element={<TimeTable />} />
                    </Route>
                  </Route>
                </Route>

                {/* Catch-all Fallback */}
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
