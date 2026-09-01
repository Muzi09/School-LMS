import React from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/context/ThemeContext"
import { AuthProvider } from "@/context/AuthContext"
import { queryClient } from "@/lib/queryClient"

// Layouts & Route Guards
import { AppLayout } from "@/components/layout/AppLayout"
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout"
import {
  SuperAdminRoute,
  PrincipalRoute,
  SuperAdminLoginRoute,
  PrincipalLoginRoute,
} from "@/components/auth/ProtectedRoute"

// Super Admin Pages
import { SuperAdminLogin } from "@/pages/super-admin/SuperAdminLogin"
import { SuperAdminDashboard } from "@/pages/super-admin/SuperAdminDashboard"
import { PrincipalsManagement } from "@/pages/super-admin/PrincipalsManagement"
import { PlatformUsersManagement } from "@/pages/super-admin/PlatformUsersManagement"

// Principal & Onboarding Pages
import { PrincipalLogin } from "@/pages/principal/PrincipalLogin"
import { SchoolSetupWizard } from "@/pages/principal/SchoolSetupWizard"

// School User Management Pages
import { StaffList } from "@/pages/user-management/staff/StaffList"
import { StudentList } from "@/pages/user-management/students/StudentList"

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="school-lms-theme">
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Super Admin Login (Only redirects if already Super Admin) */}
              <Route element={<SuperAdminLoginRoute />}>
                <Route path="/super-admin/login" element={<SuperAdminLogin />} />
              </Route>

              {/* Principal Login (Only redirects if already School Principal/Staff) */}
              <Route element={<PrincipalLoginRoute />}>
                <Route path="/principal/login" element={<PrincipalLogin />} />
              </Route>

              {/* Principal School Setup Onboarding Wizard */}
              <Route path="/principal/setup-school" element={<SchoolSetupWizard />} />

              {/* Super Admin Protected Portal */}
              <Route element={<SuperAdminRoute />}>
                <Route element={<SuperAdminLayout />}>
                  <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />
                  <Route path="/super-admin/principals" element={<PrincipalsManagement />} />
                  <Route path="/super-admin/users" element={<PlatformUsersManagement />} />
                  <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />
                </Route>
              </Route>

              {/* Principal & Staff Protected School Application */}
              <Route element={<PrincipalRoute />}>
                <Route element={<AppLayout />}>
                  <Route index element={<Navigate to="/staff" replace />} />
                  <Route path="staff" element={<StaffList />} />
                  <Route path="students" element={<StudentList />} />
                </Route>
              </Route>

              {/* Catch-all Fallback */}
              <Route path="*" element={<Navigate to="/principal/login" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
