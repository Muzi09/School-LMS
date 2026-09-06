import React from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"

export function AdminRoute() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

export function PrincipalRoute() {
  const { isAuthenticated, user, isAdmin, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // If Admin is logged in, do not let them access school application routes directly
  if (!isAuthenticated || isAdmin) {
    return <Navigate to="/principal/login" state={{ from: location }} replace />
  }

  // If user is a Principal and setup is pending, force them to onboarding wizard
  if (user?.role === 1 && !user?.school_setup_completed) {
    return <Navigate to="/principal/setup-school" replace />
  }

  return <Outlet />
}

export function AdminLoginRoute() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (isAuthenticated && isAdmin) {
    return <Navigate to="/admin/dashboard" replace />
  }

  return <Outlet />
}

export function PrincipalLoginRoute() {
  const { isAuthenticated, user, isAdmin, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Only redirect if authenticated as a School User (Principal, Staff, etc.).
  // If authenticated as Admin, allow them to view and log in to the Principal portal without conflict.
  if (isAuthenticated && !isAdmin) {
    if (user?.role === 1 && !user?.school_setup_completed) {
      return <Navigate to="/principal/setup-school" replace />
    }
    return <Navigate to="/staff" replace />
  }

  return <Outlet />
}

// Backward compatibility aliases
export const SuperAdminRoute = AdminRoute
export const SuperAdminLoginRoute = AdminLoginRoute
