import React from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/context/ThemeContext"
import { AuthProvider } from "@/context/AuthContext"
import { queryClient } from "@/lib/queryClient"

// Layouts & Route Guards
import { AppLayout } from "@/components/layout/AppLayout"
import { AdminLayout } from "@/components/layout/AdminLayout"
import {
  AdminRoute,
  PrincipalRoute,
  AdminLoginRoute,
  PrincipalLoginRoute,
  PermissionRoute,
  AppIndexRoute,
} from "@/components/auth/ProtectedRoute"
import { Permission } from "@/lib/permissions"

// Admin Pages
import { AdminLogin } from "@/pages/admin/Login"
import { AdminDashboard } from "@/pages/admin/Dashboard"
import { PrincipalsManagement } from "@/pages/admin/PrincipalsManagement"
import { PlatformUsersManagement } from "@/pages/admin/UsersManagement"

// Principal & Onboarding Pages
import { PrincipalLogin } from "@/pages/principal/Login"
import { SchoolSetupWizard } from "@/pages/principal/SchoolSetupWizard"

// Staff First Login Account Setup Page
import { StaffAccountSetup } from "@/pages/staff/StaffAccountSetup"

// School User Management Pages
import { StaffList } from "@/pages/user-management/staff/StaffList"
import { StudentList } from "@/pages/user-management/students/StudentList"

// Chat Page
import { ChatPage } from "@/pages/chat/ChatPage"

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="school-lms-theme">
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Admin Login (Only redirects if already Admin) */}
              <Route element={<AdminLoginRoute />}>
                <Route path="/admin/login" element={<AdminLogin />} />
              </Route>

              {/* Unified Login Route for Principal and Staff */}
              <Route element={<PrincipalLoginRoute />}>
                <Route path="/login" element={<PrincipalLogin />} />
                <Route path="/principal/login" element={<PrincipalLogin />} />
              </Route>

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
                  <Route path="chat" element={<ChatPage />} />
                </Route>
              </Route>

              {/* Catch-all Fallback */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
