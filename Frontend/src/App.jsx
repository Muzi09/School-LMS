import React from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ThemeProvider } from "@/context/ThemeContext"
import { AppLayout } from "@/components/layout/AppLayout"
import DashboardPage from "@/pages/DashboardPage"
import CoursesPage from "@/pages/CoursesPage"
import StudentsPage from "@/pages/StudentsPage"
import AssignmentsPage from "@/pages/AssignmentsPage"
import SettingsPage from "@/pages/SettingsPage"

export function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="school-lms-theme">
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="schedule" element={<DashboardPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="teachers" element={<StudentsPage />} />
            <Route path="assignments" element={<AssignmentsPage />} />
            <Route path="gradebook" element={<AssignmentsPage />} />
            <Route path="attendance" element={<StudentsPage />} />
            <Route path="analytics" element={<DashboardPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App


