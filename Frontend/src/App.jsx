import React from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/context/ThemeContext"
import { AppLayout } from "@/components/layout/AppLayout"
import { queryClient } from "@/lib/queryClient"

// User management pages
import { StaffList } from "@/pages/user-management/staff/StaffList"
import { StudentList } from "@/pages/user-management/students/StudentList"

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="school-lms-theme">
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/staff" replace />} />
              <Route path="staff" element={<StaffList />} />
              <Route path="students" element={<StudentList />} />
              <Route path="*" element={<Navigate to="/staff" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
